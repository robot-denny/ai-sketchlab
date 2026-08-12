# Plan: Umbraco AI Search Migration

**Spec**: (no spec file — plan was drafted directly from user description in conversation 2026-04-21)
**Branch**: `claude/feature/umbraco-ai-search`

## Context

The site search at [Views/search.cshtml](../src/UmbracoProject/Views/search.cshtml) currently uses the legacy `IPublishedContentQuery.Search()` API, which is backed by Umbraco's built-in Examine/Lucene keyword index. We want to migrate to the new **Umbraco.Cms.Search** framework (destined to replace the legacy search in v18) and layer **Umbraco.AI.Search** on top for semantic/vector search. This combines keyword recall (via the Examine provider) with semantic understanding (via embeddings from a cheap OpenAI model), giving editors better results for paraphrased or intent-based queries on a low-traffic demo site.

The work is a refactor-with-new-capability: existing user-visible search behavior must not regress, and one new capability (semantic match on paraphrased queries) must be demonstrable. Both `Umbraco.Cms.Search` and `Umbraco.AI.Search` are **beta** on Umbraco 17 — versions must be pinned and the upgrade path documented.

---

## Key Decisions

- **Packages (pin exact versions at Step 1; do not use floating versions)**:
  - `Umbraco.Cms.Search.Core` — search abstractions, the `ISearcher` / `ISearcherResolver` API
  - `Umbraco.Cms.Search.Provider.Examine` — Lucene/keyword provider (hybrid fallback for short, exact queries)
  - `Umbraco.Cms.Search.BackOffice` — backoffice search UI (lets editors rebuild/inspect indexes)
  - `Umbraco.Cms.Search.DeliveryApi` — Delivery API querying (future-proofs headless consumption)
  - `Umbraco.AI.Search` — vector/semantic search on top of Core
