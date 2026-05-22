import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from './_helpers';

// Canonical surface: /experiments/ -- the blockgrid richTextRow shim wraps the
// blocklist partial in `<div data-content-element-type-alias="richTextRow">`.

test.describe('Screenshot: Block Grid richTextRow', () => {
  test('renders blockgrid richTextRow matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/experiments/',
      '[data-content-element-type-alias="richTextRow"]',
    );
    await expect(block).toHaveScreenshot(
      'richTextRow.blockgrid.png',
      screenshotOptions(),
    );
  });
});
