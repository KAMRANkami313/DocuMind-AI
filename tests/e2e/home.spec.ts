import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('loads and shows app title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/DocuMind/i);
  });

  test('shows sidebar with documents section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Your Documents')).toBeVisible({ timeout: 10_000 });
  });

  test('shows upload area', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Upload PDF Document')).toBeVisible({ timeout: 10_000 });
  });

  test('theme toggle button is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button[aria-label="Toggle theme"]')).toBeVisible({ timeout: 10_000 });
  });
});