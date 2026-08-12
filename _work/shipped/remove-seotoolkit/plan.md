# Plan: Remove SeoToolkit and Ship In-Tree SEO Equivalents

**Spec**: `_specs/remove-seotoolkit.md`
**Branch**: `claude/feature/remove-seotoolkit`

## Context

The `SeoToolkit.Umbraco` package was installed for evaluation against the existing custom SEO partial + sitemap template, but never configured (no `_ViewImports` tag helpers registered, no master.cshtml wiring, no Live backoffice config — `/sitemap.xml` and `/robots.txt` 404 on Live). Investigation revealed SeoToolkit has no Umbraco Deploy integration, so every one of its features stores configuration only in each environment's database — permanently outside the project's "schema and config in git" discipline. This plan removes the package and replaces the three pieces of value it could have delivered with in-tree C#/static-file code that flows through the normal `master → Dev → Live` pipeline.

The custom SEO surface that stays untouched: `Views/Partials/metaData.cshtml` (renders ~25 meta/link tags), the `SEO Controls` doc-type composition with field aliases `metaName` / `metaDescription` / `metaKeywords` / `isIndexable` / `isFollowable`, and the `SEO Assistant` AI agent whose system prompt hard-codes those aliases. The existing `Views/Partials/xmlSitemap.cshtml` (the recursion that walks the published tree) is reused by the new controller — only the URL routing and the legacy outer view change.

---

## Key Decisions

- **Sitemap routing approach: SurfaceController, not doc-type rename.** Umbraco templates derive their URL from the doc-type alias as a slug (`/sitemap`, not `/sitemap.xml`); only a controller or custom `IContentFinder` can natively serve a `.xml` extension. The existing `Views/Partials/xmlSitemap.cshtml` recursion is reused as-is by a new `SitemapController : SurfaceController` — no logic duplication. This is the first SurfaceController in the project (grep for `SurfaceController` returns zero hits), so the file lives at `src/UmbracoProject/Controllers/SitemapController.cs` and that folder is created in this step.
- **Legacy `/xmlsitemap` URL: keep the content node + template, rewrite the outer view to a 301.** The `xMLSitemap` doc-type is at GUID `ac6ebe34-fc2b-4ee0-9b26-e7a22adbe591`, its template at `72f84ac5-d043-4035-937f-2f0a99d6afbe`, and a published content node renders at `/xmlsitemap` today (verified: HTTP 200). Deleting any of those would generate `.uda` deletions plus orphan a content node. Instead, the outer view `Views/xMLSitemap.cshtml` is reduced to a `Response.Redirect("/sitemap.xml", permanent: true)` call. Schema stays intact; only behavior changes.
- **404 wiring: `IContentLastChanceFinder`, not `appsettings.Error404Collection`.** The finder pattern gives explicit C# control over which paths get intercepted (we explicitly need static-asset paths under `/media/`, `/assets/`, `/umbraco/` to remain unintercepted per the spec's edge cases). ASP.NET Core's `UseStaticFiles` middleware already runs *before* Umbraco's content routing so static-asset 404s never reach the finder — this is the default; the implementation just has to not undo it. The Error doc-type GUID is `9db112c5-c2ea-441d-8bd4-6daf522aa2b6` (alias `error`).
- **Composer registration**: the project has three existing `IComposer` implementations (`SearchComposer`, `SearchServiceComposer`, `AssignMembersToPremiumRoleComposer`) — same one-liner pattern. The 404 finder gets its own composer alongside them: `NotFoundComposer.cs`.
- **One smoke spec, written first.** All three new endpoints (`/sitemap.xml`, `/robots.txt`, true-404) are covered by a single `tests/e2e/seoRouting.spec.ts` written before any implementation. This is the test-first checkpoint — it's RED across the board at Step 1's end, then each subsequent step turns one assertion GREEN until Step 5.
- **xUnit unit test for the finder is *not* worth the harness cost.** The `IContentLastChanceFinder` interface requires mocking `IPublishedRequestBuilder` + `IUmbracoContextAccessor` + a content tree to test in isolation — non-trivial. The E2E smoke spec covers the behavior directly. Existing `tests/UmbracoProject.Tests/SmokeTests.cs` stays untouched in this work.
- **CLAUDE.md update goes at the end** in its own step. Updating docs as the last step (rather than each implementation step) keeps each implementation step focused and avoids merge conflicts in CLAUDE.md as steps land.
- **Removal of `SeoToolkit.Umbraco` happens late (Step 5)**, after the in-tree replacements are GREEN. Reversing that order would leave `/sitemap.xml` and `/robots.txt` 404'ing on local for the duration of the branch.

