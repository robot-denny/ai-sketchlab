/**
 * Shared helpers for block-component AND page-template screenshot specs
 * (Steps 5 + 6 of `_plans/arch-safety-net.md`).
 *
 * Originally authored at `tests/e2e/blocks/screenshots/_helpers.ts` for the
 * block-component suite; lifted to `tests/e2e/_helpers.ts` in Step 6 once the
 * page-template specs needed the same `prepareForScreenshot` /
 * `screenshotOptions` / `dynamicRegionMasks` primitives. Block specs import
 * via `'../../_helpers'`; page specs import via `'../_helpers'`.
 *
 * TEST SCOPE — IMPORTANT for future authors:
 *   These specs are VISUAL REGRESSION tests only:
 *     - All runs under `prefers-reduced-motion: reduce`. Motion-on variants
 *       are NOT baseline-tested. If a component has motion-sensitive layout,
 *       add a dedicated motion-on spec alongside the reduced-motion one.
 *     - No spec asserts ARIA, role, alt text, heading level, or keyboard
 *       behavior. A refactor that strips `alt`, drops `aria-label`, or
 *       promotes an `<h3>` to `<h2>` will NOT fail any test in this suite.
 *       Semantic regression coverage requires separate axe-core or role-
 *       assertion specs (not in this bundle).
 *     - `latestArticlesRow` masks its `.entries` card grid for stability;
 *       link text and focus rings inside cards are therefore invisible to
 *       this spec. Ensure a separate semantic/axe spec covers those if it
 *       matters.
 *
 * Block-to-page mapping (canonical render surfaces on the running site):
 *
 *   --- blocklist (11 components) ---
 *   alertBanner             -> /styleguide/components/ (.alert)
 *   codeSnippetRow          -> /styleguide/components/ (pre:has(code))
 *   colorPaletteBlock       -> /styleguide/ ([data-block-alias="colorPaletteBlock"])
 *   generalElementsBlock    -> /styleguide/ ([data-block-alias="generalElementsBlock"])
 *   iconLinkRow             -> NO RENDER SURFACE on the demo site (skipped, see spec)
 *   imageCarouselRow        -> /styleguide/components/ (.image-carousel, first)
 *   imageRow                -> /styleguide/components/ (.image, first)
 *   latestArticlesRow       -> /styleguide/components/ (.latest-articles-row, mask cards)
 *   richTextRow             -> /styleguide/components/ (.richtext, first non-label instance)
 *   typographyShowcaseBlock -> /styleguide/ ([data-block-alias="typographyShowcaseBlock"])
 *   videoRow                -> /styleguide/components/ (.row:has(.youtube-player))
 *
 *   --- blockgrid (12 components) ---
 *   All blockgrid components render on the /experiments/ page. Each block is
 *   wrapped by Umbraco's `<div class="umb-block-grid__layout-item" data-content-element-type-alias="X">`,
 *   which gives a stable test selector regardless of the inner partial markup.
 *
 *   alertBanner          -> /experiments/ ([data-content-element-type-alias="alertBanner"])
 *                            (NOTE: not currently authored on /experiments/; falls back to
 *                             /styleguide/components/ for the shim equivalence spec)
 *   commandBadge         -> /experiments/ ([data-content-element-type-alias="commandBadge"])
 *   embeddedSketch       -> /experiments/ ([data-content-element-type-alias="embeddedSketch"])
 *   featureCard          -> /experiments/ ([data-content-element-type-alias="featureCard"])
 *   iconLinkRow          -> NO RENDER SURFACE (skipped)
 *   imageRow             -> /experiments/ ([data-content-element-type-alias="imageRow"])
 *   pillarSection        -> /experiments/ ([data-content-element-type-alias="pillarSection"])
 *   pullQuoteBlock       -> /experiments/ ([data-content-element-type-alias="pullQuoteBlock"])
 *   richTextRow          -> /experiments/ ([data-content-element-type-alias="richTextRow"])
 *   showcaseHero         -> /experiments/ ([data-content-element-type-alias="showcaseHero"])
 *   statCallout          -> /experiments/ ([data-content-element-type-alias="statCallout"])
 *   timelineRow          -> /experiments/ ([data-content-element-type-alias="timelineRow"])
 *
 *   --- shim equivalence (4 components) ---
 *   The four blockgrid shims (alertBanner, iconLinkRow, imageRow, richTextRow)
 *   delegate to the matching blocklist partial via `Html.PartialAsync`. The
 *   equivalence specs assert the rendered output is pixel-identical across
 *   blocklist and blockgrid contexts.
 *
 * Page-to-template mapping (Step 6 — `tests/e2e/pages/*.screenshot.spec.ts`):
 *
 *   home                    -> `/` (always; root URL is structural, safe to hardcode)
 *                              Mask: latestArticles + standard timestamp selectors.
 *   articleList             -> Looked up via header/nav walk for a link whose
 *                              destination renders `<main class="archive-page">`
 *                              (the unique articleList.cshtml wrapper).
 *                              Mask: .article-grid-card, .byline, time/.post-meta,
 *                              .pagination.
 *   article                 -> 2-hop: home → articleList nav → first
 *                              `.article-grid-card a[href]`. Mask: .byline,
 *                              section.next, time/.post-meta.
 *   experimentsLandingPage  -> Looked up via header/nav/footer walk for a link
 *                              whose destination renders the blockgrid umb-block-grid
 *                              wrapper (the unique experiments surface).
 *                              Mask: time/.post-meta (timeline dates).
 *   search                  -> `/search?q=zzzz-no-results-baseline` (deliberate
 *                              empty-state to avoid rank-dependent snippet thrash).
 *                              Mask: none -- the empty state is layout-stable.
 *   contact                 -> Looked up via header/nav/footer walk for a link
 *                              whose destination renders `form[method="post"]`
 *                              inside main (contact.cshtml's fingerprint).
 *                              Mask: time/.post-meta defensive only.
 *
 * Baseline generation policy (Step 5 key decisions, _plans/arch-safety-net.md):
 *   - Baselines are GENERATED ON LINUX ONLY via the `update-snapshots.yml`
 *     `workflow_dispatch` workflow. Mac-side regeneration is forbidden -- font
 *     rendering differs between macOS and Linux.
 *   - Default `maxDiffPixelRatio: 0.01` per block spec (tolerates anti-aliasing).
 *   - Shim equivalence specs use `maxDiffPixelRatio: 0` (byte-identical).
 *   - `.gitignore` rules assume Playwright's default `<spec>-snapshots/`
 *     directory naming; if `snapshotDir` is overridden later, revisit the
 *     `*-darwin.png` / `*-win32.png` exclusion rules.
 */

