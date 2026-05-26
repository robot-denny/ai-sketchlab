import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from '../../_helpers';

// Canonical surface: /experiments/ -- partial emits `<figure class="exp-sketch">`
// with a poster image and an interactive p5.js iframe slot. We mask the
// `.exp-sketch__slot` so the baseline captures the figure chrome (poster,
// caption, spacing) without depending on whether the interactive sketch has
// hydrated yet.

test.describe('Screenshot: Block Grid embeddedSketch', () => {
  test('renders embeddedSketch matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/experiments/',
      '[data-content-element-type-alias="embeddedSketch"]',
    );
    await expect(block).toHaveScreenshot(
      'embeddedSketch.png',
      screenshotOptions({
        mask: [page.locator('.exp-sketch__slot')],
      }),
    );
  });
});
