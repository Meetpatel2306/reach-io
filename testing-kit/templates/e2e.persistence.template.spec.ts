// E2E persistence template — verify that user data survives reloads, new tabs, and offline.

import { test, expect } from '@playwright/test';

test('localStorage state survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('preference', 'dark'));
  await page.reload();
  const value = await page.evaluate(() => localStorage.getItem('preference'));
  expect(value).toBe('dark');
});

test('cookies are sent on subsequent requests', async ({ page, context }) => {
  await context.addCookies([{
    name: 'tk_demo',
    value: '1',
    domain: 'localhost',
    path: '/',
  }]);
  await page.goto('/');
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name === 'tk_demo')).toBe(true);
});

test('IndexedDB roundtrip from the page', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    return new Promise<string | null>((resolve) => {
      const req = indexedDB.open('tk-test', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put('hi', 'k');
        tx.oncomplete = () => {
          const tx2 = db.transaction('kv', 'readonly');
          const r = tx2.objectStore('kv').get('k');
          r.onsuccess = () => resolve(r.result as string);
          r.onerror = () => resolve(null);
        };
      };
    });
  });
  expect(result).toBe('hi');
});

test('opens correctly in a second tab with shared storage', async ({ context }) => {
  const a = await context.newPage();
  await a.goto('/');
  await a.evaluate(() => localStorage.setItem('shared', 'yes'));

  const b = await context.newPage();
  await b.goto('/');
  const value = await b.evaluate(() => localStorage.getItem('shared'));
  expect(value).toBe('yes');
});

test('graceful behavior when offline', async ({ page, context }) => {
  await page.goto('/');
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  // Replace this with whatever offline UI your app shows (banner, toast, fallback content).
  // await expect(page.getByText(/offline/i)).toBeVisible();
  await context.setOffline(false);
});
