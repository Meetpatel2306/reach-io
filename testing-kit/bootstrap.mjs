#!/usr/bin/env node
// Fully dynamic bootstrap — works for any project in this monorepo.
//
// Usage from the monorepo root:
//   node testing-kit/bootstrap.mjs <project-folder> [--dry-run] [--no-install]
//   node testing-kit/bootstrap.mjs --all [--dry-run] [--no-install]
//
// What it does (per project):
//   1. Detects language (Node vs Python) and framework (Next/Vite/CRA/Remix/Astro/Express,
//      or FastAPI/Flask/Streamlit/Django).
//   2. Picks a unique HTTP port for E2E that doesn't collide with any other project.
//   3. Reads tsconfig.json paths to auto-discover the source alias ('@' or whatever).
//   4. Generates the right config files + starter tests + npm/pytest scripts for that stack.
//   5. Re-runnable: skips files that already exist; only adds missing scripts.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeProject, collectUsedPorts, pickPort } from './lib/detect.mjs';

const KIT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(KIT_DIR, '..');

// ─────────────────────────── arg parsing ───────────────────────────
const args = process.argv.slice(2);
const flags = {
  all: args.includes('--all'),
  dryRun: args.includes('--dry-run'),
  noInstall: args.includes('--no-install'),
};
const positional = args.filter((a) => !a.startsWith('--'));

if (!flags.all && positional.length === 0) {
  console.error([
    'usage:',
    '  node testing-kit/bootstrap.mjs <project-folder> [--dry-run] [--no-install]',
    '  node testing-kit/bootstrap.mjs --all [--dry-run] [--no-install]',
    '',
    'flags:',
    '  --all          bootstrap every project in the monorepo',
    '  --dry-run      print what would happen, do not write files or install',
    '  --no-install   skip dep install (just write configs/templates)',
  ].join('\n'));
  process.exit(1);
}

const log = (m) => process.stdout.write(`[testing-kit] ${m}\n`);
const warn = (m) => process.stderr.write(`[testing-kit][warn] ${m}\n`);

// ─────────────────────────── per-project bootstrap ───────────────────────────

function bootstrapProject(target, sharedUsedPorts) {
  const projectDir = resolve(REPO_ROOT, target);
  if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) {
    warn(`skip ${target}: not a directory`);
    return;
  }

  const info = describeProject(projectDir, REPO_ROOT);

  if (info.language === 'unknown') {
    warn(`skip ${target}: no package.json / requirements.txt / pyproject.toml`);
    return;
  }

  log(`── ${target} → language=${info.language}, framework=${info.framework ?? '-'}`);

  if (info.language === 'node') return bootstrapNode(target, projectDir, info, sharedUsedPorts);
  if (info.language === 'python') return bootstrapPython(target, projectDir, info);
}

// ─────────────────────────── Node (vitest + playwright) ───────────────────────────

