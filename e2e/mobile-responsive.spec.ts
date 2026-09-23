import { test, expect } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/',
  '/browse',
  '/channels',
  '/pricing',
  '/for-businesses',
  '/for-publishers',
  '/about',
  '/contact',
  '/tools',
  '/opportunities',
];

for (const width of [320, 375, 390]) {
  test(`public pages do not overflow horizontally at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });

    for (const route of PUBLIC_ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      await page.waitForTimeout(250);

      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        htmlScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }));

      expect(
        dimensions.htmlScrollWidth,
        `${route}: document overflowed horizontally (viewport=${dimensions.viewport}, scrollWidth=${dimensions.htmlScrollWidth})`
      ).toBeLessThanOrEqual(dimensions.viewport + 1);

      expect(
        dimensions.bodyScrollWidth,
        `${route}: body overflowed horizontally (viewport=${dimensions.viewport}, scrollWidth=${dimensions.bodyScrollWidth})`
      ).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
  });
}
