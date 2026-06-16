# Feature: SEO Routing

The site serves the three SEO surfaces crawlers expect at their standard URLs — a sitemap at `/sitemap.xml`, a `/robots.txt` that points crawlers at it, and a branded 404 page for unknown URLs — all from in-tree code and static files that flow through the normal master → Dev → Live pipeline, with no per-environment backoffice configuration. The custom meta-tag system and the SEO Assistant AI agent continue to drive per-page `<head>` metadata.

**Source spec**: `_specs/shipped/remove-seotoolkit.md` _(the in-tree SEO surface was introduced when the `SeoToolkit.Umbraco` package was removed — that spec is the design rationale)_
**Last verified**: 2026-06-02

---

## Increments

The per-feature mini-roadmap: shipped increments + planned increments + parking-lot ideas. Newest planned items first.

- [x] 2026-06-02 — Serve `/sitemap.xml`, `/robots.txt`, and a branded 404 from in-tree code (replacing the removed `SeoToolkit.Umbraco` package) (spec: [`_specs/shipped/remove-seotoolkit.md`](../_specs/shipped/remove-seotoolkit.md))
- [ ] (parking lot) Manual redirects UI — for inbound links to URLs that never existed in Umbraco. Deferred until Google Search Console reveals a real need.
- [ ] (parking lot) 404 logging dashboard — internal aggregation of 404 hits. Deferred in favor of Search Console.
- [ ] (parking lot) Editor-facing meta override UI — the "resolved preview + override input" pattern. Deferred because the current direct-field-editing flow is fine for the site's editor count.

---

## Behaviors

Scenarios are grouped by Rule — the business rule each cluster proves. See `.claude/skills/BDD.md` for guidance.

### Rule: Visitors and crawlers find a working sitemap at the standard URL on every environment

```scenario
Scenario: A search engine fetches the sitemap
  Given a published site is deployed
  When a search engine sends a GET request to /sitemap.xml
  Then the response status is 200 OK
  And the Content-Type header starts with `application/xml`
  And the response body is a valid XML sitemap that includes the Home page, every published Article, every published Author page, and the Contact page
  And the response body excludes any page that has "Exclude from sitemap" ticked in the backoffice
```

```scenario
Scenario: The sitemap renders identically on local and Cloud (only the base URL differs)
  Given a developer runs the site locally
  When the developer fetches /sitemap.xml
  Then the response status is 200 OK
  And the XML output matches the same shape as Live (same template, different base URL)
```

### Rule: robots.txt is served at the standard URL and points crawlers at the sitemap

```scenario
Scenario: A crawler fetches robots.txt
  Given a published site is deployed
  When a crawler sends a GET request to /robots.txt
  Then the response status is 200 OK
  And the Content-Type header starts with `text/plain`
  And the response body contains a `Sitemap:` directive pointing at the site's /sitemap.xml
  And the response body does not contain a blanket `Disallow: /` line
```

### Rule: A request for a non-existent page renders the branded Error page with a 404 status code

```scenario
Scenario: A visitor follows a broken inbound link to a URL that never existed
  Given a published site is deployed
  When the visitor's browser sends a GET request to a content URL that was never published
  Then the response status is 404 Not Found
  And the response body is the branded Error page (not Umbraco's stock "Page Not Found" template)
  And the body contains the eyebrow text `404 · Not found` (or its HTML-encoded equivalent)
  And the body contains the headline "Page not found" (the editor-set Title) or the hard-coded fallback "The page isn't here."
```

### Rule: The legacy /xmlsitemap URL still reaches a sitemap

```scenario
Scenario: A search engine has the legacy URL cached and re-fetches it
  Given a search engine indexed /xmlsitemap from a previous crawl
  When the search engine sends a GET request to /xmlsitemap
  Then the response is either HTTP 200 OK with the same XML sitemap body returned at /sitemap.xml
   OR  the response is HTTP 301 Moved Permanently with a Location header ending in /sitemap.xml
  And the search engine is not given a 404

# The shipped implementation lands on the 200-with-body variant — an internal
# URL-rewrite middleware in Program.cs maps /sitemap.xml → /xmlsitemap before
# Umbraco's content router runs, so both URLs reach the same xMLSitemap content
# node and render identical bodies. The scenario keeps the 301 alternative as
# legal because tests/e2e/seoRouting.spec.ts still accepts both branches — that
# preserves room to switch to a 301 canonicalization later without breaking the
# feature contract or the test.
```

### Rule: The custom meta-tag system and SEO AI agent drive per-page metadata

