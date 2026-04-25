#!/usr/bin/env node
// Bootstrap a Next.js / React project to use the shared testing-kit.
//
// Usage from the monorepo root:
//   node testing-kit/bootstrap.mjs <project-folder>
//
// Example:
//   node testing-kit/bootstrap.mjs task-manager
//   node testing-kit/bootstrap.mjs email-blaster
//
// What this does:
//   1. Verifies the target folder exists and has a package.json
//   2. Installs vitest + RTL + jsdom + @vitejs/plugin-react + @playwright/test as devDeps
//   3. Writes vitest.config.ts and playwright.config.ts that re-export the shared kit configs
//   4. Creates tests/ and e2e/ folders with one starter test each
//   5. Adds npm scripts: test, test:watch, test:e2e, test:all, typecheck

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(KIT_DIR, '..');

const target = process.argv[2];
if (!target) {
  console.error('usage: node testing-kit/bootstrap.mjs <project-folder>');
  process.exit(1);
}

const projectDir = resolve(REPO_ROOT, target);
if (!existsSync(projectDir)) {
  console.error(`Folder not found: ${projectDir}`);
  process.exit(1);
}
const pkgPath = join(projectDir, 'package.json');
if (!existsSync(pkgPath)) {
  console.error(`No package.json in: ${projectDir}`);
  process.exit(1);
}

const log = (m) => process.stdout.write(`[testing-kit] ${m}\n`);

// ── 1. Install dev deps ──
log(`Installing test deps in ${target}...`);
const deps = [
  'vitest@^2.1.8',
  '@vitest/ui@^2.1.8',
  'jsdom@^25.0.1',
  '@testing-library/react@^16.1.0',
  '@testing-library/dom@^10.4.0',
  '@testing-library/jest-dom@^6.6.3',
  '@testing-library/user-event@^14.5.2',
  '@vitejs/plugin-react@^4.3.4',
  '@playwright/test@^1.49.1',
];
execSync(`npm install --save-dev ${deps.join(' ')}`, { cwd: projectDir, stdio: 'inherit' });

// ── 2. Compute relative path from project to kit ──
const kitRel = relative(projectDir, KIT_DIR).replace(/\\/g, '/');

// ── 3. Write vitest config ──
const vitestConfigPath = join(projectDir, 'vitest.config.ts');
if (!existsSync(vitestConfigPath)) {
  writeFileSync(
    vitestConfigPath,
    `import { createVitestConfig } from '${kitRel}/configs/vitest.config';\n\nexport default createVitestConfig({\n  srcAlias: '@',\n  srcRoot: 'src',\n  testsDir: 'tests',\n});\n`
  );
  log(`wrote vitest.config.ts`);
} else {
  log(`vitest.config.ts already exists — skipped`);
}

// ── 4. Write playwright config ──
const playwrightConfigPath = join(projectDir, 'playwright.config.ts');
if (!existsSync(playwrightConfigPath)) {
  // Try to detect a likely start command (next start or vite preview)
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const startCmd = pkg.scripts?.start
    ? `npm start -- -p 3100`
    : pkg.scripts?.preview
      ? `npm run preview -- --port 3100`
      : `npx serve -l 3100 .`;
  writeFileSync(
    playwrightConfigPath,
    `import { createPlaywrightConfig } from '${kitRel}/configs/playwright.config';\n\nexport default createPlaywrightConfig({\n  port: 3100,\n  command: '${startCmd}',\n});\n`
  );
  log(`wrote playwright.config.ts (start command: ${startCmd})`);
} else {
  log(`playwright.config.ts already exists — skipped`);
}

// ── 5. Create tests/ and e2e/ with one starter each ──
const testsDir = join(projectDir, 'tests');
const e2eDir = join(projectDir, 'e2e');
if (!existsSync(testsDir)) {
  mkdirSync(testsDir, { recursive: true });
  copyFileSync(join(KIT_DIR, 'templates/unit.test.template.ts'), join(testsDir, 'starter.test.ts'));
  log(`created tests/starter.test.ts`);
}
if (!existsSync(e2eDir)) {
  mkdirSync(e2eDir, { recursive: true });
  copyFileSync(join(KIT_DIR, 'templates/e2e.smoke.template.spec.ts'), join(e2eDir, 'starter.spec.ts'));
  log(`created e2e/starter.spec.ts`);
}

// ── 6. Patch package.json scripts ──
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const before = { ...pkg.scripts };
pkg.scripts.test = pkg.scripts.test ?? 'vitest run';
pkg.scripts['test:watch'] = pkg.scripts['test:watch'] ?? 'vitest';
pkg.scripts['test:e2e'] = pkg.scripts['test:e2e'] ?? 'playwright test';
pkg.scripts['test:e2e:ui'] = pkg.scripts['test:e2e:ui'] ?? 'playwright test --ui';
pkg.scripts['test:all'] = pkg.scripts['test:all'] ?? 'vitest run && playwright test';
pkg.scripts.typecheck = pkg.scripts.typecheck ?? 'tsc --noEmit';
const added = Object.keys(pkg.scripts).filter((k) => !(k in before));
if (added.length) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  log(`added scripts: ${added.join(', ')}`);
}

log(`✓ Done. Next steps in ${target}:`);
log(`    npx playwright install chromium    # one-time, ~110MB`);
log(`    npm test                           # unit tests`);
log(`    npm run test:e2e                   # browser tests`);
log(`    npm run test:all                   # everything`);