- **Embedding model**: **OpenAI `text-embedding-3-small`** (512-dim, ~$0.02 per 1M tokens). Reuse the existing `Umbraco.AI.OpenAI` connection. Rationale: cheap, fast, good-enough recall for a demo site; can swap later by changing the profile in the backoffice only.
- **Hybrid strategy**: Register *both* the Examine provider and AI.Search. Default the public `/search` page to the AI searcher; rely on Examine in the backoffice and as a safety net for exact-match queries. Avoids pure-vector degradation for short queries like author names or "contact".
- **Registration**: Single `SearchComposer.cs` next to the existing [AssignMembersToPremiumRoleComposer.cs](../src/UmbracoProject/AssignMembersToPremiumRoleComposer.cs). Follow the existing `IComposer` pattern — `AddComposers()` in [Program.cs:6](../src/UmbracoProject/Program.cs#L6) picks it up automatically.
- **Config location**: `Umbraco:AI:Search` block goes in `appsettings.json` (non-secret tuning values). `ChunkSize: 512`, `ChunkOverlap: 50`, `DefaultTopK: 50`, `MinScore: 0.3`. No secrets — the embedding API key stays in `appsettings.Development.json` (gitignored) via the existing `Anthropic:ApiKey` / OpenAI pattern.
- **Doc-type exclusion**: Move the current client-side LINQ filter (`Category`, `CategoryList`, `Error`, `Search`, `XMlsitemap`) to a server-side `ISearcher` filter where possible; keep a thin LINQ fallback after result resolution for doc types that can't be excluded at index time.
- **Result resolution**: `ISearcher.SearchAsync` returns IDs/scores, not `IPublishedContent`. Inject `IPublishedContentQuery` in the Razor view and call `.Content(Guid)` per result to get the published content for URL/title/author rendering. Preserves the view's existing contract (URL, title/name fallback, subtitle, `IArticleControls` author + date).
- **E2E test strategy**: Write **characterization tests** first — they assert the existing user-visible contract (`/search?q=article` returns results, system doc types are excluded from results). These are GREEN before the rewrite and must remain GREEN after — i.e. a safety net for the refactor. Add **one new capability test** asserting a paraphrased query returns a semantically relevant article; this is the only test that is RED before migration and GREEN after.
- **Index rebuild**: Required once after install — done manually via the backoffice search dashboard (`Settings → Search` once `AddBackOfficeSearch()` is registered). Also document the admin-triggered rebuild for future content re-indexing.
- **Rollback**: Keep the migration as a single branch. Rollback = `git revert` the merge commit. Do *not* leave a `.legacy.bak` copy of `search.cshtml` in the repo — rely on git history per CLAUDE.md "no half-finished implementations" rule.
- **Umbraco Cloud consideration**: The embedding index state is local to each environment. Document that after deploying to Cloud, the index must be rebuilt once in each environment (Development → Staging → Live) via the backoffice, and the embedding API key must be set in each environment's app settings.

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading is a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Pre-flight: pick pinned versions and create branch ✅ DONE

> **Prompt**: Implement Step 1 of `_plans/shipped/umbraco-ai-search.md`. Create branch `claude/feature/umbraco-ai-search` off `master`. Then query the NuGet feed for the latest beta versions of `Umbraco.Cms.Search.Core`, `Umbraco.Cms.Search.Provider.Examine`, `Umbraco.Cms.Search.BackOffice`, `Umbraco.Cms.Search.DeliveryApi`, and `Umbraco.AI.Search` that are compatible with Umbraco 17.3.x. Record the exact versions inline in this plan (edit the table under "What to build") so every subsequent step uses the same set. Do NOT install packages yet.

**What to build**: a versions table recorded in this plan and a new branch. No code changes yet.

Commands:
```bash
git checkout -b claude/feature/umbraco-ai-search

# Latest beta per package — run each and record
dotnet package search Umbraco.Cms.Search.Core --prerelease --exact-match
dotnet package search Umbraco.Cms.Search.Provider.Examine --prerelease --exact-match
dotnet package search Umbraco.Cms.Search.BackOffice --prerelease --exact-match
dotnet package search Umbraco.Cms.Search.DeliveryApi --prerelease --exact-match
dotnet package search Umbraco.AI.Search --prerelease --exact-match
```

After running, edit this table in the plan:

| Package | Pinned version |
|---------|---------------|
| Umbraco.Cms.Search.Core | 1.0.0-beta.3 |
| Umbraco.Cms.Search.Provider.Examine | 1.0.0-beta.3 |
| Umbraco.Cms.Search.BackOffice | 1.0.0-beta.3 |
| Umbraco.Cms.Search.DeliveryApi | 1.0.0-beta.3 |
| Umbraco.AI.Search | 1.0.0-beta3 |

Versions confirmed 2026-04-21 via `dotnet package search ... --prerelease --exact-match` and NuGet catalog dependency inspection. All five packages target `net10.0` and depend on `Umbraco.Cms.* >= 17.0.0` (compatible with the project's 17.3.0). `Umbraco.AI.Search 1.0.0-beta3` transitively requires `Umbraco.AI.Startup [1.5.0, 1.999.999)` — aligned with the project's existing `Umbraco.AI 1.9.0` stack. Note the inconsistent version format: the `Umbraco.Cms.Search.*` packages use `-beta.3` (dot) while `Umbraco.AI.Search` uses `-beta3` (no dot); both are correct SemVer 2.0 pre-release labels as published.

**Downgrade note (2026-04-21, Step 5 runtime failure)**: Originally pinned `Umbraco.Cms.Search.*` at `1.0.0-beta.4`, but `Umbraco.AI.Search 1.0.0-beta3` is binary-compiled against `beta.3` — beta.4 changed the `IndexMetadata` constructor signature, triggering `MissingMethodException: Void Umbraco.Cms.Search.Core.Models.Indexing.IndexMetadata..ctor(Int64, Umbraco.Cms.Search.Core.Models.Indexing.HealthStatus)` the moment you visit `Settings → Search` in the backoffice. NuGet's declared range allows beta.4 (`[1.0.0-beta.3, 1.999.999)`) but the assembly was built against beta.3 and the dep-range floor wasn't bumped. Downgraded all four `Cms.Search.*` packages to `1.0.0-beta.3`. Revisit once a newer `Umbraco.AI.Search` ships compiled against `Cms.Search.Core beta.4+`.

**Validation**:
- [Automated]: `git branch --show-current` prints `claude/feature/umbraco-ai-search`
- [Manual]: Plan file contains pinned versions — every subsequent step references this table

---

### Step 2 — Install NuGet packages ✅ DONE

All five packages are already referenced in [src/UmbracoProject/UmbracoProject.csproj](../src/UmbracoProject/UmbracoProject.csproj) at the pinned versions from Step 1.

> **Prompt**: Implement Step 2 of `_plans/shipped/umbraco-ai-search.md`. Using the pinned versions recorded in the table under Step 1, add the five `Umbraco.Cms.Search.*` and `Umbraco.AI.Search` packages to `src/UmbracoProject/UmbracoProject.csproj`. Run `dotnet restore` then `dotnet build` from `src/UmbracoProject`. Do not run the app yet — this step only verifies packages resolve and the project compiles with them referenced (but not wired up).

**What to build**: 5 new `<PackageReference>` entries in [src/UmbracoProject/UmbracoProject.csproj](../src/UmbracoProject/UmbracoProject.csproj), grouped with the existing `Umbraco.AI.*` block for readability.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` succeeds with zero errors. Warnings about "beta/prerelease" are expected and acceptable.
- [Manual]: `grep -E "Umbraco.Cms.Search|Umbraco.AI.Search" src/UmbracoProject/UmbracoProject.csproj` shows all 5 entries

---

### Step 3 — Register search services via IComposer

> **Prompt**: Implement Step 3 of `_plans/shipped/umbraco-ai-search.md`. Create `src/UmbracoProject/SearchComposer.cs` (namespace `UmbracoProject`) that implements `IComposer` and registers the search stack. Follow the existing pattern in [AssignMembersToPremiumRoleComposer.cs](../src/UmbracoProject/AssignMembersToPremiumRoleComposer.cs). Call `AddSearchCore()`, `AddExamineSearchProvider()`, `AddBackOfficeSearch()`, `AddDeliveryApiSearch()`, and the AI.Search registration (check the `Umbraco.AI.Search` package for the exact extension method name — likely `AddAiSearch()` or `AddAISearchProvider()`). Run `dotnet build` from `src/UmbracoProject`. Then run `dotnet run` briefly (kill after boot succeeds) to verify the composer executes without DI errors.

**What to build**: `src/UmbracoProject/SearchComposer.cs`.

Skeleton (confirm method names against actual package XML docs before building):
```csharp
using Umbraco.Cms.Core.Composing;

namespace UmbracoProject;

public class SearchComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder
            .AddSearchCore()
            .AddExamineSearchProvider()
            .AddBackOfficeSearch()
            .AddDeliveryApiSearch()
            .AddAiSearch(); // verify exact method name
    }
}
```

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` succeeds
- [Automated]: `dotnet run` reaches "Application started" log line without throwing a composition or DI error — then Ctrl-C

