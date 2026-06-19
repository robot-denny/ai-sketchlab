# Spec for feature-folder-architecture

> This spec captures initial requirements and design rationale. For **current system behavior**, see the doc named on the **Work type** line below. This is `fix-infra` (an internal code-organization change with no editor- or visitor-facing behavior change), so its durable residue lands in a new **`## Solution architecture`** section in CLAUDE.md — not a `_features/` capability doc.

branch: claude/feature/feature-folder-architecture
**Work type**: fix-infra — see CLAUDE.md → Workflow layers → "Work types". This restructures the solution into a Razor Class Library + thin host with a folder-by-kind taxonomy; the Rules below read as *transitions* and *structural invariants* ("the host references the Features library", "Search renders byte-identically after the move"), not standing site behavior — the tell for fix-infra rather than a capability. No feature doc.

## Summary

Restructure the solution to match the agency's standard Umbraco architecture (reference: `dev-kittitas-county`) **to the extent that buys real architectural resilience**, and prove it by migrating one pilot slice (**Search**). This is the north-star "how" spec that the `arch-feature-folder-migration` plan converges from.

Two goals, deliberately ranked: **(1) raise architectural resilience** (the [2026-05-19 audit](../_audits/2026-05-19-umbraco-17-demo-site.md) scores Pillar 2 — architectural separation — at 2/5; the [Kittitas comparison](../_audits/2026-05-19-dev-kittitas-county.md) scores 4/5) — this is the primary goal; **(2) bring the project in line with the standard agency layout** — valuable, but not pursued past the point of diminishing returns. Codebase *parity* is explicitly **not** the goal; architectural resilience is. Where faithful parity would mean importing large bespoke machinery for little resilience gain, this spec stops and says so.

### The destination, in three tiers

After studying the reference architecture in full, the agency standard decomposes into three layers with very different ROI. This spec **adopts** the first two and **defers/declines** the third:

| Tier | What the reference does | Decision | Why |
|---|---|---|---|
| **1. Project split** | Two projects: `Kittitas.Features` (a `Microsoft.NET.Sdk.Razor` Class Library holding business logic) + `Kittitas.Web` (thin host: `Program.cs`, `appsettings`, `wwwroot/`, `umbraco/`, shared views). | **Adopt** | The single highest-ROI move. A compile-enforced boundary is the lever the audit's Pillar 2 rewards, it improves Pillars 4 + 7, and it is the team standard's defining trait. Modest lift. |
| **2. Folder-by-kind taxonomy** | Inside the RCL: `Abstractions/`, `Services/`, `Controllers/`, `Composer/`, `Constants/`, `Extensions/`, `Infrastructure/`, `Models/`, `ViewComponents/` — with vertical slices *inside* `Blocks/<Element>/` and `Pages/<PageType>/` and `Controllers/API/<Domain>/`. **No top-level `Features/<FeatureName>/` folder exists** in the reference. | **Adopt** | Nearly free once the RCL exists; gives a definitive "where does X live" answer; speaks the team's folder language. Supersedes the ROADMAP's earlier `Features/<FeatureName>/` premise, which does not match the reference. |
| **3. Embedded views + rendering framework** | Razor views live *in the RCL* as `<EmbeddedResource>` (`Blocks/<El>/Views/Index.cshtml`, `Pages/<Page>/Views/Index.cshtml`), enabled by a substantial homegrown framework: per-page route-hijacking controllers, `IViewModelFactory`, `ITemplateCoordinator` (alias→view registration), `BaseController`, custom `HtmlExtensions`. (Homegrown — not Diagram-provided — but real.) | **Decline for now** | Large port; its value is mostly already achieved in this codebase by stock Umbraco block/template conventions + the already-extracted `SearchService`. Parity-for-parity. Views stay in the host's stock `Views/` locations. Recorded as an explicitly-optional future increment. |

### The gating constraint: ModelsBuilder mode

The reference RCL compiles typed page controllers and views that reference generated `PublishedModels.*` because Kittitas uses **source-mode ModelsBuilder** (committed `Models/Generated/`). This project uses **`InMemoryAuto`** (models generated at runtime under `umbraco/Data/TEMP/InMemoryAuto/`). Therefore **any C# or view that references a generated `PublishedModels.*` type cannot live in a build-time-compiled RCL** — it would fail `CS0234` at build.

- **Search is RCL-safe** (verified: it references generated models only in a doc comment; its real dependencies are stock abstractions — `IPublishedContent`, the Search Core/AI services). So the pilot needs no ModelsBuilder change.
- **Migrating model-coupled code (most page controllers, some handlers, and any RCL-embedded view) is gated on switching `InMemoryAuto` → source-mode ModelsBuilder.** That switch is high-value on its own — it also unblocks build-time Razor obsolete-API detection (retiring the constraint recorded in the project memory about InMemoryAuto blocking build-time Razor compile, and de-risking `arch-obsolete-api-migration`) — but it is a **separate, deliberately-scoped increment**, not folded into this pilot.

