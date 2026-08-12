# AGENTS.md

The neutral entry point for anyone (human or agent) working in this repository — project
identity, architecture, and conventions, with pointers to the operational runbooks under
[docs/](docs/). Tool-specific operating notes for Claude Code live in [CLAUDE.md](CLAUDE.md);
the workflow spine (roadmap → feature → spec → plan → implement) is owned by the installed
`workflow` skill.
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

For E2E tests, see [docs/testing-guide.md](docs/testing-guide.md).
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

**AI Deploy packages** (serializes AI entities as `.uda` artifacts for schema deploy to Umbraco Cloud): Umbraco.AI.Deploy, Umbraco.AI.Prompt.Deploy, Umbraco.AI.Agent.Deploy. Auto-registered — no composer code required. **All four AI entity families (connections/profiles/contexts/prompts, plus agents) deploy as `.uda`** — agents no longer need to be recreated manually per Cloud environment. (Note: profile *settings* require `Umbraco.AI.Deploy` ≥ 17.0.1 — see *AI schema deployment* in [docs/ai-copilot.md](docs/ai-copilot.md).)

**Search packages** (now stable — the v18-forward replacement for legacy Examine search): Umbraco.Cms.Search.Core, Umbraco.Cms.Search.BackOffice, Umbraco.Cms.Search.DeliveryApi, plus Umbraco.AI.Search (on the CMS-17-aligned AI versioning, not the Cms.Search 1.0.0 line). The lone exception is Umbraco.Cms.Search.Provider.Examine, pinned to a beta (no stable release yet) — see [docs/pinned-betas.md](docs/pinned-betas.md).
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
## Conventions

- Views inherit from `UmbracoViewPage<ContentType>` where `ContentType` is an auto-generated model
- `_ViewImports.cshtml` imports `Umbraco.Cms.Web.Common.PublishedModels`, `Umbraco.Extensions`, and ASP.NET tag helpers
- The `.env` file contains Umbraco MCP server connection settings for local development
- `appsettings.Development.json` is **gitignored** — it contains the Anthropic and OpenAI API keys (and any other per-developer secrets). Each developer must create their own with their credentials.
- `umbraco-cloud.json` is managed by Umbraco Cloud — do not manually edit
## Formatting

