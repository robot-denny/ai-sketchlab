import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from './_helpers';

// Canonical surface: /styleguide/components/ -- partial emits
// `<div class="richtext">`. The first `.richtext` instance on the page is
// a label heading ("Rich Text Row"); the second is the sample showcasing
// bold/italic/link. Both are valid baselines; we pick the first for stability
// since the order is fixed by the section-row layout helper.

test.describe('Screenshot: Block List richTextRow', () => {
  test('renders richTextRow matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/styleguide/components/',
      '.richtext',
    );
    await expect(block).toHaveScreenshot('richTextRow.png', screenshotOptions());
  });
});
