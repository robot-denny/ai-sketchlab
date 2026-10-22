import { test, expect, type Page } from '@playwright/test';
import { collectContentNodesByDocType, getDocumentTypeByName, tryGetDocumentPath } from '../_umbracoApi';

// Template smoke baseline (Step 1, _work/umbraco-18-upgrade/plan.md).
//
// One real, published page per site template, visited the way a visitor would:
// the response is 200, the page's own title heading is on screen, and the
// visitor is not looking at an error page. It is a CHARACTERIZATION test — green
// on Umbraco 17.6.2 by design — so that a template that breaks after the v18
// bump is attributable to the bump.
//
// URLS. The fixed rows are stable section/landing pages, discovered by walking
// the content tree through the Management API (node → template alias → URL) on
// 2026-10-22. Content flows local → Dev → Live, so the same nodes exist on Dev
// for Gate 2; if one moves, the failure message names the template.
// Pages that editors add, rename or retitle (an author, a how-to guide, the
// experiments landing page) are NOT hard-coded: DYNAMIC_CASES resolves the first
// published node of the document type through the Management API (E2E rule #2)
// and only asserts that it shows a non-empty title heading.
//
// HEADINGS. Every page renders two <h1>s: the site wordmark (a logo link whose
// accessible name is the site name) and the page's own title. The page title is
// the one heading-level-1 that is NOT a link wrapper, so `pageTitle()` filters
// the wordmark out by that, not by class name.
//
// Templates with no row here: `master` (a layout, exercised by every row),
// `Login` (member registration, covered by memberLogin.spec.ts), `error`
// (covered by the 404 case below), and `xMLSitemap` (covered by /sitemap.xml).

interface TemplateCase {
  template: string;
  url: string;
  expectHeading: string;
}

const TEMPLATE_CASES: TemplateCase[] = [
  { template: 'home', url: '/', expectHeading: 'Umbraco AI Sketch Lab' },
  { template: 'articleList', url: '/blog/', expectHeading: 'Blog' },
  { template: 'article', url: '/blog/welcome-to-the-demo-site/', expectHeading: 'Welcome to the Demo Site' },
  { template: 'AuthorList', url: '/authors/', expectHeading: 'Authors' },
  { template: 'content', url: '/about/', expectHeading: 'About' },
  { template: 'documentation', url: '/capabilities/', expectHeading: 'Capabilities' },
  { template: 'contact', url: '/contact/', expectHeading: 'Contact' },
  { template: 'search', url: '/search/', expectHeading: 'Find an essay.' },
  { template: 'spellbook', url: '/spellbook/', expectHeading: 'The Cantrip Spellbook' },
  { template: 'guides', url: '/guides/', expectHeading: 'Guides' },
  { template: 'guidePage', url: '/guides/component-guide/', expectHeading: 'Component Guide' },
];

/** Template → document type display name, for pages resolved at run time. */
const DYNAMIC_CASES = [
  { template: 'Author', docTypeName: 'Author' },
  { template: 'howToGuidePage', docTypeName: 'How-To Guide Page' },
  { template: 'experimentsLandingPage', docTypeName: 'Experiments Landing Page' },
];

/** The custom 404 page's title: the editor-set Title, else error.cshtml's fallback (same tolerance as seoRouting.spec.ts). */
const NOT_FOUND_HEADING = /Page not found|The page[\s\S]{0,40}isn't here\./i;

/** First published URL of a document type, or null when none exists or the type is missing. */
async function firstPublishedUrl(docTypeName: string): Promise<string | null> {
  const docType = await getDocumentTypeByName(docTypeName);
  if (!docType) return null;
  for (const node of await collectContentNodesByDocType(docType.id)) {
    const url = await tryGetDocumentPath(node.id);
    if (url) return url;
  }
  return null;
}

/** The page's own title heading — the level-1 heading that isn't the wordmark logo link. */
function pageTitle(page: Page, name: string | RegExp) {
  return page
    .getByRole('heading', { level: 1, name, exact: typeof name === 'string' })
    .filter({ hasNot: page.getByRole('link') });
}

