# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ASP.NET Core 10 web application powered by **Umbraco 17 CMS**, hosted on **Umbraco Cloud**. The site is a demo/content site with articles, authors, contact form, and block-based content rendering.

## Build & Run Commands

```bash
# Build
cd src/UmbracoProject && dotnet build

# Run (serves at https://localhost:44367 / http://localhost:64853)
cd src/UmbracoProject && dotnet run

# Trust HTTPS dev certificate (first-time setup)
dotnet dev-certs https --trust

# Publish for production
dotnet publish src/UmbracoProject -c Release
```

For E2E tests, see the **Testing** section below.

## Architecture

**Entry point**: `src/UmbracoProject/Program.cs` — bootstraps Umbraco with `CreateUmbracoBuilder()`, adds BackOffice + Website middleware and endpoints. Also registers MVC controllers (including `ImageGeneratorController` from the HelloWorld project).

**Key directories under `src/UmbracoProject/`:**

- `Views/` — Razor templates using `UmbracoViewPage<T>` base class with auto-generated published content models (`Umbraco.Cms.Web.Common.PublishedModels`)
- `Views/Partials/` — Reusable partials; navigation and footer use `Html.CachedPartialAsync()` with 60-minute cache
- `Views/Partials/blocks/Components/` — **shared, editor-agnostic** block views (one per block alias — richText, image, video, codeSnippet, etc.) rendered by both the Block List and Block Grid dispatchers. See *Block / component rendering & parity* below.
- `Views/Partials/blocklist/` — Block List dispatcher (`default.cshtml`) — resolves the shared `blocks/Components/` folder
- `Views/Partials/blockgrid/` — Block Grid layout rendering (default, area, areas, items); `items.cshtml` resolves the shared `blocks/Components/` folder, falling back to `blockgrid/Components/` for grid-only blocks (`pillarSection`)
- `Views/Components/` — MVC View Components (Contact form, Pagination)
- `wwwroot/` — Static assets (Bootstrap 5 via CDN, custom CSS/JS, Highlight.js, Swiffy Slider)
- `umbraco/Deploy/Revision/` — Umbraco Deploy `.uda` metadata files (document types, data types, templates). These are auto-managed by Umbraco Deploy and pushed to Cloud for schema sync.
- `umbraco/Data/` — Local SQLite database and generated temp files (not committed)

**Content model**: Document types are defined in the Umbraco backoffice and stored as `.uda` files in `umbraco/Deploy/Revision/`. C# models are auto-generated at runtime in `umbraco/Data/TEMP/InMemoryAuto/`.

**Backoffice extension**: `src/HelloWorld/` — a backoffice extension project referenced from the main `.csproj`. Uses TypeScript + Vite with a `Client/` subfolder for the frontend build. Includes a dashboard, property actions, an image generator module, and an auto-generated OpenAPI client.

**Key NuGet packages** (exact versions live in the `.csproj` files — the source of truth): Umbraco.Cms, Umbraco.Cms.DevelopmentMode.Backoffice, Umbraco.Cloud.Cms, Umbraco.Cloud.StorageProviders.AzureBlob, Umbraco.Forms, Umbraco.Forms.Deploy, Umbraco.Deploy.Cloud, Clean.Core (view models for contact form/page headers), jcdcdev.Umbraco.ExtendedMarkdownEditor.

**AI packages** (the whole suite is on the CMS-17-aligned versioning — see `[[project_ai_suite_17_version_alignment]]`): Umbraco.AI, Umbraco.AI.Agent, Umbraco.AI.Agent.Copilot (copilot chat surface), Umbraco.AI.Agent.UI (shared chat UI components), Umbraco.AI.AGUI (AG-UI protocol SDK), Umbraco.AI.Anthropic, Umbraco.AI.Google, Umbraco.AI.OpenAI, Umbraco.AI.Prompt. **As of the Umbraco.AI 17.x line** (the feature landed in the pre-alignment 1.14.0 release), `$`-referenced configuration keys must be allow-listed — see *AI config-key allow-list* under AI & Copilot.

**AI Deploy packages** (serializes AI entities as `.uda` artifacts for schema deploy to Umbraco Cloud): Umbraco.AI.Deploy, Umbraco.AI.Prompt.Deploy, Umbraco.AI.Agent.Deploy. Auto-registered — no composer code required. **All four AI entity families (connections/profiles/contexts/prompts, plus agents) deploy as `.uda`** — agents no longer need to be recreated manually per Cloud environment. (Note: profile *settings* require `Umbraco.AI.Deploy` ≥ 17.0.1 — see *AI schema deployment* below.)

**Search packages** (now stable — the v18-forward replacement for legacy Examine search): Umbraco.Cms.Search.Core, Umbraco.Cms.Search.BackOffice, Umbraco.Cms.Search.DeliveryApi, plus Umbraco.AI.Search (on the CMS-17-aligned AI versioning, not the Cms.Search 1.0.0 line). The lone exception is Umbraco.Cms.Search.Provider.Examine, pinned to a beta (no stable release yet) — see **Pinned betas** below.

## Block / component rendering & parity

Page-body blocks render from **one shared, editor-agnostic view per block alias** at [Views/Partials/blocks/Components/{alias}.cshtml](src/UmbracoProject/Views/Partials/blocks/Components/) — a block is authored once and renders identically whether it sits in a Block List or a Block Grid. This replaced the old split (`blocklist/Components/` + `blockgrid/Components/` with per-editor duplicates and four grid→list shim files); those are gone. `blockgrid/Components/` now holds only the one genuinely grid-only view (`pillarSection.cshtml`).

**Shared view contract.** Each shared view binds to `@model Umbraco.Cms.Core.Models.Blocks.IBlockReference<IPublishedElement, IPublishedElement>` (not a page/model-specific type) and reads its settings through the **composition interfaces** (`ISpacingProperties` → `SpacingHelper`, `…Settings.Hide`, etc.) — never via a page type or a sibling block. That self-containment is what makes a block a restyle-only port to another site (the CSS half of the same contract lives in [docs/block-css-seam.md](docs/block-css-seam.md): functional CSS ships with the block, brand/skin is a `var(--token)` override).

