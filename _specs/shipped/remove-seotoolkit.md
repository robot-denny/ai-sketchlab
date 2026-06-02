# Spec for remove-seotoolkit

> This spec captures initial requirements and design rationale. For **current system behavior**, see `_features/remove-seotoolkit.md`.

branch: claude/feature/remove-seotoolkit

## Summary

Remove the `SeoToolkit.Umbraco` 6.3.0 NuGet package and replace the three pieces of value it could have delivered — a public sitemap, a public robots.txt, and a working 404 page — with in-tree equivalents that flow through the project's normal `master → Dev → Live` pipeline. The package is removed because every one of its features stores configuration only in the per-environment database with no Umbraco Deploy integration, which permanently breaks the project's "schema and configuration live in git" discipline. The custom SEO partial, the `SEO Controls` doc-type composition, and the SEO Assistant AI agent are not touched — they remain the source of truth for meta tags, indexability, and content-editor SEO guidance.

## Functional Requirements

- The `SeoToolkit.Umbraco` package reference must no longer appear in any `.csproj` file in the repository.
- A request to `/sitemap.xml` on any environment (local, Dev, Live) must return an HTTP 200 response with a valid XML sitemap listing every published, visible, non-excluded page in the tree.
- A request to `/robots.txt` on any environment must return an HTTP 200 response with a static, in-repo robots policy that permits crawling and points search engines at `/sitemap.xml`.
- A request to a URL that does not resolve to any published content (a true 404) must render the existing branded `Error` content page from `Views/error.cshtml`, not Umbraco's stock "Page Not Found" template.
- The existing `/xmlsitemap` URL must not become a hard 404; if its underlying template is removed or renamed, a redirect to `/sitemap.xml` preserves any inbound links.
- All existing Playwright test suites — particularly the `articleCardMetaDescription` suite and every screenshot-baseline spec — continue to pass without baseline regeneration.
- No new per-environment manual configuration step is added to the project's README. Every replacement built in this work deploys automatically as part of the existing `master → Dev` pipeline; promotion to Live happens via the Cloud Portal as usual.

## Possible Edge Cases

