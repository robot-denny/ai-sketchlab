import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from '../../_helpers';

// Canonical surface: /guides/styleguide/ -- the partial emits a wrapper with
// `data-block-alias="generalElementsBlock"`.

test.describe('Screenshot: Block List generalElementsBlock', () => {
  test('renders generalElementsBlock matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/guides/styleguide/',
      '[data-block-alias="generalElementsBlock"]',
    );
    await expect(block).toHaveScreenshot('generalElementsBlock.png', screenshotOptions());
  });
});