function bootstrapNode(target, projectDir, info, sharedUsedPorts) {
  const pkgPath = join(projectDir, 'package.json');
  const kitRel = relative(projectDir, KIT_DIR).replace(/\\/g, '/');

  // Re-pick port using the shared set so multiple bootstraps in --all don't collide.
  const port = pickPort(sharedUsedPorts);
  sharedUsedPorts.add(port);
  const web = info.webServer.command.replace(/-p \d+|--port[\s=]\d+/g, (m) => m.replace(/\d+/, String(port)))
    .replace(/-l \d+/, `-l ${port}`);

  // 1. Install deps
  if (!flags.noInstall && !flags.dryRun) {
    log(`installing test deps in ${target}…`);
    const deps = [
      'vitest@^2.1.8',
      '@vitest/ui@^2.1.8',
      'jsdom@^25.0.1',
      '@vitejs/plugin-react@^4.3.4',
      '@playwright/test@^1.49.1',
    ];
    if (info.hasReact) {
      deps.push(
        '@testing-library/react@^16.1.0',
        '@testing-library/dom@^10.4.0',
        '@testing-library/jest-dom@^6.6.3',
        '@testing-library/user-event@^14.5.2',
      );
    }
    try {
      execSync(`npm install --save-dev ${deps.join(' ')}`, { cwd: projectDir, stdio: 'inherit' });
    } catch (e) {
      warn(`npm install failed in ${target} — continuing with config write. (${e.message})`);
    }
  } else if (flags.dryRun) {
    log(`[dry-run] would install vitest + RTL + playwright in ${target}`);
  }

  // 2. Write vitest config
  const vitestConfigPath = join(projectDir, 'vitest.config.ts');
  const vitestBody =
    `import { createVitestConfig } from '${kitRel}/configs/vitest.config';\n` +
    `\n` +
    `export default createVitestConfig({\n` +
    `  srcAlias: '${info.srcAlias}',\n` +
    `  srcRoot: '${info.srcRoot}',\n` +
    `  testsDir: 'tests',\n` +
    (info.hasReact ? `` : `  disableReact: true,\n`) +
    `});\n`;
  writeFileMaybe(vitestConfigPath, vitestBody, 'vitest.config.ts');

  // 3. Write playwright config
  const playwrightConfigPath = join(projectDir, 'playwright.config.ts');
  const pwBody =
    `import { createPlaywrightConfig } from '${kitRel}/configs/playwright.config';\n` +
    `\n` +
    `export default createPlaywrightConfig({\n` +
    `  port: ${port},\n` +
    `  command: '${web}',\n` +
    `});\n`;
  writeFileMaybe(playwrightConfigPath, pwBody, 'playwright.config.ts');

  // 4. tests/ + e2e/ starter files
  const testsDir = join(projectDir, 'tests');
  const e2eDir = join(projectDir, 'e2e');
  if (!existsSync(testsDir)) {
    if (flags.dryRun) log(`[dry-run] would create tests/starter.test.ts`);
    else {
      mkdirSync(testsDir, { recursive: true });
      copyFileSync(join(KIT_DIR, 'templates/unit.test.template.ts'), join(testsDir, 'starter.test.ts'));
      log(`created tests/starter.test.ts`);
    }
  }
  if (!existsSync(e2eDir)) {
    if (flags.dryRun) log(`[dry-run] would create e2e/starter.spec.ts`);
    else {
      mkdirSync(e2eDir, { recursive: true });
      copyFileSync(join(KIT_DIR, 'templates/e2e.smoke.template.spec.ts'), join(e2eDir, 'starter.spec.ts'));
      log(`created e2e/starter.spec.ts`);
    }
  }

  // 5. Patch package.json scripts
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  const before = { ...pkg.scripts };
  pkg.scripts.test = pkg.scripts.test ?? 'vitest run';
  pkg.scripts['test:watch'] = pkg.scripts['test:watch'] ?? 'vitest';
  pkg.scripts['test:e2e'] = pkg.scripts['test:e2e'] ?? 'playwright test';
  pkg.scripts['test:e2e:ui'] = pkg.scripts['test:e2e:ui'] ?? 'playwright test --ui';
  pkg.scripts['test:all'] = pkg.scripts['test:all'] ?? 'vitest run && playwright test';
  if (info.hasTypeScript) {
    pkg.scripts.typecheck = pkg.scripts.typecheck ?? 'tsc --noEmit';
  }
  const added = Object.keys(pkg.scripts).filter((k) => !(k in before));
  if (added.length) {
    if (flags.dryRun) log(`[dry-run] would add scripts: ${added.join(', ')}`);
    else {
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      log(`added scripts: ${added.join(', ')}`);
    }
  }

  log(`✓ ${target}: ready (port ${port}, framework ${info.framework})`);
}

// ─────────────────────────── Python (pytest) ───────────────────────────

