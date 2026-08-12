# Plan: Migrate Routing/SEO Infrastructure to RCL

**Spec**: `_specs/arch-migrate-routing-infra.md`
**Branch**: `claude/feature/arch-migrate-routing-infra`
**Work type**: fix-infra — behavior-preserving architectural relocation; drives the final step (durable record → CLAUDE.md, no `_features/` doc)

## Context

Step (3) of `arch-feature-folder-migration`: move the cross-cutting routing/SEO infra into the `UmbracoProject.Features` RCL. Two independent pieces: **(A)** `NotFoundContentFinder` (`IContentLastChanceFinder` → branded 404) + its `NotFoundComposer` move from the host root into `Infrastructure/ContentFinder/` + `Composer/`; **(B)** the inline `/sitemap.xml` → `/xmlsitemap` rewrite lambda in `Program.cs` is extracted into a named middleware class + `IApplicationBuilder` extension in the RCL `Infrastructure/`, with `Program.cs` keeping a one-line call in the **same pipeline position**. Both are model-decoupled. Behavior is preserved exactly; the contract is `tests/e2e/seoRouting.spec.ts` (4 scenarios) plus the existing `_features/seo-routing.md`. The finder relies on cross-assembly composer auto-discovery (proven by the Search + premium-role slices); the middleware, being pipeline-ordered, keeps an explicit `Program.cs` registration.

This builds directly on the just-shipped `arch-migrate-premium-role-handler` slice — the RCL `Infrastructure/` and `Composer/` folders already exist and hold migrated code.

---

## Key Decisions

- **Two independent pieces, sequenced middleware-first**: Part B (middleware) gets real TDD — its path-rewrite logic is host-free unit-testable. Part A (finder/composer) is a pure move verified by the existing E2E + a runtime check (registration via `SetContentLastChanceFinder` needs a host harness to unit-test, per the Search/premium-role precedent — not worth it). Doing B first means the `Program.cs` edit and the move are in separate, independently-revertable steps.
- **Middleware shape**: a conventional middleware class `SitemapRewriteMiddleware` (constructor takes `RequestDelegate next`; `public async Task InvokeAsync(HttpContext context)`) plus a `public static IApplicationBuilder UseSitemapRewrite(this IApplicationBuilder app)` extension. This mirrors the inline lambda's exact behavior (rewrite `/sitemap.xml` → `/xmlsitemap`, else pass through) and is the most unit-testable form. Both land under `src/UmbracoProject.Features/Infrastructure/` (namespace `UmbracoProject.Features.Infrastructure`). The full "why a rewrite, not a SurfaceController/IContentFinder" comment travels into the class.
- **Naming**: `SitemapRewriteMiddleware` + `UseSitemapRewrite()` — descriptive, no existing convention to match (grep found none).
- **Finder/composer namespaces mirror folders**: finder → `UmbracoProject.Features.Infrastructure.ContentFinder`; composer → `UmbracoProject.Features.Composer` (gains `using UmbracoProject.Features.Infrastructure.ContentFinder;`).
- **Explicit usings in the RCL**: as with the premium-role handler, the host supplies some implicit usings the RCL doesn't. The middleware needs `Microsoft.AspNetCore.Builder`, `Microsoft.AspNetCore.Http`; the finder already has explicit Umbraco usings and needs no addition (verify on build).
- **Test project may need a framework reference**: unit-testing middleware uses `Microsoft.AspNetCore.Http.DefaultHttpContext`. If it doesn't resolve transitively in `tests/UmbracoProject.Tests/` (a `Microsoft.NET.Sdk` project), add `<FrameworkReference Include="Microsoft.AspNetCore.App" />` to the test csproj — a clean, justified addition. Try the build first; only add if the type is unresolved.
- **Pipeline position is load-bearing**: the `UseSitemapRewrite()` call must stay between `app.UseHttpsRedirection()` and `app.UseUmbraco()`. Wrong position breaks `/sitemap.xml` (the `.xml` extension gets filtered from content routing).
- **No schema churn**: C#-only. Discard incidental `.uda` regeneration (`git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/`).

---

## Steps

Each step is designed to be completed independently in its own context window.

---

### Step 1 — Extract the sitemap rewrite into an RCL middleware + extension (TDD)