---

## Steps

Each step is designed to be completed independently in its own context window. The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Write the SEO-routing smoke spec (RED)

> **Prompt**: Implement Step 1 of `_plans/remove-seotoolkit.md`. Create a new Playwright spec at `tests/e2e/seoRouting.spec.ts` that asserts the three SEO endpoints described in `_features/remove-seotoolkit.md`: (a) `GET /sitemap.xml` returns HTTP 200, `content-type` starts with `application/xml` or `text/xml`, body contains the literal string `<urlset` and a `<loc>` referencing the Home page URL; (b) `GET /robots.txt` returns HTTP 200, `content-type` starts with `text/plain`, body contains a `Sitemap:` directive whose URL ends in `/sitemap.xml`, body does NOT contain a `Disallow: /` line; (c) `GET /this-url-was-never-published-{Date.now()}` returns HTTP 404, body contains the headline literal `The page isn&#x27;t here.` (HTML-escaped form of the apostrophe — verify by viewing the current `Views/error.cshtml`); (d) `GET /xmlsitemap` returns either HTTP 301 with a Location header ending in `/sitemap.xml`, or HTTP 200 with the same kind of sitemap body as `/sitemap.xml`. The spec uses `process.env.URL` for the base URL (matches the existing E2E auth helper convention in `tests/e2e/auth.setup.ts`). Use raw `request.get()` calls — no page navigation needed, since these are pure HTTP assertions. Set `test.use({ ignoreHTTPSErrors: true })` so the local self-signed cert doesn't block. Then run the spec and confirm it is RED on all four assertions: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/seoRouting.spec.ts --reporter=list`. Commit the failing spec.

**What to build**:
- `tests/e2e/seoRouting.spec.ts` — single file, four `test()` blocks (one per endpoint), each using `request.newContext({ baseURL: process.env.URL, ignoreHTTPSErrors: true })`.

**Test first**: This step IS the test-first checkpoint for the whole feature. All four assertions are expected to fail at the end of this step.

**Validation**:
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/seoRouting.spec.ts --reporter=list` — should report **4 failed** with the listed reasons (sitemap may pass against local because SeoToolkit is serving it; the 404 case definitely fails; the robots and `/xmlsitemap` cases fail). Capture which assertions are red vs green in the commit message for traceability.
- [Manual]: None — the test result is the verification.

---

### Step 2 — Add `IContentLastChanceFinder` wired to the Error doc-type (turns true-404 GREEN)

> **Prompt**: Implement Step 2 of `_plans/remove-seotoolkit.md`. Create `src/UmbracoProject/Controllers/NotFoundContentFinder.cs` implementing `Umbraco.Cms.Core.Routing.IContentLastChanceFinder`. The finder's `TryFindContent(IPublishedRequestBuilder request)` should: walk to the published content root via `IUmbracoContextAccessor.TryGetUmbracoContext(out var ctx)`, then `ctx.PublishedSnapshot.Content.GetAtRoot().FirstOrDefault()` for Home, then `home.FirstChildOfType("error")` (or equivalent) to find the published Error node. If found, call `request.SetPublishedContent(errorNode)` and `request.SetResponseStatus(404)` and return `true`. If Home or the Error child is missing, return `false`. Inject `IUmbracoContextAccessor` via constructor. Create a sibling file `src/UmbracoProject/Controllers/NotFoundComposer.cs` implementing `IComposer` that does `builder.SetContentLastChanceFinder<NotFoundContentFinder>();`. Place both files under the existing `UmbracoProject` namespace (no nested `.Controllers` namespace — match the pattern of `SearchComposer.cs` and `AssignMembersToPremiumRoleComposer.cs` which sit at the root namespace). Build with `cd src/UmbracoProject && dotnet build -c Release`. Then run the Step 1 smoke spec — assertion (c) (the true-404 with the headline literal) should now be GREEN; the others remain RED. Commit.

**What to build**:
- `src/UmbracoProject/Controllers/NotFoundContentFinder.cs` — implements `IContentLastChanceFinder`.
- `src/UmbracoProject/Controllers/NotFoundComposer.cs` — `IComposer` registering the finder via `builder.SetContentLastChanceFinder<>()`.

**Test first**: Already done in Step 1 (the smoke spec's true-404 assertion).

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build -c Release` — must succeed with zero warnings (TWAE is on).
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/seoRouting.spec.ts --reporter=list -g "404"` — the true-404 assertion is now GREEN.
- [Manual]: Start the dev server (`cd src/UmbracoProject && dotnet run`), browse to `https://localhost:44367/this-page-does-not-exist`, confirm the branded Error page renders (headline "The page isn't here.") rather than Umbraco's stock "Page Not Found" template. Also browse to `https://localhost:44367/media/this-image-was-deleted.png` and confirm you get a generic 404 (not the branded Error page) — verifies static-asset 404s are not intercepted.