function bootstrapPython(target, projectDir, info) {
  // 1. Install deps via pip if user did not opt out
  if (!flags.noInstall && !flags.dryRun) {
    const pipDeps = ['pytest>=8', 'pytest-asyncio>=0.24'];
    if (info.framework === 'fastapi') pipDeps.push('httpx>=0.27');
    if (info.framework === 'flask') pipDeps.push('flask-testing');
    log(`installing pytest deps in ${target}: ${pipDeps.join(', ')}`);
    try {
      execSync(`pip install ${pipDeps.map((d) => `"${d}"`).join(' ')}`, { cwd: projectDir, stdio: 'inherit' });
    } catch (e) {
      warn(`pip install failed in ${target} — continuing with config write. (${e.message})`);
    }
  } else if (flags.dryRun) {
    log(`[dry-run] would pip install pytest + ${info.framework}-specific helpers`);
  }

  // 2. Write pytest.ini if missing
  const pytestIniPath = join(projectDir, 'pytest.ini');
  const pytestIni = readFile(join(KIT_DIR, 'configs/pytest.ini'));
  writeFileMaybe(pytestIniPath, pytestIni, 'pytest.ini');

  // 3. tests/ folder + conftest + starter
  const testsDir = join(projectDir, 'tests');
  if (!existsSync(testsDir)) {
    if (flags.dryRun) log(`[dry-run] would create tests/`);
    else {
      mkdirSync(testsDir, { recursive: true });
      log(`created tests/`);
    }
  }

  const conftestPath = join(testsDir, 'conftest.py');
  if (!existsSync(conftestPath)) {
    const body = readFile(join(KIT_DIR, 'setup/conftest.py'));
    writeFileMaybe(conftestPath, body, 'tests/conftest.py');
  }

  const starter = join(testsDir, 'test_starter.py');
  if (!existsSync(starter)) {
    if (flags.dryRun) log(`[dry-run] would create tests/test_starter.py`);
    else {
      copyFileSync(join(KIT_DIR, 'templates/unit.test.template.py'), starter);
      log(`created tests/test_starter.py`);
    }
  }

  if (info.framework === 'fastapi') {
    const apiTest = join(testsDir, 'test_api_starter.py');
    if (!existsSync(apiTest)) {
      if (flags.dryRun) log(`[dry-run] would create tests/test_api_starter.py`);
      else {
        copyFileSync(join(KIT_DIR, 'templates/api.test.template.py'), apiTest);
        log(`created tests/test_api_starter.py`);
      }
    }
  }

  log(`✓ ${target}: ready (pytest, framework ${info.framework})`);
}

// ─────────────────────────── helpers ───────────────────────────

function writeFileMaybe(path, content, label) {
  if (existsSync(path)) {
    log(`${label} already exists — skipped`);
    return;
  }
  if (flags.dryRun) {
    log(`[dry-run] would write ${label}`);
    return;
  }
  writeFileSync(path, content);
  log(`wrote ${label}`);
}

function readFile(path) {
  return readFileSync(path, 'utf8');
}

function listProjects() {
  return readdirSync(REPO_ROOT)
    .filter((n) => !n.startsWith('.') && n !== 'node_modules' && n !== 'testing-kit' && n !== '__pycache__')
    .filter((n) => statSync(join(REPO_ROOT, n)).isDirectory())
    .filter((n) => {
      const p = join(REPO_ROOT, n);
      return existsSync(join(p, 'package.json'))
        || existsSync(join(p, 'requirements.txt'))
        || existsSync(join(p, 'pyproject.toml'));
    });
}

// ─────────────────────────── main ───────────────────────────

const sharedUsedPorts = collectUsedPorts(REPO_ROOT);
const targets = flags.all ? listProjects() : positional;

if (targets.length === 0) {
  warn('no projects found to bootstrap.');
  process.exit(0);
}

if (flags.all) log(`bootstrapping ${targets.length} project(s): ${targets.join(', ')}`);

for (const t of targets) {
  try {
    bootstrapProject(t, sharedUsedPorts);
  } catch (e) {
    warn(`failed on ${t}: ${e.message}`);
  }
}

log(`done.`);
