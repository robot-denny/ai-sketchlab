/**
 * Shared helpers for block-component screenshot specs (Step 5 of
 * `_plans/arch-safety-net.md`).
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
 */
export interface ScreenshotOptions {
  animations?: 'allow' | 'disabled';
  caret?: 'hide' | 'initial';
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

// Re-export `expect` so spec files don't need to import it directly from
// playwright/test alongside the testhelpers `test`.
export { expect };