### Scope boundary

This increment delivers: **(a)** the `UmbracoProject.Features` RCL + thin-host split; **(b)** the folder-by-kind taxonomy, documented; **(c)** the **Search** C# migrated into it as the reference slice; **(d)** behavior preserved. It does **not** move Razor views into the RCL, build any rendering framework, or change ModelsBuilder mode. The remaining slices (ImageGenerator, Palettes in `HelloWorld`; the cross-cutting routing/membership infra; the ModelsBuilder switch; any later view migration) stay under `arch-feature-folder-migration` and are planned separately, each converging from the convention this spec freezes.

### Why Search is the pilot

Search has the cleanest seam in the codebase: `ISearchService` + `SearchService` + `SearchMode` + `SearchResult` + `SearchServiceComposer` already live together under `src/UmbracoProject/Services/` (the `extract-search-service` work, shipped 2026-05-20, already moved the logic out of `search.cshtml`), and it is verified free of generated-model coupling. Relocating that cluster into the new RCL is the smallest possible proof of the whole pattern — a move + namespace update + project reference, no logic change.

## Functional Requirements

- **FR1 — RCL + thin-host split.** A new `src/UmbracoProject.Features/` project (`Microsoft.NET.Sdk.Razor`, `net10.0`, `<Nullable>enable</Nullable>`, `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` to match the existing projects) holds migrated business logic. `src/UmbracoProject/` references it and remains the runnable host (entry point, config, `wwwroot/`, `umbraco/`, `.uda`, views). The solution and the test project reference the new project.
- **FR2 — Folder-by-kind taxonomy.** The RCL is organized by kind, mirroring the reference: `Abstractions/` (cross-cutting interfaces), `Services/` (with domain sub-folders, e.g. `Services/Search/`), `Composer/`, `Constants/`, `Extensions/`, `Infrastructure/`, `Models/`, `Controllers/` — plus `Blocks/` and `Pages/` reserved for the deferred view-migration tier. Domain-specific interfaces co-locate with their implementation (as the reference does with `Controllers/API/Search/Service/ISearchService.cs`); only genuinely cross-cutting interfaces go in `Abstractions/`.
- **FR3 — Namespace mirrors the project + folder.** Types in the RCL use `UmbracoProject.Features`-rooted namespaces matching their folder (e.g. `UmbracoProject.Features.Services.Search`), so namespace and path stay in lockstep.
- **FR4 — Composer auto-discovery across assemblies.** Umbraco's `IComposer` type scan discovers composers in the referenced RCL with no central manifest and no `Program.cs` edit. The pilot must confirm this (it is the single biggest "does the boundary actually work" risk).
- **FR5 — Search slice migrated.** `ISearchService`, `SearchService`, `SearchMode`, `SearchResult` move to `UmbracoProject.Features/Services/Search/`; `SearchServiceComposer` moves to `UmbracoProject.Features/Composer/`. Namespaces updated; the `search.cshtml` view and the xUnit tests re-point to the new namespace. Nothing of Search's C# remains under `src/UmbracoProject/Services/`.
- **FR6 — Views stay in the host (this increment).** All Razor views — page templates (`Views/*.cshtml`) and block components (`Views/Partials/blocklist|blockgrid/Components/`) — remain in `src/UmbracoProject/Views/` at their stock Umbraco locations. No view is embedded in the RCL; no `IViewLocationExpander` / `ViewModelFactory` / `TemplateCoordinator` is introduced.
- **FR7 — Behavior-preserving.** After the migration the site renders identically (Playwright screenshot baselines unchanged), all xUnit tests pass, both projects build clean under `<TreatWarningsAsErrors>`, and `/search` behaves exactly as before (Keyword + AI-semantic modes, cache, fallback).
- **FR8 — Documented architecture + recorded decisions.** A new **`## Solution architecture`** section in CLAUDE.md states the project split, the folder-by-kind taxonomy, the composer-discovery mechanism, the "stays in the host" list, where cross-cutting code goes, and — explicitly — the two **deferred** decisions (ModelsBuilder source-mode switch; embedded-views rendering framework) with their rationale, so later slices do not re-litigate them.

## Possible Edge Cases

