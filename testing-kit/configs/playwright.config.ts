// Reusable Playwright config factory.
//
// Usage in your project:
//   import { createPlaywrightConfig } from '../testing-kit/configs/playwright.config';
//   export default createPlaywrightConfig({ port: 3100, command: 'npx next start -p 3100' });

import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

interface KitOptions {
  /** Port your dev server listens on (default: 3100) */
  port?: number;
  /** Shell command Playwright should run to start the server */
  command?: string;
  /** Test directory (default: 'e2e') */
  testDir?: string;
  /** Reuse the dev server when running locally */
  reuseExistingServer?: boolean;
  /** Extra Playwright projects (e.g. firefox, webkit) */
  extraProjects?: PlaywrightTestConfig['projects'];
}

export function createPlaywrightConfig(opts: KitOptions = {}): PlaywrightTestConfig {
  const port = opts.port ?? 3100;
  const baseURL = `http://localhost:${port}`;

  return defineConfig({
    testDir: opts.testDir ?? './e2e',
    testMatch: '**/*.spec.ts',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['list'], ['html', { open: 'never' }]],
    timeout: 30_000,
    expect: { timeout: 5_000 },

    use: {
      baseURL,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
      permissions: ['notifications'],
    },

    projects: [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      ...(opts.extraProjects ?? []),
    ],

    webServer: opts.command
      ? {
          command: opts.command,
          url: baseURL,
          reuseExistingServer: opts.reuseExistingServer ?? !process.env.CI,
          timeout: 120_000,
          stdout: 'ignore',
          stderr: 'pipe',
        }
      : undefined,
  });
}

export default createPlaywrightConfig;
