// Detection helpers — figure out language/framework/conventions for a target project.
// Pure functions, no side effects.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Read JSON if the file exists, else return null. */
export function readJson(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
}

/** Read a text file if it exists, else return ''. */
export function readText(path) {
  if (!existsSync(path)) return '';
  try { return readFileSync(path, 'utf8'); }
  catch { return ''; }
}

/** Detect the language of a project folder. */
export function detectLanguage(projectDir) {
  if (existsSync(join(projectDir, 'package.json'))) return 'node';
  if (
    existsSync(join(projectDir, 'requirements.txt')) ||
    existsSync(join(projectDir, 'pyproject.toml')) ||
    existsSync(join(projectDir, 'setup.py'))
  ) return 'python';
  return 'unknown';
}

/**
 * Detect the JS framework + meta from a Node project.
 * Returns { framework, runtime, hasReact, hasTypeScript, port, devCommand, startCommand }
 */
export function detectNodeProject(projectDir) {
  const pkg = readJson(join(projectDir, 'package.json')) || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const scripts = pkg.scripts || {};

  let framework = 'node';
  if (deps.next) framework = 'next';
  else if (deps['@remix-run/react']) framework = 'remix';
  else if (deps.vite || scripts.dev?.includes('vite')) framework = 'vite';
  else if (deps['react-scripts']) framework = 'cra';
  else if (deps.astro) framework = 'astro';
  else if (deps.express || deps.fastify || deps.hono || deps.koa) framework = 'node-server';

  return {
    framework,
    runtime: 'node',
    hasReact: !!deps.react,
    hasTypeScript: !!deps.typescript || existsSync(join(projectDir, 'tsconfig.json')),
    scripts,
    pkg,
  };
}

/**
 * Detect the Python framework from requirements.
 */
export function detectPythonProject(projectDir) {
  const req = readText(join(projectDir, 'requirements.txt')).toLowerCase();
  const pyproj = readText(join(projectDir, 'pyproject.toml')).toLowerCase();
  const all = req + '\n' + pyproj;

  let framework = 'python';
  if (all.includes('fastapi')) framework = 'fastapi';
  else if (all.includes('flask')) framework = 'flask';
  else if (all.includes('streamlit')) framework = 'streamlit';
  else if (all.includes('django')) framework = 'django';

  const hasPytest = all.includes('pytest');
  return { framework, hasPytest };
}

/** Pick a likely source directory: src/ then app/ then root. */
export function detectSrcRoot(projectDir) {
  if (existsSync(join(projectDir, 'src'))) return 'src';
  if (existsSync(join(projectDir, 'app'))) return 'app';
  return '.';
}

/** Read tsconfig.json paths and return the first alias key (e.g. '@'). */
export function detectAlias(projectDir) {
  const ts = readJson(join(projectDir, 'tsconfig.json'));
  const paths = ts?.compilerOptions?.paths || {};
  const keys = Object.keys(paths);
  for (const k of keys) {
    // Match "@/*" → "@"
    const m = k.match(/^([^/*]+)\/\*$/);
    if (m) return m[1];
  }
  return '@';
}

/**
 * Build the Playwright web-server command for a Node project.
 * Picks the best command + tells the caller whether the project needs `npm run build` first.
 */
export function detectWebServer(projectDir, port) {
  const pkg = readJson(join(projectDir, 'package.json')) || {};
  const scripts = pkg.scripts || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  if (deps.next) {
    // Prefer `next start` (production) but fall back to `next dev` when no build exists.
    return {
      command: `npx next start -p ${port}`,
      devCommand: `npx next dev -p ${port}`,
      needsBuild: true,
    };
  }
  if (deps.vite) {
    return {
      command: scripts.preview ? `npm run preview -- --port ${port}` : `npx vite preview --port ${port}`,
      devCommand: scripts.dev ? `npm run dev -- --port ${port}` : `npx vite --port ${port}`,
      needsBuild: true,
    };
  }
  if (scripts.start) {
    return { command: `npm start -- -p ${port}`, devCommand: scripts.dev ? `npm run dev` : null, needsBuild: false };
  }
  // Static fallback
  return { command: `npx serve -l ${port} .`, devCommand: null, needsBuild: false };
}

/**
 * Scan the monorepo for already-bootstrapped projects and the ports they use,
 * so a fresh project can be assigned a port that doesn't collide.
 */
export function collectUsedPorts(repoRoot) {
  const used = new Set();
  let entries = [];
  try { entries = readdirSync(repoRoot); } catch { return used; }

  for (const name of entries) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const p = join(repoRoot, name);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (!s.isDirectory()) continue;
    const cfg = join(p, 'playwright.config.ts');
    if (!existsSync(cfg)) continue;
    const text = readText(cfg);
    // Catch all common port declarations: `port: 3100`, `const port = 3100`, `const PORT = 3100`,
    // `-p 3100`, `--port 3100`, `--port=3100`, `localhost:3100`.
    const patterns = [
      /\b[Pp][Oo][Rr][Tt]\s*[:=]\s*(\d{4,5})\b/g,
      /-p\s+(\d{4,5})\b/g,
      /--port[\s=](\d{4,5})\b/g,
      /localhost:(\d{4,5})\b/g,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(text)) !== null) used.add(Number(m[1]));
    }
  }
  return used;
}

/** Pick the lowest port in [start, start+limit] not already in `used`. */
export function pickPort(used, start = 3100, limit = 50) {
  for (let p = start; p < start + limit; p++) {
    if (!used.has(p)) return p;
  }
  return start; // fallback — caller may collide, but that's better than crashing
}

/** Prepare a one-shot summary object — callers use this for logging + decisions. */
export function describeProject(projectDir, repoRoot) {
  const language = detectLanguage(projectDir);
  if (language === 'node') {
    const node = detectNodeProject(projectDir);
    const used = collectUsedPorts(repoRoot);
    const port = pickPort(used);
    const web = detectWebServer(projectDir, port);
    return {
      language,
      ...node,
      srcRoot: detectSrcRoot(projectDir),
      srcAlias: detectAlias(projectDir),
      port,
      webServer: web,
    };
  }
  if (language === 'python') {
    const py = detectPythonProject(projectDir);
    return { language, ...py };
  }
  return { language };
}