**Block CSS lives globally, so the "restyle-only port" is literally true.** Page-body block functional/base CSS and the Block Grid layout engine (`.umb-block-grid*`) live in the globally-loaded [wwwroot/assets/css/blocks.css](src/UmbracoProject/wwwroot/assets/css/blocks.css) (linked site-wide from `master.cshtml`, after `site-chrome.css`) — so the six reusable Experiments-era blocks (`exp-card`, `exp-cmd`, `exp-stat`, `exp-pullquote`, `exp-timeline`, `exp-sketch`) lay out and skin on **any** page, not only inside `main.experiments`. The per-page [experiments.css](src/UmbracoProject/wwwroot/assets/css/experiments.css) now holds **only** Experiments page chrome, the two page-composition blocks (`showcaseHero`/`exp-hero`, `pillarSection`/`exp-pillar`), and the pillar-tone *context* rules (a block's own `--dark`/`--accent` tone modifier is functional and stays global; the `.exp-pillar--* .exp-*` context form stays page-scoped). That global home is the portability seam — see [docs/block-css-seam.md](docs/block-css-seam.md).

**Both dispatchers are kept and both resolve the shared folder, guarded.** [blocklist/default.cshtml](src/UmbracoProject/Views/Partials/blocklist/default.cshtml) keeps its `ella-wrap` AI-persona logic; [blockgrid/items.cshtml](src/UmbracoProject/Views/Partials/blockgrid/items.cshtml) resolves `blocks/Components/{alias}` first and **falls back to `blockgrid/Components/{alias}`** for grid-only blocks. Both are guarded: a block with no resolvable view renders a friendly message instead of throwing a 500.

**Palette membership is admin-discretionary; parity is the shipped default.** Which blocks a given editor offers is Umbraco admin config (the `data-type__*.uda` allow-lists), not a code constraint. The default is parity — the same shared blocks are offered in both `[BlockList] Main Content` and `[BlockGrid] Experiments Body`. **Code restricts a block from an editor only when it is genuinely incompatible:**

- `pillarSection` is **grid-only** — it uses Block Grid *areas* (has no shared view; its view stays at `blockgrid/Components/pillarSection.cshtml`).
- Nested sub-lists (`imageCarouselSlide`, `categoryPaletteEntry`, `contentSectionRow`) are **parent-scoped** — only offered inside their owning block.
- `iconLinkRow`'s list home is the separate **footer Icon List palette**, not Main Content.

**Enforcement + visibility.** The invariant is a build gate: [tests/UmbracoProject.Tests/BlockRenderCoverageTests.cs](tests/UmbracoProject.Tests/BlockRenderCoverageTests.cs) asserts every palette-offered block resolves a view in **both** editors (minus the documented exceptions above) — a block that would render blank fails the build. Intentional one-sided palette membership stays visible via the non-failing **"Block palette drift"** report in [/check-uda](.claude/commands/check-uda.md) (Step 6b). E2E parity coverage is [tests/e2e/blocks/blockParity.spec.ts](tests/e2e/blocks/blockParity.spec.ts).

**Where a new block goes:** author one shared view at `Views/Partials/blocks/Components/{alias}.cshtml` bound to `IBlockReference<…>`, read settings via composition interfaces, add it to whichever palette(s) it belongs in (parity by default), and let the render-coverage test confirm both editors resolve it. Only put a view under `blockgrid/Components/` if the block is genuinely grid-only (uses areas).

## Solution architecture

The solution is a **two-project Razor Class Library (RCL) split**, matching the agency-standard Umbraco layout (reference: `dev-kittitas-county`, whose `Kittitas.Features` RCL this mirrors). The split exists to put a **compile-enforced boundary** between business logic and the runnable host — the lever the [2026-05-19 audit](_audits/2026-05-19-umbraco-17-demo-site.md) rewards on Pillar 2 (architectural separation, scored 2/5). It shipped via the `arch-feature-folder-architecture` pilot (2026-06-19; spec/plan archived under `_specs/shipped/` and `_plans/shipped/`), which proved the pattern by migrating the **Search** slice with behavior preserved.

### The two projects

- **`src/UmbracoProject.Features/`** — the RCL holding migrated business logic. SDK is `Microsoft.NET.Sdk.Razor` with `<AddRazorSupportForMvc>true</AddRazorSupportForMvc>` (matches the reference's `Kittitas.Features` exactly, and readies the project for the deferred view-migration tier — see *Recorded deferrals* below). `net10.0`, `<Nullable>enable</Nullable>`, `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` to match the other two C# projects. References `Umbraco.Cms` (+ the slice's own packages, e.g. `Umbraco.AI.Search`, `Umbraco.Cms.Search.Core`), with explicit pinned versions aligned to the host (`Version="*"` is rejected by Cloud's CI/CD Flow validator — see `[[project_cloud_no_wildcard_versions]]`).
- **`src/UmbracoProject/`** — the **thin host**. Stays the runnable entry point. References the Features RCL (`UmbracoProject.csproj` → `ProjectReference ../UmbracoProject.Features/UmbracoProject.Features.csproj`); the test project (`tests/UmbracoProject.Tests/`) also references it.

### Folder-by-kind taxonomy (inside the RCL)

The RCL is organized **by kind**, not by feature — mirroring the reference. There is **no top-level `Features/<FeatureName>/` folder** (this supersedes the ROADMAP's original `src/UmbracoProject/Features/<FeatureName>/` premise — the reference uses no such folder):

- `Abstractions/` — genuinely cross-cutting interfaces only. Domain-specific interfaces co-locate with their implementation instead (e.g. `ISearchService.cs` lives in `Services/Search/`, not here).
- `Services/` — application services, with a domain sub-folder per service (e.g. `Services/Search/` holds `ISearchService`, `SearchService`, `SearchMode`, `SearchResult`).
- `Composer/` — Umbraco `IComposer` implementations (e.g. `SearchServiceComposer`).
- `Constants/`, `Extensions/`, `Models/` — by-kind buckets for their respective types.
- `Infrastructure/` — cross-cutting plumbing (content finders, middleware, message handlers). `AssignMembersToPremiumRoleHandler` lives here (migrated 2026-06-29 via `arch-migrate-premium-role-handler`; its `AssignMembersToPremiumRoleComposer` is in `Composer/`). `NotFoundContentFinder` (now in `Infrastructure/ContentFinder/`, its `NotFoundComposer` in `Composer/`) and the `/sitemap.xml` rewrite middleware (now `SitemapRewriteMiddleware` in `Infrastructure/`, called via `app.UseSitemapRewrite()` from `Program.cs`) were migrated here 2026-06-30 via `arch-migrate-routing-infra`. Nothing in the host root remains pending here — the only remaining migration targets are the `HelloWorld` clusters (ROADMAP step 4) and the optional view tier (step 5). Mirrors the reference's `Infrastructure/ContentFinder/Custom404ContentFinder.cs`.
- `Controllers/` — MVC/API controllers; vertical slices live *inside* `Controllers/API/<Domain>/` (and, in the deferred view tier, `Blocks/<Element>/` and `Pages/<PageType>/`).

**Namespaces mirror the project + folder** (the .NET default, and an aid to navigation): a type under `Services/Search/` is `namespace UmbracoProject.Features.Services.Search`; the composer is `UmbracoProject.Features.Composer`. Namespace and path stay in lockstep. Note this is *not* the reference's flat `Kittitas.Features` namespace — folder→namespace mirroring was chosen deliberately.

### Composer cross-assembly auto-discovery

Umbraco's `TypeLoader` scans **every assembly in the host's dependency graph that references Umbraco**. Because the RCL references `Umbraco.Cms`, it is in that scanned graph, so an `IComposer` placed in `UmbracoProject.Features/Composer/` is discovered and run **with no `Program.cs` edit and no central manifest** (runtime-verified: `SearchServiceComposer` in the RCL registers `ISearchService` and `/search` works).

### Stays in the host (`src/UmbracoProject/`)

These remain in the thin host and are **not** moved into the RCL:

- `Program.cs` (entry point + middleware wiring), `appsettings*.json`, `wwwroot/` (static assets).
- `umbraco/` and all `.uda` schema artifacts under `umbraco/Deploy/Revision/`.
- **All Razor views** — page templates (`Views/*.cshtml`) and block components (`Views/Partials/blocklist|blockgrid/Components/`) stay at their stock Umbraco locations under `src/UmbracoProject/Views/`. No view is embedded in the RCL this increment (see *Recorded deferrals*).
- The package-registration composer `SearchComposer.cs` (which calls `.AddSearchCore()` / `.AddExamineSearchProvider()` / `.AddBackOfficeSearch()` / `.AddDeliveryApiSearch()`) stays in the host — it wires up the search *packages*; the relocated `SearchServiceComposer` in the RCL registers the *application service*.

`HelloWorld` remains a distinct backoffice-extension project; it is **not** merged into the Features RCL. **Its ImageGenerator/Palettes C# clusters stay in `HelloWorld` — end-state decided 2026-06-30 (`arch-migrate-helloworld-clusters`, step (4)): keep, do not relocate into the RCL.** Rationale: HelloWorld is a self-contained, NuGet-packaged backoffice extension (its own TS/Vite `Client/` frontend + auto-generated OpenAPI client), not the site's business logic the RCL exists to hold; its `ImageGeneratorController` is a Management API surface the frontend's OpenAPI client targets, and the generator/palette logic exists only to serve that one feature. Relocating the non-controller logic would *split* a cohesive feature across two projects and add a `HelloWorld → UmbracoProject.Features` dependency — reducing cohesion for no resilience gain. The compile-enforced boundary is already satisfied (HelloWorld is its own project; the generation logic already sits behind the `IImageGenerator` seam from `arch-image-generator-extraction`). Future ImageGenerator/Palettes work happens *within* `HelloWorld`.

### Where new code goes

- A new application service → `Services/<Domain>/` in the RCL, with its interface co-located (cross-cutting interfaces → `Abstractions/`).
- A new composer → `Composer/`. Cross-cutting plumbing (finders, middleware, handlers) → `Infrastructure/`.
- A new view → stays in the host's `Views/` (until the deferred view tier is adopted).

### Recorded deferrals (do not re-litigate)

After studying the reference in full, the agency standard decomposes into three tiers; this project **adopts** the project split + folder-by-kind taxonomy and **defers/declines** the third. Two decisions are recorded here so later slices don't re-decide them:

1. **ModelsBuilder `InMemoryAuto` → source-mode switch — SHIPPED** (2026-06-29, `arch-modelsbuilder-source-mode`). This was the gating deferral (model-coupled C# couldn't build-time-compile in the RCL under `InMemoryAuto`); it now runs in `SourceCodeManual` with committed models in the RCL. Full mechanism in the [`## ModelsBuilder`](#modelsbuilder) section below.
2. **Embedded-views rendering framework — DECLINED (parity-only).** The reference embeds Razor views *in the RCL* as `<EmbeddedResource>`, enabled by a substantial homegrown framework: per-page route-hijacking controllers, an `IViewModelFactory`, an `ITemplateCoordinator` (alias→view registration), a `BaseController`, and custom `HtmlExtensions`. This is a large port whose value is mostly already achieved here by stock Umbraco block/template conventions + the already-extracted `SearchService`. It was **declined** as parity-for-parity (low marginal resilience). Views stay in the host's stock `Views/` locations; **no `IViewLocationExpander`, `ViewModelFactory`, or `TemplateCoordinator` is introduced.** Recorded as an explicitly-optional future increment under `arch-feature-folder-migration` — pursue only if pages accrete logic that justifies it.

## ModelsBuilder

ModelsBuilder runs in **`SourceCodeManual`** mode (it was previously the Umbraco default **`InMemoryAuto`**, which generated PublishedModels at runtime into the gitignored `umbraco/Data/TEMP/InMemoryAuto/`). Committed source is now the single source of truth — Cloud never regenerates models on boot.

### Where the models live (and why the RCL)

The generated `*.generated.cs` models are committed under [src/UmbracoProject.Features/Models/Generated/](src/UmbracoProject.Features/Models/Generated/) — **in the RCL, not the host**. This is forced by dependency direction: the RCL can't reference the host, so for any future *model-coupled* RCL code (services, handlers, controllers) to compile against `PublishedModels.*`, the models must live in (or below) the RCL. The host sees them transitively via its existing `ProjectReference` to `UmbracoProject.Features`. This was the gate identified by the Pillar 2 push — see *Recorded deferrals → item 1* under [Solution architecture](#solution-architecture).

The **namespace is unchanged** — `Umbraco.Cms.Web.Common.PublishedModels` (the ModelsBuilder default) — so no existing view or C# file needed a `using`/namespace edit when the switch landed.

### Configuration

In [src/UmbracoProject/appsettings.json](src/UmbracoProject/appsettings.json) under `Umbraco:CMS:ModelsBuilder`:

- `ModelsMode: SourceCodeManual` — committed source is authoritative; no runtime/boot regeneration.
- `ModelsDirectory: ../UmbracoProject.Features/Models/Generated` — relative to the host content root, points into the RCL.
- `AcceptUnsafeModelsDirectory: true` — required because the directory is outside the host project.

Because this lives in committed `appsettings.json`, it applies to local and **every Cloud environment** identically — committed models are authoritative everywhere, and no environment auto-regenerates.

### Regenerating models when the schema changes

`SourceCodeManual` does **not** regenerate automatically. When you change a document type / element type in the backoffice:

1. **Settings → ModelsBuilder → Generate models** (or `POST /umbraco/management/api/v1/models-builder/build` via the Management API).
2. `git diff` the updated `*.generated.cs` under `src/UmbracoProject.Features/Models/Generated/` — confirm the change matches your schema edit.
3. Commit the regenerated models alongside the `.uda` schema change.

Stale models (forgetting step 1) won't break the build, but model-coupled code won't see the new property until you regenerate.

### Build-time Razor compilation + obsolete-API gate

Switching off `InMemoryAuto` let build-time Razor compilation be turned back on — the host csproj's `RazorCompileOnBuild=false` / `RazorCompileOnPublish=false` flags were removed. So `dotnet build` now compiles views and gates **obsolete-API (`CS0618`) usage at build time**, instead of those errors only surfacing on Cloud's first-request runtime Razor compile. Existing obsolete usages are grandfathered with scoped per-call-site `#pragma warning disable/restore CS0618` (e.g. [Views/Partials/v2/_SiteHead.cshtml](src/UmbracoProject/Views/Partials/v2/_SiteHead.cshtml)); new unguarded usage fails the build. The migration off obsolete APIs is tracked as ROADMAP `arch-obsolete-api-migration`. The former `.githooks/lint-obsolete-razor-api.sh` stopgap was retired — the compiler now supersedes it.

Turning on build-time Razor compile also surfaced ~102 pre-existing nullable-reference-type warnings across 22 views (idiomatic Umbraco template code never previously nullable-checked under runtime-compile). These are grandfathered project-wide via `<NoWarn>` `CS8600;CS8602;CS8603;CS8604` on [UmbracoProject.csproj](src/UmbracoProject/UmbracoProject.csproj); incremental per-view cleanup is tracked as ROADMAP `arch-view-nullable-hardening`.

## Pinned betas — do not float

The search stack went stable 1.0.0, so this table collapsed to a single remaining pin. Don't let NuGet float it.

| Package | Pinned version | Why pinned |
|---|---|---|
| Umbraco.Cms.Search.Provider.Examine | 1.0.0-beta.9 | No stable release exists yet — beta.9 is the head pre-release and declares `Umbraco.Cms.Search.Core [1.0.0, )`, so it's the correct companion to the stable Core. It's the keyword provider the Core façade routes to (`.AddExamineSearchProvider()` in [SearchComposer.cs](src/UmbracoProject/SearchComposer.cs)) — `Cms.Search.BackOffice`'s direct `Examine.Lucene` dependency does **not** supersede it. **Known beta.9 bug:** some multi-word keyword queries throw `NullReferenceException` inside Examine, so [SearchService.cs](src/UmbracoProject.Features/Services/Search/SearchService.cs) guards the keyword path (try/catch → zero hits) and `/search` degrades to the empty state instead of a 500. Drop the guard and bump when a fixed/stable Provider.Examine ships. |

The four previously-pinned packages are off beta: `Cms.Search.Core`/`.BackOffice`/`.DeliveryApi` on stable 1.0.0, and `AI.Search` on the CMS-17-aligned 17.0.0 — the old `MissingMethodException`-on-`Settings → Search` and the `AddBackOfficeSearch()` list-view crash are both fixed, so `AddBackOfficeSearch()` is now enabled in [SearchComposer.cs](src/UmbracoProject/SearchComposer.cs).

**v18 upgrade path**: Both `Cms.Search.*` and `AI.Search` are the v18-forward replacement for the legacy Examine-backed `IPublishedContentQuery.Search()` API. Expect further API changes at v18 — revisit composer registration in [SearchComposer.cs](src/UmbracoProject/SearchComposer.cs), the searcher calls in [SearchService.cs](src/UmbracoProject.Features/Services/Search/SearchService.cs), and this table as part of the v18 upgrade PR.

## AI & Copilot

The backoffice includes an **AI Copilot** that can generate and edit content directly in blocks/fields. Configuration is done in the Umbraco backoffice under **Settings > AI**:

- **AI Connection**: Provider + API credentials (Anthropic key stored in `appsettings.Development.json` under `Anthropic:ApiKey`)
- **Chat Profile**: Links an AI connection to a specific model
- **Agent**: Links a chat profile and defines the agent's role. **Permissions must be set on the agent** to allow content editing (scope controls which document types/properties it can modify).
- **Contexts**: Define data access boundaries (e.g., brand voice guidelines)

What's been validated end-to-end with MCP + AI is tracked in [docs/capabilities.md](docs/capabilities.md), which mirrors the **Capabilities** page in the backoffice.

The **Umbraco MCP server** enables Claude Code to interact with backoffice content. Connection settings are in `.env` with tool collections for `document`, `media`, `document-type`, and `data-type`.

### AI schema deployment to Umbraco Cloud

With the `Umbraco.AI.Deploy` + `Umbraco.AI.Prompt.Deploy` + `Umbraco.AI.Agent.Deploy` packages installed, every AI Connection, Context, Guardrail, Chat Profile, Embedding Profile, Prompt, Agent, and AI Setting saved in **Settings > AI** auto-serializes to a `umbraco-ai-*.uda` artifact under [src/UmbracoProject/umbraco/Deploy/Revision/](src/UmbracoProject/umbraco/Deploy/Revision/). Those artifacts flow through the same git → Umbraco Cloud pipeline as document types.

**Profile settings (Max Tokens, Temperature, System Prompt, Context IDs) require `Umbraco.AI.Deploy` ≥ 17.0.1.** Earlier versions wrote `Settings: {}` to the `.uda` (a serialization bug), so profile tuning couldn't deploy and deploying a profile artifact **overwrote** the target's settings with empty. On ≥ 17.0.1 profile settings flow through the normal path: edit in local **Settings > AI**, **Save** (the Save is what serializes — nothing auto-exports on its own), then commit the updated `umbraco-ai-profile__*.uda` and push. **Tell/symptom:** a profile `.uda` with `Settings: {}` right after a save means you're on a pre-17.0.1 Deploy package.

**Secrets stay per-environment**: `.uda` artifacts reference API keys via placeholders (e.g. `$OpenAI:ApiKey`, `$Anthropic:ApiKey`), never the raw value. Each Cloud environment (Development, Staging, Live) must have its own keys set in that environment's app settings via the Cloud portal — **never paste raw keys into the backoffice connection form** (they get encrypted to the DB and break on Data Protection key rotation).

**Cloud portal secret-key naming**: the portal's app-settings UI rejects `:` in key names (validator allows only `0-9 a-z A-Z _`). Use the .NET Core double-underscore convention — `Anthropic__ApiKey` / `OpenAI__ApiKey`. .NET Core flattens `__` back to `:` when building `IConfiguration`, so the backoffice connection references (`$OpenAI:ApiKey`) and `appsettings.Development.json` entries (`"OpenAI:ApiKey": "..."`) keep the colon form unchanged.

**AI config-key allow-list** (behavior of the current **Umbraco.AI 17.x** suite; the feature landed in the pre-alignment 1.14.0 release): the AI core refuses to resolve a `$`-referenced configuration key unless its prefix is allow-listed. The defaults are `Umbraco:AI:Secrets` and `Umbraco:AI:Variables` only — so the `$OpenAI:ApiKey` / `$Anthropic:ApiKey` references this project uses throw `InvalidOperationException: Configuration key 'OpenAI:ApiKey' is not permitted in settings` at resolve time. The failure is **swallowed** by the AI searcher (logged as `Vector search failed for index UmbAI_Search`) and silently breaks embeddings/semantic search rather than erroring loudly. Fix: extend `Umbraco:AI:AllowedConfigurationKeyPrefixes` in the committed [appsettings.json](src/UmbracoProject/appsettings.json) — the .NET config binder merges arrays by index, so **re-list the two defaults** then add yours:

```json
"Umbraco": { "AI": { "AllowedConfigurationKeyPrefixes": [
  "Umbraco:AI:Secrets", "Umbraco:AI:Variables", "OpenAI", "Anthropic" ] } }
```

Because it lives in the committed `appsettings.json`, it applies to local + every Cloud environment with no per-environment portal action. This is the least-invasive fix (preserves the `$OpenAI:ApiKey` convention everywhere); relocating keys under `Umbraco:AI:Secrets` would rewrite the whole secret convention and re-serialize `.uda` — avoid.

**Bootstrapping existing AI config into Deploy** (one-time, when adopting the Deploy packages on an established install): existing DB-only entities do **not** auto-export on package install — the serializer only writes on save. Open **Settings → AI** and click Save on every entity once, in Deploy's dependency order: Connections/Contexts/Guardrails → Chat & Embedding Profiles → Prompts & Settings (default chat/embedding profile) → Agents. Verify new `umbraco-ai-*.uda` files appear under `umbraco/Deploy/Revision/`; before committing, grep the folder for raw secrets (`grep -rE '(sk-[A-Za-z0-9]{20,}|ANTHROPIC_)' src/UmbracoProject/umbraco/Deploy/Revision/`) to confirm only placeholder references are present, then run `/check-uda`.

**What still needs manual per-environment work**: only the vector search index (see Search section below) — every AI entity, agents included, now flows through Deploy.

## Search

The site search at [src/UmbracoProject/Views/search.cshtml](src/UmbracoProject/Views/search.cshtml) uses the new **Umbraco.Cms.Search** framework (the v18-forward replacement for legacy Examine search — see the *v18 upgrade path* note under Pinned betas) with **Umbraco.AI.Search** layered on top for semantic/vector search.

### Architecture

Three packages cooperate at runtime, registered via [src/UmbracoProject/SearchComposer.cs](src/UmbracoProject/SearchComposer.cs):

- **`Umbraco.Cms.Search.Core`** — provides the `ISearcher` / `ISearcherResolver` abstractions used by the Razor view. Doesn't do indexing itself; it's the façade that routes queries to a registered provider.
- **`Umbraco.Cms.Search.Provider.Examine`** — Lucene/keyword provider. Used as a safety net for short, exact-match queries (author names, "contact", etc.) where pure-vector search underperforms.
- **`Umbraco.AI.Search`** — vector/semantic search on top of Core. Calls the configured embedding model to chunk + embed documents on publish and to embed the query at search time.

The public `/search` page is wired to the AI searcher; the Examine provider stays registered for hybrid fallback and for the backoffice search UI. **`AddBackOfficeSearch()` is now enabled** — the beta.3 crash that previously forced it off (`'field name' cannot be null or empty` in the backoffice Media/Content list-view search box) is fixed in 1.0.0.

### Configuration

- **Embedding profile**: `default-embedding` (alias `openai-embeddings`) — OpenAI `text-embedding-3-small`, 512-dim. Set as the **default embedding profile** under `Settings → AI → Settings` in the backoffice. Without a default embedding profile, the AI index rebuild silently completes with 0 documents.
- **Searcher alias**: `UmbAI_Search` — pass this to `ISearcherResolver.GetSearcher(...)` and `ISearcher.SearchAsync(indexAlias: ...)`.
- **OpenAI API key**: stored in `appsettings.Development.json` under `OpenAI:ApiKey` (gitignored); the backoffice AI connection references it as `$OpenAI:ApiKey`. (Same placeholder-not-raw-key rule as every AI secret — see *AI schema deployment to Umbraco Cloud* under AI & Copilot.)
- **Tuning values**: `Umbraco:AI:Search` block in [appsettings.json](src/UmbracoProject/appsettings.json) — `ChunkSize: 512`, `ChunkOverlap: 50`, `DefaultTopK: 50`, `MinScore: 0.3`.

### Rebuilding the index

Trigger a full rebuild from the backoffice: **`Settings → Search`** → click the rebuild icon on the `UmbAI_Search` row. On the demo site this finishes in < 1 minute and produces ~3–4 vector chunks per published document (~115 chunks total across 33 documents).

**Always verify the document count is non-zero after a rebuild** — the rebuild API returns 200 even when misconfigured (e.g., no default embedding profile).

### Umbraco Cloud deploys

Every AI entity auto-deploys as schema via the `Umbraco.AI.Deploy` package family (see **AI schema deployment** under AI & Copilot above). **The vector index is the one exception** — it's local to each environment and must be rebuilt manually after a deploy.

After deploying to Cloud:

1. Set `OpenAI__ApiKey` (and `Anthropic__ApiKey` if using Anthropic connections) in that environment's app settings via the Cloud portal — note the double-underscore form, the portal rejects colons.
2. Log into that environment's backoffice and verify **Settings → AI** shows the deployed connections, profiles, contexts, and agents.
3. Rebuild the `UmbAI_Search` index once via `Settings → Search`.
4. Verify the document count > 0 before promoting further.

Deploys do not replicate the vector index; skipping the rebuild leaves `/search` returning empty results on that environment.

### Pinned versions

Version constraints for `Cms.Search.*` and `AI.Search` live in **Pinned betas — do not float** near the top of this file, alongside the other beta-package pinning rules.

## SEO Routing

Three URLs power the site's SEO surface: `/sitemap.xml`, `/robots.txt`, and the branded 404 page. Each is wired up in-tree with C# / static files that flow through the normal `master → Dev → Live` pipeline — no per-environment backoffice configuration. We deliberately removed the `SeoToolkit.Umbraco` package because it had no Umbraco Deploy integration and would have permanently parked its config in each environment's DB; see [_specs/shipped/remove-seotoolkit.md](_specs/shipped/remove-seotoolkit.md) for the full rationale.

The existing custom SEO surface stays untouched: [Views/Partials/metaData.cshtml](src/UmbracoProject/Views/Partials/metaData.cshtml) renders ~25 meta/link tags from the `SEO Controls` doc-type composition (field aliases `metaName` / `metaDescription` / `metaKeywords` / `isIndexable` / `isFollowable`), and the `SEO Assistant` AI agent's system prompt hard-codes those aliases.

### `/sitemap.xml` — URL rewrite middleware

The rewrite now lives in `SitemapRewriteMiddleware` (in the `UmbracoProject.Features` RCL under `Infrastructure/`), registered via `app.UseSitemapRewrite()` in [src/UmbracoProject/Program.cs](src/UmbracoProject/Program.cs) (still before `app.UseUmbraco()`, after `UseHttpsRedirection()`). It rewrites `/sitemap.xml` → `/xmlsitemap` internally. The existing `xMLSitemap` doc-type's template at [Views/xMLSitemap.cshtml](src/UmbracoProject/Views/xMLSitemap.cshtml) then renders the response via [Views/Partials/xmlSitemap.cshtml](src/UmbracoProject/Views/Partials/xmlSitemap.cshtml), wrapped in `Html.CachedPartialAsync(..., TimeSpan.FromMinutes(60))` and served with `Cache-Control: public, max-age=3600` for CDN/crawler edge-caching. The rewrite is internal — client-visible URL stays `/sitemap.xml`. Both `/sitemap.xml` and `/xmlsitemap` reach the same content node and serve identical bodies.

Why a rewrite and not a `SurfaceController` or `IContentFinder`? Both alternatives were tried and rejected:

- **SurfaceController**: the controller action can render the partial, but `IUmbracoContext` is disposed before the partial actually renders. The canonical workaround — `using UmbracoContextReference contextRef = _umbracoContextFactory.EnsureUmbracoContext()` — releases the context at the `using` block's end, which is when the action returns; the `PartialView` result executes *later* in MVC's pipeline, so `IPublishedContent.Url(mode:UrlMode.Absolute)` (and anything else that requires an active context) throws at render time.
- **IContentFinder**: Umbraco's content routing treats URLs with file extensions (`.xml`, `.txt`, etc.) as static-asset requests and filters them out before any `IContentFinder` runs. The finder never gets a chance to claim `/sitemap.xml`.

The rewrite sidesteps both: by the time Umbraco's routing sees the request, the path is `/xmlsitemap` (no extension) and resolves to the doc-type node through the normal pipeline, with `IUmbracoContext` active throughout. The comment in `Program.cs` documents the same.

### `/robots.txt` — static file

Served by ASP.NET Core's static-file middleware from [src/UmbracoProject/wwwroot/robots.txt](src/UmbracoProject/wwwroot/robots.txt). Edit it in-repo, deploy via the normal pipeline. The `Sitemap:` directive references Live's URL by convention (absolute URLs are required by the robots.txt spec) — Dev and local environments intentionally name Live's host too, since crawlers discover `/sitemap.xml` by convention regardless of which host the directive points at.

### 404s — `IContentLastChanceFinder`

[NotFoundContentFinder.cs](src/UmbracoProject.Features/Infrastructure/ContentFinder/NotFoundContentFinder.cs) (in the `UmbracoProject.Features` RCL under `Infrastructure/ContentFinder/`, registered via [NotFoundComposer.cs](src/UmbracoProject.Features/Composer/NotFoundComposer.cs) under `Composer/`) resolves unmatched URLs to the published `Error` doc-type node (alias `error`, expected as a direct child of `Home` alias `home`) and sets HTTP 404. Uses `IDocumentNavigationQueryService` (the v18-forward navigation API) to walk by doc-type alias rather than "first root node", so multi-root or reordered setups don't silently break.

**Static-asset 404s are NOT intercepted.** The `IContentLastChanceFinder` interface only fires when Umbraco's content routing has exhausted every `IContentFinder` without a match — which happens *after* ASP.NET's static-file middleware has already given up on `/media/...`, `/assets/...`, etc. Those still get the framework's plain 404.

The finder also has an explicit path-prefix guard that skips `/umbraco` and `/api/` requests — defense in depth so a future route registration that bypasses standard middleware order doesn't get an HTML error response on what should be a JSON 404.

### Rename-redirects — built-in URL Tracker

Umbraco's built-in URL Tracker is active (default; `Umbraco:CMS:WebRouting:DisableRedirectUrlTracking` is unset) and handles rename-redirects automatically without code — when a content node's URL changes, the old URL 301s to the new one for as long as the redirect entry exists in `umbracoRedirectUrl`.

## CI/CD & Build hygiene

The safety net that lets schema/structural refactors (e.g. moving ~60 Razor files) ship without a leap of faith. Four interlocking pieces: GitHub Actions running Umbraco Cloud CI/CD Flow, a `dotnet build`+xUnit pre-push hook, Playwright screenshot baselines pinned to Linux, and `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` across all C# projects.

### Cloud CI/CD Flow (two gates)

[.github/workflows/main.yml](.github/workflows/main.yml) is the orchestrator. It runs a **two-gate** pipeline on every push:

- **Gate 1 — `gate-1-build-test`** (every branch): `dotnet restore` → `dotnet build -c Release` → `dotnet test --no-build`. Runner-local; takes < 1 minute on a warm cache. Mirrors the local pre-push hook exactly so anything that slipped past the hook (or was skipped via `SKIP_PREPUSH=1`) still fails CI.
- **Gate 2 — Cloud sync → artifact → deploy to Dev → search readiness gate → Playwright** (master only): the four jobs are guarded by `if: github.ref == 'refs/heads/master'` at the `main.yml` level. Feature branches stop at Gate 1. (`playwright-against-dev` runs a search readiness gate before Playwright — see *Post-deploy search readiness gate* below.)

The three Cloud jobs (`cloud-sync` / `cloud-artifact` / `cloud-deployment`) are reusable workflows under [.github/workflows/](.github/workflows/), mostly verbatim from the upstream Umbraco Cloud CI/CD Flow sample. The six bash scripts they call live under [.github/scripts/](.github/scripts/) — two of them carry local patches for upstream bugs (search the scripts for "Fixed locally:" to see the rationale).

`concurrency: ${{ github.ref }}` with `cancel-in-progress: true` is set at the `main.yml` workflow level — rapid pushes to the same branch cancel any in-flight runs.

### Post-deploy search readiness gate (between Dev deploy and Playwright)

`cloud-deployment` reports "finished" before Dev search actually *serves*, so the `playwright-against-dev` job runs [`.github/scripts/wait_for_search_warm.sh`](.github/scripts/wait_for_search_warm.sh) (env `URL` only) right after checkout, *before* Playwright. It **polls `GET $URL/search` with a long/semantic query** (every 10s, budget `TOTAL_BUDGET` default **180s**) to exercise the **Healthy `UmbAI_Search` vector path** — not the fragile Examine keyword index, which routinely comes up corrupt after a deploy. It logs a **non-gating WARNING** if the keyword check (`q=article`) is down but opens the gate as soon as semantic search serves.

Load-bearing facts: (1) The gate **detects and fails fast; it does NOT self-heal** — if it fails within budget, semantic search itself is down (worse than keyword corruption: check `UmbAI_Search` health / embeddings — see the AI config-key allow-list note — then `gh run rerun <id> --failed`). (2) Routine post-deploy **keyword** corruption is non-gating but leaves short-query `/search` dead on Dev; the fix is a **Portal restart** (the dashboard "Rebuild" on `Umb_PublishedContent` fails, and don't touch the Healthy `UmbAI_Search`). Full forensics + the disproven theories: [CI Failure Recipes → cold AI.Search 500 cascade](docs/ci-failure-recipes.md).

### Master → Dev → manual promotion to Live

CI **never deploys to Live**. The `cloud-deployment` job's `targetEnvironmentAlias` is wired to Dev only. Promotion from Dev to Live (or via Staging if you add one later) is a human action via the Umbraco Cloud Portal, on whatever cadence makes sense.

This is deliberate: Live is the production content/media surface and shouldn't be redeployed every time master moves. A failed Playwright run on Dev gives you a chance to investigate without Live being affected.

### Content workflow under CI

**Content flows local → Dev → Live**, riding the same pipeline as schema. You author content locally (local SQLite, preview locally first), transfer it *up* to Dev via the Cloud Deploy dashboard, verify it on the tested Dev environment, then promote it to Live. Because content follows the same local → Dev → Live path as the code, content that depends on new schema can't reach Live ahead of the code it needs — and everything (including MCP/Ella-authored content) is gated through the tested Dev environment before it lands on Live. The full by-hop discipline is the [content-transfer workflow runbook](docs/content-transfer-workflow.md); the short version:

- **local → Dev**: root-queue freely. Low stakes — Dev already hosts CI fixtures and is the staging surface everything passes through.
- **Dev → Live**: selective / per-item by default. A root-level Dev → Live transfer is only safe **just after a green CI run with the test fixtures cleaned** — otherwise published `[E2E]`-prefixed fixtures can ride up to Live (the decisive test-content-pollution risk).
- **Live → Dev restores**: forbidden by default. A restore is overwrite-not-merge, so it clobbers any unpromoted content sitting on Dev. Live hotfixes are made upstream (local → Dev → Live) and re-promoted, or accepted as small drift.
- **Rule of thumb**: transfer WIP *up* before pulling anything *down* — Umbraco Cloud has no merge story for concurrent same-node edits anywhere.

**Media rides separately** — content transfers and restores do **not** carry media binaries; the separate media restore / `media:sync` step is still required (see [Media files](#media-files)).

### Pre-push hook

[.githooks/pre-push](.githooks/pre-push) runs `dotnet build -c Release` + `dotnet test --no-build` before each push. Enabled via `git config core.hooksPath .githooks` (see [README.md](README.md) for the one-time setup).

On success, it prints `Pre-push OK — build: Xs, test: Ys, total: Zs` (whole seconds). Runtime budget is < 30s on a warm build.

To bypass:
- **Per-invocation (this hook only)**: `SKIP_PREPUSH=1 git push`.
- **Per-push (bypasses ALL git hooks, pre-commit included)**: `git push --no-verify`.
- **Persistent disable (this hook only)**: set `ENABLE_PREPUSH=false` in `.githooks.conf` (see [.githooks.conf.example](.githooks.conf.example)). Setting `SKIP_PREPUSH=1` in your shell profile (`~/.zshrc`) achieves the same effect.

This replaced the previous opt-in AI-review pre-push hook. If you want AI review on a push, run [.claude/commands/review.md](.claude/commands/review.md) manually instead.

A smoke validator at [.githooks/test-pre-push.sh](.githooks/test-pre-push.sh) exercises the hook's failure paths (build-fail / test-fail / skip flag) so future edits don't silently break the gating.

### Screenshot baselines

Playwright visual-regression specs live under [tests/e2e/blocks/screenshots/](tests/e2e/blocks/screenshots/) (block components) and [tests/e2e/pages/](tests/e2e/pages/) (page templates). Shared helpers in [tests/e2e/_helpers.ts](tests/e2e/_helpers.ts) — `prepareForScreenshot`, `screenshotOptions`, `dynamicRegionMasks`, `discoverBlockOnPage`, `findNavLinkForTemplate`.

**Baselines are Linux-only.** macOS and Linux render fonts differently, so a baseline captured on a Mac will mismatch every time CI runs it. The `.gitignore` blocks `*-darwin.png` and `*-win32.png` to enforce this.

**Regenerating baselines**: trigger [.github/workflows/update-snapshots.yml](.github/workflows/update-snapshots.yml) via the "Run workflow" button on the GitHub Actions UI, or:

```bash
gh workflow run update-snapshots.yml --ref <branch>
```

The workflow runs Playwright with `--update-snapshots=all` against Dev (using the `URL` GitHub variable), then commits any new/changed PNGs back to the branch as `github-actions[bot]`. The default `testFilter` input is `tests/e2e/`, covering both block and page-template specs; pass a narrower path to regenerate a subset. (The workflow's own setup gotchas — the explicit `--update-snapshots=all` mode Playwright 1.56+ needs, and the `UMBRACO_BASE_URL` env it must set — are recorded in `[[project_screenshot_baselines_never_committed]]`.)

**When to run**: first time you add a new screenshot spec (initial baseline), or after an intentional visual change where existing baselines are now correctly stale. Always review the resulting commit diff before merging. **A new screenshot spec with no committed baseline does not skip — it _fails_** every Gate 2 Playwright run until its PNG lands, and reads as "pre-existing red" (this is exactly how 26 specs sat red for weeks; see *Diagnosing a red CI run* below). So after adding any spec, run this workflow and confirm the bot's baseline commit before moving on.

**When NOT to run**: as a "quick fix" for failing visual tests on master. Investigate the diff first — the failure may be a real regression.

**What the specs cover** (and don't): runs are all under `prefers-reduced-motion: reduce`. Motion-on variants, ARIA, alt text, heading levels, and keyboard behavior are **not** baseline-tested. Semantic regression coverage requires separate axe-core / role-assertion specs (not in this bundle). See the header of [tests/e2e/_helpers.ts](tests/e2e/_helpers.ts) for the full scope statement.

Default tolerance is `maxDiffPixelRatio: 0.01` per block. Shim-equivalence specs (the four blockgrid → blocklist pass-through pairs: `alertBanner`, `iconLinkRow`, `imageRow`, `richTextRow`) override to `0` for byte-identical assertions. Dynamic regions (latestArticles card grid, timestamps) are masked via `dynamicRegionMasks(page)`.

### Warnings as errors + surgical NoWarn

All three C# projects have `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`:

- [src/UmbracoProject/UmbracoProject.csproj](src/UmbracoProject/UmbracoProject.csproj)
- [src/HelloWorld/HelloWorld.csproj](src/HelloWorld/HelloWorld.csproj)
- [tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj](tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj)

`<Nullable>enable</Nullable>` is on the same projects, so any new nullable-reference-type warning fails the build (and therefore Gate 1 and the pre-push hook).

**Surgical `<NoWarn>` per warning code with inline justification is the only relaxation pattern.** No project-wide suppression of CS-prefixed warnings. The NoWarn exemptions currently in the tree — each a transitive advisory that can't be pinned without breaking a locked dependency chain, carrying an inline XML comment naming the advisory + the upgrade signal that retires it:

- **`NU1902`** — AngleSharp 1.4.0 (GHSA-pgww-w46g-26qg, moderate) — transitive via `SmartReader 0.11.0` → AngleSharp. On **all three** C# projects (`UmbracoProject`, `UmbracoProject.Features`, `UmbracoProject.Tests`). Added 2026-07-20: when the advisory landed, NuGet audit failed `dotnet restore` under TWAE across the board (Gate 1 red on a docs-only merge — the advisory, not the change). SmartReader is transitive itself, so pinning AngleSharp risks that chain. Retire when SmartReader (or its parent) bumps to a patched AngleSharp.
- **`NU1903`** — Lucene.Net.Replicator 4.8.0-beta00017 (GHSA-2qw8-ppr5-m96c, high) — transitive via Umbraco.Cms.Search.Provider.Examine → Examine → Lucene.Net. On `UmbracoProject`, `UmbracoProject.Features`, and `UmbracoProject.Tests`. Cannot pin without breaking Umbraco's locked Examine chain. Retire when Umbraco upgrades Examine past that Lucene.Net.
- **`NU1904`** — Microsoft.AspNetCore.DataProtection 10.0.4 (GHSA-9mv3-2cwr-p262, critical) — transitive into the test host via `Microsoft.NET.Test.Sdk`. `UmbracoProject.Tests` only; those APIs are never exercised in tests. Retire when the Test SDK upgrades past it.
- **`CS8600;CS8602;CS8603;CS8604`** — pre-existing nullable-reference warnings across ~22 views on `UmbracoProject` only (not a security advisory); incremental cleanup tracked in ROADMAP `arch-view-nullable-hardening`.

**Out of scope**: Razor `.cshtml` files (compile inside the runtime, not the csproj's `dotnet build`) and the auto-generated published-content models under `umbraco/Data/TEMP/InMemoryAuto/` (regenerated on startup).

### GitHub Secrets / Variables

The pipeline reads CI auth from GitHub Secrets and non-sensitive routing info from GitHub Variables. AI API keys are **not** here — they live in Umbraco Cloud Secrets Management on Dev (see below).

| GitHub kind | Name | Source / purpose |
|---|---|---|
| Secret | `UMBRACO_CLOUD_API_KEY` | Cloud Portal → Configuration → CI/CD Flow (project-wide). Authenticates `cloud-sync` / `cloud-artifact` / `cloud-deployment`. |
| Secret | `UMBRACO_CLIENT_ID` | Dev backoffice OAuth client. Used by Playwright's `tests/e2e/auth.setup.ts` against Dev. |
| Secret | `UMBRACO_CLIENT_SECRET` | Dev backoffice OAuth client secret (matched to `UMBRACO_CLIENT_ID`). |
| Variable | `PROJECT_ID` | Cloud project ID. Non-sensitive — passed as a workflow input to the reusable Cloud workflows. |
| Variable | `TARGET_ENVIRONMENT_ALIAS` | Cloud environment alias for Dev (typically `development`). Controls which environment `cloud-deployment` targets. |
| Variable | `URL` | Dev's URL (e.g. `https://<project-slug>.umbraco.io/`). Read by Playwright auth setup as `process.env.URL` and by the curl sanity check in Gate 2. |

The comment header at the top of [.github/workflows/main.yml](.github/workflows/main.yml) is the source of truth for this mapping — keep it in sync with this table if names ever change.

### AI keys live on Cloud Dev, NOT in GitHub Secrets

Anthropic and OpenAI keys (`ANTHROPIC__APIKEY`, `OPENAI__APIKEY` — Cloud Portal's double-underscore form, see [AI & Copilot](#ai--copilot) → "Cloud portal secret-key naming") are set in **Umbraco Cloud Secrets Management** on the Dev environment via the Cloud Portal, referenced by `.uda` artifacts as `$OpenAI:ApiKey` / `$Anthropic:ApiKey` placeholders just like Live and local.

**Never put AI keys in GitHub Secrets.** GitHub Actions doesn't touch the running Umbraco app at runtime — the deployed Dev environment reads its own Cloud Secrets Management entries directly. Putting keys in GitHub would just create another sync surface to drift.

The two Live/Staging environments (if they exist) each have their own Cloud Secrets Management slot for these keys, set per-environment via the Cloud Portal — see the existing [AI & Copilot](#ai--copilot) and [Search > Umbraco Cloud deploys](#umbraco-cloud-deploys) subsections for the full per-environment ritual.

## Diagnosing a red CI run

When master's pipeline goes red, work through three questions in order before touching anything:

1. **Which gate failed?** Gate 1 (`gate-1-build-test`, every branch) vs Gate 2 (`cloud-sync` → `cloud-artifact` → `cloud-deployment` → `playwright-against-dev`, master only). See [CI/CD & Build hygiene](#cicd--build-hygiene).
2. **Which job inside it?** Gate 1 reproduces locally in one command: `cd src/UmbracoProject && dotnet build -c Release && dotnet test --no-build`. The four Gate 2 jobs each have a different first move.
3. **New or pre-existing?** If the same failure was already red on the previous master run, it's structural — **file a ROADMAP entry under "Next" and unblock your work**, don't bundle a pre-existing infra/content issue into an unrelated PR. If it's new with your push, it's yours to fix (and likely deserves a `/spec` if non-trivial).

Skipping straight to "fix the test" without answering all three is the habit that lets a perpetually-red gate become background noise — always run the three questions before dismissing a red, and file (don't absorb) pre-existing failures.

The [CI Failure Recipes runbook](docs/ci-failure-recipes.md) is the home for the rest: the `gh run list` / `gh run view` command walkthrough, the per-job diagnostic table (which trap each Gate 2 job hits — see also `[[project_cloud_no_wildcard_versions]]`, `[[project_cloud_build_no_npm]]`, `[[project_cloud_razor_honors_twae]]`), and the previously-seen failure recipes. Check it first before diagnosing from scratch.

## Modifying Umbraco Content from Claude Code

Use the `/umbraco-edit` skill to edit document properties or invoke an AI agent via the Management API from outside the backoffice. Covers the OAuth token dance, the document/document-type endpoint reference, the find → read → PUT workflow, and the Agent SSE stream parsing. Credentials (`UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET`) live in `.env`.

## Schema Management

`.uda` files in `umbraco/Deploy/Revision/` are auto-modified by Umbraco on every local startup. Before staging, always verify `.uda` changes are intentional — if not, discard them:

```bash
git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/
```

The pre-commit hook in `.githooks/pre-commit` (activated with `git config core.hooksPath .githooks` — see README) automatically checks for conflicts before each commit.

Use `/check-uda` for a detailed pre-commit analysis: fetches remote state, identifies which schema entities are at risk, rates conflict severity (SAFE / LOW / MEDIUM / HIGH / CRITICAL), and gives specific remediation steps. `/check-uda` also hits Live's Deploy Management API to detect DB↔file drift that pure git diffing can't see (see **How schema drift happens** below).

### How schema drift happens in this project

The Deploy dashboard treats any entity where `umbracoExists !== fileExists` as drift. Four mechanisms can drive a wedge between DB state and file state:

**1. Built-in Umbraco entities never extracted at setup.** When the project was first provisioned, only user-authored entities (custom document types, custom data types, templates) got extracted to `.uda`. Built-in defaults — `Date Picker`, `Textstring`, `Dropdown`, the 18 `Label (*)` types, the six default media types (`Article`, `Audio`, `File`, `Folder`, `Vector Graphics (SVG)`, `Video`), the `en-US` language, the `Member` type, and the seven standard relation types — stayed DB-only on every environment. This created permanent "not up to date" noise on the Deploy dashboard that masked real drift. **Fixed once, 2026-04-23**: all 51 built-in defaults are now committed as `.uda` files. If you install a new package that adds built-in entities (e.g. a member-type container), expect the same pattern — extract its artifacts via `POST /umbraco/deploy/management/api/v1/schema/file?udi={udi}` or the dashboard's per-row "Create file" action, then commit.

**2. Schema edits made directly on Live's backoffice.** Local is the declared source of truth — all schema authoring should happen on local and flow through git to Live. If someone makes a schema change directly in Live's backoffice (including via the Deploy dashboard's "Create" action on an orphan), that change becomes a Live-only entity with no `.uda` file. Rule: **never author schema on Live** — always edit locally and push. If Live already has orphans (as we found with the old manually-created AI connection), either delete them from Live and let the file-backed version replace them, or extract them to `.uda` via the Deploy dashboard before deleting.

**3. Umbraco auto-regenerates `.uda` on local startup.** Every `dotnet run` can rewrite files based on local DB signatures. If that regeneration gets staged inadvertently, git drifts from Live without any intentional schema change. See the `git checkout --` recipe above. Under [CI/CD & Build hygiene](#cicd--build-hygiene), `cloud-sync` also pulls Cloud's auto-normalized `.uda` commits back to the branch before each Dev deploy (the `permissions: contents: write` block in [main.yml](.github/workflows/main.yml) exists for this push) — an additional surface for the same drift, already covered by `/check-uda`.

**4. Umbraco Cloud auto-commits normalized `.uda` back to git.** When a file is imported into Live's DB via the Deploy dashboard, Cloud can re-serialize the artifact with normalized internal IDs (e.g. regenerating `Resources[].Id` GUIDs in ai-context files) and commit it directly to the repo as `Umbraco Cloud <support@umbraco.io>`. This is normal — it means Live becomes the source of truth for those specific normalized values. **Always `git pull` / `git fetch` before pushing** so you don't conflict with Cloud's own commits. The `/check-uda` pre-commit hook warns about this.

Root-cause summary: mechanism (1) was the biggest contributor historically (51 entities of drift from day one). Mechanisms (2)–(4) are ongoing risks that `/check-uda` is designed to catch before push.

### Importing pending schema on a Cloud environment

If `/check-uda` reports `mismatch` or `pending` entries on Live and content transfers get stuck, the fastest fix is usually the dashboard's **per-row "Update item"** action — right-click the row after toggling "hide up to date" on. Do **not** start with portal restarts or empty-commit nudges (they often don't trigger reimport), and do not confuse the per-row action with the top-of-dashboard bulk "Update Umbraco Schema from data files" button (which does nothing on Cloud despite reporting "operation completed"). Full remediation paths — including the `POST /schema/item?udi=...` API fallback for pending rows — live in `/check-uda` Step 8.

### Enabling Live-drift detection in `/check-uda`

`/check-uda` can optionally query Live's Deploy Management API to catch drift that pure git diffing misses. To enable:

1. On Live's backoffice, create an OAuth client credentials pair: **Settings → OAuth → Add client** (same mechanism as the local credentials the `/umbraco-edit` skill uses). Grant it scopes sufficient to read the Deploy Management API.
2. Add these entries to your local `.env`:
   ```
   UMBRACO_LIVE_URL=https://<your-live-host>
   UMBRACO_LIVE_CLIENT_ID=<client id>
   UMBRACO_LIVE_CLIENT_SECRET=<client secret>
   ```
3. Run `/check-uda`. If credentials resolve, the report will include a **Live-Side Drift** section with per-category counts of orphans / pending / signature mismatches.

Without `UMBRACO_LIVE_*` entries, `/check-uda` degrades gracefully to git-only mode with a yellow warning.

## Media files

**Umbraco Cloud is the source of truth for media binaries.** `src/UmbracoProject/wwwroot/media/` is gitignored — binaries are never committed. This is the Cloud-native pattern: schema flows through git (.uda files), content flows through Cloud Deploy, and media flows through Cloud's media transfer. It scales cleanly across multiple authors because nobody has to remember to "commit the image they just uploaded".

### Local development workflow

**Fresh clone:** `dotnet run` starts with an empty local media folder. Existing articles will render with broken images until media is restored from Cloud.

**Restoring content from Cloud to local:**

1. In the local backoffice, open **Settings → Deploy** and do a content restore from a Cloud environment — **Dev** for the full superset (including content not yet promoted to Live), or **Live** for published-only content. (A restore overwrites local records, so transfer any local WIP *up* first — see [content workflow under CI](#content-workflow-under-ci).)
2. In that same dashboard, also do a **media restore** for the same environment. This is the step that's easy to forget — content restore pulls document records (including the media picker references like `/media/<hash>/<name>.png`), but **does not** pull the media binaries.
3. Verify: browse the restored articles. If `mainImage` fields show broken links, step 2 was skipped.

**Authoring:** Create and generate media **locally** (backoffice upload or the image-generator CLI — the local `wwwroot/media/` is where new binaries land), then transfer it **up** the same direction as content: local → Dev → Live, via the Cloud Deploy dashboard. Do not commit `wwwroot/media/` changes — the gitignore rule will block them, but don't bypass it.

### When local media breaks

The usual cause is skipping the media restore after a partial content restore: local DB now points to `/media/<hash>/<filename>` paths whose binaries live on Dev-or-Live (Dev is the superset) but not on disk. To heal:

```bash
npm run media:sync                  # pull every missing binary from $UMBRACO_LIVE_URL
npm run media:sync -- --dry-run     # report what would change, don't write
npm run media:sync -- --source=<url>   # use a different source environment
```

The script walks the local media tree, finds every record whose `umbracoFile.src` points at a file not on disk, and downloads each from the source env at the same path. Safe to run anytime — idempotent, only writes missing files. Exits 2 if any record's binary is missing from the source too (e.g., locally-created media that was never pushed up).

Source: [scripts/media-sync/src/cli.ts](scripts/media-sync/src/cli.ts). Requires `UMBRACO_LIVE_URL` in `.env`.

The "right" fix is always to do the matching media restore from the Cloud Deploy dashboard — `media:sync` is the safety net when that step got skipped.

### The generator produces media the same way

The image generator CLI ([scripts/image-generator/src/umbraco-api.ts](scripts/image-generator/src/umbraco-api.ts)) calls the same Management API endpoints as a backoffice upload: `POST /temporary-file` followed by `POST /media`. The generated files land in local `wwwroot/media/<hash>/`, get picked up by the local DB, and need to be pushed to Cloud via a standard media transfer if they're needed on other environments.

## Testing

### E2E Tests (Playwright)

Tests live in `tests/e2e/`. The test runner and dependencies are in the root `package.json` (separate from the C# project).

```bash
# Node is managed via nvm — prefix commands with PATH if node isn't in your shell PATH
PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test

# Run with visual UI (great for debugging)
PATH="..." npx playwright test --ui

# Run a specific file
PATH="..." npx playwright test tests/e2e/blocks/alertBanner.spec.ts
```

**Packages** (root `package.json`):
- `@playwright/test` ^1.56
- `@umbraco/playwright-testhelpers` 17.1.0-beta.7 — must match Umbraco major version
- `@umbraco/json-models-builders` ^2.0.42 — for building element type payloads

**First-time setup:**
```bash
PATH="..." npm install
PATH="..." npx playwright install chromium
```

### Auth Setup

`tests/e2e/auth.setup.ts` uses **OAuth client credentials** (not UI login). The Umbraco 17 backoffice is a Lit SPA — `LoginUiHelper` from testhelpers won't find `[name="username"]` in the DOM. Instead, auth setup:

1. POSTs to `/umbraco/management/api/v1/security/back-office/token` with `grant_type=client_credentials`
2. Writes `tests/e2e/.auth/user.json` with the token in `umb:userAuthTokenResponse` localStorage format

Credentials come from `.env` (`UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET`). The testhelpers package reads `process.env.URL` (not `UMBRACO_URL`) for the base URL — both are set in `.env`.

**In CI** (the Gate 2 `playwright-against-dev` job in [.github/workflows/main.yml](.github/workflows/main.yml)) auth points at **Dev's URL, not localhost**, via the `URL` GitHub variable. `UMBRACO_CLIENT_ID` / `UMBRACO_CLIENT_SECRET` come from GitHub Secrets and must match an OAuth client registered on the Dev backoffice. See [CI/CD & Build hygiene > GitHub Secrets / Variables](#github-secrets--variables) for the full mapping.

**Tokens expire in 299 seconds.** Auth re-runs automatically before each Playwright session.

### Block Development Workflow (TDD)

Use the `/block` command for the full RED → GREEN TDD workflow for building blocklist components. See [.claude/commands/block.md](.claude/commands/block.md) for details.

**Authoring E2E specs?** The Management-API quirks and the E2E resilience rules (dynamic ID/slug lookup, stale-data cleanup, token refresh, resilient assertions) live in [docs/e2e-testing.md](docs/e2e-testing.md).

## Image Generator

Canvas-based image generator for creating flow-field featured images from article metadata. Lives in two locations:

- `scripts/image-generator/` — standalone CLI tool (`tsx scripts/image-generator/src/cli.ts`)
- `src/HelloWorld/Client/src/imageGenerator/` — backoffice integration module

Uses `@napi-rs/canvas` for server-side rendering. Run via `npm run generate:images`. Unit tests via `npm run test:unit`.

Use the `/cms-image` command to generate and publish images.

## Claude Code Skills

Five skills are installed in this project — three from [anthropics/skills](https://github.com/anthropics/skills), one Anthropic skill used as meta-tooling, and one project-authored:

**From [anthropics/skills](https://github.com/anthropics/skills):**
- `/algorithmic-art` — Interactive p5.js generative art for decorative hero visuals. Outputs self-contained HTML with seed navigation and parameter controls. Export PNG via the built-in download button.
- `/canvas-design` — Static PNG visual design with curated typography. Requires fonts (see `skills/README.md` for fetch instructions).
- `frontend-design` — Refined UI design exploration (used during the image-carousel-captions-controls work; see [_plans/shipped/image-carousel-captions-controls.md](_plans/shipped/image-carousel-captions-controls.md) Step 3 for an example invocation).
- `skill-creator` — Anthropic's official scaffolding for building, evaluating, and tuning new skills. Used to build `architecture-audit`; available for future skills.

**Project-authored:**
- `architecture-audit` — Audits the architectural quality of an Umbraco/.NET codebase against seven pillars (modern .NET, architectural separation, Umbraco-version-appropriate patterns, headless suitability, documentation & onboarding, resilience & operations, scalability & refactorability). Lifecycle-aware; optionally compares two repos head-to-head. Reports save to `_audits/<YYYY-MM-DD>-<slug>.md`.

### Two skill folder locations (and why)

Skills live in two top-level folders by accident of history. The intent is to consolidate eventually; for now both are valid:

- **`skills/`** — older repo-local convention. Holds skills that ship bundled binary assets (e.g., `canvas-design` needs font files fetched at install time). `/algorithmic-art` and `/canvas-design` live here; outputs go to `skills/output/` (gitignored). See [skills/README.md](skills/README.md) for the asset-fetch instructions.
- **`.agents/skills/`** — the [Anthropic skills convention](https://github.com/anthropics/skills). `frontend-design`, `skill-creator`, and `architecture-audit` live here. Each is symlinked from `.claude/skills/<name>` so Claude Code discovers it.

Future cleanup (P2): move `algorithmic-art` and `canvas-design` to `.agents/skills/` with their bundled assets and retire the legacy `skills/` location. Hash of `frontend-design` is tracked in [skills-lock.json](skills-lock.json).

## Workflow layers

Work flows through five layers, loose-to-tight: **Roadmap → Feature → Spec → Plan → Implement**. The project-level queue lives in [ROADMAP.md](ROADMAP.md); per-feature mini-roadmaps live in the **Increments** section of each `_features/<slug>.md`. Each spec covers a single increment (not a whole feature). When a body of work spans 3+ features and needs a shared intent doc, write an optional PRD at `_prds/<slug>.md` and link it from the roadmap.

Entry-point commands per layer: `/spec <slug>` → `/plan _specs/<slug>.md` → `/implement-step _plans/<slug>.md N` (per step) → `/feature update <slug>` → `/code-review`. `/implement-step` dispatches each step to a fresh subagent so the main context stays clean across an M-or-L plan; you can also just paste a step's prompt into a new chat if you don't want the dispatch overhead. Every command ends with a "Next:" line pointing at the next stage.

**Out-of-flow changes — the `/retrofit` path.** Not every change goes through the layers above, and that's fine: small front-end/backoffice tweaks and AI-assistant edits often land directly, verified by eye. The standing rule is that **any change that skipped the flow → run `/retrofit` before you commit it** (or before you push, if you already committed). `/retrofit` reconciles what you did against the actual diff, runs the three `/code-review` reviewers, surfaces edge cases, and proposes the tests + doc updates the change would otherwise skip — then applies only what you confirm. It's the low-friction "easy button" that keeps the codebase documented and testable regardless of how a change got made, so you don't have to remember to hand-run review + tests + docs each time. A bare `/retrofit` (no description) works; adding a sentence about what you changed sharpens its intent-vs-diff reconciliation.

### Work types — which artifacts a piece of work earns

`_features/` is **living documentation of how the site behaves right now — one file per capability, named by area of the site** (`section-navigation`, `site-header`, `seo-routing`, `umbraco-ai-search`). It is **not** a record of work done. Before any work earns a feature doc, classify it — `/spec`, `/plan`, and `/feature` all branch on this:

| Work type | Examples | Feature doc? | Where the durable record lives |
|---|---|---|---|
| **New capability** | section-navigation, image-carousel, innovation-showcase | **Create** `_features/<slug>.md`, named by the capability | The new feature doc (behavior) + spec/plan (why/how) |
| **Change to an existing capability** | migrate-ai-search-stable, extract-search-service, a new field on an existing block | **Update the existing capability's doc** — do *not* create a `<work-name>.md` | Evergreen behavior folds into the existing feature doc; point-in-time ACs stay in the shipped spec/plan |
| **Fix / infra / CI / cleanup** | fix-e2e-dev-only-failures, fix-screenshot-baselines, a dependency bump with no behavior change | **No feature doc** | A runbook under `docs/` (e.g. [docs/ci-failure-recipes.md](docs/ci-failure-recipes.md)) and/or a CLAUDE.md section; ACs in the shipped spec |

**The tell**: if a doc's Rules read as *transitions* ("goes from red to…", "leaves no trace after the change ships", "compiles on the stable stack") rather than *standing behavior* ("visitors can search from /search"), it's a change/fix masquerading as a capability — fold it into the affected capability doc or a runbook, don't file it under `_features/`. (This is why `migrate-ai-search-stable-1-0`, `remove-seotoolkit`, and `fix-e2e-dev-only-failures` were retired on 2026-06-16 — see their shipped specs.) This rule supersedes the older `workflow-bundle-mode` ROADMAP idea (binary bundle/not-bundle) with a three-way classification.

## Project Planning

- `_specs/` — feature specification documents (initial requirements, design rationale, open questions — the "why"). Shipped specs archive under `_specs/shipped/`.
- `_plans/` — implementation plans for features (TDD steps with paste-ready prompts — the "how"). Shipped plans archive under `_plans/shipped/`.
- `_features/` — living BDD-style behavioral specifications (current feature behavior as Given/When/Then scenarios — the "what")
- `_prds/` — optional PRDs for bodies of work spanning 3+ features (see *Workflow layers* above)
- `_audits/` — dated reference notes for the owner's own consideration (`YYYY-MM-DD-<slug>.md`): `architecture-audit` skill reports plus ad-hoc audits and decision/strategy records. **Gitignored** — personal working reference, not a team artifact for now; these date quickly and can become stale noise, so treat any as a point-in-time snapshot rather than current truth. The two `2026-05-19-*` audits predate the ignore rule and remain tracked as pre-existing history (and as skill-creator eval fixtures); everything added since is local-only.

## Feature Behavioral Specs

- `_features/` contains one file per logical feature, using Given/When/Then scenario format grouped by `Rule:` headings
- **Source of truth** for what a feature does right now — used for QA regression testing and developer onboarding
- Draft scenarios are generated by `/spec`, verified/updated as the final step of every `/plan`
- Use `/feature` to generate or update a feature doc from specs, plans, and tests
- Follows BDD principles from `.claude/skills/BDD.md`: Example Mapping, Specification by Example, Ubiquitous Language
- `_specs/` remain as historical records of original requirements and design rationale

## Deployment

Deploys are wired through **GitHub Actions → Umbraco Cloud CI/CD Flow** — see [`## CI/CD & Build hygiene`](#cicd--build-hygiene) above for the full pipeline (two gates, master-only deploy to Dev, manual promotion to Live in the Cloud Portal). The `.umbraco` file at the repo root still tells Cloud which `.csproj` to build; it just isn't triggered by a direct git push to a Cloud remote anymore — GitHub Actions calls the Cloud CI/CD Flow API instead. Environment-specific config is in `appsettings.{Development,Staging,Production}.json`.

### Git remotes — always push to `github`, never `origin`

This clone has **three** remotes, and `origin` is a trap:

| Remote | URL | What it is | Push here? |
|---|---|---|---|
| `github` | `github.com/robot-denny/ai-sketchlab` | **The dev repo** — code, PRs, GitHub Actions CI/CD. `master` tracks this. | **Yes — all normal git work.** |
| `origin` | `scm.umbraco.io/.../umbraco-17-demo-site` | Umbraco Cloud **Live** SCM | No |
| `dev-cloud` | `scm.umbraco.io/.../dev-umbraco-17-demo-site` | Umbraco Cloud **Dev** SCM | No |

**All pushes, branches, and PRs go to `github`.** The Cloud remotes (`origin`, `dev-cloud`) are *not* the deploy trigger — GitHub Actions calls the Cloud CI/CD Flow API (above), so you never `git push` to Cloud in the normal workflow.

The trap: `git config remote.pushDefault` is **unset**, so git falls back to `origin` (= Cloud Live) for any branch without an upstream. `master` already tracks `github` so a bare `git push` on master is fine, but **`git push -u origin <new-branch>` pushes a feature branch to Cloud, not GitHub** — the wrong place, and it won't open a PR or run CI. When creating a branch, push explicitly: `git push -u github <branch>`. (A durable per-clone fix is `git config remote.pushDefault github`, which makes a bare `git push` target GitHub for every branch.)

## Formatting

Mechanical formatting rules live in [.editorconfig](.editorconfig) — every modern editor honors them at save time, no extra tooling required (covers indentation, line endings, trailing whitespace, final newline, C# Allman braces, C# predefined-type keywords, C# spacing around operators / commas / control-flow keywords). The conventions below cover what `.editorconfig` can't express:

- **Comment marker spacing**: space after `//`, `#`, `/*` (`// note`, not `//note`).
- **String interpolation over concatenation** for simple cases: `$"Hello {name}"` in C#, `` `Hello ${name}` `` in TS. Don't convert complex multi-expression concats.
- **Variable declarations**: match the file's dominant style. C# in this codebase uses `var` widely — don't mix in explicit types in `var`-dominant files (or vice versa).
- **Import grouping**: stdlib → third-party → local, alphabetical within each group. Only remove imports that are demonstrably unused — risky in C# due to DI / model-binding / source generators, safer in TS.
- **Braces**: C# uses Allman (enforced by `.editorconfig`). Single-line guards like `if (x == null) return null;` are idiomatic in this codebase — don't expand them. TS uses K&R per JS/TS community convention.

There is no automated formatter wired up (no `dotnet format` pre-commit hook, no Prettier / ESLint config). The combination of `.editorconfig` (auto-enforced at save) and these guidelines (Claude-aware when authoring) is the project's current formatting strategy.

## Conventions

- Views inherit from `UmbracoViewPage<ContentType>` where `ContentType` is an auto-generated model
- `_ViewImports.cshtml` imports `Umbraco.Cms.Web.Common.PublishedModels`, `Umbraco.Extensions`, and ASP.NET tag helpers
- The `.env` file contains Umbraco MCP server connection settings for local development
- `appsettings.Development.json` is **gitignored** — it contains the Anthropic and OpenAI API keys (and any other per-developer secrets). Each developer must create their own with their credentials.
- `umbraco-cloud.json` is managed by Umbraco Cloud — do not manually edit

## Claude Code Plugins

The **Umbraco CMS Backoffice Skills** plugin is installed via the Claude Code CLI (not the VS Code extension). It provides 60+ skills for building backoffice extensions:

```
/plugin marketplace add umbraco/Umbraco-CMS-Backoffice-Skills
/plugin install umbraco-cms-backoffice-skills@umbraco-backoffice-marketplace
/plugin install umbraco-cms-backoffice-testing-skills@umbraco-backoffice-marketplace
```
