import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from './_helpers';

// Canonical surface: /experiments/ -- partial emits
// `<figure class="exp-pullquote exp-pullquote--<tone>">`.

test.describe('Screenshot: Block Grid pullQuoteBlock', () => {
  test('renders pullQuoteBlock matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/experiments/',
      '[data-content-element-type-alias="pullQuoteBlock"]',
    );
    await expect(block).toHaveScreenshot(
      'pullQuoteBlock.png',
      screenshotOptions(),
    );
  });
});
