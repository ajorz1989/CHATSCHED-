import { test, expect } from '@playwright/test';

/** Authentication smoke tests. Full account creation/login requires dedicated
 * seeded test credentials and should be enabled in CI when those secrets exist. */
test.describe('Authentication entry points', () => {
  test('login and registration routes exist', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/ChatSched/i);
    await expect(page.getByRole('heading').first()).toBeVisible();

    await page.goto('/register');
    await expect(page).toHaveTitle(/ChatSched/i);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
});