---

### Step 4 — Add `Umbraco:AI:Search` config block

> **Prompt**: Implement Step 4 of `_plans/shipped/umbraco-ai-search.md`. Edit [src/UmbracoProject/appsettings.json](../src/UmbracoProject/appsettings.json) to add an `AI.Search` section under the existing `Umbraco` root. Use `ChunkSize: 512`, `ChunkOverlap: 50`, `DefaultTopK: 50`, `MinScore: 0.3`. Do NOT put API keys here — those go in `appsettings.Development.json` (gitignored). Run `dotnet build`, then boot the app briefly and confirm no configuration-binding errors in the log.

**What to build**: update [appsettings.json](../src/UmbracoProject/appsettings.json):
```json
{
  "Umbraco": {
    "CMS": { /* existing */ },
    "Licenses": { /* existing */ },
    "AI": {
      "Search": {
        "ChunkSize": 512,
        "ChunkOverlap": 50,
        "DefaultTopK": 50,
        "MinScore": 0.3
      }
    }
  }
}
```

**Validation**:
- [Automated]: `dotnet build` succeeds, `dotnet run` boots without config-binding errors
- [Manual]: JSON is valid (no trailing commas)

---

### Step 5 — Configure embedding profile in the backoffice (manual)

> **Prompt**: Implement Step 5 of `_plans/shipped/umbraco-ai-search.md`. This is a manual backoffice configuration step — no code changes. Start the app with `dotnet run`, log into the backoffice, and configure the embedding profile. Record the resulting **connection name, embedding profile name, and default-search-profile alias** in the "Completion notes" subsection below so later steps and the feature doc can reference them.