---

### Step 3 — Add static `robots.txt` (turns robots GREEN; survives SeoToolkit removal in Step 5)

> **Prompt**: Implement Step 3 of `_plans/remove-seotoolkit.md`. Create `src/UmbracoProject/wwwroot/robots.txt` with the following body — three lines, plain text, no BOM, LF line endings: `User-agent: *` / `Allow: /` / blank line / `Sitemap: https://umbraco-17-demo-site.useast01.umbraco.io/sitemap.xml`. The Sitemap URL is hard-coded to Live because crawlers index Live's URL and shouldn't see a localhost reference (the Sitemap directive is informational — crawlers still discover `/sitemap.xml` by convention regardless of what URL appears in robots.txt). Verify the file is picked up by ASP.NET Core's static-file middleware (no extra config required — `wwwroot` is the default static root). With the dev server running, run the smoke spec — assertions (b) (robots.txt) are GREEN. Commit.

**What to build**:
- `src/UmbracoProject/wwwroot/robots.txt` — three lines as specified.

**Test first**: Already done in Step 1.

**Validation**:
- [Automated]: With dev server running, `curl -ksS -o - https://localhost:44367/robots.txt` returns the four lines, status 200, content-type `text/plain`.
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/seoRouting.spec.ts --reporter=list -g "robots"` — GREEN.
- [Manual]: Browse to `https://localhost:44367/robots.txt`, confirm the file contents display as plain text.

---

### Step 4 — Add `SitemapController` serving `/sitemap.xml`; rewrite the legacy `Views/xMLSitemap.cshtml` to redirect (turns sitemap + legacy-URL GREEN)

