# Spec for Migrate AI + Search Stack to Stable 1.0.0

> This spec captures initial requirements and design rationale. For **current system behavior**, see `_features/migrate-ai-search-stable-1-0.md`.

branch: claude/feature/migrate-ai-search-stable-1-0

## Summary

The AI Copilot stack and the new Umbraco.Cms.Search / Umbraco.AI.Search stack are currently pinned to pre-release versions. The entire "Pinned betas — do not float" section in CLAUDE.md exists because `Umbraco.AI.Search 1.0.0-beta3` was binary-compiled against `Umbraco.Cms.Search.Core 1.0.0-beta.3`, and floating Core forward threw `MissingMethodException` on **Settings → Search**.

As of this spec, **stable releases have shipped**: `Umbraco.AI.Search 1.0.0`, `Umbraco.Cms.Search.Core/BackOffice/DeliveryApi 1.0.0`, and the full `Umbraco.AI.*` package family has minor/patch updates (notably `Umbraco.AI 1.14.0`). The AI family and the search stack are **coupled**: `Umbraco.AI.Search 1.0.0 → Umbraco.AI.Search.Startup 1.0.0 → Umbraco.AI.Startup [1.14.0, 1.999.999)`, so they must move together.

This migration takes the whole stack to stable, re-tests the two known beta.3 backoffice-search bugs against 1.0.0, and — if they're fixed — re-enables `AddBackOfficeSearch()`. The open dependency-shape question around `Umbraco.Cms.Search.Provider.Examine` (which has **no** stable release — latest is `1.0.0-beta.9`) has been **resolved during spec authoring** (see OQ1): it stays, bumped to beta.9. Consequently the "Pinned betas — do not float" section can't be fully retired but **collapses from five rows to one** (Provider.Examine only), with a much weaker rationale.

## Functional Requirements

- **FR1 — AI family to latest stable.** Bump in `src/UmbracoProject/UmbracoProject.csproj`: `Umbraco.AI` 1.11.0→1.14.0, `Umbraco.AI.Agent` 1.10.0→1.10.4, `Umbraco.AI.AGUI` 1.10.0→1.10.4, `Umbraco.AI.Agent.Copilot`/`.UI`/`.Deploy` 1.0.0→1.0.1, `Umbraco.AI.Deploy` 1.0.0→1.0.4, `Umbraco.AI.Prompt` 1.8.4→1.8.8, `Umbraco.AI.Prompt.Deploy` 1.0.0→1.0.1, `Umbraco.AI.Anthropic` 1.3.2→1.3.6, `Umbraco.AI.OpenAI` 1.2.2→1.2.6, `Umbraco.AI.Google` 1.1.7→1.1.11.
- **FR2 — Search stack to stable.** Bump `Umbraco.AI.Search` 1.0.0-beta3→1.0.0 and `Umbraco.Cms.Search.Core`/`.BackOffice`/`.DeliveryApi` 1.0.0-beta.3→1.0.0.
- **FR3 — Bump Provider.Examine to beta.9.** Resolved (OQ1): `Umbraco.Cms.Search.Provider.Examine` stays — it's the keyword provider the Core façade routes to for the `/search` hybrid fallback, and `Cms.Search.BackOffice 1.0.0` does **not** supersede it. Bump `1.0.0-beta.3 → 1.0.0-beta.9` (the head pre-release, which declares `Cms.Search.Core [1.0.0, )`). Keep the `.AddExamineSearchProvider()` call in `SearchComposer.cs`.
- **FR4 — Re-validate the two beta.3 backoffice-search bugs against 1.0.0.** (1) `AddBackOfficeSearch()` crashing the Media/Content list-view search box with `'field name' cannot be null or empty` from Examine; (2) `MissingMethodException` on opening **Settings → Search**. If both are fixed, re-enable `AddBackOfficeSearch()` in `src/UmbracoProject/SearchComposer.cs`.
- **FR5 — Rebuild and verify the vector index.** After the upgrade, rebuild the `UmbAI_Search` index via **Settings → Search** and confirm the document count is **> 0** (rebuild returns 200 even when misconfigured). Expected ~115 chunks across ~33 published documents on the demo site.
- **FR6 — Public search still works.** The `/search` page ([Views/search.cshtml](src/UmbracoProject/Views/search.cshtml)) returns relevant results for both semantic queries and short exact-match queries (author names, "contact") after the upgrade.
- **FR7 — Update CLAUDE.md.** Reduce the "Pinned betas — do not float" table to a **single row** — `Umbraco.Cms.Search.Provider.Examine 1.0.0-beta.9` — with the updated rationale ("no stable release exists yet; beta.9 targets `Cms.Search.Core 1.0.0`"), and drop the four now-stable rows and the binary-compat-trap narrative. Update the Search section's version references and the `v18 upgrade path` note to stable 1.0.0. (Full retirement of the section is **not** possible while Provider.Examine has no stable release — see OQ1.)
- **FR8 — Gates stay green.** Clean `dotnet build -c Release` under `TreatWarningsAsErrors`, all xUnit tests pass, and the `.uda` artifacts contain no schema drift and no raw secrets after the AI packages re-serialize on save.

