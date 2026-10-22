import { test, expect, type Page } from '@playwright/test';

// Template smoke baseline (Step 1, _work/umbraco-18-upgrade/plan.md).
//
// One real, published page per site template, visited the way a visitor would:
// the response is 200, the page's own title heading is on screen, and the
// visitor is not looking at an error page. It is a CHARACTERIZATION test — green
// on Umbraco 17.6.2 by design — so that a template that breaks after the v18
// bump is attributable to the bump.
//
// URLS. Each row is a real published node, discovered by walking the content
// tree through the Management API (node → template alias → URL) on 2026-10-22,
// not guessed. Content flows local → Dev → Live, so the same nodes exist on
// Dev for Gate 2. If an editor renames or moves one of these nodes, update the
// row — the failure message names the template so the fix is obvious.
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
  { template: 'Author', url: '/authors/dennis-kardys/', expectHeading: 'Dennis Kardys' },
  { template: 'AuthorList', url: '/authors/', expectHeading: 'Authors' },
  { template: 'content', url: '/about/', expectHeading: 'About' },
  { template: 'documentation', url: '/capabilities/', expectHeading: 'Capabilities' },
  { template: 'contact', url: '/contact/', expectHeading: 'Contact' },
  { template: 'search', url: '/search/', expectHeading: 'Find an essay.' },
  { template: 'spellbook', url: '/spellbook/', expectHeading: 'The Cantrip Spellbook' },
  { template: 'guides', url: '/guides/', expectHeading: 'Guides' },
  { template: 'guidePage', url: '/guides/component-guide/', expectHeading: 'Component Guide' },
  {
    template: 'howToGuidePage',
    url: '/guides/how-to-use-the-alert-banner/',
    expectHeading: 'How To Use The Alert Banner',
  },
  {
    template: 'experimentsLandingPage',
    url: '/experiments/',
    expectHeading: 'Unlocking Agentic Workflows with Umbraco',
  },
];

/** The page's own title heading — the level-1 heading that isn't the wordmark logo link. */
function pageTitle(page: Page, name: string | RegExp) {
  return page
    .getByRole('heading', { level: 1, name, exact: typeof name === 'string' })
    .filter({ hasNot: page.getByRole('link') });
}

/** What a visitor would see if the template threw or the site fell over instead of rendering. */
async function expectNoErrorPage(page: Page) {
  await expect(page.getByRole('heading', { name: /Page not found|The page[\s\S]{0,40}isn't here\./i })).toHaveCount(0);
  await expect(page.getByText(/An unhandled exception occurred|Boot Failed|Internal Server Error/i)).toHaveCount(0);
}

test.describe('Template smoke baseline — one published page per template', () => {
  for (const { template, url, expectHeading } of TEMPLATE_CASES) {
    test(`${template} template renders ${url}`, async ({ page }) => {
      const response = await page.goto(url);

      expect(response?.status(), `${template} (${url}) should be HTTP 200`).toBe(200);
      await expect(pageTitle(page, expectHeading), `${template} should show its title heading`).toBeVisible();
      await expectNoErrorPage(page);
    });
  }

  test('spellCardRedirect template sends a card URL to its place in the spellbook deck', async ({ page }) => {
    const response = await page.goto('/spellbook/core/spec/');

    expect(response?.status(), 'the landing page after the redirect should be HTTP 200').toBe(200);
    const landed = new URL(page.url());
    expect(landed.pathname, 'a card URL should land on its spellbook').toBe('/spellbook/');
    expect(landed.hash, 'the deep link should point at the card in its stack').toBe('#deck/core/spec');
    await expect(pageTitle(page, 'The Cantrip Spellbook')).toBeVisible();
    await expectNoErrorPage(page);
  });

  test('/sitemap.xml is well-formed XML listing the home page', async ({ page, request, baseURL }) => {
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
    expect(parsed.locs, 'sitemap should list the home page').toContain(new URL('/', baseURL).href);
  });

  test('an unpublished URL shows the custom 404 page with status 404', async ({ page }) => {
    const url = `/template-smoke-never-published-${Date.now()}/`;
    const response = await page.goto(url);

    expect(response?.status(), `${url} should be HTTP 404`).toBe(404);
    // error.cshtml shows the editor-set Title when there is one, else a fallback
    // (same tolerance as seoRouting.spec.ts).
    await expect(pageTitle(page, /Page not found|The page[\s\S]{0,40}isn't here\./i)).toBeVisible();
  });
});
