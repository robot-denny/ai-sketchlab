import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from './_helpers';

// Canonical surface: /experiments/ -- the partial emits `<div class="exp-cmd">`
// inside Umbraco's blockgrid wrapper. Using the data-content-element-type-alias
// selector keeps the test resilient to inner-markup refactors.

test.describe('Screenshot: Block Grid commandBadge', () => {
  test('renders commandBadge matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/experiments/',
      '[data-content-element-type-alias="commandBadge"]',
    );
    await expect(block).toHaveScreenshot(
      'commandBadge.png',
      screenshotOptions(),
    );
  });
});
