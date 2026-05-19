# Plan: Extract Search Service

**Spec**: `_specs/extract-search-service.md`
**Branch**: `claude/feature/extract-search-service`

## Context

Audit P0.2 from `_audits/2026-05-19-umbraco-17-demo-site.md`: the search pipeline (Examine-vs-AI routing, 5-minute cache, system-doc-type filtering, fallback chain) lives inside [Views/search.cshtml](src/UmbracoProject/Views/search.cshtml) — interesting business logic trapped in a Razor view. This plan extracts it into a `SearchService` registered via `IComposer`, with the view becoming a thin renderer. The existing [tests/e2e/search.spec.ts](tests/e2e/search.spec.ts) is a 167-line characterization suite already covering the page shell, results, system-doc exclusion, post-meta, and XSS — the refactor must keep it green. The only behavior the existing E2E doesn't assert is the mode label (added in Step 5).

This plan also creates the project's first xUnit test project (`tests/UmbracoProject.Tests/`). That artifact is co-authored with audit P0.3 in spirit; P0.3 will later add PaletteService tests on top of the same scaffolding. The .csproj is set up to be the seed for future unit tests across the codebase.

---

## Key Decisions

- **Service contract**: `ISearchService.SearchAsync(string query, CancellationToken ct)` returns a `SearchResult` record containing `IReadOnlyList<IPublishedContent> Items`, `SearchMode Mode` (enum: `Keyword | AiSemantic`), and `int TotalCount`. The view needs `Mode` to render the label; returning the enum (not a string) keeps localization a view concern. `IPublishedContent` items (not DTOs) preserve the existing `_ArticleCard.cshtml` rendering — DTO mapping is a v2 increment when a Delivery API endpoint is added.
- **Service location**: `src/UmbracoProject/Services/SearchService.cs` (new `Services/` folder). Starts the convention the Kittitas comparison in the audit recommends. Namespace: `UmbracoProject.Services`.
- **DI registration**: new `SearchServiceComposer` in `src/UmbracoProject/Services/SearchServiceComposer.cs` calling `builder.Services.AddTransient<ISearchService, SearchService>()`. Matches the project's "one composer per concern" pattern ([SearchComposer.cs](src/UmbracoProject/SearchComposer.cs), [PaletteServiceComposer.cs](src/HelloWorld/PaletteServiceComposer.cs)). Do **not** fold registration into existing `SearchComposer` — that one's purpose is wiring the Umbraco.Cms.Search providers, not project services.
- **Test project**: `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj`. Stack: xUnit + NSubstitute (lighter mocking syntax than Moq, good fit for the small surface). Targets `net10.0` to match the main project. Project reference back to `src/UmbracoProject/UmbracoProject.csproj` so internals are accessible if needed (default is no, but the reference is structural).
- **Cache testing**: pass a real `MemoryCache` instance to the service in unit tests rather than mocking `IMemoryCache`. Simpler, exercises real cache semantics, and the cache is the unit under test as much as the routing logic is.
- **Mode label localization**: leave the literal strings `"Keyword"` / `"AI semantic"` in the view's ternary for now (matches today's behavior). A `Search.Mode.Keyword` / `Search.Mode.AiSemantic` dictionary entry is a follow-up if/when the site goes multilingual — out of scope.
- **`Take(20)` semantics preserved**: the view today asks the searcher for `max(20, DefaultTopK)` raw hits and `Take(20)` after filtering. Service preserves both — request headroom, display 20. The display cap stays hardcoded; the searcher cap stays config-bound.
- **Logging**: add one structured `_logger.LogDebug` on the cache-miss path (`"Search cache miss for {Mode} mode, query length {QueryLength}"`) plus one `_logger.LogDebug` on the AI→keyword fallback (`"AI semantic returned no results, falling back to keyword search"`). No logging of the query itself (PII / log-spam hygiene). Single-debug entries; not a logging overhaul.
- **Central package management (P2.3)**: the audit recommends introducing `Directory.Packages.props` at the moment a third .csproj is added — which is what this plan does. **Decision: defer to a follow-up small change.** This plan ships the test project with its own `<PackageReference>` entries; the centralization happens in a separate PR so the SearchService refactor isn't entangled with a NuGet reorg.
- **What the existing search.spec.ts already covers** (do **not** rewrite — extend): page shell, empty query, results, system-doc-type exclusion, post-meta rendering, XSS via `<script>`, XSS via `onerror`, AI semantic capability. **Missing**: mode-label assertion. Step 5 adds it.

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Add the xUnit test project