import { expect, Page, Locator } from '@playwright/test';

/**
 * Subset of Playwright's screenshot assertion options that this helper
 * surfaces. Keeps callers from passing arbitrary string values (e.g.
 * `{ maxDiffPixelRatio: 'banana' }`) and getting silent type widening.
 *
 * `fullPage` is only meaningful on `await expect(page).toHaveScreenshot(...)`
 * (Step 6, page-template specs). Locator-based block specs ignore it.
 */
export interface ScreenshotOptions {
  animations?: 'allow' | 'disabled';
  caret?: 'hide' | 'initial';
  fullPage?: boolean;
  maxDiffPixelRatio?: number;
  maxDiffPixels?: number;
  mask?: Locator[];
  threshold?: number;
  scale?: 'css' | 'device';
  timeout?: number;
}

/**
 * Standard page preparation for screenshot specs:
 *   1. Reduce motion (matches users with `prefers-reduced-motion: reduce`).
 *   2. Disable Bootstrap's carousel auto-cycle by forcing the play/pause toggle
 *      to the "paused" state where possible.
 *   3. Wait for fonts to load (custom typography would otherwise shift baselines).
 *   4. Wait for network idle so lazy-loaded images settle.
 *
 * Call this once per test, after the initial `page.goto(...)`.
 */
export async function prepareForScreenshot(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Some components (image carousel) also respond to a JS-level pause; the
  // reduced-motion media query handles the CSS animation side, this covers
  // the JS-driven `setInterval` slide rotation.
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('.carousel.slide').forEach((el) => {
      // Best-effort: nothing crashes if Bootstrap isn't loaded.
      const w = window as unknown as {
        bootstrap?: { Carousel: { getInstance(el: HTMLElement): { pause?: () => void } | null } };
      };
      const inst = w.bootstrap?.Carousel?.getInstance(el);
      inst?.pause?.();
    });
  });
  await page.waitForLoadState('networkidle').catch(() => {
    // networkidle can flake when the dev backend leaves long-poll connections
    // open; treat as best-effort.
  });
  await page.evaluate(() => document.fonts?.ready);
}

/**
 * Default screenshot options. Override `mask`/`maxDiffPixelRatio` etc. via the
 * `overrides` argument; the returned object can be spread into `toHaveScreenshot`.
 */
export function screenshotOptions(overrides: ScreenshotOptions = {}): ScreenshotOptions {
  return {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
    ...overrides,
  };
}

/**
 * Navigate to `path`, wait for the target locator to be in view, run
 * prepareForScreenshot, and return the locator. Fails the test loudly when
 * the locator isn't found (so missing canonical content surfaces clearly).
 * Specs that want a soft skip on missing content should probe with a
 * `domcontentloaded` goto + count check before calling this helper.
 */