> **Prompt**: Implement Step 1 of `_plans/arch-migrate-routing-infra.md`. First write a host-free unit test `tests/UmbracoProject.Tests/Infrastructure/SitemapRewriteMiddlewareTests.cs` (namespace `UmbracoProject.Tests.Infrastructure`) for a not-yet-existing `UmbracoProject.Features.Infrastructure.SitemapRewriteMiddleware`. Two facts using `Microsoft.AspNetCore.Http.DefaultHttpContext` + a `RequestDelegate` stub that records invocation: (1) a request with `Path == "/sitemap.xml"` is rewritten to `/xmlsitemap` and `next` is called; (2) a request with `Path == "/about"` is left unchanged and `next` is called. Confirm RED (won't compile — the class doesn't exist; if `DefaultHttpContext` itself is unresolved, add `<FrameworkReference Include="Microsoft.AspNetCore.App" />` to `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj`). Then create `src/UmbracoProject.Features/Infrastructure/SitemapRewriteMiddleware.cs` — a conventional middleware (`ctor(RequestDelegate next)`, `public async Task InvokeAsync(HttpContext context)`) that does exactly what the current inline `app.Use(...)` lambda in `Program.cs` (lines 27–35) does: if `context.Request.Path.Equals("/sitemap.xml", StringComparison.OrdinalIgnoreCase)` set `context.Request.Path = "/xmlsitemap"`, then `await _next(context)`. Carry the full explanatory comment (lines 18–26 of `Program.cs`) into the class. Add an `IApplicationBuilder` extension `UseSitemapRewrite()` (same file or a sibling `SitemapRewriteMiddlewareExtensions.cs` in `Infrastructure/`). Then edit `src/UmbracoProject/Program.cs`: remove the inline `app.Use(...)` lambda + its comment and replace with a single `app.UseSitemapRewrite();` call in the SAME position (after `app.UseHttpsRedirection()`, before `app.UseUmbraco()`); add `using UmbracoProject.Features.Infrastructure;` if needed. Run `cd src/UmbracoProject && dotnet build -c Release` and `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj -c Release` — build clean (warnings-as-errors), the 2 new tests GREEN, full suite green. Discard any `.uda` churn.

**What to build**:
- `tests/UmbracoProject.Tests/Infrastructure/SitemapRewriteMiddlewareTests.cs` (test-first).
- `src/UmbracoProject.Features/Infrastructure/SitemapRewriteMiddleware.cs` (middleware + `UseSitemapRewrite()` extension; namespace `UmbracoProject.Features.Infrastructure`; explicit `using Microsoft.AspNetCore.Builder; using Microsoft.AspNetCore.Http;`).
- Edit `src/UmbracoProject/Program.cs` — replace inline lambda with `app.UseSitemapRewrite();` in the same pipeline slot.
- If needed: `<FrameworkReference Include="Microsoft.AspNetCore.App" />` in the test csproj.

