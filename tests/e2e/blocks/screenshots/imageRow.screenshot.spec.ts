import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from '../../_helpers';

// Canonical surface: /styleguide/components/ -- partial emits `<div class="image">`.
// The space-trailing variant (`.image `) is the spacing-class suffix; matching
// `.image` alone is stable.

test.describe('Screenshot: Block List imageRow', () => {
  test('renders imageRow matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/styleguide/components/',
      '.image',
    );
    await expect(block).toHaveScreenshot('imageRow.png', screenshotOptions());
  });
});
