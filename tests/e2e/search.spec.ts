import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import dotenv from 'dotenv';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const SEARCH_PATH = '/search';
// Known URL paths of system doc types that must never appear in results. Category /
// Category List pages share a URL prefix; Error / Search / Sitemap resolve to exact
// paths. Keep this list aligned with `docTypesToIgnore` in Views/search.cshtml.
const SYSTEM_DOC_TYPE_URL_PATHS = ['/search', '/error', '/sitemap.xml'];
const SYSTEM_DOC_TYPE_URL_PREFIXES = ['/category', '/categories'];

test.describe('Search — page shell (characterization)', () => {

  test('GET /search renders the page shell with search form and no results section when q is empty', async ({ page }) => {
    await page.goto(SEARCH_PATH);

    // Search form exists
    await expect(page.locator('form#search')).toBeVisible();
    await expect(page.locator('form#search input[name="q"]')).toBeVisible();
    await expect(page.locator('form#search button.search-button')).toBeVisible();

    // No results block when no query supplied
    await expect(page.locator('.post-preview')).toHaveCount(0);
  });

  test('GET /search?q=article returns at least one .post-preview result', async ({ page }) => {
    await page.goto(`${SEARCH_PATH}?q=article`);

    const results = page.locator('.post-preview');
    await expect(results.first()).toBeVisible();
    expect(await results.count()).toBeGreaterThan(0);
  });

  test('results exclude system doc types (Search, Error, XMLsitemap, Category, CategoryList)', async ({ page }) => {
    await page.goto(`${SEARCH_PATH}?q=a`);

    const results = page.locator('.post-preview');
    const count = await results.count();
    // Only enforce the exclusion if results were returned; otherwise there's nothing to check.
    if (count === 0) {
      test.skip(true, 'No results returned for broad query — cannot verify exclusion');
    }

    const hrefs = await results.locator('a').evaluateAll(
      (els) => els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? '')
    );

    for (const href of hrefs) {
      const normalized = (href || '').toLowerCase().replace(/\/+$/, '');
      for (const systemUrl of SYSTEM_DOC_TYPE_URL_PATHS) {
        const sys = systemUrl.toLowerCase().replace(/\/+$/, '');
        expect(
          normalized === sys,
          `result URL "${href}" should not resolve to system doc-type page "${systemUrl}"`
        ).toBe(false);
      }
      for (const prefix of SYSTEM_DOC_TYPE_URL_PREFIXES) {
        expect(
          normalized.startsWith(prefix),
          `result URL "${href}" should not sit under system doc-type prefix "${prefix}"`
        ).toBe(false);
      }
    }
  });

  test('article results render post-meta with "Posted" + author + article date', async ({ page }) => {
    await page.goto(`${SEARCH_PATH}?q=article`);

    const results = page.locator('.post-preview');
    await expect(results.first()).toBeVisible();

    // Find at least one result that has .post-meta (article results only — not every result carries metadata)
    const metas = page.locator('.post-preview .post-meta');
    const metaCount = await metas.count();
    expect(metaCount, 'at least one article result should render .post-meta').toBeGreaterThan(0);

    const firstMetaText = (await metas.first().textContent()) ?? '';
    // "Posted" dictionary label → matches Posted (case-insensitive, allow whitespace)
    expect(firstMetaText).toMatch(/posted/i);
    // Date should be rendered in the "MMMM dd, yyyy" format (at least the year is detectable)
    expect(firstMetaText).toMatch(/\b(19|20)\d{2}\b/);
  });

  test('XSS safety: script in q is HTML-encoded in the rendered results line', async ({ page }) => {
    const payload = '<script>alert(1)</script>';

    // Fail the test if a dialog opens (would indicate script execution)
    let dialogTriggered = false;
    page.on('dialog', async (d) => {
      dialogTriggered = true;
      await d.dismiss().catch(() => {});
    });

    await page.goto(`${SEARCH_PATH}?q=${encodeURIComponent(payload)}`);

    expect(dialogTriggered, 'no alert() dialog should open (script must not execute)').toBe(false);

    // Confirm the raw payload has not been injected as a live <script> element in the results area
    const liveScripts = await page.locator('form#search script').count();
    expect(liveScripts, 'no <script> tag should be injected inside the search form').toBe(0);
  });

  test('mode label shows "Keyword" for a single-token query', async ({ page }) => {
    // Single-token queries route through the Examine keyword provider. The
    // service emits SearchMode.Keyword which the view renders as "Keyword".
    await page.goto(`${SEARCH_PATH}?q=${encodeURIComponent('contact')}`);

    // Mode label still renders on the zero-results state, so guard against a
    // cold index producing a vacuous pass.
    const results = page.locator('.post-preview');
    if ((await results.count()) === 0) {
      test.skip(true, 'Keyword index returned no results — cannot verify keyword routing');
    }

    const modeLabel = page.locator('.s-meta .mode');
    await expect(modeLabel).toBeVisible();
    await expect(modeLabel).toContainText('Keyword');
  });

  test('mode label shows "AI semantic" for a 3+ token query', async ({ page }) => {
    // The AI semantic searcher requires an OpenAI key for query embedding.
    // Skip cleanly on environments without it rather than failing on a
    // missing-credentials assertion.
    test.skip(!process.env.OPENAI_API_KEY, 'OPENAI_API_KEY not set — AI semantic search unavailable');

    // Multi-token natural-language queries route through the AI vector
    // searcher. The service emits SearchMode.AiSemantic which the view
    // renders as "AI semantic".
    await page.goto(`${SEARCH_PATH}?q=${encodeURIComponent('stories about resilience')}`);

    // Mode label still renders on the zero-results state, so guard against a
    // cold AI vector index producing a vacuous pass.
    const results = page.locator('.post-preview');
    if ((await results.count()) === 0) {
      test.skip(true, 'AI index returned no results — cannot verify AI semantic routing');
    }

    const modeLabel = page.locator('.s-meta .mode');
    await expect(modeLabel).toBeVisible();
    await expect(modeLabel).toContainText('AI semantic');
  });

  test('XSS safety: attribute-injection payload (onerror=) is HTML-encoded, not executed', async ({ page }) => {
    // Regression guard: StripHtml() alone does NOT neutralize this vector because
    // the payload contains no tags for it to strip. Only HTML-encoding the query
    // before Html.Raw(string.Format(...)) prevents the browser from parsing this
    // as a live <img> element with an onerror handler.
    const payload = '<img src=x onerror=alert(1)>';

    let dialogTriggered = false;
    page.on('dialog', async (d) => {
      dialogTriggered = true;
      await d.dismiss().catch(() => {});
    });

    // Collect any page errors the onerror might raise even if no dialog appears
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(`${SEARCH_PATH}?q=${encodeURIComponent(payload)}`);

    expect(dialogTriggered, 'no alert() dialog should open for onerror payload').toBe(false);

    // The query is echoed into the results-count line. An un-encoded payload would
    // have injected a live <img> element there.
    const injectedImg = await page.locator('form#search img[src="x"]').count();
    expect(injectedImg, 'no <img> element should be injected from the query string').toBe(0);
  });
});