- An external site has indexed `/xmlsitemap` as the project's sitemap. After this work ships, crawlers hitting that URL must end up at `/sitemap.xml` rather than 404, otherwise indexing temporarily breaks.
- A page in the content tree has `excludeFromSitemap = true` set. The new `/sitemap.xml` must continue to honor that flag exactly as the old `/xmlsitemap` did — editors who previously hid pages from search should not be surprised.
- A request comes in for a URL that *used* to resolve to a now-renamed published page. Umbraco's built-in URL Tracker should silently 301 the request to the new URL; the new 404 handler must not intercept that case.
- A request comes in for a URL that genuinely never existed (a vendor's stale link, a typo). The new 404 handler must serve the branded Error page with an HTTP 404 status code, not an HTTP 200 — search engines distinguish between "soft 404s" and real 404s.
- A request comes in for a static asset under `/media/`, `/assets/`, or `/umbraco/` that does not exist. The new 404 handler must not intercept those static-file 404s, otherwise the Error page accidentally replaces missing-asset errors in ways that confuse asset-fingerprinting and CDN behavior.
- An editor publishes a new page with no `metaName` or `metaDescription` set. The custom `metaData.cshtml` partial already handles fallbacks for the meta tags themselves; this work must not regress that behavior even though it doesn't touch the partial.
- Cloud's runtime Razor compiler honors `<TreatWarningsAsErrors>` and the project-wide `<NoWarn>CS0618</NoWarn>` is in place; any new C# or Razor code introduced here must compile cleanly under both local `dotnet build -c Release` and Cloud's first-request Razor compile.

## Acceptance Criteria

1. The `SeoToolkit.Umbraco` package is removed from `src/UmbracoProject/UmbracoProject.csproj` and no other SeoToolkit references remain anywhere in the codebase (composer code, view imports, partial calls, configuration keys).
2. After the change is deployed to a Cloud environment, a visitor or search engine that requests `/sitemap.xml` receives a 200 response with an XML sitemap that lists the same set of pages the legacy `/xmlsitemap` template lists today.
3. After the change is deployed to a Cloud environment, a visitor or search engine that requests `/robots.txt` receives a 200 response with a robots policy that does not block crawlers and references `/sitemap.xml`.
4. After the change is deployed to a Cloud environment, a visitor who requests a URL that does not match any published content receives the branded Error page with an HTTP 404 status code.
5. Editors and AI tooling that depend on the `metaName`, `metaDescription`, `metaKeywords`, `isIndexable`, and `isFollowable` field aliases continue to work without modification — the SEO Controls composition and the SEO Assistant AI agent are not edited as part of this work.
6. The project's existing Playwright test suite passes in CI without any baseline screenshots being regenerated.
7. The project's README and CLAUDE.md describe the new SEO routing (sitemap, robots, 404 handler) so a new contributor can find the relevant code without searching.

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation. See `_features/remove-seotoolkit.md` for the verified version.

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

```scenario
Scenario: A visitor requests a missing static asset
  Given the Live environment has the SeoToolkit removal deployed
  When the visitor's browser sends a GET request to https://umbraco-17-demo-site.useast01.umbraco.io/media/this-image-was-deleted.png
  Then the response status is 404 Not Found
  And the response body is NOT the branded Error page (static-asset 404s remain unintercepted)
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

## Open Questions

1. **Sitemap routing approach.** Two viable paths exist for serving `/sitemap.xml`:
   - **Rename the existing `xMLSitemap` doc-type alias to `sitemap`** (Umbraco template URLs derive from the doc-type alias). Cleaner; Umbraco-native. Schema change required.
   - **Add a small SurfaceController** that returns the existing partial at `/sitemap.xml`. More code; no schema change; keeps the existing `xMLSitemap` doc-type structure intact.
   The plan stage must pick one and justify it. The author's lean is the SurfaceController, because schema changes ripple through `.uda` files and Deploy artifacts; a controller is contained to C# code.
2. **Where the legacy /xmlsitemap redirect lives.** If the doc-type rename approach is chosen, /xmlsitemap could be preserved as an Umbraco "alternative URL" on the Home node. If the SurfaceController approach is chosen, a second controller route or an `app.MapGet` in Program.cs can issue the 301. The plan stage should specify the exact mechanism.
3. **Should a Playwright smoke test be added** that asserts `/sitemap.xml`, `/robots.txt`, and a 404 URL return the expected status codes and content on the local dev server? The author's lean is **yes** — the original symptom was "Live 404s on these endpoints and nobody noticed," which a one-spec smoke test would have caught.
4. **Static-file 404 handling.** Does ASP.NET Core's default static-file middleware bypass the new `IContentLastChanceFinder` for requests under `/media/`, `/assets/`, and similar? This needs verification during plan stage — a misconfigured handler could replace missing-asset 404s with HTML Error-page responses, breaking asset-fingerprinting flows.
5. **Whether to file a follow-up roadmap item for manual redirects and 404 logging.** Both are deliberately out of scope for this spec, but a future need is foreseeable. Should ROADMAP.md gain a deferred entry, or is "Search Console + custom code if/when needed" enough of a paper trail?
6. **Cloud-side cleanup.** SeoToolkit's settings (sitemap config, redirects, robots rules) currently live only in the local DB and (if anyone configured them) in each Cloud environment's DB. After removing the package, those rows become orphaned. Is any DB cleanup needed, or is it safe to leave them as cold-storage rows that Umbraco simply ignores once the SeoToolkit assemblies are gone from the build?

## Testing Guidelines

Create test files in the `tests/e2e/` folder for the new feature, and create meaningful tests for the following cases without going too heavy:

- A smoke spec that fetches `/sitemap.xml`, `/robots.txt`, and a guaranteed-404 URL against the local dev server, asserting status code and content-type for each.
- A spec that asserts the legacy `/xmlsitemap` URL does not return a 404 (either redirects to `/sitemap.xml` or returns the same XML body).
- A spec that confirms the branded Error page renders for a deliberately-bogus URL but **not** for a missing static asset (verifies the 404 handler scoping).
- No changes to the existing `articleCardMetaDescription.spec.ts` — its continued passing is the regression guarantee for the meta-fields surface.
- No new screenshot baselines.
- For the `IContentLastChanceFinder`, a small xUnit unit test in `tests/UmbracoProject.Tests/` covering: it returns the Error node for a missing path, returns null for a path that matches a known asset prefix, and returns null when no Error node is published.