> **Prompt**: Implement Step 1 of `_plans/extract-search-service.md`. Create `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` targeting `net10.0` with `Microsoft.NET.Test.Sdk`, `xunit`, `xunit.runner.visualstudio`, and `NSubstitute` package references (use current stable versions). Add a `ProjectReference` to `../../src/UmbracoProject/UmbracoProject.csproj`. Add a single smoke test file `tests/UmbracoProject.Tests/SmokeTests.cs` with one `[Fact] public void True_IsTrue() => Assert.True(true);`. Update `umbraco-17-demo-site.sln` to include the new project under a "tests" solution folder. Run `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` from the repo root and confirm one test passes. Do not modify any other file.

**What to build**:
- `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` — net10.0, references above
- `tests/UmbracoProject.Tests/SmokeTests.cs` — `namespace UmbracoProject.Tests; public class SmokeTests { [Fact] public void True_IsTrue() => Assert.True(true); }`
- `umbraco-17-demo-site.sln` — add the new project under a new "tests" solution folder (folder GUID `{2150E333-8FDC-42A3-9474-1A3956D46DE8}`)

**Validation**:
- [Automated]: `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` — output shows `Passed!  - Failed: 0, Passed: 1, Skipped: 0`
- [Automated]: `dotnet build umbraco-17-demo-site.sln` — solution-wide build still succeeds

---

### Step 2 — Define the service contract and write failing unit tests (RED)

> **Prompt**: Implement Step 2 of `_plans/extract-search-service.md`. The xUnit project exists at `tests/UmbracoProject.Tests/` from Step 1. Create the public service contract in `src/UmbracoProject/Services/` (folder is new): an `ISearchService` interface with one method `Task<SearchResult> SearchAsync(string query, CancellationToken cancellationToken = default)`, a `SearchResult` record carrying `IReadOnlyList<IPublishedContent> Items`, `SearchMode Mode`, and `int TotalCount`, and a `SearchMode` enum with values `Keyword` and `AiSemantic`. Do **not** create the `SearchService` implementation yet. Then write `tests/UmbracoProject.Tests/Services/SearchServiceTests.cs` with the failing test cases listed below. The test class instantiates the (not-yet-existing) `SearchService` via NSubstitute mocks for `IPublishedContentQuery` and `ISearcherResolver`, a real `MemoryCache`, mocked `IOptions<AIVectorSearchOptions>` returning `DefaultTopK = 50`, and a NullLogger. Run `dotnet build` — expect a compilation failure because `SearchService` doesn't exist yet. That's RED. Do **not** implement the service in this step.

**What to build**:
- `src/UmbracoProject/Services/ISearchService.cs` — interface as described above; namespace `UmbracoProject.Services`
- `src/UmbracoProject/Services/SearchResult.cs` — `public sealed record SearchResult(IReadOnlyList<IPublishedContent> Items, SearchMode Mode, int TotalCount);`
- `src/UmbracoProject/Services/SearchMode.cs` — `public enum SearchMode { Keyword, AiSemantic }`
- `tests/UmbracoProject.Tests/Services/SearchServiceTests.cs` — `namespace UmbracoProject.Tests.Services;` containing these `[Fact]` test cases:
  - `EmptyQuery_ReturnsEmptyResult_DoesNotInvokeSearcher` — pass `""` → assert `Items` empty, `searcherResolver.GetSearcher` never called
  - `WhitespaceQuery_ReturnsEmptyResult_DoesNotInvokeSearcher` — pass `"   "` → same as above
  - `NullQuery_ReturnsEmptyResult_DoesNotInvokeSearcher` — pass `null!` → same as above
  - `OneTokenQuery_RoutesToKeywordSearcher` — pass `"contact"` → keyword searcher invoked, AI not
  - `TwoTokenQuery_RoutesToKeywordSearcher_Boundary` — pass `"John Doe"` → keyword invoked, AI not
  - `ThreeTokenQuery_RoutesToAiSearcher_First` — pass `"stories about resilience"` → AI invoked
  - `AiReturnsZeroRawHits_FallsBackToKeyword` — long query, AI mock returns 0 → keyword invoked
  - `AiReturnsHitsAllSystemDocTypes_DoesNotFallBack` — AI returns 1 hit that is a `Category` content type → filtered to 0; keyword NOT invoked (raw-zero gates fallback)
  - `SystemDocTypes_FilteredFromResults` — searcher returns mix of Article + Category + Error → result list contains only Article
  - `ResultLimit_Capped_At_20` — searcher returns 30 articles → result list contains 20
  - `RepeatQuery_WithinCacheWindow_ReturnsCachedResult_SearcherInvokedOnce` — call `SearchAsync("contact")` twice → keyword searcher invoked once across both calls
  - `KeywordAndAi_CacheKeysDistinct` — call `SearchAsync("contact")` (keyword) then `SearchAsync("contact stories of resilience")` (AI) → both searchers invoked once each (no collision)
