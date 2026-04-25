// Reusable Vitest config factory.
//
// Usage in your project:
//   import { createVitestConfig } from '../testing-kit/configs/vitest.config';
//   export default createVitestConfig({ srcAlias: '@', srcRoot: 'src' });

import { defineConfig, type UserConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

interface KitOptions {
  /** Project root (default: process.cwd()) */
  projectRoot?: string;
  /** Path-alias key, e.g. '@' (default: '@') */
  srcAlias?: string;
  /** Source folder mapped to the alias (default: 'src') */
  srcRoot?: string;
  /** Tests directory (default: 'tests') */
  testsDir?: string;
  /** Setup file paths to load before tests */
  setupFiles?: string[];
  /** Extra files/folders to exclude */
  extraExclude?: string[];
}

export function createVitestConfig(opts: KitOptions = {}): UserConfig {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const srcAlias = opts.srcAlias ?? '@';
  const srcRoot = opts.srcRoot ?? 'src';
  const testsDir = opts.testsDir ?? 'tests';
  const kitSetup = path.resolve(__dirname, '../setup/test-setup.ts');

  return defineConfig({
    plugins: [react()],
    resolve: {
      alias: { [srcAlias]: path.resolve(projectRoot, srcRoot) },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      css: false,
      setupFiles: [kitSetup, ...(opts.setupFiles ?? [])],
      include: [`${testsDir}/**/*.test.{ts,tsx}`],
      exclude: ['e2e/**', 'node_modules/**', '.next/**', ...(opts.extraExclude ?? [])],
    },
  });
}

export default createVitestConfig;
