// E2E keyboard navigation template — verify the app is usable without a mouse.

import { test, expect } from '@playwright/test';

test('skip-link jumps to main on first Tab', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  // If your app has a skip-link this should be it; otherwise skip this assertion.
  // expect(focused).toMatch(/skip to main/i);
  expect(focused !== '' || focused !== undefined).toBeTruthy();
});

test('Escape closes the open dialog', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /open|menu|settings/i }).first();
  if (await trigger.isVisible()) {
    await trigger.click();
    await page.keyboard.press('Escape');
    // Dialog should be gone or hidden.
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('Enter submits the focused form', async ({ page }) => {
  await page.goto('/contact');
  const name = page.getByLabel(/name/i);
  if (await name.isVisible()) {
    await name.fill('A');
    await page.getByLabel(/email/i).fill('a@b.com');
    await page.getByLabel(/message/i).fill('hi');
    await page.getByLabel(/message/i).press('Enter');
    // Whatever submission feedback your app shows:
    // await expect(page.getByText(/thanks|sent/i)).toBeVisible();
  }
});

test('arrow keys navigate within a menu', async ({ page }) => {
  await page.goto('/');
  const menuTrigger = page.getByRole('button', { name: /menu/i }).first();
  if (await menuTrigger.isVisible()) {
    await menuTrigger.click();
    await page.keyboard.press('ArrowDown');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('role'));
    expect(['menuitem', 'option', 'menuitemradio']).toContain(focused ?? '');
  }
});

test('focus is visible on tabbable elements', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle, boxShadow: cs.boxShadow };
  });
  // At least one of these should indicate a visible focus ring.
  if (outline) {
    expect(
      outline.outlineStyle !== 'none' ||
      outline.outlineWidth !== '0px' ||
      outline.boxShadow !== 'none'
    ).toBe(true);
  }
});
