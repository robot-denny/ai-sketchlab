# Plan: Feature-Folder Architecture (RCL + folder-by-kind)

**Spec**: `_specs/feature-folder-architecture.md`
**Branch**: `claude/feature/feature-folder-architecture`
**Work type**: fix-infra — carried from the spec; the final step records residue in CLAUDE.md (no `_features/` doc) and archives the spec/plan.

## Context

This restructures the solution toward the agency-standard Umbraco architecture (reference: `dev-kittitas-county`): a two-project **RCL split** — a new `UmbracoProject.Features` Razor Class Library holding business logic, with `UmbracoProject` as the thin host — organized **folder-by-kind** (`Abstractions/ Services/ Composer/ Constants/ Extensions/ Infrastructure/ Models/ Controllers/`). It proves the pattern with one behavior-preserving pilot: migrating the **Search** slice (already cleanly seamed under `src/UmbracoProject/Services/` since `extract-search-service` shipped, and verified free of generated-model coupling). Razor views stay in the host this increment; the ModelsBuilder switch and the embedded-views rendering framework are explicitly deferred (see spec's three-tier decision). The whole point is a compile-enforced boundary — the lever the [2026-05-19 audit](../_audits/2026-05-19-umbraco-17-demo-site.md) rewards on Pillar 2 (currently 2/5).

The migration surface is tiny and fully mapped: 5 C# files move, 2 references update (`search.cshtml`, `SearchServiceTests.cs`), and the now-empty host `Services/` folder is deleted.

---

## Key Decisions

- **RCL SDK = `Microsoft.NET.Sdk.Razor`** (not plain `Microsoft.NET.Sdk`), with `<AddRazorSupportForMvc>true</AddRazorSupportForMvc>`. No views move this increment, but this matches the reference's `Kittitas.Features` exactly, makes the project instantly recognizable as "the Features RCL" to the team, and avoids an SDK swap if the optional view-migration tier is ever pursued. Cost of carrying it empty is zero.
- **Folder-mirrored namespaces** (`UmbracoProject.Features.Services.Search`, `UmbracoProject.Features.Composer`), not the reference's flat `Kittitas.Features`. Deliberate minor deviation: folder→namespace mirroring is the .NET default and aids navigation as the library grows. Goal 1 (best practice) wins this small tie over goal 2 (literal parity); the divergence is cosmetic and non-surprising.
- **Search service home** = `UmbracoProject.Features/Services/Search/` (service + interface + `SearchMode` + `SearchResult`), mirroring the reference's domain sub-folders (`Services/SEO/`, `Services/Rendering/`). The composer goes to `UmbracoProject.Features/Composer/` (the reference keeps composers in a dedicated `Composer/` folder). This splits the slice across two folders — the accepted folder-by-kind tradeoff.
- **Views stay in the host.** `search.cshtml` and all block/page templates remain under `src/UmbracoProject/Views/` at stock Umbraco locations. No `IViewLocationExpander`, `ViewModelFactory`, or `TemplateCoordinator` is introduced.
- **RCL package references**: pin `Umbraco.Cms` 17.4.2, `Umbraco.AI.Search` 1.0.0, `Umbraco.Cms.Search.Core` 1.0.0 — explicit versions aligned with the host (no wildcards — `[[project_cloud_no_wildcard_versions]]`). `Microsoft.Extensions.*` (Caching.Memory, Logging, Options) come transitively via `Umbraco.Cms`. Mirror the host's `<NoWarn>$(NoWarn);NU1903</NoWarn>` defensively (Lucene transitive advisory) since `<TreatWarningsAsErrors>` is on; CS0618 is not needed (no Razor in the RCL).
- **No new tests.** This is behavior-preserving; the existing `SearchServiceTests.cs` (re-pointed) + `tests/e2e/search.spec.ts` are the safety net. The genuinely new risk — cross-assembly composer discovery — gets an explicit runtime check, not a new automated test.
- **Composer discovery mechanism**: Umbraco's `TypeLoader` scans all assemblies in the host's dependency graph that reference Umbraco; the RCL references `Umbraco.Cms`, so `SearchServiceComposer` is found with no `Program.cs` edit or manifest. This is the load-bearing assumption — Step 3 verifies it at runtime.

---

## Steps

Each step is designed to be completed independently in its own context window. The step heading contains a ready-to-use prompt.

---

### Step 1 — Scaffold the `UmbracoProject.Features` RCL and wire references

> **Prompt**: Implement Step 1 of `_plans/feature-folder-architecture.md`. Create a new Razor Class Library at `src/UmbracoProject.Features/UmbracoProject.Features.csproj` using SDK `Microsoft.NET.Sdk.Razor`, targeting `net10.0`, with `<Nullable>enable</Nullable>`, `<ImplicitUsings>enable</ImplicitUsings>`, `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`, `<AddRazorSupportForMvc>true</AddRazorSupportForMvc>`, and `<NoWarn>$(NoWarn);NU1903</NoWarn>` (with a comment mirroring the host's Lucene-advisory rationale). Add `PackageReference`s with explicit versions: `Umbraco.Cms` 17.4.2, `Umbraco.AI.Search` 1.0.0, `Umbraco.Cms.Search.Core` 1.0.0. Create the empty folder-by-kind skeleton with `.gitkeep` files: `Abstractions/`, `Services/`, `Composer/`, `Constants/`, `Extensions/`, `Infrastructure/`, `Models/`, `Controllers/`. Add the project to the solution (`dotnet sln umbraco-17-demo-site.sln add src/UmbracoProject.Features/UmbracoProject.Features.csproj`), add a `ProjectReference` to it from `src/UmbracoProject/UmbracoProject.csproj`, and add an explicit `ProjectReference` to it from `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` (mirror the existing explicit-HelloWorld-ref comment style). Do NOT move any code yet. Run `dotnet build -c Release` on the solution and confirm it is clean.

**What to build**:
- `src/UmbracoProject.Features/UmbracoProject.Features.csproj` — `Microsoft.NET.Sdk.Razor`, props + 3 package refs as above.
- Folder skeleton: `Abstractions/ Services/ Composer/ Constants/ Extensions/ Infrastructure/ Models/ Controllers/` each with a `.gitkeep` (so empty dirs commit).
- Solution entry for the new project.
- `ProjectReference` host → Features in `src/UmbracoProject/UmbracoProject.csproj`.
- `ProjectReference` test → Features in `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj`.

**Validation**:
- [Automated]: `cd /Users/dkardys/Sites/umbraco-17-demo-site && dotnet build -c Release` — solution builds clean (the new RCL compiles empty; no warnings-as-errors failures). The new project appears in build output.
- [Manual]: `dotnet sln list` shows `src/UmbracoProject.Features/UmbracoProject.Features.csproj`.

---

### Step 2 — Migrate the Search slice into the RCL

> **Prompt**: Implement Step 2 of `_plans/feature-folder-architecture.md` (Step 1 created the `UmbracoProject.Features` RCL). Move the Search C# out of `src/UmbracoProject/Services/` into the RCL: `ISearchService.cs`, `SearchService.cs`, `SearchMode.cs`, `SearchResult.cs` → `src/UmbracoProject.Features/Services/Search/`; and `SearchServiceComposer.cs` → `src/UmbracoProject.Features/Composer/`. Change the namespace in the four `Services/Search/` files from `UmbracoProject.Services` to `UmbracoProject.Features.Services.Search`, and in the composer to `UmbracoProject.Features.Composer` (add `using UmbracoProject.Features.Services.Search;` to the composer since it references `ISearchService`/`SearchService`). Update the two external references: in `src/UmbracoProject/Views/search.cshtml` change `@using UmbracoProject.Services` to `@using UmbracoProject.Features.Services.Search`; in `tests/UmbracoProject.Tests/Services/SearchServiceTests.cs` change `using UmbracoProject.Services;` to `using UmbracoProject.Features.Services.Search;`. Delete the now-empty `src/UmbracoProject/Services/` folder. Then run `dotnet build -c Release` and `dotnet test --no-build` and confirm both are green. Note: `tests/UmbracoProject.Tests/SearchComposerTests.cs` tests the *root* `SearchComposer` (search-provider registration), NOT `SearchServiceComposer` — do not touch it.

**What to build / move**:
- Move + renamespace: `Services/{ISearchService,SearchService,SearchMode,SearchResult}.cs` → `UmbracoProject.Features/Services/Search/` (namespace `UmbracoProject.Features.Services.Search`).
- Move + renamespace: `Services/SearchServiceComposer.cs` → `UmbracoProject.Features/Composer/` (namespace `UmbracoProject.Features.Composer`; add `using UmbracoProject.Features.Services.Search;`).
- Edit `src/UmbracoProject/Views/search.cshtml` line 7: `@using UmbracoProject.Services` → `@using UmbracoProject.Features.Services.Search`.
- Edit `tests/UmbracoProject.Tests/Services/SearchServiceTests.cs` line 13: `using UmbracoProject.Services;` → `using UmbracoProject.Features.Services.Search;`.
- Delete the empty `src/UmbracoProject/Services/` directory.

**Validation**:
- [Automated]: `cd /Users/dkardys/Sites/umbraco-17-demo-site && dotnet build -c Release` — both projects clean under warnings-as-errors (a missed `using`/namespace fails here).
- [Automated]: `dotnet test --no-build` — all xUnit tests pass (the re-pointed `SearchServiceTests` included).
- [Manual]: `grep -rn "UmbracoProject.Services" src/ tests/ --include=*.cs --include=*.cshtml` returns nothing; `ls src/UmbracoProject/Services 2>/dev/null` is empty/absent.

---

### Step 3 — Verify behavior is preserved at runtime (the cross-assembly composer-discovery check)

> **Prompt**: Implement Step 3 of `_plans/feature-folder-architecture.md`. The Search slice now lives in the `UmbracoProject.Features` RCL (Steps 1–2). Verify the migration changed no behavior. (1) Boot the host: `cd src/UmbracoProject && dotnet run`. Confirm it starts without DI errors. Browse `https://localhost:44367/search`, run a short keyword query (e.g. "contact") and confirm Keyword-mode results render, then a long natural-language phrase and confirm AI-semantic results render — this proves `SearchServiceComposer` (now in the RCL) was auto-discovered and `ISearchService` registered across the assembly boundary (the single biggest risk in this migration). (2) Run the functional Playwright search spec against localhost: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/search.spec.ts`. Do NOT regenerate any screenshot baselines — visual baselines are Linux-only and are validated by CI Gate 2 against Dev, not locally on macOS (see CLAUDE.md → Screenshot baselines). Report the results.

**What to verify**:
- Host boots clean (no `Unable to resolve service for type ISearchService` — the failure mode if discovery breaks).
- `/search` Keyword path and AI-semantic path both work (same behavior as before the move).
- `tests/e2e/search.spec.ts` passes against localhost.

**Validation**:
- [Manual]: `/search` returns results for both a short and a long query in the browser.
- [Automated]: `tests/e2e/search.spec.ts` passes.
- [Manual]: Do not touch `*-linux.png` baselines; confirm none were regenerated (`git status` shows no screenshot changes). The `/search` visual baseline is asserted in CI against Dev after deploy.

---

### Step 4 — Record the durable architecture (fix-infra) and archive

> **Prompt**: Implement Step 4 of `_plans/feature-folder-architecture.md`. This is `fix-infra`, so there is NO `_features/` doc. (1) Add a new `## Solution architecture` section to CLAUDE.md documenting: the two-project RCL split (`UmbracoProject.Features` RCL + `UmbracoProject` thin host) and why (compile-enforced separation, agency standard); the folder-by-kind taxonomy (`Abstractions/ Services/ Composer/ Constants/ Extensions/ Infrastructure/ Models/ Controllers/`, vertical slices inside `Blocks/ Pages/ Controllers/API/<Domain>/`); the composer cross-assembly auto-discovery mechanism; the "stays in the host" list (`Program.cs`, `appsettings*`, `wwwroot/`, `umbraco/`, `.uda`, all `Views/`); where cross-cutting code will land (`Infrastructure/`, `Composer/`); and the two RECORDED DEFERRALS with rationale — the ModelsBuilder `InMemoryAuto`→source-mode switch (gate for migrating model-coupled code; ref `arch-modelsbuilder-source-mode`) and the embedded-views/`ViewModelFactory`/`TemplateCoordinator` rendering framework (declined as parity-only). (2) Fix stale Search paths elsewhere in CLAUDE.md: the **Search** section links `[Services/SearchService.cs](src/UmbracoProject/Services/SearchService.cs)` and `SearchService` references — update them to `src/UmbracoProject.Features/Services/Search/SearchService.cs`; check the **Architecture** "Key directories" list and the Pinned-betas SearchService link too (`grep -n "Services/SearchService\|Services/SearchService.cs\|UmbracoProject/Services" CLAUDE.md`). (3) Confirm `_specs/feature-folder-architecture.md` carries the acceptance criteria (it does). (4) Move `_specs/feature-folder-architecture.md` → `_specs/shipped/` and `_plans/feature-folder-architecture.md` → `_plans/shipped/`. (5) Update the ROADMAP: move `arch-feature-folder-architecture` to "Recently shipped" with today's date and a one-line summary, leaving `arch-modelsbuilder-source-mode` and `arch-feature-folder-migration` in Now.

**What to build**:
- New `## Solution architecture` section in `CLAUDE.md` (placement: near the top, after `## Architecture`, since it describes solution structure).
- Path fixes for the relocated SearchService across CLAUDE.md.
- Archive spec + plan to `shipped/`.
- ROADMAP "Recently shipped" entry.

**Validation**:
- [Manual]: `grep -n "src/UmbracoProject/Services" CLAUDE.md` returns nothing (all updated to the RCL path).
- [Manual]: The `## Solution architecture` section names the RCL split, the taxonomy, composer discovery, the stays-in-host list, and both deferrals — nothing was filed under `_features/`.
- [Manual]: `_specs/shipped/feature-folder-architecture.md` and `_plans/shipped/feature-folder-architecture.md` exist; the un-shipped copies are gone.
- [Automated]: `dotnet build -c Release` still clean (sanity — doc-only step shouldn't affect it, but confirm nothing else drifted).

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/UmbracoProject.Features/UmbracoProject.Features.csproj` |
| Create | `src/UmbracoProject.Features/{Abstractions,Services,Composer,Constants,Extensions,Infrastructure,Models,Controllers}/.gitkeep` |
| Create (move) | `src/UmbracoProject.Features/Services/Search/{ISearchService,SearchService,SearchMode,SearchResult}.cs` |
| Create (move) | `src/UmbracoProject.Features/Composer/SearchServiceComposer.cs` |
| Delete | `src/UmbracoProject/Services/` (all 5 files + folder) |
| Modify | `umbraco-17-demo-site.sln` (add Features project) |
| Modify | `src/UmbracoProject/UmbracoProject.csproj` (ProjectReference → Features) |
| Modify | `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` (ProjectReference → Features) |
| Modify | `src/UmbracoProject/Views/search.cshtml` (`@using`) |
| Modify | `tests/UmbracoProject.Tests/Services/SearchServiceTests.cs` (`using`) |
| Modify *(fix-infra)* | `CLAUDE.md` (new `## Solution architecture` section + SearchService path fixes) |
| Modify | `ROADMAP.md` (mark `arch-feature-folder-architecture` shipped) |
| Move | `_specs/feature-folder-architecture.md` → `_specs/shipped/` |
| Move | `_plans/feature-folder-architecture.md` → `_plans/shipped/` |