- **Composer not discovered after the move.** If Umbraco's `TypeLoader` does not scan the RCL assembly, `ISearchService` silently fails to register and `/search` 500s. The RCL referencing `Umbraco.Cms` should put it in the scanned graph, but this must be *verified at runtime*, not assumed.
- **Generated-model coupling sneaks into the RCL.** If any file moved to the RCL references `PublishedModels.*` in code (not just comments), the RCL fails to build under InMemoryAuto. Search is verified clean; future slices must be screened for this before moving (it is the ModelsBuilder gate).
- **`.uda` template artifacts.** Doc-type templates are tracked as `.uda` keyed on alias/GUID, not file path; a C#-only move must not desync the template→doc-type mapping. Verify (views aren't moving this increment, so risk is low, but confirm).
- **Namespace ripple.** Moving `SearchService` updates every `using UmbracoProject.Services;` reference (the `search.cshtml` view, the test project, any composer). A missed reference fails the build — caught by Gate 1 / pre-push.
- **Test project reference.** `tests/UmbracoProject.Tests/` references `SearchService`; it must reference the new RCL project and the new namespace, or the build breaks.
- **CI / Cloud build.** Cloud's CI/CD Flow validator builds the solution; a new project must be picked up by the `.umbraco`/csproj build target and must not trip the wildcard-version or npm-in-container traps (`[[project_cloud_no_wildcard_versions]]`, `[[project_cloud_build_no_npm]]`). The new RCL should pin explicit package versions aligned with the host.
- **Two-project ambiguity with `HelloWorld`.** `HelloWorld` is already a separate (backoffice-extension) project with feature-shaped clusters (ImageGenerator, Palettes). The convention must state how the new `UmbracoProject.Features` RCL relates to it — they are not merged in this increment.

## Acceptance Criteria

- **AC1** — A new `src/UmbracoProject.Features/` RCL exists, is referenced by `src/UmbracoProject/` and by the test project, and is part of the solution.
- **AC2** — The Search C# lives under `UmbracoProject.Features/Services/Search/` (service, interface, `SearchMode`, `SearchResult`) and `UmbracoProject.Features/Composer/` (the composer); nothing of Search's C# remains under `src/UmbracoProject/Services/`.
- **AC3** — Types in the RCL carry `UmbracoProject.Features`-rooted namespaces matching their folders; the `search.cshtml` view and the xUnit tests reference the new namespaces.
- **AC4** — At runtime, `SearchServiceComposer` (now in the RCL) is discovered and `ISearchService` is registered with no `Program.cs` edit and no central manifest.
- **AC5** — Both projects build clean with `dotnet build -c Release` under warnings-as-errors; `dotnet test` passes; the `/search` Playwright screenshot baseline is unchanged (no visual diff).
- **AC6** — `/search` still returns Keyword results for short queries and AI-semantic results for long queries, with the same cache and fallback behavior as before the move.
- **AC7** — All Razor views remain under `src/UmbracoProject/Views/` (no view embedded in the RCL); no rendering framework or view-location expander was added.
- **AC8** — CLAUDE.md has a `## Solution architecture` section stating the project split, the taxonomy, composer discovery, the "stays in the host" list, the cross-cutting-code home, and the two recorded deferrals (ModelsBuilder source-mode; embedded views) with rationale.

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. Because this is `fix-infra`, the verified versions live in the CLAUDE.md `## Solution architecture` section + the shipped spec, not a `_features/` doc.

### Rule: The solution splits into a Features RCL and a thin host (AC1, AC2)

```scenario
Scenario: The Search slice is relocated into the new RCL
  Given the Search service code lives under src/UmbracoProject/Services/
  When a developer creates src/UmbracoProject.Features/ and moves ISearchService, SearchService, SearchMode, and SearchResult into Services/Search/ and SearchServiceComposer into Composer/
  Then no Search C# file remains under src/UmbracoProject/Services/
  And src/UmbracoProject/ and the test project both reference UmbracoProject.Features
```

### Rule: Composers in the RCL are auto-discovered across the assembly boundary (AC4)

```scenario
Scenario: The relocated composer still registers its service
  Given SearchServiceComposer now lives in UmbracoProject.Features/Composer/
  When the host application boots
  Then Umbraco's composer scan registers ISearchService exactly as before
  And neither Program.cs nor any central registration list was edited
```

### Rule: Namespace mirrors project and folder (AC3)

```scenario
Scenario: Relocated types adopt the Features namespace
  Given SearchService moves into UmbracoProject.Features/Services/Search/
  When the file's namespace is updated
  Then it reads "namespace UmbracoProject.Features.Services.Search"
  And search.cshtml and the test project reference that namespace
```

### Rule: The migration is behavior-preserving (AC5, AC6, AC7)

```scenario
Scenario: Both projects build and tests stay green
  Given the Search slice has been relocated into the RCL
  When dotnet build -c Release and dotnet test run
  Then both projects build clean under TreatWarningsAsErrors
  And all xUnit tests pass
```