## Possible Edge Cases

- **`SearchComposer.cs` master/branch divergence.** On `master`, `SearchComposer.cs:25` still calls `.AddBackOfficeSearch()`. The disable-fix (commit `a233c8d`) and the CLAUDE.md Pinned-betas rewrite currently live on the unmerged `claude/chore/roadmap-claudemd-cleanup` branch. Depending on merge order, this migration may be re-enabling something master never disabled, or reconciling with a merged disable. Plan must check the actual state of `SearchComposer.cs` at implementation time, not assume.
- **`ComposeBefore` ordering guard.** The `[ComposeBefore(typeof(UmbracoAISearchComposer))]` + `AddSearchCore()` idempotency comment references beta.3/beta.4 behavior. Verify whether the ordering guard is still needed against 1.0.0 and update the comment.
- **`AIVectorSearchOptions` binding.** `SearchComposer` binds `Umbraco:AI:Search` config to `AIVectorSearchOptions` from `Umbraco.AI.Search.Core.Configuration`. The options type/namespace could have moved between beta3 and 1.0.0; the explicit `Configure<>` call and [search.cshtml](src/UmbracoProject/Views/search.cshtml)'s `IOptions<>` injection must still compile.
- **`ISearcher` / `ISearcherResolver` API surface.** The `UmbAI_Search` searcher alias call in [search.cshtml](src/UmbracoProject/Views/search.cshtml) (`ISearcherResolver.GetSearcher(...)`, `ISearcher.SearchAsync(indexAlias: ...)`) may have a changed signature in stable — this is exactly the `MissingMethodException` class of failure.
- **NU1903 suppression.** The `NoWarn=NU1903` (Lucene.Net.Replicator) is justified by the `Provider.Examine → Examine → Lucene.Net` chain. If FR3 removes Provider.Examine, the transitive Lucene chain may change — re-confirm whether the suppression is still needed.
- **AI `.uda` re-serialization.** Bumping `Umbraco.AI.Deploy`/`Prompt.Deploy`/`Agent.Deploy` could change the serialized `.uda` artifact format. Watch for unexpected churn under `umbraco/Deploy/Revision/` on first startup, and grep for raw secrets before committing.
- **Cloud deploy of stable packages.** Stable package versions must survive Cloud's CI/CD Flow build validator (no wildcards — already satisfied) and the runtime Razor compile against `search.cshtml`.

## Acceptance Criteria