Mechanical formatting rules live in [.editorconfig](.editorconfig) — every modern editor honors them at save time, no extra tooling required (covers indentation, line endings, trailing whitespace, final newline, C# Allman braces, C# predefined-type keywords, C# spacing around operators / commas / control-flow keywords). The conventions below cover what `.editorconfig` can't express:

- **Comment marker spacing**: space after `//`, `#`, `/*` (`// note`, not `//note`).
- **String interpolation over concatenation** for simple cases: `$"Hello {name}"` in C#, `` `Hello ${name}` `` in TS. Don't convert complex multi-expression concats.
- **Variable declarations**: match the file's dominant style. C# in this codebase uses `var` widely — don't mix in explicit types in `var`-dominant files (or vice versa).
- **Import grouping**: stdlib → third-party → local, alphabetical within each group. Only remove imports that are demonstrably unused — risky in C# due to DI / model-binding / source generators, safer in TS.
- **Braces**: C# uses Allman (enforced by `.editorconfig`). Single-line guards like `if (x == null) return null;` are idiomatic in this codebase — don't expand them. TS uses K&R per JS/TS community convention.

There is no automated formatter wired up (no `dotnet format` pre-commit hook, no Prettier / ESLint config). The combination of `.editorconfig` (auto-enforced at save) and these guidelines (Claude-aware when authoring) is the project's current formatting strategy.
## Toolkit & workflow

This repo runs on the **cantrip toolkit** as its developer tooling. The layout:

- **Spells** — skills under [.agents/skills/](.agents/skills/) (symlinked from `.claude/skills/`)
  provide the workflow commands: `/spec`, `/plan`, `/implement-step`, `/feature`, `/retrofit`,
  `/explore`, `/code-review`, `/commit-message`. These supersede the eight retired
  `.claude/commands/*.md` of the same names.
- **Kept project commands** — seven tailored commands stay under [.claude/commands/](.claude/commands/):
  `check-uda`, `umbraco-edit`, `block`, `cms-image`, `guide`, `algorithmic-art`, `canvas-design`.
- **Config slots** — project-specific facts the spells read live in [.agents/config/](.agents/config/):
  `paths.md` (where things live), `stack.md` (build/test/run commands), `conventions.md`
  (branch/commit/impl discipline), and `reviewer-rules/`.
- **The `workflow` skill** owns the workflow spine and the **work-type classification**
  (new-capability / change-to-existing / fix-infra) that decides which durable artifacts a piece
  of work earns — consult it before creating a spec, plan, or feature doc. Specs and plans currently
  land in `_specs/`/`_plans/`; the toolkit's target layout is one increment bundle per slug under
  `_work/<slug>/`, which the in-progress workspace migration establishes (see
  [.agents/config/paths.md](.agents/config/paths.md)). Living capability docs stay in
  [_features/](_features/).
- **Reviewers** — `code-reviewer`, `accessibility-reviewer`, `perf-reviewer` under
  [.claude/agents/](.claude/agents/); `/code-review` runs all three. Their calibrated working
  memory lives in `.claude/agent-memory/<reviewer>/` (gitignored).

See [CLAUDE.md](CLAUDE.md) for Claude-Code-specific operating notes (skills, plugins, the two
memory systems, MCP).
## Documentation index

Operational runbooks live under [docs/](docs/):

**Build, test, deploy & CI**
- [docs/testing-guide.md](docs/testing-guide.md) — the full testing guide (xUnit, Node, Playwright), plus the ported Playwright setup/auth appendix.
- [docs/e2e-testing.md](docs/e2e-testing.md) — Management-API quirks and E2E resilience rules.
- [docs/ci-cd.md](docs/ci-cd.md) — CI/CD & build hygiene (two-gate pipeline, screenshot baselines, TWAE/NoWarn, GitHub secrets).
- [docs/ci-failure-recipes.md](docs/ci-failure-recipes.md) — diagnosing a red CI run + the previously-seen failure recipes.
- [docs/deployment.md](docs/deployment.md) — deploy pipeline and the git-remotes map (push to `github`, never `origin`).
- [docs/pinned-betas.md](docs/pinned-betas.md) — the pinned pre-release packages and why.

**Content, schema & media**
- [docs/schema-management.md](docs/schema-management.md) — `.uda` drift, `/check-uda`, importing pending schema.
- [docs/content-transfer-workflow.md](docs/content-transfer-workflow.md) — the local → Dev → Live content-transfer runbook.
- [docs/media.md](docs/media.md) — media-binary flow and `media:sync`.
- [docs/umbraco-edit.md](docs/umbraco-edit.md) — editing content via the Management API from outside the backoffice.

**AI, search & SEO**
- [docs/ai-copilot.md](docs/ai-copilot.md) — AI Copilot config + AI schema deployment to Cloud.
- [docs/search.md](docs/search.md) — the Umbraco.Cms.Search + AI.Search stack.
- [docs/seo-routing.md](docs/seo-routing.md) — `/sitemap.xml`, `/robots.txt`, branded 404.
- [docs/capabilities.md](docs/capabilities.md) — validated MCP + AI capabilities.

**Frontend & design**
- [docs/design-system.md](docs/design-system.md), [docs/brand.md](docs/brand.md), [docs/block-css-seam.md](docs/block-css-seam.md) — design tokens, brand, and the block CSS portability seam.
- [docs/image-generator.md](docs/image-generator.md) — the flow-field featured-image generator.

`docs/project-memory/` mirrors the agent's cross-session project memory read-only (see
[CLAUDE.md](CLAUDE.md)).
## Claude Code Plugins

The **Umbraco CMS Backoffice Skills** plugin is installed via the Claude Code CLI (not the VS Code extension). It provides 60+ skills for building backoffice extensions:

```
/plugin marketplace add umbraco/Umbraco-CMS-Backoffice-Skills
/plugin install umbraco-cms-backoffice-skills@umbraco-backoffice-marketplace
/plugin install umbraco-cms-backoffice-testing-skills@umbraco-backoffice-marketplace
```