test.describe('Search — semantic capability (RED until AI.Search is wired up)', () => {

  // Paraphrased query that never mentions "welcome" / "getting started" / "introduction"
  // explicitly. A keyword index returns zero results (no Lucene term match); a vector
  // index should surface the site's introductory content via semantic similarity.
  test('paraphrased query "how do I get started with this site" returns an onboarding-related result', async ({ page }) => {
    // Bound the wait on the OpenAI embedding round-trip so a degraded external API
    // doesn't stall CI for Playwright's 30 s default. 10 s is a comfortable ceiling
    // for a healthy request (~100–200 ms typical) plus Umbraco render time.
    await page.goto(
      `${SEARCH_PATH}?q=${encodeURIComponent('how do I get started with this site')}`,
      { timeout: 10_000 }
    );

    const results = page.locator('.post-preview');
    await expect(results.first()).toBeVisible({ timeout: 10_000 });
    const count = await results.count();
    expect(count, 'paraphrased query should return at least one result (semantic match)').toBeGreaterThan(0);

    const titles = await results.locator('.post-title').evaluateAll(
      (els) => els.map((el) => (el.textContent ?? '').toLowerCase())
    );

    const matches = titles.some((t) =>
      ['welcome', 'getting started', 'introduction', 'introducing'].some((kw) => t.includes(kw))
    );

    expect(
      matches,
      `at least one result title should contain one of [welcome, getting started, introduction, introducing] — got: ${JSON.stringify(titles)}`
    ).toBe(true);
  });
});
