import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

/**
 * SEO Routing — smoke spec for the `remove-seotoolkit` feature.
 *
 * Asserts the three SEO endpoints the project owns directly (no SeoToolkit):
 *   (a) GET /sitemap.xml          — XML sitemap
 *   (b) GET /robots.txt           — robots directive + sitemap pointer
 *   (c) GET /<unknown>            — true HTTP 404 rendering the custom error.cshtml
 *   (d) GET /xmlsitemap           — legacy URL, 301 → /sitemap.xml OR 200 with sitemap body
 *
 * See _features/remove-seotoolkit.md and _plans/remove-seotoolkit.md for the
 * shipped behavioral contract.
 *
 * Implementation notes:
 *  - Uses the `{ request }` fixture so `baseURL` and `ignoreHTTPSErrors` are
 *    inherited from playwright.config.ts — no per-test newContext/dispose.
 *  - `BASE_URL` is read at module scope only to build the Home `<loc>` regex,
 *    which must match the request origin. Same env precedence as
 *    playwright.config.ts (`UMBRACO_URL`), falling back to `URL` (the testhelpers
 *    convention used by auth.setup.ts) and finally local.
 *  - The 404-body assertion matches either headline form rendered by
 *    Views/error.cshtml: the editor-set `Model.Title` (currently "Page not
 *    found") OR the hard-coded fallback `The page <em>isn't here.</em>` when
 *    Title is empty. The eyebrow `404 · Not found` is the second anchor
 *    confirming we're on the branded error page rather than Umbraco's stock
 *    404. Razor HTML-encodes the eyebrow, so `·` arrives as `&#xB7;` — the
 *    regex accepts either form plus a few other plausible separators.
 */

const BASE_URL = process.env.UMBRACO_URL || process.env.URL || 'https://localhost:44367';

test.describe('SEO routing — sitemap, robots, 404, legacy redirect', () => {
  test('GET /sitemap.xml returns 200 XML with a <urlset> and Home <loc>', async ({ request }) => {
    const res = await request.get('/sitemap.xml');

    expect(res.status(), 'sitemap.xml should be HTTP 200').toBe(200);

    const contentType = res.headers()['content-type'] ?? '';
    expect(
      /^(application|text)\/xml/i.test(contentType),
      `content-type should start with application/xml or text/xml — got "${contentType}"`,
    ).toBe(true);

    const body = await res.text();
    expect(body, 'body should contain <urlset').toContain('<urlset');

    // Tolerate both the local self-signed URL and the configured public URL on
    // Live (e.g. https://example.com/).
    const homeLocRegex = new RegExp(`<loc>\\s*${escapeRegex(BASE_URL.replace(/\/$/, ''))}/?\\s*</loc>`, 'i');
    expect(body, `body should contain a <loc> for the Home page (matching ${homeLocRegex})`).toMatch(homeLocRegex);
  });

  test('GET /robots.txt returns 200 plain text with a Sitemap: directive and no Disallow: /', async ({ request }) => {
    const res = await request.get('/robots.txt');

    expect(res.status(), 'robots.txt should be HTTP 200').toBe(200);

    const contentType = res.headers()['content-type'] ?? '';
    expect(
      contentType.toLowerCase().startsWith('text/plain'),
      `content-type should start with text/plain — got "${contentType}"`,
    ).toBe(true);

    const body = await res.text();

    // Match a Sitemap: line whose URL ends in /sitemap.xml. Tolerant of
    // arbitrary whitespace and capitalization (the directive name is
    // case-insensitive per the de facto spec).
    expect(body, 'body should contain a `Sitemap:` directive pointing at /sitemap.xml').toMatch(
      /^\s*Sitemap:\s*\S+\/sitemap\.xml\s*$/im,
    );

    // A bare `Disallow: /` (with nothing after the slash on that line) would
    // block all crawlers. Path-prefixed Disallows like `Disallow: /umbraco/`
    // are fine — only the bare global-block form is rejected.
    expect(body, 'body must NOT contain a bare `Disallow: /` line').not.toMatch(/^\s*Disallow:\s*\/\s*$/im);
  });

  test('GET /<unknown> returns a true 404 rendering the custom error.cshtml headline', async ({ request }) => {
    const slug = `/this-url-was-never-published-${Date.now()}`;
    const res = await request.get(slug);

    expect(res.status(), `${slug} should be HTTP 404`).toBe(404);

    const body = await res.text();
    expect(body, 'body should contain the branded 404 eyebrow `404 · Not found`').toMatch(
      /404\s*(?:·|•|&#xB7;|&middot;|\|)\s*Not found/i,
    );
    expect(body, 'body should contain the branded 404 headline (editor-set Title OR fallback)').toMatch(
      /Page not found|The page[\s\S]{0,40}isn't here\./i,
    );
  });

  test('GET /xmlsitemap either 301-redirects to /sitemap.xml or returns 200 with a sitemap body', async ({ request }) => {
    // maxRedirects: 0 — we want to inspect the redirect itself, not follow it.
    const res = await request.get('/xmlsitemap', { maxRedirects: 0 });

    const status = res.status();
    if (status === 301) {
      const location = res.headers()['location'] ?? '';
      expect(
        /\/sitemap\.xml$/i.test(location),
        `301 Location header should end in /sitemap.xml — got "${location}"`,
      ).toBe(true);
    } else if (status === 200) {
      const body = await res.text();
      expect(body, '200 body should look like a sitemap (contain <urlset or <loc>)').toMatch(/<urlset|<loc>/i);
    } else {
      throw new Error(`/xmlsitemap should be HTTP 200 or 301 — got ${status}`);
    }
  });
});

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