```scenario
Scenario: A visitor searching sees identical results before and after the move
  Given a visitor on /search
  When they search the keyword "contact"
  Then they see the same Keyword-mode results as before the relocation
  And when they search a long natural-language phrase they see AI-semantic results as before
```

```scenario
Scenario: The search page looks pixel-identical and views did not move
  Given the Linux Playwright screenshot baseline for /search captured before the move
  When the post-move screenshot spec runs in CI
  Then the diff is within the existing tolerance (no baseline regeneration needed)
  And search.cshtml still resides under src/UmbracoProject/Views/
```

### Rule: The architecture and its deferrals are documented (AC8)

```scenario
Scenario: A contributor reads the convention before adding a feature
  Given a contributor opening CLAUDE.md
  When they read the "## Solution architecture" section
  Then they learn where C# goes, how composers are discovered across the RCL boundary, and what stays in the host
  And they learn that views stay in the host and why the ModelsBuilder source-mode switch and the embedded-views framework are deferred — so they do not re-decide those
```

## Open Questions

Most of the original "where does it live" questions are now **resolved** by deferring to the reference; recorded here as decisions plus the few genuinely-open items.

- **RESOLVED — Project shape.** Two-project RCL split (`UmbracoProject.Features` + `UmbracoProject` host), per the reference. Supersedes the ROADMAP's `src/UmbracoProject/Features/<FeatureName>/` premise.
- **RESOLVED — Internal organization.** Folder-by-kind (`Abstractions/ Services/ Composer/ Constants/ Extensions/ Infrastructure/ Models/ Controllers/`, with vertical slices inside `Blocks/ Pages/ Controllers/API/<Domain>/`). No top-level `Features/<Name>/` folder.
- **RESOLVED — Views.** Stay in the host's stock `Views/` locations this increment. Embedded-RCL-views + the `ViewModelFactory`/`TemplateCoordinator`/route-hijacking-controller framework are declined as parity-only for now; recorded as an optional future increment.
- **RESOLVED — Search service home.** `UmbracoProject.Features/Services/Search/` (mirrors the reference's `Services/SEO/`, `Services/Rendering/` domain sub-folders); composer in `Composer/`.
- **OQ1 — Cross-cutting code home.** The reference uses `Infrastructure/` (e.g. `Infrastructure/ContentFinder/Custom404ContentFinder.cs`) and `Composer/`. Confirm during planning that our `NotFoundContentFinder`, the `/sitemap.xml` rewrite middleware, and `AssignMembersToPremiumRoleHandler` land under `Infrastructure/` (finder/middleware) + `Composer/` (composers) when their slices migrate — they are **not** moved in this pilot, but the convention doc should name their destination.
- **OQ2 — ModelsBuilder switch timing.** `InMemoryAuto` → source-mode is the gate for migrating any model-coupled code/views into the RCL, and independently unblocks build-time Razor checks. Is it the **next** increment after this pilot (recommended, since it unblocks the bulk of the migration *and* `arch-obsolete-api-migration`), or deferred further? **Decide when planning `arch-feature-folder-migration`.**
- **OQ3 — `Services/` folder fate in the host.** After Search moves out, `src/UmbracoProject/Services/` is empty. Delete it (recommended — services now live in the RCL). Confirm.
- **OQ4 — `HelloWorld` relationship.** `HelloWorld` stays a distinct backoffice-extension project; its ImageGenerator/Palettes clusters migrate within `HelloWorld` (or into the RCL) in later slices. The convention doc should state the intended end-state relationship between `HelloWorld` and `UmbracoProject.Features`. **To confirm.**

## Testing Guidelines

The pilot is behavior-preserving, so the strategy is **"prove nothing changed"** rather than "test new behavior." No new test files should be needed; the existing suite is the safety net.

- Re-point the existing **xUnit** suite (`tests/UmbracoProject.Tests/`) to the new RCL project + namespaces; the `SearchService` tests (search-mode label routing: Keyword / AI-semantic) must pass unchanged.
- Run the existing **Playwright** `/search` and search-related specs — confirm Keyword + AI-semantic behavior is intact, and confirm the `/search` screenshot baseline does **not** need regeneration (a diff here means something actually changed and the behavior-preserving claim is false).
- **Verify composer discovery at runtime** — boot the host and confirm `/search` returns results (proves the RCL composer registered `ISearchService` across the assembly boundary). This is the one genuinely new risk and deserves an explicit manual/automated check, not just a green build.
- `dotnet build -c Release` must be clean for **both** projects under `<TreatWarningsAsErrors>` (a stale `using` or namespace typo fails here, mirroring Gate 1 / the pre-push hook).
- No assertion on file *paths* in tests (per the E2E resilience rules) — the relocation is verified by the build + runtime behavior staying green, not by asserting a file lives at a specific path.