- **AC1.** All `Umbraco.AI.*` packages are at the stable versions listed in FR1 and the project compiles.
- **AC2.** The search stack (`AI.Search`, `Cms.Search.Core/BackOffice/DeliveryApi`) is at `1.0.0` and the `Provider.Examine` dependency is in a documented, justified end state (FR3).
- **AC3.** Opening **Settings → Search** in the backoffice no longer throws `MissingMethodException`.
- **AC4.** The backoffice Media/Content list-view search box returns results without the `'field name' cannot be null or empty` crash (whether via re-enabled `AddBackOfficeSearch()` or documented fallback).
- **AC5.** A rebuilt `UmbAI_Search` index reports a document count > 0, and the public `/search` page returns relevant results for both a semantic query and a short exact-match query.
- **AC6.** CLAUDE.md's Pinned-betas section is retired or reduced to the single justified remaining pin, and the Search section reflects stable versions.
- **AC7.** `dotnet build -c Release` is clean under TWAE, all xUnit tests pass, and `/check-uda` reports no schema conflicts with no raw secrets in `.uda` files.

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation. See `_features/migrate-ai-search-stable-1-0.md` for the verified version.

### Rule: The AI Copilot stack runs on stable AI package versions (AC1)

```scenario
Scenario: Project compiles on the stable AI family
  Given the csproj references Umbraco.AI 1.14.0 and the rest of the AI family at their latest stable versions
  When a developer runs dotnet build -c Release
  Then the build succeeds with zero warnings under TreatWarningsAsErrors
```

```scenario
Scenario: The AI Copilot still answers in the backoffice
  Given the AI connection and agent are configured under Settings → AI
  When an editor opens the Copilot chat and asks it to edit a block
  Then the Copilot responds and applies the edit as it did before the upgrade
```

### Rule: The search stack runs on stable 1.0.0 with a documented Examine end state (AC2)

```scenario
Scenario: Search packages resolve at stable versions
  Given the csproj references AI.Search 1.0.0 and Cms.Search.Core/BackOffice/DeliveryApi 1.0.0
  When a developer restores and builds the project
  Then the restore resolves a coherent dependency graph with no version-conflict warnings
  And the Provider.Examine reference is either bumped to beta.9 or removed with a recorded rationale
```

### Rule: Opening Settings → Search no longer throws (AC3)

```scenario
Scenario: Settings → Search page loads
  Given the search stack is on stable 1.0.0
  When an administrator opens Settings → Search in the backoffice
  Then the page renders the UmbAI_Search index row without a MissingMethodException
```

### Rule: Backoffice list-view search works without the field-name crash (AC4)

```scenario
Scenario: Media list-view search returns results
  Given the search stack is on stable 1.0.0
  When an editor types a query into the Media section list-view search box
  Then matching media items are listed without a "'field name' cannot be null or empty" error
```

### Rule: The vector index rebuilds with content and public search works (AC5)

```scenario
Scenario: Rebuilt index has documents
  Given a default embedding profile is set under Settings → AI → Settings
  When an administrator clicks rebuild on the UmbAI_Search row in Settings → Search
  Then the index finishes with a document count greater than zero
```

```scenario
Scenario: Public search returns semantic and exact-match results
  Given the UmbAI_Search index has been rebuilt with documents
  When a visitor searches /search for a topic phrase and separately for an author surname
  Then both queries return relevant result pages
```

### Rule: CLAUDE.md reflects the post-migration reality (AC6)

```scenario
Scenario: Pinned-betas guidance is retired or reduced
  Given the migration to stable is complete
  When a developer reads CLAUDE.md
  Then the "Pinned betas — do not float" section is removed, or reduced to only the still-pinned Provider.Examine row with an updated rationale
  And the Search section lists the stable 1.0.0 versions
```

### Rule: CI/build gates stay green (AC7)

```scenario
Scenario: Pre-push gate passes after the migration
  Given all package bumps and code changes are in place
  When the pre-push hook runs dotnet build -c Release and dotnet test
  Then the build is clean under TWAE and all xUnit tests pass
```

```scenario
Scenario: No schema drift or leaked secrets in .uda artifacts
  Given the AI Deploy packages re-serialized their artifacts on first startup
  When /check-uda runs before commit
  Then it reports no schema conflicts and no raw secrets in umbraco/Deploy/Revision/
```

