// Reusable Vitest config factory.
//
// Usage in your project:
//   import { createVitestConfig } from '../testing-kit/configs/vitest.config';
//   export default createVitestConfig();                        // auto-detects everything
//   export default createVitestConfig({ srcAlias: '@' });       // override one thing

import { defineConfig, type UserConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

interface KitOptions {
  /** Project root (default: process.cwd()) */
  projectRoot?: string;
  /** Path-alias key, e.g. '@'. If omitted, auto-detected from tsconfig.json paths. */
  srcAlias?: string;
  /** Source folder mapped to the alias. If omitted, auto-detects 'src' → 'app' → '.'. */
  srcRoot?: string;
  /** Tests directory (default: 'tests') */
  testsDir?: string;
  /** Setup file paths to load before tests */
  setupFiles?: string[];
  /** Extra files/folders to exclude */
  extraExclude?: string[];
  /** Disable React plugin (use for non-React projects) */
  disableReact?: boolean;
}

function readJson(p: string): any {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function autoAlias(projectRoot: string): { key: string; target: string } | null {
  const ts = readJson(path.join(projectRoot, 'tsconfig.json'));
  const paths = ts?.compilerOptions?.paths || {};
  for (const k of Object.keys(paths)) {
    const m = k.match(/^([^/*]+)\/\*$/);
    if (!m) continue;
    const target = paths[k]?.[0]?.replace(/\/\*$/, '');
    if (!target) continue;
    return { key: m[1], target };
  }
  return null;
}

function autoSrcRoot(projectRoot: string): string {
  if (existsSync(path.join(projectRoot, 'src'))) return 'src';
  if (existsSync(path.join(projectRoot, 'app'))) return 'app';
  return '.';
}

export function createVitestConfig(opts: KitOptions = {}): UserConfig {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const detected = autoAlias(projectRoot);
  const srcAlias = opts.srcAlias ?? detected?.key ?? '@';
  const srcRoot = opts.srcRoot ?? detected?.target ?? autoSrcRoot(projectRoot);
  const testsDir = opts.testsDir ?? 'tests';
  const kitSetup = path.resolve(__dirname, '../setup/test-setup.ts');

  return defineConfig({
    plugins: opts.disableReact ? [] : [react()],
    resolve: {
      alias: { [srcAlias]: path.resolve(projectRoot, srcRoot) },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      css: false,
      setupFiles: [kitSetup, ...(opts.setupFiles ?? [])],
      include: [`${testsDir}/**/*.test.{ts,tsx,js,jsx}`],
      exclude: ['e2e/**', 'node_modules/**', '.next/**', 'dist/**', ...(opts.extraExclude ?? [])],
    },
  });
}

export default createVitestConfig;
