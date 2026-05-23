import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from '../../_helpers';

// Canonical surface: /experiments/ -- the blockgrid imageRow shim wraps the
// blocklist partial inside `<div data-content-element-type-alias="imageRow">`.

test.describe('Screenshot: Block Grid imageRow', () => {
  test('renders blockgrid imageRow matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/experiments/',
      '[data-content-element-type-alias="imageRow"]',
    );
    await expect(block).toHaveScreenshot(
      'imageRow.blockgrid.png',
      screenshotOptions(),
    );
  });
});
