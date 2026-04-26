// E2E auth flow template — login, protected route, logout, session persistence.
// Replace selectors with your real ones. getByRole is preferred over CSS selectors.

import { test, expect, type Page } from '@playwright/test';

const TEST_USER = { email: 'test@example.com', password: 'password123' };

async function login(page: Page, creds = TEST_USER) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/password/i).fill(creds.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
}

test('login → redirected to dashboard', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/(dashboard|home|app)/);
});

test('protected route redirects to login when unauthenticated', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('invalid credentials show an error', async ({ page }) => {
  await login(page, { email: 'wrong@example.com', password: 'badpass' });
  await expect(page.getByRole('alert')).toContainText(/invalid|incorrect|wrong/i);
});

test('session survives a page reload', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/(dashboard|home|app)/);
  await page.reload();
  await expect(page).toHaveURL(/\/(dashboard|home|app)/);
});

test('logout clears the session', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: /sign out|log out/i }).click();
  await expect(page).toHaveURL(/\/(login|$)/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('CSRF / session cookie is httpOnly (security smoke)', async ({ page, context }) => {
  await login(page);
  const cookies = await context.cookies();
  const session = cookies.find((c) => /session|auth|jwt/i.test(c.name));
  if (session) {
    expect(session.httpOnly).toBe(true);
  }
});
