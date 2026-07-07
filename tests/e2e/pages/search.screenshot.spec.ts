import { test } from '@umbraco/playwright-testhelpers';
import {
  expect,
  prepareForScreenshot,
  screenshotOptions,
  keywordSearchAvailable,
  KEYWORD_SEARCH_SKIP_REASON,
} from '../_helpers';

// Page-template screenshot (Step 6, _plans/arch-safety-net.md).
//
// Canonical surface: `/search/?q=...`. The plan suggests `q=umbraco` but
// notes that result snippets are rank-dependent — they reflow as the
// underlying search index changes (vector embeddings, indexed content
// updates, snippet length tweaks). To get a fully deterministic layout we
// instead use a query that the search index reliably has no matches for,
// which exercises the "no results" empty-state branch of search.cshtml:
//
//   - The page head renders with the encoded query echoed into the title.
//   - The `.s-meta` results count line renders ("0 results for X").
//   - The `_EmptyState.cshtml` partial renders with its "Browse the archive"
//     and "Clear search" actions.
//
// This branch has zero content-dependent text, so the baseline is stable
// across content changes. If we later want to baseline the results layout
// itself, we'd add a separate spec with heavier masking on `.post-preview`
// titles and snippets.
//
// Dynamic regions to mask:
//   - None on the empty-state branch by design.
//   - We still defensively mask `time, .post-meta, .article-meta` in case
//     the empty-state markup grows a timestamp later.
//
// Note: the query string is reflected back via @encodedQuery into the page
// head. Using a fixed token keeps that text stable.

const NO_RESULTS_QUERY = 'zzzz-no-results-baseline';

test.describe('Screenshot: search page template', () => {
  test('renders /search/?q=<no-results> matching baseline', async ({ page }) => {
    // The search page's empty-state rendering differs when the Examine keyword
    // index is corrupt (beta.9; e.g. Dev after a deploy), so the baseline only
    // matches when keyword search is healthy. Skip when it's confirmed down —
    // conditional, so a genuine visual regression (keyword UP) still fails.
    test.skip(!(await keywordSearchAvailable(page)), KEYWORD_SEARCH_SKIP_REASON);

    const resp = await page.goto(`/search/?q=${encodeURIComponent(NO_RESULTS_QUERY)}`);
    expect(resp?.ok(), 'navigation to /search/ should succeed').toBeTruthy();
    await prepareForScreenshot(page);

    // Confirm we hit the empty-state branch -- otherwise the baseline would
    // capture rank-dependent results which the spec is explicitly avoiding.
    await expect(
      page.locator('.post-preview'),
      'chosen query should yield zero search results',
    ).toHaveCount(0);

    await expect(page).toHaveScreenshot(
      'search.png',
      screenshotOptions({
        fullPage: true,
        mask: [
          page.locator('time, .post-meta, .article-meta'),
        ],
      }),
    );
  });
});
