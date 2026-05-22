import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from './_helpers';

// Canonical surface: /experiments/ -- partial emits
// `<div class="exp-timeline__row">` with a `<time>` element. The date
// content is static in source (publishing milestones, not "today") so no
// time-masking is needed here.

test.describe('Screenshot: Block Grid timelineRow', () => {
  test('renders timelineRow matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/experiments/',
      '[data-content-element-type-alias="timelineRow"]',
    );
    await expect(block).toHaveScreenshot(
      'timelineRow.png',
      screenshotOptions(),
    );
  });
});
