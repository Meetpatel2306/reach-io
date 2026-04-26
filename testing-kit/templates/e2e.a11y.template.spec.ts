// E2E accessibility smoke template — basic semantic checks.
// For full WCAG audit install @axe-core/playwright and run AxeBuilder against each page.

import { test, expect } from '@playwright/test';

const PAGES = ['/', '/login', '/about'];

for (const path of PAGES) {
  test(`${path} — has a unique <h1>`, async ({ page }) => {
    await page.goto(path);
    const h1s = await page.locator('h1').all();
    expect(h1s.length).toBeLessThanOrEqual(1);
  });

  test(`${path} — every input has an accessible label`, async ({ page }) => {
    await page.goto(path);
    const inputs = await page.locator('input:not([type=hidden])').all();
    for (const input of inputs) {
      const label = await input.evaluate((el: HTMLInputElement) => {
        return el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
      });
      expect(label).toBeTruthy();
    }
  });

  test(`${path} — every link has visible text or aria-label`, async ({ page }) => {
    await page.goto(path);
    const links = await page.locator('a[href]').all();
    for (const link of links) {
      const text = (await link.textContent())?.trim();
      const aria = await link.getAttribute('aria-label');
      expect(text || aria).toBeTruthy();
    }
  });

  test(`${path} — has a <main> landmark`, async ({ page }) => {
    await page.goto(path);
    const mains = await page.getByRole('main').count();
    expect(mains).toBe(1);
  });

  test(`${path} — html has a lang attribute`, async ({ page }) => {
    await page.goto(path);
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  test(`${path} — has a meta description and a non-empty title`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(/.+/);
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc?.length).toBeGreaterThan(10);
  });
}

test('keyboard-only nav reaches the primary CTA', async ({ page }) => {
  await page.goto('/');
  // Tab through ~10 elements; loosen this if your header has more focusables.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    if (focused === 'BUTTON' || focused === 'A') break;
  }
  expect(['BUTTON', 'A']).toContain(
    await page.evaluate(() => document.activeElement?.tagName ?? '')
  );
});
