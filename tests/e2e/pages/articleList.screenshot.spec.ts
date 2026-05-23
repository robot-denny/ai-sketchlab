import { test } from '@umbraco/playwright-testhelpers';
import { expect, findNavLinkForTemplate, prepareForScreenshot, screenshotOptions } from '../_helpers';

// Page-template screenshot (Step 6, _plans/arch-safety-net.md).
//
// Canonical surface: the ArticleList document type (articleList.cshtml). On
// this site the document is published as "Blog" with URL `/blog/`, but the
// URL is looked up dynamically from header/nav/footer anchors to honour the
// E2E test resilience rules (no hardcoded slugs). The articleList.cshtml
// template emits `<main class="archive-page">`, which is its fingerprint.
//
// Dynamic regions to mask:
//   - `.article-grid-card` — article titles, authors, and dates change as
//     content authors publish. Masking the whole card keeps page chrome
//     (filter strip, year headings, grid spacing) under test while ignoring
//     per-card content. Note: `.article-grid-card` is the class used by
//     `_ArticleCard.cshtml` in BOTH articleList.cshtml and latestArticlesRow.
//   - The year `<h2 class="year">` heading is content-derived but stable
//     enough on a content-stable env; leave unmasked. If thrash appears, add
//     `page.locator('h2.year')` to the mask list.
//   - `.byline` -- per-author lookup on cards.
//   - `time, .post-meta, .article-meta` — catch any future timestamp.
//   - Pagination links (`.pagination`) shift count as content grows; mask.

test.describe('Screenshot: articleList page template', () => {
  test('renders article-list page matching baseline', async ({ page }) => {
    const articleListUrl = await findNavLinkForTemplate(page, 'main.archive-page');
    await page.goto(articleListUrl);
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot(
      'articleList.png',
      screenshotOptions({
        fullPage: true,
        mask: [
          page.locator('.article-grid-card'),
          page.locator('.byline'),
          page.locator('time, .post-meta, .article-meta'),
          page.locator('.pagination'),
        ],
      }),
    );
  });
});
