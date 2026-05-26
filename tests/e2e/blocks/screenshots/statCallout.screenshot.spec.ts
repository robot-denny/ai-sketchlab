import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from '../../_helpers';

// Canonical surface: /experiments/ -- partial emits `<figure class="exp-stat">`.

test.describe('Screenshot: Block Grid statCallout', () => {
  test('renders statCallout matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/experiments/',
      '[data-content-element-type-alias="statCallout"]',
    );
    await expect(block).toHaveScreenshot(
      'statCallout.png',
      screenshotOptions(),
    );
  });
});
