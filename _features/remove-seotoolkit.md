# Feature: Remove SeoToolkit and Ship In-Tree SEO Equivalents

> **Draft** — These scenarios have not yet been verified against an implementation. They will be refined during planning and verified after implementation.

The `SeoToolkit.Umbraco` package is removed and the three pieces of value it could have delivered — a public sitemap, a public robots.txt, and a working branded 404 page — are replaced with in-tree equivalents that flow through the project's normal master → Dev → Live pipeline. The custom SEO partial, the SEO Controls composition, and the SEO Assistant AI agent stay as they are; this work changes how visitors and crawlers see the site, not how editors author content.

**Source spec**: `_specs/remove-seotoolkit.md`
**Last verified**: (draft — not yet verified)

---

## Increments

The per-feature mini-roadmap: shipped increments + planned increments + parking-lot ideas. Newest planned items first. When an item ships, flip the checkbox and point it at the shipped spec.

- [ ] 2026-06-01 — Remove SeoToolkit package; serve `/sitemap.xml`, `/robots.txt`, and branded 404 from in-tree code (spec: `_specs/remove-seotoolkit.md`, no plan yet)
- [ ] (parking lot) Manual redirects UI — for inbound links to URLs that never existed in Umbraco. Deferred until Google Search Console reveals a real need.
- [ ] (parking lot) 404 logging dashboard — internal aggregation of 404 hits. Deferred in favor of Search Console.
- [ ] (parking lot) Editor-facing meta override UI — the "resolved preview + override input" pattern from SeoToolkit's meta-fields. Deferred because the current direct-field-editing flow is fine for the site's editor count.

---

## Behaviors

Scenarios are grouped by Rule — the business rule or acceptance criterion that the scenarios prove. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

### Rule: The SeoToolkit package leaves no trace in the codebase

```scenario
Scenario: Developer searches the project for any SeoToolkit reference after the change ships
  Given the `claude/feature/remove-seotoolkit` branch is merged to master
  When a developer searches the repository for the string "SeoToolkit"
  Then they find no matches in any .csproj, .cs, .cshtml, .json, or .config file
  And the only matches (if any) are in historical commits or archived spec files
```

```scenario
Scenario: CI build runs without SeoToolkit assemblies in the output
  Given the master branch has the SeoToolkit removal merged
  When the Gate 1 build step runs `dotnet build -c Release`
  Then the resulting `bin/Release/net10.0/` directory contains no `SeoToolkit.Umbraco*.dll` files
```

### Rule: Visitors and crawlers find a working sitemap at the standard URL on every environment

```scenario
Scenario: A search engine fetches the sitemap on Live
  Given the Live environment has the SeoToolkit removal deployed
  When a search engine sends a GET request to https://umbraco-17-demo-site.useast01.umbraco.io/sitemap.xml
  Then the response status is 200 OK
  And the response body is a valid XML sitemap that includes the Home page, every published Article, every published Author page, and the Contact page
  And the response body excludes any page that has "Exclude from sitemap" ticked in the backoffice
```

```scenario
Scenario: A developer fetches the sitemap on the local dev server
  Given the local dev server is running and the branch is checked out
  When the developer runs `curl https://localhost:44367/sitemap.xml`
  Then the response status is 200 OK
  And the XML output matches the same shape as Live (same template, different base URL)
```

### Rule: The robots.txt file ships in the repository as a static asset and points crawlers at the sitemap

```scenario
Scenario: A crawler fetches robots.txt on Live
  Given the Live environment has the SeoToolkit removal deployed
  When a crawler sends a GET request to https://umbraco-17-demo-site.useast01.umbraco.io/robots.txt
  Then the response status is 200 OK
  And the response body contains a `Sitemap:` directive pointing at https://umbraco-17-demo-site.useast01.umbraco.io/sitemap.xml
  And the response body does not contain a blanket `Disallow: /` line
```

```scenario
Scenario: The robots.txt content is version-controlled
  Given the master branch has the SeoToolkit removal merged
  When a developer inspects `src/UmbracoProject/wwwroot/robots.txt`
  Then the file exists in git and contains the same content that is served at the `/robots.txt` URL
