import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from './_helpers';

// Canonical surface: /experiments/ -- partial emits `<section class="exp-pillar">`.

test.describe('Screenshot: Block Grid pillarSection', () => {
  test('renders pillarSection matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/experiments/',
      '[data-content-element-type-alias="pillarSection"]',
    );
    await expect(block).toHaveScreenshot(
      'pillarSection.png',
      screenshotOptions(),
    );
  });
});
