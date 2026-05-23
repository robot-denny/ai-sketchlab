import { test } from '@umbraco/playwright-testhelpers';
import { expect, findNavLinkForTemplate, prepareForScreenshot, screenshotOptions } from '../_helpers';

// Page-template screenshot (Step 6, _plans/arch-safety-net.md).
//
// Canonical surface: the Article document type (article.cshtml). The article
// page is reached dynamically by:
//   1. Walk site nav for the article-list template fingerprint
//      (`main.archive-page`)
//   2. From the article-list page, find the first article card link
//   3. Navigate to that article and full-page-screenshot
//
// This matches the test-resilience rule: never hardcode an article slug.
// Names like "Four Ethical Frameworks" or "The First Article" can be
// renamed/reordered without breaking the test.
//
// Dynamic regions to mask:
//   - `.byline` — contains author name + article date + read-time. Author/date
//     can change without the layout regressing.
//   - The "next/previous" navigation section at the bottom shifts as sibling
//     articles are added or reordered; mask `section.next`.
//   - Standard timestamps (`time, .post-meta, .article-meta`).

test.describe('Screenshot: article page template', () => {
  test('renders article page matching baseline', async ({ page }) => {
    // Step 1: find the article-list URL via nav walk.
    const articleListUrl = await findNavLinkForTemplate(page, 'main.archive-page');
    await page.goto(articleListUrl);

    // Step 2: from article-list, find first article card and capture its href.
    // _ArticleCard.cshtml wraps each card in `<article class="article-grid-card">`
    // with anchors on the thumb and title.
    const firstArticleHref = await page
      .locator('main.archive-page .article-grid-card a[href]')
      .first()
      .getAttribute('href');
    expect(firstArticleHref, 'article-list page should expose at least one article link').toBeTruthy();

    // Step 3: navigate to that article and screenshot.
    const resp = await page.goto(firstArticleHref!);
    expect(resp?.ok(), `navigation to ${firstArticleHref} should succeed`).toBeTruthy();
    await prepareForScreenshot(page);

    // Sanity check: article.cshtml renders an `<article>` element wrapping
    // the `.art-body` content. If we landed elsewhere, the assertions below
    // would still pass on baseline-missing but the snapshot would be
    // meaningless; fail loudly here instead.
    await expect(page.locator('article .art-body'), 'should be on the article template').toBeVisible({
      timeout: 10_000,
    });

    await expect(page).toHaveScreenshot(
      'article.png',
      screenshotOptions({
        fullPage: true,
        mask: [
          page.locator('.byline'),
          page.locator('section.next'),
          page.locator('time, .post-meta, .article-meta'),
        ],
      }),
    );
  });
});
