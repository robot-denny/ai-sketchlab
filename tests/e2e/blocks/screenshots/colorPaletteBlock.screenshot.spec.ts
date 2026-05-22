import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from './_helpers';

// Canonical surface: /styleguide/ (the design-system overview page). The
// partial emits a wrapper with `data-block-alias="colorPaletteBlock"` -- the
// most stable selector for this block.

test.describe('Screenshot: Block List colorPaletteBlock', () => {
  test('renders colorPaletteBlock matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/styleguide/',
      '[data-block-alias="colorPaletteBlock"]',
    );
    await expect(block).toHaveScreenshot('colorPaletteBlock.png', screenshotOptions());
  });
});
