# Spec for arch-migrate-routing-infra

> This spec captures initial requirements and design rationale. This is a `fix-infra` relocation — its durable record is the CLAUDE.md *Solution architecture* + *SEO Routing* sections. The SEO Routing behavior itself is unchanged, so [_features/seo-routing.md](../_features/seo-routing.md) is not modified.

branch: claude/feature/arch-migrate-routing-infra
**Work type**: fix-infra — behavior-preserving architectural relocation, no standing behavior change; see CLAUDE.md → Workflow layers → "Work types"

## Summary

Step (3) of `arch-feature-folder-migration`: migrate the cross-cutting routing/SEO infrastructure out of the thin host into the `UmbracoProject.Features` RCL, in two parts:

- **(A) The branded-404 content finder.** Move `NotFoundContentFinder` (an `IContentLastChanceFinder` that resolves unmatched URLs to the published `Error` doc-type node and sets HTTP 404) and its registering `NotFoundComposer` from the host root (namespace `UmbracoProject`) into the RCL — finder → `Infrastructure/ContentFinder/` (mirroring the reference's `Infrastructure/ContentFinder/Custom404ContentFinder.cs`), composer → `Composer/` (beside `SearchServiceComposer` and `AssignMembersToPremiumRoleComposer`). Namespaces mirror folders: `UmbracoProject.Features.Infrastructure.ContentFinder` and `UmbracoProject.Features.Composer`.
- **(B) The sitemap rewrite middleware.** Extract the inline `/sitemap.xml` → `/xmlsitemap` URL-rewrite currently written as an anonymous `app.Use(...)` lambda in `Program.cs` (between `UseHttpsRedirection()` and `UseUmbraco()`) into the RCL under `Infrastructure/` as a named middleware class plus an `IApplicationBuilder` extension method, leaving `Program.cs` with a single registration call in the **same pipeline position**.

Both pieces are model-decoupled (the finder resolves by doc-type alias via `IDocumentNavigationQueryService` and returns `IPublishedContent` — no `PublishedModels.*` types), so neither depends on anything beyond the already-shipped RCL scaffolding. This is a **behavior-preserving relocation**: every observable `/sitemap.xml` and 404 behavior stays identical; only the code's home changes. It continues moving the SEO routing surface behind the compile-enforced host/RCL boundary the Pillar 2 push rewards.

## Functional Requirements

- `NotFoundContentFinder` relocates to `src/UmbracoProject.Features/Infrastructure/ContentFinder/` with namespace `UmbracoProject.Features.Infrastructure.ContentFinder`; its full doc-comment rationale (static-file-middleware ordering, `/umbraco`+`/api/` guard, alias-based Home/Error resolution, v18-forward navigation API) travels with it unchanged.
- `NotFoundComposer` relocates to `src/UmbracoProject.Features/Composer/` with namespace `UmbracoProject.Features.Composer`; it still registers the finder via `SetContentLastChanceFinder<NotFoundContentFinder>()`.
- The finder is registered by **cross-assembly composer auto-discovery** — no `Program.cs` edit for the finder (the mechanism proven by the Search and premium-role slices).
- The sitemap rewrite becomes a named middleware class + an `IApplicationBuilder` extension method, both in the RCL under `Infrastructure/`; the carried-over comment explains *why* a rewrite (not a SurfaceController/IContentFinder) is used.
- `Program.cs` replaces the inline `app.Use(...)` lambda with a single call to the new extension method, in the **same position**: after `app.UseHttpsRedirection()` and before `app.UseUmbraco()`. (Unlike the finder, the middleware *does* require this one-line `Program.cs` change — middleware is explicitly ordered in the request pipeline and is not auto-discovered.)
- The two finder/composer source files are **removed** from `src/UmbracoProject/` (a move, not a copy) — no leftover host `IContentLastChanceFinder` registration.
- The solution builds clean under `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`; `tests/e2e/seoRouting.spec.ts` stays 4/4 GREEN; the xUnit suite stays green.
- No `.uda` schema files change.

## Possible Edge Cases

- **Pipeline-order regression**: the rewrite must run *before* `app.UseUmbraco()` (so Umbraco's content routing sees `/xmlsitemap`, no extension) and after `UseHttpsRedirection()`. If the extracted extension method is called in the wrong position, `/sitemap.xml` breaks (the `.xml` extension gets filtered out of content routing). The registration call's position in `Program.cs` is load-bearing.
- **Last-chance-finder is a single slot**: `SetContentLastChanceFinder<T>()` *replaces* rather than adds. If a stale host copy of the composer survives the move, two composers fight over the one slot. The move (not copy) requirement guards this.
- **Auto-discovery silently not firing**: the highest-risk failure mode — the composer compiles and moves but `TypeLoader` doesn't pick it up, so unmatched URLs fall back to Umbraco's stock "Page Not Found" instead of the branded Error page. Must be positively verified.
- **Cache-Control is not in scope**: the `Cache-Control: public, max-age=3600` on `/sitemap.xml` is set in the view/cached-partial layer ([Views/Partials/xmlSitemap.cshtml](../src/UmbracoProject/Views/Partials/xmlSitemap.cshtml) / [Views/xMLSitemap.cshtml](../src/UmbracoProject/Views/xMLSitemap.cshtml)), **not** in the middleware. This slice moves only the path-rewrite; the caching behavior is untouched and must continue to work.
- **`Microsoft.Extensions`/`IApplicationBuilder` usings**: as with the premium-role handler, the host supplies some implicit usings the RCL does not (`Microsoft.AspNetCore.Builder`, `Microsoft.AspNetCore.Http`); the relocated middleware/extension must carry explicit `using`s to build in the RCL.
- **`.uda` / schema**: C#-only slice; any `.uda` diff from local startup is incidental and must be discarded.

## Acceptance Criteria

- `NotFoundContentFinder` lives at `src/UmbracoProject.Features/Infrastructure/ContentFinder/NotFoundContentFinder.cs` (namespace `UmbracoProject.Features.Infrastructure.ContentFinder`) and no longer exists under `src/UmbracoProject/`.
- `NotFoundComposer` lives at `src/UmbracoProject.Features/Composer/NotFoundComposer.cs` (namespace `UmbracoProject.Features.Composer`) and no longer exists under `src/UmbracoProject/`.
- The sitemap rewrite lives in the RCL as a named middleware + `IApplicationBuilder` extension under `src/UmbracoProject.Features/Infrastructure/`; `Program.cs` calls it via one line between `UseHttpsRedirection()` and `UseUmbraco()`, and no longer contains the inline `app.Use(...)` rewrite lambda.
- A visitor requesting `/sitemap.xml` still receives the XML sitemap body (client-visible URL stays `/sitemap.xml`); `/xmlsitemap` still serves the same content.
- A visitor requesting an unknown URL still receives the branded Error page with HTTP status 404; `/umbraco`- and `/api/`-prefixed unmatched requests are still skipped by the finder.
- The finder is registered with no `Program.cs` edit (auto-discovery); the middleware is registered with exactly the one-line `Program.cs` call.
- `dotnet build -c Release` and `dotnet test --no-build` pass clean; `tests/e2e/seoRouting.spec.ts` stays 4/4 GREEN.
- No `.uda` schema files change.

## Scenarios (Draft)

Draft BDD scenarios derived from the acceptance criteria via Example Mapping. As a `fix-infra` slice there is no `_features/` doc; the SEO Routing behavior contract already lives in [_features/seo-routing.md](../_features/seo-routing.md) and `tests/e2e/seoRouting.spec.ts`.

### Rule: /sitemap.xml still serves the XML sitemap after the middleware moves to the RCL

```scenario
Scenario: Visitor requests the sitemap by its canonical URL
  Given the rewrite middleware now lives in the UmbracoProject.Features RCL
  When a visitor requests /sitemap.xml
  Then they receive the XML sitemap document
  And the address in their browser stays /sitemap.xml

Scenario: The natural template URL still works
  When a visitor requests /xmlsitemap
  Then they receive the same XML sitemap document
```

### Rule: Unknown URLs still resolve to the branded 404 via auto-discovery

```scenario
Scenario: Visitor hits a URL that matches no content
  Given NotFoundContentFinder now lives in the RCL and Program.cs has no finder registration
  When a visitor requests /this-page-does-not-exist
  Then they receive the branded Error page
  And the HTTP status is 404

Scenario: Umbraco and API paths are left alone
  When a request for /umbraco/something-unmatched or /api/whatever-unmatched is made
  Then the branded Error finder does not claim it
```

### Rule: The relocation is behavior- and schema-neutral

```scenario
Scenario: The SEO smoke spec stays green
  Given the finder, composer, and rewrite middleware have moved to the RCL
  When tests/e2e/seoRouting.spec.ts runs against the site
  Then all 4 scenarios pass

Scenario: Build and unit tests stay green
  When dotnet build -c Release and dotnet test --no-build run
  Then both succeed with no warnings-as-errors failures

Scenario: No schema artifacts change
  Given the slice touches only C# files
  When git status is inspected after a clean local startup
  Then no .uda files under umbraco/Deploy/Revision/ are modified by this slice
```

### Rule: The finder and middleware land in the by-kind RCL taxonomy

```scenario
Scenario: Files are in the expected RCL folders with mirrored namespaces
  Given the solution has been built
  When the codebase is inspected
  Then NotFoundContentFinder is under Infrastructure/ContentFinder/ with namespace UmbracoProject.Features.Infrastructure.ContentFinder
  And NotFoundComposer is under Composer/ with namespace UmbracoProject.Features.Composer
  And the sitemap middleware + its IApplicationBuilder extension are under Infrastructure/
  And no copy of the finder or composer remains under src/UmbracoProject/
```

## Open Questions

- Does Step 3's verification rely on `seoRouting.spec.ts` (run locally / on Dev) as the behavior proof, plus a local manual check of `/sitemap.xml` + a 404 URL? (Recommendation: yes — the smoke spec is the contract; add a quick local curl of `/sitemap.xml` and an unknown URL to confirm both finder auto-discovery and middleware ordering before pushing.)
- Naming for the middleware + extension method (e.g. `SitemapRewriteMiddleware` + `UseSitemapRewrite()`): confirm during planning, following any existing RCL/extension naming convention.

## Testing Guidelines

Keep tests focused on what a relocation can actually break — pipeline ordering, auto-discovery, and behavior preservation — leaning on the existing E2E contract rather than adding heavy new coverage:

- Rely on the existing `tests/e2e/seoRouting.spec.ts` (4 scenarios) as the primary behavior contract; it must stay GREEN. Do not duplicate it.
- If a host-free unit test adds value, consider a focused test of the rewrite middleware's path logic (`/sitemap.xml` → `/xmlsitemap`; non-sitemap paths pass through untouched) using a stubbed `HttpContext`/`RequestDelegate` — mirroring the project's existing xUnit style. The finder and composer registration are best verified at runtime (per the Search/premium-role precedent: `SetContentLastChanceFinder` / auto-discovery need a host harness to unit-test).
- Reuse the existing xUnit project (`tests/UmbracoProject.Tests/`); no new test project.