- Use [Views/search.cshtml](src/UmbracoProject/Views/search.cshtml) lines 22–73 as the behavioral source-of-truth for what these tests should assert. The `docTypesToIgnore` array there is the system-doc-type set.

**Test first** *(this IS the test-first step)*:
- The test file is the deliverable. Confirm it fails compilation because `SearchService` doesn't exist. That is the expected RED state.
- Run: `dotnet build umbraco-17-demo-site.sln` — expect error CS0246: The type or namespace name 'SearchService' could not be found (or similar).

**Validation**:
- [Automated]: `dotnet build` fails with a missing-type error referencing `SearchService` — confirms RED
- [Automated]: The interface, record, and enum compile cleanly on their own (`dotnet build src/UmbracoProject/UmbracoProject.csproj` succeeds — the test project is what fails)

---

### Step 3 — Implement SearchService (GREEN)

> **Prompt**: Implement Step 3 of `_plans/extract-search-service.md`. The contract types and failing tests exist from Step 2. Create `src/UmbracoProject/Services/SearchService.cs` implementing `ISearchService`. Port the routing/cache/filter/fallback logic from [Views/search.cshtml](src/UmbracoProject/Views/search.cshtml) lines 22–73 verbatim in behavior. Constructor injects `IPublishedContentQuery`, `ISearcherResolver`, `IMemoryCache`, `IOptions<AIVectorSearchOptions>`, and `ILogger<SearchService>`. Token count uses the same `Split(new[] { ' ', '\t', '\n' }, StringSplitOptions.RemoveEmptyEntries).Length` as the view. Cache key format `"search:results:{kw|ai}:{normalized-query}"` and 5-minute TTL preserved. System doc-type filter set: `Category`, `CategoryList`, `Error`, `Search`, `XMLsitemap` — get these from the same `ModelTypeAlias` constants the view uses. Per-page display limit `Take(20)`; searcher cap `Math.Max(20, options.Value.DefaultTopK)`. Add one `_logger.LogDebug` call on cache miss (mode + query length) and one on AI→keyword fallback. Do NOT modify search.cshtml in this step. Run `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` — all SearchServiceTests must pass.

**What to build**:
- `src/UmbracoProject/Services/SearchService.cs` — implementation as described. Namespace `UmbracoProject.Services`. ~80–120 lines.

**Validation**:
- [Automated]: `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` — all SearchServiceTests pass. Confirms GREEN.
- [Automated]: `dotnet build umbraco-17-demo-site.sln` — solution-wide build clean.

---

### Step 4 — Wire DI and refactor search.cshtml to use the service

> **Prompt**: Implement Step 4 of `_plans/extract-search-service.md`. SearchService and ISearchService exist and are tested. Create `src/UmbracoProject/Services/SearchServiceComposer.cs` registering `builder.Services.AddTransient<ISearchService, SearchService>()`. Then refactor `src/UmbracoProject/Views/search.cshtml`: replace the inline `RunSearchAsync` local function, the token-counting, the cache lookup, and the fallback chain (lines 22–73) with a single `var searchResult = await searchService.SearchAsync(searchQuery);` call. Inject `ISearchService` via `@inject UmbracoProject.Services.ISearchService searchService`. Remove the now-unused `@inject` directives for `ISearcherResolver`, `IMemoryCache`, and `IOptions<AIVectorSearchOptions>`. Map `searchResult.Mode` to the display string with `searchResult.Mode == SearchMode.Keyword ? "Keyword" : "AI semantic"`. Render `searchResult.Items` where the view currently renders `results`. **Accessibility guardrail**: the existing `.s-meta` div uses `role="status" aria-live="polite" aria-atomic="true"` so the result count and mode label are announced as a single atomic update by screen readers — keep BOTH the count span and the mode span inside that same status container after the refactor. Do not split the mode label into a separate element outside the live region. Preserve the existing XSS-encoding pipeline (`WebUtility.HtmlEncode(searchQuery.StripHtml())`) for echoing the query back — that stays in the view. Then run `dotnet build`, start the site (`cd src/UmbracoProject && dotnet run`), and manually load `/search?q=contact` (expect "Mode · Keyword" + results) and `/search?q=stories about resilience` (expect "Mode · AI semantic" + results). Then run the existing Playwright suite to confirm no regressions: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/search.spec.ts`.

**What to build**:
- `src/UmbracoProject/Services/SearchServiceComposer.cs` — new composer; one-line registration
- `src/UmbracoProject/Views/search.cshtml` — refactored to use `ISearchService`. Target: the `@{ ... }` block at top shrinks from ~70 lines to ~15 (query parsing + XSS-encoding + headTitle/headDek). The body of the view (form, results loop, empty state) is unchanged.

**Validation**:
- [Automated]: `dotnet build umbraco-17-demo-site.sln` succeeds
- [Automated]: `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` still passes (no regression in unit tests)
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/search.spec.ts` — all 7 existing tests pass (6 page-shell + 1 semantic capability)
- [Manual]: Load `/search?q=contact` in the browser → shows "Mode · Keyword" and results
- [Manual]: Load `/search?q=stories about resilience` → shows "Mode · AI semantic" and results
- [Manual]: Load `/search` (no query) → form shows alone, no results / empty state
- [Manual]: View source on `/search?q=<script>alert(1)</script>` → no live `<script>` tag inside `form#search`

