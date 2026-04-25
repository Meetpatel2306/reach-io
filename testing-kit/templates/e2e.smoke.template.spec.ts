// Playwright E2E smoke template — copy into your project's e2e/ folder, rename, edit selectors.
// Run: npm run test:e2e

import { test, expect, type Page } from '@playwright/test';

// Example helper — pre-set localStorage flags before any navigation.
async function dismissOnboarding(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('onboarding-done', 'true'); } catch {}
  });
}

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(['notifications']);
  await dismissOnboarding(page);
});

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});

test('a primary CTA is visible', async ({ page }) => {
  await page.goto('/');
  // Replace with your actual CTA — getByRole is more resilient than CSS selectors.
  // await expect(page.getByRole('button', { name: /Get Started/i })).toBeVisible();
  await expect(page.locator('body')).toBeVisible();
});

test('navigation works', async ({ page }) => {
  await page.goto('/');
  // await page.getByRole('link', { name: /About/i }).click();
  // await expect(page).toHaveURL(/about/);
});

test('persistence — reload preserves state', async ({ page }) => {
  await page.goto('/');
  // do something that writes to localStorage / IndexedDB
  await page.reload();
  // assert the state survived
  await expect(page.locator('body')).toBeVisible();
});