**What to do** (manual, in the backoffice at `Settings → AI`):

1. **AI Connection**: Create (or reuse) an OpenAI connection. Store the OpenAI API key in `appsettings.Development.json` under `OpenAI:ApiKey` (follow the existing pattern used for `Anthropic:ApiKey` — see [CLAUDE.md](../CLAUDE.md) "AI & Copilot" section). **In the connection form, paste `$OpenAI:ApiKey` as the API Key value** — Umbraco.AI resolves `$Section:Key` references against `appsettings.*.json` at call time; do not paste the raw key (it would be encrypted into the DB and break whenever Data Protection keys rotate).
2. **Embedding Profile**: Create a new embedding profile using the OpenAI connection, model `text-embedding-3-small`. Name it `default-embedding` (or similar — record the actual name).
3. **Assign as default embedding profile**: Under `Settings → AI → Settings`, set the embedding profile above as the **default embedding profile**. *Without this, the `UmbAI_Search` rebuild completes silently with 0 documents — the indexer has no profile to call.* API equivalent: `PUT /umbraco/ai/management/api/v1/settings` with `defaultEmbeddingProfileId` set to the profile's id.
4. **Rebuild index**: Trigger a full rebuild from the backoffice search dashboard (`Settings → Search` → click the rebuild icon on the `UmbAI_Search` row). On a demo-size site, finishes in a few seconds and populates ~3–4 vector chunks per published document.

**Completion notes** (confirmed 2026-04-22):
- OpenAI connection name: `OpenAI` (API key field set to `$OpenAI:ApiKey` reference, not raw key)
- Embedding profile: name `default-embedding`, alias `openai-embeddings`, id `bfcc69a8-7b46-4598-abc2-7ac55e3f3c13`, model `text-embedding-3-small`
- Searcher alias used by AI.Search: `UmbAI_Search`
- Index rebuild result: **115 vector chunks** from 33 published documents (≈ 3–4 chunks per doc at `ChunkSize: 512`), completes in < 1 minute

**Gotchas we hit and what to watch for:**
- **Data Protection key loss on laptop migration**: the previous laptop's encrypted Anthropic connection secret was unrecoverable after migrating — `~/.aspnet/DataProtection-Keys/` didn't come across. Fix was to delete + re-create the Anthropic connection with `$Anthropic:ApiKey` as the value. **Always store AI connection keys as `$Section:Key` references, never as raw keys.** That way a lost key ring only requires re-pointing the reference, not re-keying the provider.
- **Package version mismatch (binary, not NuGet)**: `Umbraco.AI.Search 1.0.0-beta3` is compiled against `Umbraco.Cms.Search.Core 1.0.0-beta.3`. NuGet's declared range allows beta.4 but `IndexMetadata` changed signatures and the call explodes with `MissingMethodException` the moment you open `Settings → Search`. Keep `Cms.Search.*` pinned at beta.3 until AI.Search ships a newer build. See Step 1 versions table.
- **"Rebuild" with no default embedding profile silently succeeds with 0 docs.** The fatal misconfiguration has no error anywhere in the log — the UI/API both return 200 and the index count stays at 0. Always verify `UmbAI_Search` document count > 0 after a rebuild.