---

### Step 5 — Add mode-label coverage to search.spec.ts

> **Prompt**: Implement Step 5 of `_plans/extract-search-service.md`. The refactor is complete and all existing tests pass. The one behavior not covered by [tests/e2e/search.spec.ts](tests/e2e/search.spec.ts) is the mode-label assertion. Extend the existing `'Search — page shell (characterization)'` describe block with two new tests: one for a single-token query showing "Mode · Keyword", one for a 3+ token query showing "Mode · AI semantic". The mode label lives in `.s-meta .mode` in the rendered HTML (see [Views/search.cshtml:115](src/UmbracoProject/Views/search.cshtml#L115)). Run the existing Playwright command to confirm the new tests pass and the old tests still pass: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/search.spec.ts`.

**What to build**:
- `tests/e2e/search.spec.ts` — append two tests inside the existing `'Search — page shell (characterization)'` describe block:
  - `'mode label shows "Keyword" for a single-token query'` — visit `/search?q=contact`, assert `.s-meta .mode b` contains `"Keyword"`
  - `'mode label shows "AI semantic" for a 3+ token query'` — visit `/search?q=stories about resilience`, assert `.s-meta .mode b` contains `"AI semantic"`

**Test first** *(this step is itself the test-writing step for the missing coverage)*:
- These tests are written *against an already-working implementation* (the refactor is done). Treat as a coverage extension, not a TDD RED→GREEN cycle.
- Run: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/search.spec.ts` — all tests pass on first run (no RED expected; the implementation already supports the assertions).

**Validation**:
- [Automated]: All Playwright tests in `search.spec.ts` pass — confirms full mode-label coverage exists.

---

### Step 6 — Verify feature behavioral spec

> **Prompt**: Run `/feature update _features/extract-search-service.md` to verify the living behavioral spec reflects the actual implementation. Review each scenario against the code and test results. Update any scenarios where the implementation diverged from the draft. Fill in the test coverage table with actual test file paths and line numbers — point unit-test scenarios at `tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:Lnn` and E2E scenarios at `tests/e2e/search.spec.ts:Lnn`. Remove the "Draft" banner. Commit the verified feature doc.

**Validation**:
- [Manual]: Every scenario in `_features/extract-search-service.md` matches observable behavior or a passing test
- [Manual]: Test coverage table has no unexpected "Not covered" gaps (the v2/v3/v4 increments listed under "Increments" are out of scope for this verification)

---

## File Summary

| Action | File |
|--------|------|
| Create | `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` |
| Create | `tests/UmbracoProject.Tests/SmokeTests.cs` |
| Create | `tests/UmbracoProject.Tests/Services/SearchServiceTests.cs` |
| Modify | `umbraco-17-demo-site.sln` |
| Create | `src/UmbracoProject/Services/ISearchService.cs` |
| Create | `src/UmbracoProject/Services/SearchResult.cs` |
| Create | `src/UmbracoProject/Services/SearchMode.cs` |
| Create | `src/UmbracoProject/Services/SearchService.cs` |
| Create | `src/UmbracoProject/Services/SearchServiceComposer.cs` |
| Modify | `src/UmbracoProject/Views/search.cshtml` |
| Modify | `tests/e2e/search.spec.ts` |
| Create/Update | `_features/extract-search-service.md` |