```

### Rule: A request for a non-existent page renders the branded Error page with a 404 status code

```scenario
Scenario: A visitor follows a broken inbound link to a URL that never existed
  Given the Live environment has the SeoToolkit removal deployed
  When the visitor's browser sends a GET request to https://umbraco-17-demo-site.useast01.umbraco.io/this-url-was-never-published
  Then the response status is 404 Not Found
  And the response body is the branded Error page from Views/error.cshtml (the page with the headline "The page isn't here.")
  And the response body is NOT Umbraco's stock "Page Not Found" template
```

### Rule: A request to the legacy /xmlsitemap URL still reaches a sitemap

```scenario
Scenario: A search engine has the legacy URL cached and re-fetches it
  Given a search engine has indexed /xmlsitemap from a previous crawl
  When the search engine sends a GET request to https://umbraco-17-demo-site.useast01.umbraco.io/xmlsitemap
  Then the response is either a 301 redirect to /sitemap.xml OR a 200 with the same XML body the new sitemap returns
  And the search engine is not given a 404
```

### Rule: The custom meta-tag system and SEO AI agent continue to work unchanged

```scenario
Scenario: A CMS editor publishes an article with custom meta values
  Given the SeoToolkit removal is deployed
  And an editor creates a new Article with metaName "Test Title" and metaDescription "Test Description"
  When a visitor loads that article
  Then the rendered HTML head contains `<title>Test Title | …</title>` and `<meta name="Description" content="Test Description">`
```

```scenario
Scenario: An editor uses the SEO Assistant AI agent to draft meta values
  Given the SeoToolkit removal is deployed
  When an editor invokes the SEO Assistant agent on a draft article
  Then the agent's guidance references the field aliases metaName, metaDescription, metaKeywords, isIndexable, and isFollowable (its system prompt is unchanged)
```

### Rule: Every existing Playwright test passes without baseline regeneration

```scenario
Scenario: The articleCardMetaDescription suite runs after the SeoToolkit removal
  Given the SeoToolkit removal branch is checked out
  When `npx playwright test tests/e2e/articleCardMetaDescription.spec.ts` runs
  Then every test passes
  And no screenshot baseline is regenerated as part of the run
```

```scenario
Scenario: Visual-regression baselines hold across the change
  Given the SeoToolkit removal branch is checked out
  When the full `npx playwright test` suite runs against the local dev server
  Then every screenshot-baseline spec passes without `--update-snapshots`
```

### Rule: New SEO routing is discoverable from project documentation

```scenario
Scenario: A new contributor reads CLAUDE.md to find sitemap/robots/404 wiring
  Given the SeoToolkit removal is merged to master
  When a new contributor opens CLAUDE.md and searches for "sitemap" or "robots" or "404"
  Then they find a section describing where sitemap.xml is served from, where robots.txt lives, and how 404s are handled
  And they do not need to grep the codebase to discover these mechanics
```

---

## Edge Cases

### Rule: Static-asset 404s are not intercepted by the branded Error page

```scenario
Scenario: A visitor requests a missing image
  Given the SeoToolkit removal is deployed
  When the visitor's browser sends a GET request to https://umbraco-17-demo-site.useast01.umbraco.io/media/this-image-was-deleted.png
  Then the response status is 404 Not Found
  And the response body is NOT the branded Error page (static-asset 404s remain unintercepted so asset-fingerprinting and CDN behavior are preserved)
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
| Sitemap returns 200 with valid XML at /sitemap.xml | — | Not covered |
| Robots.txt returns 200 at /robots.txt with Sitemap directive | — | Not covered |
| Branded Error page renders for a true 404 | — | Not covered |
| Static-asset 404 is not intercepted by the Error page | — | Not covered |
| Legacy /xmlsitemap URL redirects or proxies to /sitemap.xml | — | Not covered |
| articleCardMetaDescription suite still passes | `tests/e2e/articleCardMetaDescription.spec.ts` | Pre-existing (must continue to pass) |
| Screenshot baselines hold | `tests/e2e/blocks/screenshots/`, `tests/e2e/pages/` | Pre-existing (must continue to pass) |

---

## Revision Notes

- 2026-06-01: Draft scenarios from initial spec