## Open Questions

- **OQ1 — Provider.Examine end state. — RESOLVED 2026-06-16.** Provider.Examine is **not** superseded; keep it and bump `1.0.0-beta.3 → 1.0.0-beta.9`. Evidence: (a) `Provider.Examine 1.0.0-beta.9` declares `Umbraco.Cms.Search.Core [1.0.0, )` — it was published *after* stable Core and explicitly targets it; (b) `Cms.Search.Core 1.0.0` is only the façade and bundles **no** keyword provider, so `.AddExamineSearchProvider()` is still the registration that gives Core a keyword/Lucene provider for the `/search` hybrid fallback; (c) a full build of the migrated csproj (all stable + Examine beta.9) resolves cleanly — `Cms.Search.Core 1.0.0`, `AI.Core 1.14.0`, `AI.Search.Core 1.0.0`, `Cms.Examine.Lucene 17.4.2` — with **0 warnings under TWAE** and all 31 xUnit tests passing. `Cms.Search.BackOffice 1.0.0`'s direct `Umbraco.Cms.Examine.Lucene` dependency is for its own backoffice indexing, not a replacement for the Core keyword provider. **Consequence for FR7:** the Pinned-betas section **cannot be fully retired** — it collapses to a single Provider.Examine row, but with a far weaker rationale ("no stable release exists yet; beta.9 targets Core 1.0.0", not the old "binary-compat trap, must match beta.3").
- **OQ2 — Are the two beta.3 bugs actually fixed in 1.0.0?** Both `AddBackOfficeSearch()` field-name crash and the `Settings → Search` `MissingMethodException` need empirical re-test against 1.0.0 before re-enabling `AddBackOfficeSearch()`. If only one is fixed, what's the partial end state?
- **OQ3 — `SearchComposer.cs` baseline.** At implementation time, is `AddBackOfficeSearch()` enabled or disabled in the branch we're building on? (Master = enabled; `claude/chore/roadmap-claudemd-cleanup` = disabled.) The plan must read the actual file state rather than assume.
- **OQ4 — `ISearcher`/`AIVectorSearchOptions` API drift.** Did the searcher-resolver call surface or the options type/namespace change between beta3 and 1.0.0 in a way that requires edits to [search.cshtml](src/UmbracoProject/Views/search.cshtml) or [SearchComposer.cs](src/UmbracoProject/SearchComposer.cs)?
- **OQ5 — `Umbraco.Cloud.Cms` / `Deploy.Cloud` floor. — RESOLVED 2026-06-16.** No conflict. The migrated csproj (CMS 17.4.2 + full stable AI/search stack) restores and builds cleanly with `Umbraco.Cloud.Cms 17.1.3` and `Umbraco.Deploy.Cloud 17.1.0` unchanged — 0 warnings, no version-conflict/downgrade warnings. Cloud build-validator behaviour still to be confirmed on a real Dev deploy, but the local resolved graph is coherent.
- **OQ6 — Cloud per-environment rebuild.** After deploying to Dev, the vector index must be rebuilt manually (it doesn't replicate via Deploy). Is anything about that ritual changed by the stable AI.Search release?

## Testing Guidelines

Create or extend tests in the `./tests` folder for the following, without going too heavy:

- A lightweight smoke/unit assertion that `SearchComposer` registers the expected services and that `AIVectorSearchOptions` binds from `Umbraco:AI:Search` config (mirrors the existing test style under `tests/UmbracoProject.Tests/`).
- An E2E Playwright check (Dev-targeted) that the `/search` page returns a non-empty result set for a known semantic query and a known author-surname exact-match query — the behavioral proof for AC5/FR6 that file-content checks can't give.
- Manual verification steps (documented in the feature doc, not automated) for the backoffice-only behaviors: Settings → Search loads (AC3), Media list-view search works (AC4), and index rebuild reports > 0 docs (AC5) — these run against a local/Dev backoffice and aren't easily covered by the existing test harness.