**Validation**:
- [Manual]: Backoffice `Settings → Search` dashboard shows the AI index with a non-zero document count
- [Manual]: No errors in the app log during the index build (look for `Umbraco.AI.Search` log lines)

---

### Step 6 — Write characterization + capability E2E tests (RED for capability, GREEN for characterization)

> **Prompt**: Implement Step 6 of `_plans/shipped/umbraco-ai-search.md`. Create `tests/e2e/search.spec.ts` with **characterization tests** asserting the existing `/search` page contract (tests should currently pass against the legacy Examine-backed view) plus **one new capability test** asserting a paraphrased query returns at least one result (this test will be RED until Step 7 rewires the view to AI search). Follow the patterns in [tests/e2e/sectionNavigation.spec.ts](../tests/e2e/sectionNavigation.spec.ts) for dotenv loading and the testhelpers import style. Run the tests against the currently-running app: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/search.spec.ts`. Confirm: characterization tests PASS, capability test FAILS with a clear reason (e.g. "no results returned for paraphrased query").

**What to build**: `tests/e2e/search.spec.ts`.

Scenarios to cover:

**Characterization (must remain GREEN across the migration)**:
1. `GET /search` renders the page shell (header, search form, no results section when `q` is empty)
2. `GET /search?q=article` returns at least one `.post-preview` result
3. Results exclude system doc types — no result's URL resolves to a Category, CategoryList, Error, Search, or XMLsitemap page (check by asserting no result title matches the known system-page names, or by crawling the top 20 results and asserting none of their `.post-title` href resolves to `/search` or `/error`)
4. For article results, `.post-meta` contains "Posted" + author name + article date
5. `XSS safety`: `GET /search?q=<script>alert(1)</script>` renders the raw text (HTML-encoded) in the "Results for..." line — no script execution

**New capability (RED before Step 7, GREEN after)**:
6. `GET /search?q=how%20do%20I%20publish%20my%20site` (paraphrased query matching deployment/release content) returns at least one result whose title contains one of: `deploy`, `publish`, `release`, `cloud` (case-insensitive)

**Validation**:
- [Automated]: Characterization tests (1–5) PASS against current app
- [Automated]: Capability test (6) FAILS — record the failure message in step completion notes

---

### Step 7 — Rewrite search.cshtml to use ISearcher (test-GREEN milestone)

> **Prompt**: Implement Step 7 of `_plans/shipped/umbraco-ai-search.md`. Rewrite [src/UmbracoProject/Views/search.cshtml](../src/UmbracoProject/Views/search.cshtml) to use the new `ISearcherResolver`/`ISearcher` API from `Umbraco.Cms.Search.Core`. Inject `ISearcherResolver` and `IPublishedContentQuery`. Call the AI searcher recorded in Step 5's completion notes (alias likely `UmbAI_Search`) via `SearchAsync(indexAlias, query, culture: Model.GetCultureFromDomains(), skip: 0, take: 20)`. Convert each result ID back to `IPublishedContent` via `publishedContentQuery.Content(result.Id)`. Filter out the system doc types (`Category`, `CategoryList`, `Error`, `Search`, `XMlsitemap`) — prefer a server-side filter parameter if the `ISearcher` API supports it; otherwise keep the LINQ `.Where(...)` filter after resolution. Preserve the existing page layout (PageHeaderViewModel, dictionary labels, `.post-preview` markup, author/date rendering via `IArticleControls`). After the rewrite, run the full E2E suite from Step 6 and confirm ALL 6 tests are GREEN: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/search.spec.ts`.

**Files to modify**:
- [src/UmbracoProject/Views/search.cshtml](../src/UmbracoProject/Views/search.cshtml) — only this file changes