**Test first**:
- Write the two-fact middleware test → RED (class missing). Then implement → GREEN.
- Run: `cd /Users/dkardys/Sites/umbraco-17-demo-site && dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj -c Release`

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build -c Release` — 0 warnings / 0 errors.
- [Automated]: `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj -c Release` — new middleware tests pass; full suite green.
- [Manual]: `Program.cs` shows `app.UseSitemapRewrite();` between `UseHttpsRedirection()` and `UseUmbraco()`, and no inline `app.Use(...)` rewrite lambda remains.

---

### Step 2 — Move NotFoundContentFinder + NotFoundComposer into the RCL

> **Prompt**: Implement Step 2 of `_plans/arch-migrate-routing-infra.md`. Move two files from the host into the RCL using `git mv`: (1) `src/UmbracoProject/NotFoundContentFinder.cs` → `src/UmbracoProject.Features/Infrastructure/ContentFinder/NotFoundContentFinder.cs`, change namespace `UmbracoProject` → `UmbracoProject.Features.Infrastructure.ContentFinder` (preserve the full doc-comment and the `/umbraco`+`/api/` guard byte-for-byte); (2) `src/UmbracoProject/NotFoundComposer.cs` → `src/UmbracoProject.Features/Composer/NotFoundComposer.cs`, change namespace `UmbracoProject` → `UmbracoProject.Features.Composer` and add `using UmbracoProject.Features.Infrastructure.ContentFinder;` so it can still reference the finder in `SetContentLastChanceFinder<NotFoundContentFinder>()`. Delete both host originals (the `git mv` handles this). Confirm nothing else in `src/UmbracoProject/` references these types: `grep -rn "NotFoundContentFinder\|NotFoundComposer" src/UmbracoProject/ --include=*.cs` should return zero after the move. Run `cd src/UmbracoProject && dotnet build -c Release && dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj -c Release` — clean build (warnings-as-errors), all tests green. Then `git status` and discard any incidental `.uda` changes with `git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/`.

**What to build**:
- `git mv` finder → `src/UmbracoProject.Features/Infrastructure/ContentFinder/` + namespace `UmbracoProject.Features.Infrastructure.ContentFinder`.
- `git mv` composer → `src/UmbracoProject.Features/Composer/` + namespace `UmbracoProject.Features.Composer`, add `using UmbracoProject.Features.Infrastructure.ContentFinder;`.
- Confirm zero remaining host references; no `.uda` churn staged.

**Test first**:
- No new unit test — `seoRouting.spec.ts` + the Step 3 runtime check are the safety net (finder registration needs a host harness, per precedent).

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build -c Release && dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj -c Release` — clean, all green.
- [Automated]: `grep -rn "NotFoundContentFinder\|NotFoundComposer" src/UmbracoProject/ --include=*.cs` returns nothing.
- [Manual]: `git status` shows only the two renames (+ Step 1's changes if uncommitted) and no `.uda` modifications.

---

### Step 3 — Runtime + E2E verification (finder auto-discovery + middleware ordering)

> **Prompt**: Implement Step 3 of `_plans/arch-migrate-routing-infra.md`. This verifies the two relocations preserved behavior end-to-end. Start the site: `cd src/UmbracoProject && dotnet run -c Release` (serves https://localhost:44367). Once up, confirm three things with curl (use `-k` for the dev cert): (1) `GET /sitemap.xml` returns HTTP 200 with an XML body containing `<urlset>` and a Home `<loc>` (proves the relocated middleware is registered in the right pipeline position); (2) `GET /xmlsitemap` returns the sitemap body or a 301 to `/sitemap.xml`; (3) `GET /this-page-does-not-exist` returns HTTP 404 with a body containing the branded eyebrow `404 · Not found` (proves the relocated NotFoundContentFinder is still discovered by TypeLoader across the assembly boundary — the load-bearing check). Then run the E2E contract against the running local site: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/seoRouting.spec.ts` (ensure `URL`/baseURL points at localhost:44367). Confirm all 4 scenarios pass. Record the results. Stop the site when done.

**What to build**: nothing — verification gate.

**Validation**:
- [Manual]: `curl -k https://localhost:44367/sitemap.xml` → 200, XML with `<urlset>`.
- [Manual]: `curl -k -o /dev/null -w "%{http_code}" https://localhost:44367/this-page-does-not-exist` → 404, and the body contains `404 · Not found` (branded finder works → auto-discovery confirmed).
- [Automated]: `npx playwright test tests/e2e/seoRouting.spec.ts` → 4/4 GREEN.

---

### Step 4 — Record the durable behavior (fix-infra) and archive

> **Prompt**: Implement Step 4 of `_plans/arch-migrate-routing-infra.md`. This is a `fix-infra` slice — no `_features/` doc. Update durable records: (1) `CLAUDE.md` → *Solution architecture* → `Infrastructure/` bullet: `NotFoundContentFinder` and the `/sitemap.xml` rewrite have now migrated (they were listed as pending) — update so only the `HelloWorld` ImageGenerator/Palettes clusters (step 4) and the optional view tier (step 5) remain as future migration. (2) `CLAUDE.md` → *SEO Routing* section: the `/sitemap.xml` subsection says the rewrite is "in `Program.cs`" and the 404 subsection says `NotFoundContentFinder.cs` / `NotFoundComposer.cs` are "both at the project root, not in a Controllers/ folder" — update both to their new RCL locations (`UmbracoProject.Features/Infrastructure/` for the middleware, `Infrastructure/ContentFinder/` for the finder, `Composer/` for the composer), noting `Program.cs` now calls `app.UseSitemapRewrite()`. (3) `ROADMAP.md`: mark `arch-feature-folder-migration` ordering step (3) ✅ done (like steps 1 and 2), so step (4) — the `HelloWorld` clusters — is next. (4) Confirm the shipped spec carries the ACs (it does). Then archive: `git mv _specs/arch-migrate-routing-infra.md _specs/shipped/` and `git mv _plans/arch-migrate-routing-infra.md _plans/shipped/`. Do NOT create any `_features/*.md` (the SEO Routing behavior is unchanged).

**Validation**:
- [Manual]: CLAUDE.md *Solution architecture* `Infrastructure/` bullet + *SEO Routing* section reflect the new RCL locations; nothing still says the finder/rewrite are in the host root / `Program.cs` inline.
- [Manual]: ROADMAP `arch-feature-folder-migration` step (3) marked done; step (4) is next.
- [Manual]: Nothing filed under `_features/`; spec + plan now under their `shipped/` folders.

---

## File Summary

| Action | File |
|--------|------|
| Create | `tests/UmbracoProject.Tests/Infrastructure/SitemapRewriteMiddlewareTests.cs` |
| Create | `src/UmbracoProject.Features/Infrastructure/SitemapRewriteMiddleware.cs` (middleware + `UseSitemapRewrite()` extension) |
| Modify | `src/UmbracoProject/Program.cs` (replace inline rewrite lambda with `app.UseSitemapRewrite();`) |
| Modify *(only if needed)* | `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` (`FrameworkReference` Microsoft.AspNetCore.App) |
| Move (host → RCL) + namespace | `src/UmbracoProject/NotFoundContentFinder.cs` → `src/UmbracoProject.Features/Infrastructure/ContentFinder/NotFoundContentFinder.cs` |
| Move (host → RCL) + namespace | `src/UmbracoProject/NotFoundComposer.cs` → `src/UmbracoProject.Features/Composer/NotFoundComposer.cs` |
| Modify | `CLAUDE.md` (Solution architecture `Infrastructure/` bullet + SEO Routing section) |
| Modify | `ROADMAP.md` (mark `arch-feature-folder-migration` step (3) done) |
| Move | `_specs/arch-migrate-routing-infra.md` → `_specs/shipped/` |
| Move | `_plans/arch-migrate-routing-infra.md` → `_plans/shipped/` |
| Update *(fix-infra)* | CLAUDE.md / ROADMAP only — **no `_features/` file** |
