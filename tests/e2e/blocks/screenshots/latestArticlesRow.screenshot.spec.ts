import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, dynamicRegionMasks, expect, screenshotOptions } from '../../_helpers';

// Canonical surface: /guides/component-guide/ -- partial emits
// `<section class="latest-articles-row">`. The inner article-card grid is
// dynamic (article order/titles/dates change as content authors publish), so
// we mask the entries grid + any timestamps via dynamicRegionMasks. The
// baseline captures the section chrome (heading, spacing, structure) but
// not the volatile per-article content.
//
// Accessibility note: masking `.latest-articles-row .entries` means link
// text, alt text, and focus indicators inside cards are not baseline-tested
// here. If those matter, add a separate semantic/axe spec for the cards.

test.describe('Screenshot: Block List latestArticlesRow', () => {
  test('renders latestArticlesRow matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/guides/component-guide/',
      '.latest-articles-row',
    );
    const masks = dynamicRegionMasks(page);
    await expect(block).toHaveScreenshot(
      'latestArticlesRow.png',
      screenshotOptions({
        mask: [masks.latestArticles, masks.publishedDates],
      }),
    );
  });
});
