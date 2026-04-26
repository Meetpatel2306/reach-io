// E2E file upload + download template. Uses a Buffer payload so no real file is needed on disk.

import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('upload a small file', async ({ page }) => {
  await page.goto('/upload');
  const fileChooser = page.locator('input[type="file"]');
  await fileChooser.setInputFiles({
    name: 'hello.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello world'),
  });
  await page.getByRole('button', { name: /upload/i }).click();
  await expect(page.getByText(/uploaded|success|done/i)).toBeVisible();
});

test('rejects oversized files (UI feedback)', async ({ page }) => {
  await page.goto('/upload');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'big.bin',
    mimeType: 'application/octet-stream',
    buffer: Buffer.alloc(20 * 1024 * 1024), // 20MB
  });
  await page.getByRole('button', { name: /upload/i }).click();
  await expect(page.getByRole('alert')).toContainText(/too large|size limit|exceed/i);
});

test('download a generated file', async ({ page }) => {
  await page.goto('/reports');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /download|export/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.(csv|pdf|xlsx|json)$/i);
  const path = await download.path();
  if (path) {
    const contents = await readFile(path);
    expect(contents.byteLength).toBeGreaterThan(0);
  }
});
