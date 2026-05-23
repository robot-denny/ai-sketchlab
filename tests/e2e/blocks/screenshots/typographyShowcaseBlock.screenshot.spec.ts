import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from '../../_helpers';

// Canonical surface: /styleguide/ -- partial emits a wrapper with
// `data-block-alias="typographyShowcaseBlock"`.

test.describe('Screenshot: Block List typographyShowcaseBlock', () => {
  test('renders typographyShowcaseBlock matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/styleguide/',
      '[data-block-alias="typographyShowcaseBlock"]',
    );
    await expect(block).toHaveScreenshot(
      'typographyShowcaseBlock.png',
      screenshotOptions(),
    );
  });
});
