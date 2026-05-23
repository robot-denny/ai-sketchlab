import { test } from '@umbraco/playwright-testhelpers';
import { expect, prepareForScreenshot, screenshotOptions } from '../_helpers';

// Page-template screenshot (Step 6, _plans/arch-safety-net.md).
//
// Canonical surface: `/` -- the Home document type renders home.cshtml. The
// page is composed of the home hero, the "latest" essays section, a pull
// quote, the manifesto, plus optional content rows.
//
// Dynamic regions to mask:
//   - `section.latest` -- this is the home page's flavor of the latest-articles
//     widget (home.cshtml emits `<section class="latest">` via
//     `_LatestSection.cshtml`; it is NOT the blocklist `.latest-articles-row`
//     partial). Article order, titles, dates, and read-time change with each
//     publish, so the whole section gets masked.
//   - `time, .post-meta, .article-meta` (dynamicRegionMasks.publishedDates)
//     catches any other timestamp that creeps in via future blocks.

test.describe('Screenshot: home page template', () => {
  test('renders / matching baseline', async ({ page }) => {
    const resp = await page.goto('/');
    expect(resp?.ok(), 'navigation to / should succeed').toBeTruthy();
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot(
      'home.png',
      screenshotOptions({
        fullPage: true,
        mask: [
          page.locator('section.latest'),
          page.locator('time, .post-meta, .article-meta'),
        ],
      }),
    );
  });
});
