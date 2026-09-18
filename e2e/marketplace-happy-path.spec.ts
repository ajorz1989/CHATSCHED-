import { test, expect } from '@playwright/test';

/** Public marketplace smoke tests. Authenticated workflows belong in an
 * environment that provides dedicated test credentials and seeded data. */
test.describe('ChatSched public marketplace', () => {
  test('homepage exposes the primary customer journeys', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ChatSched/i);
    await expect(page.getByRole('link', { name: /Browse/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Build My Campaign/i }).first()).toBeVisible();
  });

  test('channel hub reflects the live marketplace', async ({ page }) => {
    await page.goto('/channels');
    await expect(page.getByRole('heading', { name: /Advertising channels/i })).toBeVisible();
    await expect(page.getByText(/Open now/i)).toBeVisible();
    await expect(page.getByText(/Coming soon/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Influencer/i }).first()).toBeVisible();
  });

  test('browse and pricing are reachable from the public funnel', async ({ page }) => {
    await page.goto('/browse');
    await expect(page.getByRole('heading', { name: /Find the page your customers already follow/i })).toBeVisible();
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: /Built so both sides can trust the deal/i })).toBeVisible();
  });
});