Key code shape:
```csharp
@inject Umbraco.Cms.Search.Core.ISearcherResolver searcherResolver
@inject Umbraco.Cms.Core.IPublishedContentQuery publishedContentQuery
@{
    var searcher = searcherResolver.GetSearcher("UmbAI_Search"); // use alias from Step 5
    var searchResults = await searcher.SearchAsync(
        indexAlias: "UmbAI_Search",
        query: searchQuery,
        culture: null,
        skip: 0,
        take: 20);

    var resolved = searchResults.Results
        .Select(r => publishedContentQuery.Content(r.Id))
        .Where(c => c != null && !docTypesToIgnore.Contains(c.ContentType.Alias))
        .ToList();
}
```

**Test first**: Step 6 already wrote the tests.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` succeeds
- [Automated]: `PATH=... npx playwright test tests/e2e/search.spec.ts` — all 6 tests GREEN
- [Manual]: Open `https://localhost:44367/search?q=article` in the browser — results render identically to before (same page header, same `.post-preview` structure, same meta line for articles)
- [Manual]: Try `?q=how do I publish my site` — results include a deployment-related article (demonstrates semantic match)

---

### Step 8 — Document the migration in CLAUDE.md

> **Prompt**: Implement Step 8 of `_plans/shipped/umbraco-ai-search.md`. Add a new `## Search` section to [CLAUDE.md](../CLAUDE.md) between the "AI & Copilot" section and "Modifying Umbraco Content from Claude Code". The section should document: (1) the search architecture (Umbraco.Cms.Search.Core + Examine provider + AI.Search), (2) how to rebuild the index (`Settings → Search` in backoffice), (3) the embedding profile name and default searcher alias (pull from Step 5's completion notes), (4) per-environment index rebuild requirement on Umbraco Cloud deploys, and (5) pinned package versions + upgrade path note (these are beta — expect breaking changes in v18). Do not edit any other section. Do not add a README.md.

**What to build**: one new `## Search` section in [CLAUDE.md](../CLAUDE.md).

**Validation**:
- [Manual]: A new developer reading the Search section can (a) find the searcher alias, (b) know how to rebuild the index, (c) know which env setting holds the OpenAI key, (d) understand that the packages are beta
- [Automated]: `git diff CLAUDE.md` shows only additions (no other sections modified)

---

### Step 9 — Verify feature behavioral spec

> **Prompt**: Run `/feature update _features/umbraco-ai-search.md` to generate a living behavioral spec from this plan and the tests in `tests/e2e/search.spec.ts`. Review each scenario against the implementation. Fill in the Test Coverage table with actual line numbers from the spec file. If this is the first generation, there will be no "Draft" banner to remove. Commit the verified feature doc.

**Validation**:
- [Manual]: Every scenario in `_features/umbraco-ai-search.md` matches an assertion in `tests/e2e/search.spec.ts` or a manual browser check
- [Manual]: Test coverage table has no unexplained "Not covered" gaps
- [Manual]: Revision notes include an entry dated 2026-04-21 for the initial version

---

## Rollback

If semantic search causes ranking regressions or embedding costs become a concern:

1. `git revert <merge-commit-sha>` on `master` — restores [Views/search.cshtml](../src/UmbracoProject/Views/search.cshtml) to the legacy Examine-backed implementation and removes the composer, config, and packages in one shot.
2. In the backoffice, deactivate the embedding profile (prevents background re-indexing calls to OpenAI).
3. The Examine index keeps running since `AddExamineSearchProvider()` is registered — no data is lost.

No schema changes, no `.uda` changes, no backoffice content changes are introduced by this migration, so rollback is purely code + config.

---

## File Summary

| Action | File |
|--------|------|
| Modify | `src/UmbracoProject/UmbracoProject.csproj` |
| Create | `src/UmbracoProject/SearchComposer.cs` |
| Modify | `src/UmbracoProject/appsettings.json` |
| Modify | `src/UmbracoProject/appsettings.Development.json` (local only — gitignored, add `OpenAI:ApiKey`) |
| Modify | `src/UmbracoProject/Views/search.cshtml` |
| Create | `tests/e2e/search.spec.ts` |
| Modify | `CLAUDE.md` |
| Create | `_features/umbraco-ai-search.md` |
