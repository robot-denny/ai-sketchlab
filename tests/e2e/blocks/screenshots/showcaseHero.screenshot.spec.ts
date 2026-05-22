import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from './_helpers';

// Canonical surface: /experiments/ -- partial emits `<section class="exp-hero">`
// as the page header. Background image is set via a CSS custom property; we
// rely on the network-idle wait in prepareForScreenshot to let the bg image
// preload before the screenshot fires.

test.describe('Screenshot: Block Grid showcaseHero', () => {
  test('renders showcaseHero matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/experiments/',
      '[data-content-element-type-alias="showcaseHero"]',
    );
    await expect(block).toHaveScreenshot(
      'showcaseHero.png',
      screenshotOptions(),
    );
  });
});
