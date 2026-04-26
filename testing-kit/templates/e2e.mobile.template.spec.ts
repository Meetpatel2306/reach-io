// E2E mobile-viewport template — runs against an emulated phone.
// Add this to your playwright.config projects[] to run as a separate suite, or use test.use().

import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPhone 13'] });

test('home loads on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});

test('mobile menu toggles', async ({ page }) => {
  await page.goto('/');
  // Most apps show a hamburger on mobile and a horizontal nav on desktop.
  const burger = page.getByRole('button', { name: /menu|navigation/i });
  if (await burger.isVisible()) {
    await burger.click();
    await expect(page.getByRole('navigation')).toBeVisible();
  }
});

test('viewport sizes match the emulated device', async ({ page }) => {
  const size = page.viewportSize();
  expect(size?.width).toBeLessThan(500);
});

test('no horizontal scroll on the home page', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });
  expect(overflow).toBe(false);
});

test('tap target sizes are at least 32px (loose check)', async ({ page }) => {
  await page.goto('/');
  const buttons = await page.getByRole('button').all();
  for (const b of buttons.slice(0, 10)) {
    const box = await b.boundingBox();
    if (!box) continue;
    expect(box.height).toBeGreaterThanOrEqual(32);
  }
});