> **Prompt**: Implement Step 4 of `_plans/remove-seotoolkit.md`. Two changes in one step (they're coupled — the controller is the new source of truth, the legacy view becomes a redirect to it):
>
> **(a)** Create `src/UmbracoProject/Controllers/SitemapController.cs`. Class derives from `Umbraco.Cms.Web.Website.Controllers.SurfaceController`. Constructor takes `IUmbracoContextAccessor`, `IUmbracoDatabaseFactory`, `ServiceContext`, `AppCaches`, `IProfilingLogger`, `IPublishedUrlProvider` — pass through to base. Single action `[HttpGet]` decorated with `[Route("/sitemap.xml")]`, name `Index()`. The action: resolves Home via `UmbracoContext.PublishedSnapshot.Content.GetAtRoot().FirstOrDefault()`, returns `PartialView("~/Views/Partials/xmlSitemap.cshtml", home)` after setting `Response.ContentType = "application/xml"`. If Home is null, return `NotFound()`. The existing `Views/Partials/xmlSitemap.cshtml` already does the tree recursion and uses `#pragma warning disable CS0618` for the obsolete `.Children` calls — reuse it verbatim.
>
> **(b)** Replace the body of `src/UmbracoProject/Views/xMLSitemap.cshtml` (currently a 6-line cached partial render) with a single-line 301 redirect: `@{ Response.Redirect("/sitemap.xml", permanent: true); }`. This preserves the existing content node + template + doc-type schema (no `.uda` changes), so `/xmlsitemap` URL ownership is intact and editor-facing schema is unchanged.
>
> Build with `cd src/UmbracoProject && dotnet build -c Release` — must succeed with zero warnings. Run the full smoke spec: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/seoRouting.spec.ts --reporter=list` — all four assertions GREEN. Commit.

**What to build**:
- `src/UmbracoProject/Controllers/SitemapController.cs` — new SurfaceController, `/sitemap.xml` route, renders existing partial.
- `src/UmbracoProject/Views/xMLSitemap.cshtml` — rewritten to one-line 301 redirect.

**Test first**: Already done in Step 1.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build -c Release` — must succeed with zero warnings.
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/seoRouting.spec.ts --reporter=list` — all four assertions GREEN.
- [Manual]: Browse to `https://localhost:44367/sitemap.xml`, confirm valid XML sitemap with `<urlset>` and `<url><loc>` entries for Home, articles, authors, etc. Browse to `https://localhost:44367/xmlsitemap`, confirm browser follows the 301 to `/sitemap.xml` (check Network tab for the 301 if needed).
- [Manual]: View page source on any rendered page (e.g. `/`), confirm the meta tags from `metaData.cshtml` still render normally — no regression on the custom meta system.

---

### Step 5 — Remove the `SeoToolkit.Umbraco` package; verify clean build and all-green smoke spec

> **Prompt**: Implement Step 5 of `_plans/remove-seotoolkit.md`. Remove the line `<PackageReference Include="SeoToolkit.Umbraco" Version="6.3.0" />` from `src/UmbracoProject/UmbracoProject.csproj`. Run `cd src/UmbracoProject && dotnet restore && dotnet build -c Release` — must succeed with zero warnings (TWAE is on; if any SeoToolkit tag-helper or composer was inadvertently referenced anywhere, the build catches it). Confirm `ls src/UmbracoProject/bin/Release/net10.0/SeoToolkit*.dll 2>/dev/null` returns nothing. Grep the codebase one more time: `grep -rni "SeoToolkit\|render-script\|meta-fields" src/UmbracoProject --include="*.cs" --include="*.cshtml" --include="*.json" --include="*.config"` should return zero matches (excluding `obj/` and `bin/`). Run the smoke spec — all four assertions still GREEN. Run the full Playwright suite to catch any regressions in unrelated tests: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test --reporter=list`. Also run xUnit tests: `cd tests/UmbracoProject.Tests && dotnet test --no-build`. Commit.

**What to build**:
- `src/UmbracoProject/UmbracoProject.csproj` — remove the SeoToolkit PackageReference line.

**Test first**: Already done in Step 1.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build -c Release` — zero warnings.
- [Automated]: `grep -rni "SeoToolkit" src/UmbracoProject --include="*.cs" --include="*.cshtml" --include="*.json" --include="*.config" | grep -v "obj/\|bin/"` — zero matches.
- [Automated]: `ls src/UmbracoProject/bin/Release/net10.0/SeoToolkit*.dll 2>/dev/null | wc -l` — returns 0.
- [Automated]: Full Playwright suite passes (no screenshot baselines regenerated). The `articleCardMetaDescription.spec.ts` suite in particular must stay GREEN.
- [Automated]: xUnit `dotnet test` passes.
- [Manual]: Browse the dev server, spot-check several pages (Home, an Article, the Authors list, the Search page) — render and meta tags identical to before this branch.

---

### Step 6 — Document the new SEO routing in CLAUDE.md

> **Prompt**: Implement Step 6 of `_plans/remove-seotoolkit.md`. Add a new top-level section to `CLAUDE.md` titled "SEO Routing" — place it after the "Search" section and before "CI/CD & Build hygiene". The section documents three things: (1) `/sitemap.xml` is served by `src/UmbracoProject/Controllers/SitemapController.cs`, which renders `Views/Partials/xmlSitemap.cshtml` (the same partial that powered the legacy `/xmlsitemap` URL); (2) `/robots.txt` is a static file at `src/UmbracoProject/wwwroot/robots.txt` — edit it in-repo, deploy via the normal pipeline, the `Sitemap:` directive references Live's URL by convention; (3) 404s for non-existent published pages are handled by `Controllers/NotFoundContentFinder.cs` registered via `Controllers/NotFoundComposer.cs`, which resolves to the published `Error` doc-type node and sets HTTP 404; static-asset 404s are NOT intercepted (the `IContentLastChanceFinder` interface only fires when Umbraco's content routing finds nothing, which happens after ASP.NET's static-file middleware has already given up). Add one sentence noting Umbraco's built-in URL Tracker is active (default) and handles rename-redirects automatically without code. Add one sentence noting we deliberately removed SeoToolkit.Umbraco — link to `_specs/shipped/remove-seotoolkit.md` for the rationale (the file will land there after `/feature update` ships in Step 7). Keep the whole section under 200 lines — this is a navigational aid, not a tutorial. Commit.

**What to build**:
- `CLAUDE.md` — new "SEO Routing" section inserted between "Search" and "CI/CD & Build hygiene".

**Validation**:
- [Manual]: Open `CLAUDE.md`, search for "SEO Routing" — section exists, contains the three subsections, is ≤ 200 lines.
- [Manual]: A reader who has never seen this branch can answer "where does /sitemap.xml come from?" by reading only that section.

---

### Step 7 — Verify feature behavioral spec

> **Prompt**: Run `/feature update _features/remove-seotoolkit.md` to verify the living behavioral spec reflects the actual implementation. Review each scenario against the shipped code and test results: (1) `_features/remove-seotoolkit.md` scenarios should all be marked as covered with concrete file-line references in the Test Coverage table (rows for sitemap/robots/404/legacy-URL all point at `tests/e2e/seoRouting.spec.ts:LN`; the `articleCardMetaDescription` row stays as "Pre-existing"); (2) the "Draft" banner at the top of the feature doc is removed; (3) the "Last verified" date is set to today; (4) revision notes get a second line: `{today}: Verified against shipped implementation (PR #N)`. Then move the spec to its shipped location: `mv _specs/remove-seotoolkit.md _specs/shipped/remove-seotoolkit.md`. Update the Increments table inside the feature doc to reflect the shipped status (check the checkbox, point the link at `_specs/shipped/remove-seotoolkit.md`). Update ROADMAP.md to reflect the shipped status if there's a relevant entry; if not, add a closed entry under the "Recently shipped" section. Commit.

**What to build**:
- `_features/remove-seotoolkit.md` — verified scenarios, populated coverage table, Draft banner removed.
- Move `_specs/remove-seotoolkit.md` → `_specs/shipped/remove-seotoolkit.md`.
- Update `ROADMAP.md` if a relevant entry exists.

**Validation**:
- [Manual]: Every scenario in `_features/remove-seotoolkit.md` matches observable behavior in the deployed site.
- [Manual]: Test coverage table has no unexpected "Not covered" gaps (the static-asset 404 edge case is covered by the manual check in Step 2, not by an automated test — that's acceptable; mark it as "Manual" if useful).
- [Manual]: The spec file has been moved into the shipped/ subfolder.

---

## File Summary

| Action | File |
|--------|------|
| Create | `tests/e2e/seoRouting.spec.ts` |
| Create | `src/UmbracoProject/Controllers/NotFoundContentFinder.cs` |
| Create | `src/UmbracoProject/Controllers/NotFoundComposer.cs` |
| Create | `src/UmbracoProject/Controllers/SitemapController.cs` |
| Create | `src/UmbracoProject/wwwroot/robots.txt` |
| Modify | `src/UmbracoProject/Views/xMLSitemap.cshtml` (replace with single-line 301) |
| Modify | `src/UmbracoProject/UmbracoProject.csproj` (remove SeoToolkit PackageReference) |
| Modify | `CLAUDE.md` (new "SEO Routing" section) |
| Modify | `ROADMAP.md` (if a relevant entry exists; otherwise add a closed entry) |
| Move | `_specs/remove-seotoolkit.md` → `_specs/shipped/remove-seotoolkit.md` |
| Update | `_features/remove-seotoolkit.md` (remove Draft banner, fill coverage table, update revision notes) |