```scenario
Scenario: A CMS editor publishes an article with custom meta values
  Given an editor creates a new Article with metaName "Test Title" and metaDescription "Test Description"
  When a visitor loads that article
  Then the rendered HTML head contains `<title>Test Title | …</title>` and `<meta name="Description" content="Test Description">`
```

```scenario
Scenario: An editor uses the SEO Assistant AI agent to draft meta values
  When an editor invokes the SEO Assistant agent on a draft article
  Then the agent's guidance references the field aliases metaName, metaDescription, metaKeywords, isIndexable, and isFollowable
```

---

## Edge Cases

### Rule: Static-asset 404s are not intercepted by the branded Error page

```scenario
Scenario: A visitor requests a missing image
  Given a published site is deployed
  When the visitor's browser sends a GET request to /media/this-image-was-deleted.png
  Then the response status is 404 Not Found
  And the response body is NOT the branded Error page (static-asset 404s remain unintercepted so asset-fingerprinting and CDN behavior are preserved)
```

### Rule: Umbraco-internal and API paths are not intercepted by the branded Error page

```scenario
Scenario: A request to an unknown /umbraco or /api/ path
  Given a published site is deployed
  When the visitor's browser sends a GET request to a URL beginning with /umbraco or /api/
  Then the NotFoundContentFinder defensive guard short-circuits and returns false
  And Umbraco / the API pipeline handles the 404 with its own (non-HTML) response shape

# Defensive guard — middleware order normally prevents these paths from reaching
# the finder, but the guard makes the contract structural rather than operational.
# See NotFoundContentFinder.cs:60-65.
```

### Rule: A rename-redirect from the built-in URL Tracker takes precedence over the 404 handler

```scenario
Scenario: A visitor follows an inbound link to a renamed article
  Given an article was published at /blog/old-title and later renamed to /blog/new-title
  And the built-in URL Tracker created a 301 redirect at the time of rename
  When the visitor requests /blog/old-title
  Then the response status is 301 Moved Permanently
  And the response Location header points at /blog/new-title
  And the branded 404 Error page is NOT served
```

### Rule: A page with excludeFromSitemap = true is omitted from /sitemap.xml

```scenario
Scenario: An editor hides a thank-you page from the sitemap
  Given an editor creates a page at /thank-you and ticks "Exclude from sitemap"
  When a crawler fetches /sitemap.xml
  Then the response does not contain a <url> entry for /thank-you
  And every other published, visible page still appears
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Sitemap returns 200 with valid XML at /sitemap.xml | [`tests/e2e/seoRouting.spec.ts:37`](../tests/e2e/seoRouting.spec.ts#L37) | Covered |
| Robots.txt returns 200 at /robots.txt with Sitemap directive and no bare `Disallow: /` | [`tests/e2e/seoRouting.spec.ts:57`](../tests/e2e/seoRouting.spec.ts#L57) | Covered |
| Branded Error page renders for a true 404 (with eyebrow + headline assertions) | [`tests/e2e/seoRouting.spec.ts:83`](../tests/e2e/seoRouting.spec.ts#L83) | Covered |
| Legacy /xmlsitemap URL returns 200 with a sitemap body (or 301 — spec accepts either) | [`tests/e2e/seoRouting.spec.ts:98`](../tests/e2e/seoRouting.spec.ts#L98) | Covered |
| Static-asset 404 is not intercepted by the Error page | — | Manual (verified during implementation; not automated) |
| Umbraco-internal / API path 404s skip the finder | — | Manual (verified by inspection of `NotFoundContentFinder.cs:60-65`) |

---

## Revision Notes

- 2026-06-01: Draft scenarios from the `remove-seotoolkit` spec.
- 2026-06-02: Verified against the shipped implementation. Sitemap routing landed as a URL-rewrite middleware in `Program.cs` (not the originally-specified SurfaceController — UmbracoContext lifecycle issues forced the change); `/xmlsitemap` returns 200 with the sitemap body (not the originally-planned 301); `NotFoundContentFinder` added a defensive `/umbraco` + `/api/` path-prefix guard during code review. Coverage table populated against `tests/e2e/seoRouting.spec.ts` (4/4 GREEN).
- 2026-06-16: Renamed from `remove-seotoolkit` to `seo-routing` to make the doc an evergreen capability spec rather than a record of the package-removal work. Dropped the migration-only acceptance criteria (no SeoToolkit trace in the codebase / no SeoToolkit assemblies in the build / existing Playwright baselines unchanged / wiring discoverable from CLAUDE.md) — those were point-in-time ACs and live in `_specs/shipped/remove-seotoolkit.md`. Reframed scenario preconditions from "the SeoToolkit removal is deployed" to evergreen "a published site is deployed."
