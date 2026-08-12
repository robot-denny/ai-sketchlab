# Plan: Migrate AI + Search Stack to Stable 1.0.0

**Spec**: `_specs/migrate-ai-search-stable-1-0.md`
**Branch**: `claude/feature/migrate-ai-search-stable-1-0`

## Context

The AI Copilot packages and the new `Umbraco.Cms.Search` / `Umbraco.AI.Search` stack are pinned to pre-releases. Stable `1.0.0` of the search stack and minor/patch bumps across the AI family (notably `Umbraco.AI 1.14.0`) have shipped; they're coupled (`AI.Search 1.0.0 → AI.Search.Startup → AI.Startup [1.14.0, 1.999.999)`). This plan takes the whole stack to stable, verifies the two known beta.3 backoffice-search bugs are gone, and updates docs.

**Two open questions were already resolved during spec authoring** (see spec OQ1/OQ5):
- **Provider.Examine stays**, bumped `beta.3 → beta.9` (it's still the Core façade's keyword provider; `Cms.Search.BackOffice 1.0.0`'s direct `Examine.Lucene` dep does not replace it). The Pinned-betas section therefore **collapses to one row**, not full retirement.
- **No Cloud.Cms / Deploy.Cloud floor conflict** — the migrated graph resolves cleanly.

**The package bumps in `src/UmbracoProject/UmbracoProject.csproj` are already applied (uncommitted) and proven green**: clean `dotnet build -c Release` under TWAE + 31/31 xUnit tests, with the full graph resolving (`Cms.Search.Core 1.0.0`, `Provider.Examine beta.9`, `AI.Core 1.14.0`, `Examine.Lucene 17.4.2`). Every search API in `SearchService.cs` / `SearchComposer.cs` compiled unchanged, so the remaining risk is **runtime behavior in the backoffice**, not compilation.

The public `/search` page ([Views/search.cshtml](src/UmbracoProject/Views/search.cshtml)) delegates to `ISearchService` → [Services/SearchService.cs](src/UmbracoProject/Services/SearchService.cs), which uses `ISearcherResolver.GetSearcher(...)` + `ISearcher.SearchAsync(...)`. Registration lives in [SearchComposer.cs](src/UmbracoProject/SearchComposer.cs).

---

## Key Decisions

- **Provider.Examine → beta.9, keep `.AddExamineSearchProvider()`** (spec OQ1): beta.9 declares `Cms.Search.Core [1.0.0, )`; Core is a façade with no bundled keyword provider, so dropping it would remove the `/search` keyword fallback.
- **Pinned-betas section collapses, not retires**: one remaining row (Provider.Examine beta.9), rationale changes from "binary-compat trap / must match beta.3" to "no stable release exists yet; beta.9 targets Core 1.0.0".
- **`AddBackOfficeSearch()` is a runtime decision, not a guess** (spec OQ2/OQ3): on `master` the call is *enabled* ([SearchComposer.cs:25](src/UmbracoProject/SearchComposer.cs#L25)); the disable-fix (`a233c8d`) + CLAUDE.md Pinned-betas rewrite live on the unmerged `claude/chore/roadmap-claudemd-cleanup` branch. Step 2 empirically tests whether the beta.3 crashes are fixed in 1.0.0 and Step 3 sets the call accordingly — reading the actual file state first.
- **Version-specific code comments must be reconciled**: the beta.3/beta.4 idempotency note in [SearchComposer.cs:13-16](src/UmbracoProject/SearchComposer.cs#L13-L16) and the "`SearchAsync` has no CancellationToken overload in 1.0.0-beta.3" note in [SearchService.cs:185-187](src/UmbracoProject/Services/SearchService.cs#L185-L187) — check whether 1.0.0 changed either (a CT overload would let us thread `Context.RequestAborted`).
- **AI `.uda` re-serialization risk**: bumping the AI Deploy packages may rewrite `umbraco-ai-*.uda` on first startup; gate with `/check-uda` and a raw-secret grep before committing (spec FR8).
- **No new schema / no backoffice-extension work** — this is a package migration; MCP schema inspection and Umbraco TS skills are not applicable.

### Step 2 findings (runtime gate — resolved 2026-06-16)

- **AC3/AC4/AC5 all PASS**: Settings → Search loads (no `MissingMethodException`), backoffice list-view search works (no `'field name'` crash), index rebuilt to 178 docs. → The beta.3 backoffice bugs are **fixed in 1.0.0**, so **`AddBackOfficeSearch()` stays ENABLED** in `SearchComposer.cs` (resolves OQ2/OQ3).
- **FR6 initially FAILED, now fixed**: semantic `/search` 500'd. Root cause = **`Umbraco.AI 1.14.0` added a `$`-config-reference allowlist** (`AIOptions.AllowedConfigurationKeyPrefixes`, default `["Umbraco:AI:Secrets","Umbraco:AI:Variables"]`). The connection's `$OpenAI:ApiKey` reference was rejected → embedding threw → swallowed by `AIVectorSearcher` → 0 hits → keyword fallback → **Provider.Examine beta.9 NRE** on multi-word queries. See `[[project_ai_1_14_allowed_config_key_prefixes]]`.
- **Fix applied (uncommitted)**: added `Umbraco:AI:AllowedConfigurationKeyPrefixes: ["Umbraco:AI:Secrets","Umbraco:AI:Variables","OpenAI","Anthropic"]` to the committed `appsettings.json` (re-lists the two defaults because the .NET config binder merges arrays by index). Semantic search re-verified working. This applies to local + all Cloud envs via the committed file — no per-env portal action.
- **Examine beta.9 NRE is a latent bug** (`CreateAggregatedTextQuery` wraps the full multi-word query in `MultipleCharacterWildcard` → Lucene `GetFieldInternalQuery` NREs). After the allowlist fix, normal queries get AI hits and never hit the fallback, so it's now an edge case (long query with zero semantic matches). Still worth a defensive guard + a tracked upstream bug.

---

## Steps

Each step is designed to be completed independently in its own context window. The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Confirm package bumps and commit the build gate

> **Prompt**: Implement Step 1 of `_plans/migrate-ai-search-stable-1-0.md`. The package version bumps in `src/UmbracoProject/UmbracoProject.csproj` should already be applied (uncommitted) — verify they match the target versions in the spec's FR1/FR2/FR3, then prove and commit them. From `src/UmbracoProject` run `dotnet build -c Release` (expect 0 warnings under TreatWarningsAsErrors) and from the repo root run `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj -c Release` (expect 31/31 pass). If the csproj is somehow not migrated, apply the bumps listed in **What to build** below. Then `git add src/UmbracoProject/UmbracoProject.csproj` and commit. Do not push.

**What to build** (verify these exact versions in the csproj):
- AI family: `Umbraco.AI` 1.14.0, `Umbraco.AI.Agent` 1.10.4, `Umbraco.AI.AGUI` 1.10.4, `Umbraco.AI.Agent.Copilot`/`.UI`/`.Deploy` 1.0.1, `Umbraco.AI.Deploy` 1.0.4, `Umbraco.AI.Prompt` 1.8.8, `Umbraco.AI.Prompt.Deploy` 1.0.1, `Umbraco.AI.Anthropic` 1.3.6, `Umbraco.AI.OpenAI` 1.2.6, `Umbraco.AI.Google` 1.1.11
- Search: `Umbraco.AI.Search` 1.0.0, `Umbraco.Cms.Search.Core`/`.BackOffice`/`.DeliveryApi` 1.0.0, `Umbraco.Cms.Search.Provider.Examine` **1.0.0-beta.9**
- CMS (already on the `bump-cms-forms-1742` branch but re-asserted here since this branch is off master): `Umbraco.Cms` + `.DevelopmentMode.Backoffice` 17.4.2, `Umbraco.Forms` 17.4.2

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build -c Release` → `Build succeeded. 0 Warning(s) 0 Error(s)`
- [Automated]: `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj -c Release` → `Passed! Failed: 0, Passed: 31`
- [Automated]: `dotnet list src/UmbracoProject package --include-transitive | grep -iE "Cms.Search.Core|AI.Core"` shows `Cms.Search.Core 1.0.0` and `AI.Core 1.14.0`

---

### Step 2 — Runtime verification of search (the empirical OQ2/AC3/AC4/AC5/FR6 gate)

> **Prompt**: Implement Step 2 of `_plans/migrate-ai-search-stable-1-0.md`. This is a manual runtime gate — no code changes. Run the site locally (`cd src/UmbracoProject && dotnet run`), log into the backoffice, and verify the four search behaviors below against the now-stable 1.0.0 stack. Requires `appsettings.Development.json` with `OpenAI:ApiKey` and `Anthropic:ApiKey` present. Record each result (pass/fail + any error text) in a short notes block you hand back, because Step 3's `AddBackOfficeSearch()` decision depends on findings (1) and (2). Note the current state of `SearchComposer.cs:25` (is `AddBackOfficeSearch()` called?) before testing — the branch is off master so it should be enabled.

**What to verify** (record results for each):
1. **Settings → Search loads** without `MissingMethodException` (spec AC3 / the old beta.3 → floated-Core symptom).
2. **Media (and Content) list-view search box** returns results without `'field name' cannot be null or empty` from Examine (spec AC4 — the bug that motivated disabling `AddBackOfficeSearch()`).
3. **Rebuild `UmbAI_Search`** via the rebuild icon on its row → after completion the **document count is > 0** (expect ~115 chunks across ~33 docs; the API returns 200 even when misconfigured, so eyeball the count). Confirm a default embedding profile is set under Settings → AI → Settings first.
4. **Public `/search`**: a long natural-language query returns AI-semantic results; a short exact-match query (an author surname, `contact`) returns keyword results. Both render result cards (spec FR6).

**Validation**:
- [Manual]: All four behaviors confirmed; findings (1) and (2) explicitly recorded as PASS/FAIL with any error text — these decide Step 3.
- [Manual]: If (1) or (2) still fail on 1.0.0, note the exact error — `AddBackOfficeSearch()` stays disabled and the Pinned-betas row keeps a bug-tracking note instead of just a "no stable yet" note.

---

### Step 3 — Source/config remediation: allowlist commit, composer/service comments, Examine fallback guard

> **Prompt**: Implement Step 3 of `_plans/migrate-ai-search-stable-1-0.md`. This step finalizes the source + config changes for the stable 1.0.0 stack using Step 2's findings. (1) The `Umbraco:AI:AllowedConfigurationKeyPrefixes` array is already applied (uncommitted) in `src/UmbracoProject/appsettings.json` — verify it lists the two defaults plus `OpenAI` and `Anthropic`, and leave it staged for commit. (2) In `src/UmbracoProject/SearchComposer.cs`, **keep `AddBackOfficeSearch()` enabled** (Step 2 AC4 PASSED — the beta.3 crash is fixed in 1.0.0) and refresh the beta.3/beta.4 `AddSearchCore()` idempotency comment (lines ~13-16) to reflect 1.0.0. (3) In `src/UmbracoProject/Services/SearchService.cs`, add a **defensive guard** so a Provider.Examine `beta.9` NRE on the keyword path degrades to empty results instead of a 500 — wrap the `searcher.SearchAsync(...)` call in `RunSearchAsync` (around line 188) in a try/catch that logs and returns `(Array.Empty<IPublishedContent>(), 0)` (mirror the existing null-result handling at lines ~197-203); also check whether `ISearcher.SearchAsync` gained a `CancellationToken` overload in 1.0.0 and thread `cancellationToken` if so, updating the comment at ~185-187 (else just bump its version wording beta.3 → 1.0.0). Then `dotnet build -c Release` (0 warnings) and `dotnet test` (31/31).

**What to build**:
- `appsettings.json`: verify the allowlist array (already applied) — `["Umbraco:AI:Secrets","Umbraco:AI:Variables","OpenAI","Anthropic"]`.
- `SearchComposer.cs`: `AddBackOfficeSearch()` stays; refreshed 1.0.0 version comment. Keep the `[ComposeBefore]` ordering guard (cheap defensive guard) unless verified unnecessary.
- `SearchService.cs`: try/catch guard around the keyword/Examine search call so an upstream NRE can't 500 the page; CancellationToken threading only if a CT overload now exists.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build -c Release` → 0 warnings/errors
- [Automated]: `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj -c Release` → 31/31
- [Manual]: Re-run the `/search` smoke from Step 2 — confirm a relevant semantic query returns AI cards, AND that a deliberately-nonsense long query (zero semantic matches, forcing the keyword fallback) now degrades to the empty-state page instead of a 500.

---

### Step 4 — SearchComposer registration + options-binding unit test

> **Prompt**: Implement Step 4 of `_plans/migrate-ai-search-stable-1-0.md`. Add a lightweight unit test under `tests/UmbracoProject.Tests/` (mirror the existing test style/namespace there) that asserts `SearchComposer` registers the expected search services and that `AIVectorSearchOptions` binds from the `Umbraco:AI:Search` config section. Write the test first and run it (RED if anything is misregistered), then confirm GREEN against the current code. Keep it light — a container/registration assertion, not an integration test. Run `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj -c Release`.

**Test first**:
- Add `tests/UmbracoProject.Tests/SearchComposerTests.cs` (or extend an existing fixture)
- Assert the DI container resolves `ISearcherResolver` and that `IOptions<AIVectorSearchOptions>` reflects the `ChunkSize`/`DefaultTopK`/`MinScore` values from a bound config section (spec Testing Guidelines)
- Run before wiring assertions to confirm it can fail meaningfully

**Validation**:
- [Automated]: `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj -c Release` → all pass (32+ now)

---

### Step 5 — `/search` E2E spec (Dev-targeted)

> **Prompt**: Implement Step 5 of `_plans/migrate-ai-search-stable-1-0.md`. Add a Playwright spec `tests/e2e/pages/search.spec.ts` (follow the patterns in `tests/e2e/_helpers.ts` and existing page specs — dynamic lookups, no hardcoded UUIDs/slugs, regex-tolerant assertions) that navigates to `/search?q=...` and asserts a non-empty result set for (a) a known long natural-language query (AI-semantic) and (b) a known author-surname exact-match query (keyword). Assert on rendered result cards, not implementation details. Write the test, run it against Dev, confirm it passes. Use `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/pages/search.spec.ts`. This proves FR6/AC5 in CI's Gate 2.

**Test first**:
- `tests/e2e/pages/search.spec.ts` asserting result cards render for both query modes; tolerate the result count being dynamic (assert `> 0`, not an exact number)
- This is behavioral coverage that file-content checks can't give (spec Testing Guidelines)

**Validation**:
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/pages/search.spec.ts` passes against Dev
- [Manual]: If this is the first run of a new spec, no screenshot baseline is involved (it's an assertion spec, not a visual one) — but if any visual assertion is added, run `update-snapshots.yml` per CLAUDE.md before relying on Gate 2.

---

### Step 6 — Update CLAUDE.md (Pinned-betas → one row, Search + AI sections, package list)

> **Prompt**: Implement Step 6 of `_plans/migrate-ai-search-stable-1-0.md`. Update `CLAUDE.md` to reflect the stable migration. First read the current `CLAUDE.md` state on this branch (it may be the master version with the full beta.3 table, or the roadmap-cleanup rewrite if that merged — reconcile with what's actually there). Changes: (1) **Pinned betas — do not float**: drop the four now-stable rows (`AI.Search`, `Cms.Search.Core`/`.BackOffice`/`.DeliveryApi`), leaving a single `Umbraco.Cms.Search.Provider.Examine 1.0.0-beta.9` row whose rationale is "no stable release exists yet; beta.9 declares `Cms.Search.Core [1.0.0, )`" — and add the **beta.9 multi-word-query NRE** caveat (the `CreateAggregatedTextQuery`/`GetFieldInternalQuery` bug, mitigated by the SearchService fallback guard from Step 3; revisit when a fixed Provider.Examine ships). Note that `AddBackOfficeSearch()` is now re-enabled (the beta.3 crash is fixed in 1.0.0). (2) **Search section** + the `v18 upgrade path` note: update all version references to stable 1.0.0. (3) **AI & Copilot** "Key NuGet packages" / "AI packages" lists: bump the version numbers to match the csproj. (4) **NEW — document the `AllowedConfigurationKeyPrefixes` requirement**: in the AI & Copilot secret-management subsection, add that `Umbraco.AI 1.14.0+` requires `$`-referenced config prefixes to be allow-listed via `Umbraco:AI:AllowedConfigurationKeyPrefixes` in `appsettings.json` (re-list the two defaults `Umbraco:AI:Secrets`/`Umbraco:AI:Variables` then add `OpenAI`/`Anthropic`), or the `$OpenAI:ApiKey`/`$Anthropic:ApiKey` references throw at resolve time and silently break embeddings/semantic search. Cross-reference memory `[[project_ai_1_14_allowed_config_key_prefixes]]`. Keep the `NoWarn=NU1903` note (the Examine → Lucene.Net chain is unchanged — `Examine 4.0.0-beta.4` still resolves), but correct its stale "Lucene.Net 4.8.0-beta00016" wording to the resolved `Examine.Lucene 4.0.0-beta.4` (Step 1 observation).

**What to build**: edits to `CLAUDE.md` only.

**Validation**:
- [Manual]: `grep -n "beta.3" CLAUDE.md` returns nothing except (if intentional) historical context; the Pinned-betas table has one data row.
- [Manual]: Version numbers in CLAUDE.md's package lists match `UmbracoProject.csproj`.
- [Manual]: The `AllowedConfigurationKeyPrefixes` requirement is documented in the AI secret-management subsection.

---

### Step 7 — Reconcile and commit re-serialized AI `.uda` artifacts

> **Prompt**: Implement Step 7 of `_plans/migrate-ai-search-stable-1-0.md`. After running the site once (Step 2 already did), the AI Deploy packages may have rewritten `umbraco-ai-*.uda` files under `src/UmbracoProject/umbraco/Deploy/Revision/`. Inspect `git status` for changes there. Discard unintended document-type/data-type `.uda` churn per CLAUDE.md (`git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/` for noise), but keep any genuine AI-artifact format changes caused by the package bump. Grep for raw secrets: `grep -rE '(sk-[A-Za-z0-9]{20,}|ANTHROPIC_)' src/UmbracoProject/umbraco/Deploy/Revision/` must return nothing (only `$OpenAI:ApiKey` / `$Anthropic:ApiKey` placeholders). Then run `/check-uda` for the full conflict scan. Commit only the intentional artifact changes. Do not push.

**Validation**:
- [Automated]: secret grep returns no matches
- [Automated/Manual]: `/check-uda` reports no schema conflicts (SAFE) and no DB↔file drift introduced by the bump
- [Manual]: `git diff --stat` on `umbraco/Deploy/Revision/` shows only AI-artifact files, no unexpected doc-type churn

---

### Step 8 — Verify feature behavioral spec

> **Prompt**: Run `/feature update _features/migrate-ai-search-stable-1-0.md` to verify the living behavioral spec reflects the actual implementation. Review each scenario against the code and the Step 2 runtime findings and test results. Update any scenarios where reality diverged from the draft (especially the `AddBackOfficeSearch` edge case and the Provider.Examine end state). Fill in the test coverage table with actual test file paths and line numbers (the Step 4 unit test, the Step 5 E2E spec). Remove the "Draft" banner. Commit the verified feature doc.

**Validation**:
- [Manual]: Every scenario in `_features/migrate-ai-search-stable-1-0.md` matches observable behavior
- [Manual]: Test coverage table has no unexpected "Not covered" gaps for the automated scenarios

---

## File Summary

| Action | File |
|--------|------|
| Modify | `src/UmbracoProject/UmbracoProject.csproj` (already applied + committed in Step 1) |
| Modify | `src/UmbracoProject/appsettings.json` (AllowedConfigurationKeyPrefixes — already applied, commit in Step 3) |
| Modify | `src/UmbracoProject/SearchComposer.cs` (version comments; AddBackOfficeSearch stays enabled) |
| Modify | `src/UmbracoProject/Services/SearchService.cs` (keyword-fallback NRE guard + CT-overload check + comment) |
| Create | `tests/UmbracoProject.Tests/SearchComposerTests.cs` |
| Create | `tests/e2e/pages/search.spec.ts` |
| Modify | `CLAUDE.md` (Pinned-betas, Search section, AI package lists) |
| Modify | `src/UmbracoProject/umbraco/Deploy/Revision/umbraco-ai-*.uda` (if re-serialized) |
| Create/Update | `_features/migrate-ai-search-stable-1-0.md` |
