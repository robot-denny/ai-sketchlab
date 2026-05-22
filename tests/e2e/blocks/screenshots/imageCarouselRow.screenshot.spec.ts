import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from './_helpers';

// Canonical surface: /styleguide/components/ -- the partial emits a
// `.image-carousel` wrapper. The carousel auto-cycles in production; the
// shared `prepareForScreenshot` helper applies `prefers-reduced-motion: reduce`
// and calls Bootstrap's `pause()` so the screenshot lands on the first slide.

test.describe('Screenshot: Block List imageCarouselRow', () => {
  test('renders imageCarouselRow matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/styleguide/components/',
      '.image-carousel',
    );
    await expect(block).toHaveScreenshot('imageCarouselRow.png', screenshotOptions());
  });
});
