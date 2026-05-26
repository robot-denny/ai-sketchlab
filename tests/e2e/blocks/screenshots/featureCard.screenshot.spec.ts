import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from '../../_helpers';

// Canonical surface: /experiments/ -- partial emits `<article class="exp-card">`
// inside the blockgrid wrapper.

test.describe('Screenshot: Block Grid featureCard', () => {
  test('renders featureCard matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/experiments/',
      '[data-content-element-type-alias="featureCard"]',
    );
    await expect(block).toHaveScreenshot(
      'featureCard.png',
      screenshotOptions(),
    );
  });
});