export async function discoverBlockOnPage(
  page: Page,
  path: string,
  selector: string,
): Promise<Locator> {
  const resp = await page.goto(path);
  expect(resp?.ok(), `navigation to ${path} should succeed`).toBeTruthy();
  await prepareForScreenshot(page);
  const locator = page.locator(selector).first();
  await expect(locator, `selector "${selector}" should exist on ${path}`).toBeVisible({
    timeout: 10_000,
  });
  await locator.scrollIntoViewIfNeeded();
  // prepareForScreenshot already waited for networkidle once. The post-scroll
  // wait was best-effort (.catch on timeout), and across 22 active specs it
  // adds 11-33s of intentional idle waiting that rarely catches anything the
  // first wait missed. If a specific block needs a post-scroll settle
  // (large below-the-fold images, etc.), add it in that spec only.
  return locator;
}

/**
 * Common dynamic-region masks. Use individually per-spec -- most blocks don't
 * need them, but `latestArticlesRow` and any block that includes a timestamp
 * benefits from masking.
 */
export function dynamicRegionMasks(page: Page): { latestArticles: Locator; publishedDates: Locator } {
  return {
    latestArticles: page.locator('.latest-articles-row .entries'),
    publishedDates: page.locator('time, .post-meta, .article-meta'),
  };
}

/**
 * Discover the URL of a page template by walking the site's navigation and
 * probing each link's destination for a CSS selector unique to that template.
 *
 * Used by the page-template screenshot specs (Step 6) so no slug like
 * `/contact/` or `/experiments/` is hardcoded — slug changes survive without
 * rewriting tests.
 *
 * Probe gotos use `{ waitUntil: 'domcontentloaded' }` rather than the default
 * `'load'` so the discovery loop doesn't pay full image/font wait cost on
 * pages it's about to discard.
 *
 * @param page     a Playwright page; on success it ends up on the discovered URL.
 * @param fingerprint a CSS selector that ONLY the target template renders
 *                    (e.g., `'main.archive-page'` for articleList,
 *                    `'form[method="post"]'` inside main for contact).
 * @param navSelectors comma-separated selectors for nav containers to walk;
 *                     defaults to header + nav + footer anchors.
 * @returns the URL of the page rendering the fingerprint, or throws if
 *          no nav link resolved to the template.
 */
export async function findNavLinkForTemplate(
  page: Page,
  fingerprint: string,
  navSelectors: string = 'header a, nav a, footer a',
): Promise<string> {
  await page.goto('/');
  const navLinks = await page.locator(navSelectors).evaluateAll((els) =>
    els
      .map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/') && href !== '/' && !href.startsWith('/assets')),
  );

  // De-duplicate (footer often re-lists header links).
  const unique = Array.from(new Set(navLinks));

  for (const href of unique) {
    const resp = await page.goto(href, { waitUntil: 'domcontentloaded' });
    if (!resp?.ok()) continue;
    if ((await page.locator(fingerprint).count()) > 0) {
      return href;
    }
  }

  throw new Error(
    `Could not find a nav link whose destination renders \`${fingerprint}\`. ` +
      `Walked: ${navSelectors}. Visited ${unique.length} candidate URL(s).`,
  );
}

// --- Keyword-search availability (beta.9 Examine corruption guard) ----------
//
// Umbraco.Cms.Search.Provider.Examine 1.0.0-beta.9 corrupts the
// `Umb_PublishedContent` keyword index after every Cloud deploy, so SHORT /
// keyword queries return 0 results on Dev until a Portal restart rebuilds it.
// Semantic (AI vector, UmbAI_Search) search is unaffected. Tests that
// hard-depend on keyword results self-skip when keyword search is confirmed
// down — so they still run locally, post-restart, and once a stable
// Provider.Examine lands (v18). The skip is CONDITIONAL on keyword being down,
// so a failure while keyword is UP (a genuine regression) is NOT masked.
// Remove the guards + this helper when a stable Provider.Examine ships.
// See docs/ci-failure-recipes.md → "cold AI.Search".
export const KEYWORD_SEARCH_SKIP_REASON =
  'Keyword search (Examine Umb_PublishedContent) is corrupt on this environment after a Cloud deploy ' +
  '(beta.9 Provider.Examine); short queries return 0 until a Portal restart. Semantic search is unaffected. ' +
  'Re-enable when a stable Provider.Examine ships (v18). See docs/ci-failure-recipes.md.';

/**
 * True if the Examine keyword index is serving. NOTE: this NAVIGATES `page` to
 * `/search?q=article` (a short/keyword query) and counts rendered result cards —
 * the same reliable signal the search specs use (a plain `page.request` fetch
 * proved flaky re: baseURL/caching). Callers that need a specific page state
 * must navigate again afterward. Any error is treated as "down".
 */
export async function keywordSearchAvailable(page: Page): Promise<boolean> {
  try {
    await page.goto('/search?q=article');
    return (await page.locator('.article-grid-card').count()) > 0;
  } catch {
    return false;
  }
}

// Re-export `expect` so spec files don't need to import it directly from
// playwright/test alongside the testhelpers `test`.
export { expect };
