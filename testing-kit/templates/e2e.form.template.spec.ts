// E2E form submission template — validation, success path, server error display.

import { test, expect } from '@playwright/test';

test.describe('contact form', () => {
  test('shows validation errors when fields are blank', async ({ page }) => {
    await page.goto('/contact');
    await page.getByRole('button', { name: /send|submit/i }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
  });

  test('submits successfully with valid input', async ({ page }) => {
    await page.goto('/contact');
    await page.getByLabel(/name/i).fill('Alice');
    await page.getByLabel(/email/i).fill('a@b.com');
    await page.getByLabel(/message/i).fill('hello there');
    await page.getByRole('button', { name: /send|submit/i }).click();
    await expect(page.getByText(/thanks|sent|success/i)).toBeVisible();
  });

  test('server error is surfaced to the user', async ({ page }) => {
    // Intercept the API and return 500.
    await page.route('**/api/contact', (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'down' }) });
    });
    await page.goto('/contact');
    await page.getByLabel(/name/i).fill('Alice');
    await page.getByLabel(/email/i).fill('a@b.com');
    await page.getByLabel(/message/i).fill('hi');
    await page.getByRole('button', { name: /send|submit/i }).click();
    await expect(page.getByRole('alert')).toContainText(/error|fail|try again/i);
  });

  test('disables the button while submitting', async ({ page }) => {
    await page.route('**/api/contact', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      route.fulfill({ status: 200, body: '{}' });
    });
    await page.goto('/contact');
    await page.getByLabel(/name/i).fill('A');
    await page.getByLabel(/email/i).fill('a@b.com');
    await page.getByLabel(/message/i).fill('m');
    const btn = page.getByRole('button', { name: /send|submit/i });
    await btn.click();
    await expect(btn).toBeDisabled();
  });
});