/**
 * The visitor is not looking at the 404 page. A thrown template or a failed boot
 * is already caught by the status assertion and the missing title heading, so
 * there is no error-text scan — that would trip on an article that merely
 * mentions "Internal Server Error".
 */
async function expectNotTheNotFoundPage(page: Page) {
  await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toHaveCount(0);
}

test.describe('Template smoke baseline — one published page per template', () => {
  for (const { template, url, expectHeading } of TEMPLATE_CASES) {
    test(`${template} template renders ${url}`, async ({ page }) => {
      const response = await page.goto(url);

      expect(response?.status(), `${template} (${url}) should be HTTP 200`).toBe(200);
      await expect(pageTitle(page, expectHeading), `${template} should show its title heading`).toBeVisible();
      await expectNotTheNotFoundPage(page);
    });
  }

  for (const { template, docTypeName } of DYNAMIC_CASES) {
    test(`${template} template renders its first published page`, async ({ page }) => {
      const url = await firstPublishedUrl(docTypeName);
      expect(url, `a published "${docTypeName}" page should exist for the ${template} template`).not.toBeNull();

      const response = await page.goto(url!);
      expect(response?.status(), `${template} (${url}) should be HTTP 200`).toBe(200);
      const title = pageTitle(page, /\S/);
      await expect(title, `${template} should show a non-empty title heading`).toBeVisible();
      await expectNotTheNotFoundPage(page);
    });
  }

  test('spellCardRedirect template sends a card URL to its place in the spellbook deck', async ({ page }) => {
    const response = await page.goto('/spellbook/core/spec/');

    expect(response?.status(), 'the landing page after the redirect should be HTTP 200').toBe(200);
    const landed = new URL(page.url());
    expect(landed.pathname, 'a card URL should land on its spellbook').toBe('/spellbook/');
    expect(landed.hash, 'the deep link should point at the card in its stack').toBe('#deck/core/spec');
    await expect(pageTitle(page, 'The Cantrip Spellbook')).toBeVisible();
    await expectNotTheNotFoundPage(page);
  });

  test('spellCardRedirect template sends a stack URL to its stack in the spellbook deck', async ({ page }) => {
    // A stack is its own spellCardRedirect node (the isStack branch), distinct
    // from the card case above, which redirects via the card's parent stack.
    const response = await page.goto('/spellbook/core/');

    expect(response?.status(), 'the landing page after the redirect should be HTTP 200').toBe(200);
    const landed = new URL(page.url());
    expect(landed.pathname, 'a stack URL should land on its spellbook').toBe('/spellbook/');
    expect(landed.hash, 'the deep link should point at the stack').toBe('#deck/core');
    await expect(pageTitle(page, 'The Cantrip Spellbook')).toBeVisible();
    await expectNotTheNotFoundPage(page);
  });

  test('/sitemap.xml is well-formed XML listing the home page and its descendants', async ({ page, request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status(), 'sitemap.xml should be HTTP 200').toBe(200);
    const xml = await response.text();

    // Parse with the browser's XML parser: a malformed document yields a
    // <parsererror> element instead of throwing.
    const parsed = await page.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, 'application/xml');
      return {
        parseError: doc.getElementsByTagName('parsererror').length > 0,
        locs: Array.from(doc.getElementsByTagName('loc'), (el) => (el.textContent ?? '').trim()),
      };
    }, xml);

    expect(parsed.parseError, 'sitemap.xml should parse as XML').toBe(false);
    // Compare paths, not origins: <loc> is absolute and follows the environment's
    // domain binding, which need not match the URL the suite runs against.
    const paths = parsed.locs.map((loc) => new URL(loc).pathname);
    expect(paths, 'sitemap should list the home page').toContain('/');
    // More than the home page proves the recursive Children() walk ran.
    expect(paths.filter((p) => p !== '/').length, 'sitemap should list pages below home').toBeGreaterThan(0);
  });

  test('an unpublished URL shows the custom 404 page with status 404', async ({ page }) => {
    const url = `/template-smoke-never-published-${Date.now()}/`;
    const response = await page.goto(url);

    expect(response?.status(), `${url} should be HTTP 404`).toBe(404);
    await expect(pageTitle(page, NOT_FOUND_HEADING)).toBeVisible();
  });
});
