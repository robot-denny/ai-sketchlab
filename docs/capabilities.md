# Umbraco 17 + AI Capabilities Tracker

> **What's possible on this site with MCP, Umbraco, and AI/agentic tooling.** This page is a working catalogue of capabilities we've actually exercised — content operations through the Model Context Protocol (MCP), in-backoffice AI (Copilot, agents, prompts), the agentic development pipeline (Claude Code slash commands + skills), and the site features they've produced.
>
> Kept in sync with the [Capabilities page](https://ai-sketchlab.dev/capabilities/) in the Umbraco backoffice.
>
> **This page tracks _capabilities_, not commits.** For the authoritative shipped history see [ROADMAP.md → Recently shipped](https://github.com/robot-denny/ai-sketchlab/blob/master/ROADMAP.md) and the [git log](https://github.com/robot-denny/ai-sketchlab/commits/master). Behavioral contracts for each shipped feature live under [`_features/`](https://github.com/robot-denny/ai-sketchlab/tree/master/_features).

**Last Updated:** 2026-07-07

---

## Working Capabilities

### Content Management via MCP

The Umbraco MCP server exposes four tool collections to Claude Code — `document`, `media`, `document-type`, `data-type` — enabling schema and content operations from outside the backoffice UI.

| Capability | Notes |
|---|---|
| Article creation with category assignment and date metadata | MCP `document` tools |
| Multi-author attribution on content blocks (6 element types) | Author field added across block element types |
| Document type property modifications (add/rename fields, swap data types) | Full property-editor lifecycle via `document-type` tools |
| Custom document type creation via MCP | e.g. the Documentation doc type |
| Data type creation via MCP (MNTP, Markdown, Richtext, Dropdown, Block List) | `data-type` tools |
| Document type schema sync via Deploy `.uda` files | All schema changes tracked in `umbraco/Deploy/Revision/` and flow through the git → Cloud pipeline |
| Adding composition doc types to existing types | e.g. Documentation composed from 5 compositions |
| Allowing child content types on parent pages | e.g. Documentation allowed under Home |
| Document search + tree traversal via MCP | `search-document` / `search` to find content; `get-document-children` / `get-document-ancestors` to walk the tree |
| Content property update + publishing via MCP | `update-document` (whole doc) / `update-block-property` (a block value) → `publish-document` / `publish-document-with-descendants` |
| Bulk content operations via MCP | Update fields (e.g. SEO) across every blog article in a single orchestrated workflow |
| Block List editor configuration (add/remove block types) | Register new element types into a Block List data type via MCP |
| Block Grid layout configuration (areas, multi-column rows, nested grids) | The `/experiments` page is the first production Block Grid; element types registered against any Block Grid property |
| Dynamic category resolution from backoffice (no hardcoding) | Categories pulled from the category list via the Management API |
| Large-scale schema rollout with `.uda` drift management | Multi-phase design-system rollouts introduce new data types, compositions, and dictionary keys across many doc types; `/check-uda` detects drift before each push. Net: zero conflicts merged |

### Cross-Document Reading & Reference Analysis via MCP

Unlike the in-backoffice Copilot (which can read the tree but only writes to the open content item — see *Boundaries* below), MCP-orchestrated tooling can read, search, and analyze the **whole content tree**, then write across it. This is what powers the bulk-operation workflows above.

| Capability | Notes |
|---|---|
| Search across all content | `search-document` for text/keyword; `search` / `get-searcher-by-searcher-name-query` route through registered searchers (keyword, or the `UmbAI_Search` vector index for semantic discovery) |
| Fetch any document by id | `get-document-by-id` returns full property values; `get-document-configuration` / `get-document-property-value-template` expose the shape to write against |
| Traverse relationships | `get-document-children`, `get-document-ancestors` |
| **Reference / dependency analysis** | `get-document-are-referenced`, `get-document-by-id-referenced-by`, `get-document-by-id-referenced-descendants` — find what links to a node before editing or deleting it (impact analysis) |
| Schema-informed authoring | `get-document-type` / `get-all-document-types` / `get-data-type-configuration` return the element types, aliases, and editor config an agent needs to construct valid (nested) block values by design, rather than guessing structure |

### AI Content Generation (Copilot & Agents)

Configured in the backoffice under **Settings → AI**. The current stack runs the `Umbraco.AI` 17.x suite — the Copilot chat surface (`Umbraco.AI.Agent.Copilot` / `.UI`) plus provider integrations for Anthropic, OpenAI, and Google.

| Capability | Notes |
|---|---|
| Custom agent personas with distinct personality and voice | Settings → AI → Agent config |
| Context management for brand consistency and topic boundaries | Settings → AI → Contexts |
| Content-tree navigation and structure awareness | Copilot traverses parent-child relationships to understand where the open page sits in the site |
| Schema inspection for complex properties | Copilot requests full property schemas — including the JSON shapes for block lists, block grids, and pickers — to build valid values |
| Incremental block operations | Copilot adds, removes, and reorders individual blocks in a collection without replacing the whole property value |
| Page property modifications (metadata, titles, descriptions) | Copilot editing, scoped by agent permissions |
| Rich Text block population with maintained voice consistency | Fills blocks already on the page (see Limitations) |
| SEO metadata generation from page content | Copilot reads current page content and generates metaName, metaDescription, metaKeywords |
| Text summarization prompt | Settings → AI → Prompts — summarize selected text in-place |
| Image alt text generation prompt | Settings → AI → Prompts — descriptive alt text for selected images |
| SEO content agent | Dedicated agent for SEO titles, descriptions, keywords (aligned to the `SEO Controls` field aliases) |
| CMS editor support agent | Support agent that coaches editors on navigating and using Umbraco |
| AI-Agent-authored editor how-to guides | The `/guide` CLI drives a backoffice agent so guide copy stays in editable brand voice (see Custom Commands) |

### AI Schema Deployment (`.uda`)

Every AI entity now deploys as schema through git → Umbraco Cloud, so AI configuration is reproducible per-environment rather than hand-rebuilt.

| Capability | Notes |
|---|---|
| AI configuration auto-serializes to `.uda` for Cloud deploy | `Umbraco.AI.Deploy` + `Umbraco.AI.Prompt.Deploy` serialize Connections, Contexts, Guardrails, Chat/Embedding Profiles, Prompts, and Settings to `umbraco-ai-*.uda` on save |
| AI **agents** auto-serialize to `.uda` for Cloud deploy | `Umbraco.AI.Agent.Deploy` — closes the prior "agents must be recreated per Cloud environment" gap. **All four AI entity families now deploy as `.uda`** |
| Secret references stay as placeholders | Artifacts reference `$OpenAI:ApiKey` / `$Anthropic:ApiKey`; raw keys never enter the artifact stream. Per-environment keys set via Cloud Secrets Management |
| `$`-config-key allow-list | AI core refuses to resolve `$`-referenced config keys unless the prefix is allow-listed; `Umbraco:AI:AllowedConfigurationKeyPrefixes` in committed `appsettings.json` re-lists the defaults + adds `OpenAI` / `Anthropic` |

### MCP + AI Agent Orchestration

| Capability | Notes |
|---|---|
| Automated content workflow (fetch → generate → update) | Claude Code walks the document tree via Management API, extracts article content, calls the AI Agent API to generate fields, then writes each document back |
| AI Agent API invocation from Claude Code | POST to `/umbraco/ai/management/api/v1/agents/{alias}/run` with SSE-streamed response |
| Coordinated bulk AI generation | Generate SEO metadata across all blog articles by orchestrating MCP reads, Agent API calls, and Management API writes |
| Edit / invoke agents from outside the backoffice | The `/umbraco-edit` skill covers the OAuth token dance, the document/document-type endpoint reference, and the Agent SSE stream parsing |

### Backoffice Extensions

`src/HelloWorld/` is a self-contained, NuGet-packaged backoffice extension (TypeScript + Vite `Client/` frontend + auto-generated OpenAPI client).

| Capability | Notes |
|---|---|
| Dashboard extension via Umbraco Skills plugin | HelloWorld extension scaffold |
| Custom Settings dashboard (Image Generator — single/batch generation controls) | Lit dashboard in the Settings section backed by a C# Management API controller |
| Property action on media picker (one-click image generation from an article edit page) | Registered on `Umbraco.MediaPicker3` properties |
| C# Management API controller backing a backoffice extension | `ImageGeneratorController`; generation logic sits behind an `IImageGenerator` seam (unit-testable, composer-registered) |
| TipTap `styleMenu` extension manifest for editor-applied typography classes | Replaces the dead TinyMCE `/**umb_name:Label*/` annotation approach; manifest `overwrites: 'Umb.Tiptap.Toolbar.StyleSelect'` so no data-type edit is needed. Adds Editorial classes (Lead, Overline, Pull quote, Caption), h2–h6, and container styles |

### Claude Code Custom Commands

Slash commands under `.claude/commands/` that drive the agentic development process.

| Command | What it does |
|---|---|
| `/spec` | Feature spec + branch from a short idea → `_specs/{slug}.md` (requirements, acceptance criteria, edge cases) |
| `/plan` | Phased, TDD-first implementation plan from a spec → `_plans/{slug}.md` (self-contained step prompts) |
| `/implement-step` | Dispatches a single plan step to a fresh subagent so the main context stays clean across an M/L plan (Context + Key Decisions + Step N only; no auto-commit) |
| `/block` | TDD block-component creation (RED → GREEN): E2E test first, then element type via Management API, then Razor partial until green |
| `/feature` | Living BDD feature spec → `_features/{slug}.md` (Given/When/Then grouped by Rule, test-coverage table; the regression source of truth) |
| `/code-review` | Runs three specialized subagents in parallel (accessibility, code quality, performance) over uncommitted changes |
| `/check-uda` | Pre-commit analysis of Umbraco Deploy schema conflicts — fetches remote state, rates severity, gives remediation; ships pre-commit/pre-push/post-merge git hooks |
| `/cms-image` | Generate flow-field featured images from article metadata and publish to the CMS |
| `/guide` | Generate/amend editor-facing how-to guide pages; TS CLI calls a backoffice AI agent, preserves editor screenshots + live-example slots, `--audit` reports gaps |
| `/umbraco-edit` | Edit document properties or invoke an AI agent via the Management API from outside the backoffice |

**Skills** (under `.claude/skills/`): `architecture-audit` (project-authored — audits architectural quality against seven pillars), plus `frontend-design`, `skill-creator`, `algorithmic-art`, and `canvas-design`. The [Umbraco CMS Backoffice Skills](https://github.com/umbraco/Umbraco-CMS-Backoffice-Skills) plugin adds 60+ backoffice-extension skills.

### Development Workflow

End-to-end pipeline from idea to shipped feature. Each stage has a dedicated command that reads the previous stage's artifact and produces the next. Shipped specs and plans archive under [`_specs/shipped/`](https://github.com/robot-denny/ai-sketchlab/tree/master/_specs/shipped) and [`_plans/shipped/`](https://github.com/robot-denny/ai-sketchlab/tree/master/_plans/shipped) so the top-level lists reflect only active work.

| Stage | Command | Artifact |
|---|---|---|
| 1. Idea → spec | `/spec` | `_specs/{slug}.md` |
| 2. Spec → plan | `/plan` | `_plans/{slug}.md` |
| 3. Plan step → clean-context execution | `/implement-step` | (per-step, dispatched to a subagent) |
| 4. Plan → TDD block (RED → GREEN) | `/block` | E2E spec + element type + Razor partial |
| 5. Implementation → living BDD spec | `/feature` | `_features/{slug}.md` |
| 6. Uncommitted changes → review | `/code-review` | (accessibility + code-quality + perf subagents) |

**Workflow layers.** Work flows through five loose-to-tight layers — **Roadmap → Feature → Spec → Plan → Implement**. [ROADMAP.md](https://github.com/robot-denny/ai-sketchlab/blob/master/ROADMAP.md) is the project-level queue (Now / Next / Later / Bundles); each `_features/<slug>.md` carries an `Increments` section listing shipped + planned iterations, so a "feature" is durable across multiple spec/plan cycles. Work is classified as **new capability** (earns a feature doc), **change to an existing capability** (folds into that doc), or **fix/infra/cleanup** (a `docs/` runbook, no feature doc). The full model is documented under **Workflow layers** in [CLAUDE.md](https://github.com/robot-denny/ai-sketchlab/blob/master/CLAUDE.md).

### Solution Architecture

The site is a **two-project Razor Class Library (RCL) split** — a compile-enforced boundary between business logic and the runnable host. This landed via the Pillar 2 architecture push (completed 2026-06-30), moving architectural separation from 2 → 4 against the [2026-05-19 audit](https://github.com/robot-denny/ai-sketchlab/blob/master/_audits/2026-05-19-umbraco-17-demo-site.md).

| Capability | Notes |
|---|---|
| Business logic in a dedicated RCL (`UmbracoProject.Features`) | Thin host (`UmbracoProject`) references it; organized folder-by-kind (`Services/ Composer/ Infrastructure/ Constants/ Extensions/ Models/ Controllers/`) |
| Cross-assembly composer auto-discovery | Umbraco's `TypeLoader` scans the RCL (it references `Umbraco.Cms`), so an `IComposer` in the RCL runs with no `Program.cs` edit — runtime-verified via `SearchServiceComposer` |
| Migrated slices | Search service, premium-role member handler, and routing/SEO infra (404 finder, sitemap rewrite middleware) all relocated into the RCL behavior-preserving |
| ModelsBuilder in `SourceCodeManual` mode | 75 generated `PublishedModels` committed in the RCL, so model-coupled C# build-time-compiles; Cloud never regenerates on boot |
| Build-time Razor compilation + obsolete-API gate | `dotnet build` compiles views and gates obsolete-API (`CS0618`) usage; existing usages grandfathered via scoped `#pragma` |

### CI/CD & Build Hygiene

A safety net that lets schema/structural refactors ship without a leap of faith (shipped as `arch-safety-net`).

| Capability | Notes |
|---|---|
| Two-gate GitHub Actions → Umbraco Cloud CI/CD Flow | Gate 1 (every branch): `dotnet build -c Release` + `dotnet test`. Gate 2 (master only): Cloud sync → artifact → deploy to **Dev** → Playwright. Promotion to Live is a manual Cloud Portal action |
| Pre-push hook | `dotnet build -c Release` + xUnit before each push (< 30s warm; `SKIP_PREPUSH=1` escape) |
| Warnings-as-errors across all C# projects | `<TreatWarningsAsErrors>` + `<Nullable>enable</Nullable>`; only surgical per-code `<NoWarn>` with inline CVE justification is allowed |
| Linux-pinned Playwright screenshot baselines | Regenerated via the `update-snapshots.yml` workflow_dispatch; baselines committed by the CI bot |
| Red-CI diagnostic playbook | Generic "which gate → which job → new or pre-existing" method in CLAUDE.md; per-failure recipes in the [CI Failure Recipes runbook](https://github.com/robot-denny/ai-sketchlab/blob/master/docs/ci-failure-recipes.md) |

### Site Features

| Capability | Notes |
|---|---|
| Section navigation sidebar (desktop sidebar + mobile "In this Section" collapse toggle) | `sectionNavigationControls` composition applied to `content` / `documentation` types |
| Article list grid view display mode (editor-selectable list vs grid on `latestArticlesRow`) | Bootstrap grid rendering, E2E-covered |
| Multi-column site footer (branding, link groups, CSS custom properties) | `footer.cshtml` partial + footer content doc type |
| Site-wide "v2 chrome" design system | Phased page-by-page cutover; `pageHeadPatternControls` composition, Home manifesto/pull-quote fields, `[Dropdown] Page Head Pattern` data type — all distributed via MCP + `.uda` |
| Reading-time helper computed from word count | `Helpers/ReadingTime.cs` — walks `BlockListModel` rows, 225 wpm, per-request `IMemoryCache` keyed on `article.Id + UpdateDate.Ticks` |
| Editorial dictionary keys for chrome strings | Managed under Translation in the backoffice |
| Living style guide as block-driven CMS content (`/styleguide` + `/styleguide/components`) | Three programmatic element types (`colorPaletteBlock`, `typographyShowcaseBlock`, `generalElementsBlock`); swatches read live from `typography.css` via `/**umb_swatch:LABEL*/` annotations |
| Editor how-to guides as CMS content (`/guides/`) | `How-To Guide Page` doc type; `/guide` CLI keeps descriptions in sync, AI-agent-authored so brand voice stays editable; hidden from top nav |
| AI-author per-block attribution (`.ella-wrap` inline note) | `AI Persona Properties` composition adds an `isAi` toggle to Author; in a human-led article, `isAi` blocks get a "Written by {persona}" eyebrow + warm-stone callout; all-AI articles suppress it |
| **Innovation showcase** (`/experiments`) | The site's **first production Block Grid** layout — areas, multi-column rows, nested grids — telling the seven-pillar capability story end-to-end editable. Bespoke element types: `pillarSection`, `featureCard`, `commandBadge`, `statCallout`, `pullQuoteBlock`, `embeddedSketch`, `timelineRow` |

### SEO Routing

Three SEO surfaces served in-tree (no per-environment backoffice config), all flowing through the normal `master → Dev → Live` pipeline. `SeoToolkit.Umbraco` was deliberately removed (no Deploy integration).

| Capability | Notes |
|---|---|
| `/sitemap.xml` via URL-rewrite middleware | `SitemapRewriteMiddleware` (in the RCL) rewrites → `/xmlsitemap` content node; 60-min cached, `Cache-Control: public, max-age=3600`. A rewrite (not SurfaceController/IContentFinder) because those can't keep `IUmbracoContext` alive through render / are filtered out for `.xml` URLs |
| `/robots.txt` as a static file | Served from `wwwroot/robots.txt`, edited in-repo |
| Branded 404 via `IContentLastChanceFinder` | `NotFoundContentFinder` resolves unmatched URLs to the `Error` doc-type node (via `IDocumentNavigationQueryService`) and sets HTTP 404; skips `/umbraco` + `/api/` |
| Rename-redirects via built-in URL Tracker | Old URLs 301 to new automatically, no code |
| Custom meta/link tag surface | `metaData.cshtml` renders ~25 tags from the `SEO Controls` composition; the SEO Assistant agent targets the same field aliases |

### Procedural Image Generation

Canvas-based flow-field featured images seeded from article metadata.

| Capability | Notes |
|---|---|
| Deterministic flow-field PNG generation seeded from article metadata | TypeScript CLI at `scripts/image-generator/` (`@napi-rs/canvas`) |
| Category-to-color palette mapping with multi-category merging | Palettes read from "Site Settings" CMS content; `config/palettes.json` retained as seed/fallback |
| Palette configuration stored as editable CMS content | `PaletteService` reads the published "Site Settings" document via `IPublishedContentQuery`; transfers between environments via Umbraco Deploy |
| `[BlockList] Category Palettes` data type with per-category color blocks | Per-category (primary/mid/deep) hex colors via the Eye Dropper color picker |
| Batch generation + upload to the media library via Management API | CLI `--batch` flag; backoffice dashboard batch mode |
| End-to-end pipeline: generate → upload media → assign `mainImage` | CLI orchestrates metadata fetch, canvas render, media upload, property assignment (same Management API endpoints as a backoffice upload) |

### Site Search

Public search at `/search` runs on the **`Umbraco.Cms.Search` framework** (stable 1.0.0 — the v18-forward replacement for the legacy Examine-backed `IPublishedContentQuery.Search()` API) with **`Umbraco.AI.Search`** (17.x) layered on top for vector/semantic search. The lone remaining pre-release is `Provider.Examine 1.0.0-beta.9` — no stable release exists yet.

| Capability | Notes |
|---|---|
| Hybrid keyword + semantic search at `/search` | Examine (keyword) + `Umbraco.AI.Search` (vector) side-by-side; OpenAI `text-embedding-3-small` 512-dim; documents auto-chunked + embedded on publish |
| Semantic recall on paraphrased queries | Pages surface on conceptually-related queries that don't share literal keywords |
| System pages excluded from results | Search, Error, XMLSitemap, Category/CategoryList filtered at render time |
| Article results render author + publish date | "Posted by {author} on {date}"; non-article results omit it |
| Backoffice search enabled | `AddBackOfficeSearch()` on now that the 1.0.0 list-view crash is fixed |
| Vector index rebuild from the backoffice | `Settings → Search → UmbAI_Search` → rebuild icon (~3–4 chunks/doc, < 1 min). **Always verify doc count > 0** — a misconfigured rebuild still returns 200 |
| Keyword-path resilience guard | `SearchService` wraps the beta.9 multi-word `NullReferenceException` in try/catch → degrades to the empty state instead of a 500 |

### E2E Testing

Playwright suite under [`tests/e2e/`](https://github.com/robot-denny/ai-sketchlab/tree/master/tests/e2e); auth via OAuth client credentials (the backoffice is a Lit SPA, so UI login helpers don't apply).

| Capability | Notes |
|---|---|
| E2E resilience rules | 7 rules codified in CLAUDE.md (dynamic UUIDs, stale-data cleanup, token refresh, regex assertions, browser-over-file assertions) |
| Visual-regression screenshot baselines | 27 block + 6 page specs; Linux-only baselines; `maxDiffPixelRatio: 0.01` (byte-identical `0` for shim-equivalence pairs); dynamic regions masked |
| Feature-level E2E suites | Article-list grid view, site footer, section navigation, SEO routing smoke, and more |

---

## Boundaries & Limitations

**Two AI surfaces, very different reach.** Most "can AI do X?" questions resolve once you know *which* surface is meant — a limitation of one is often a capability of the other:

- **Copilot** — the in-backoffice chat UI. Scoped to the page open in the editor; assists while the editor stays in control.
- **MCP-orchestrated** (Claude Code / Desktop) — external tooling with tree-wide **read + write** across the `document` / `media` / `document-type` / `data-type` collections. This is what the *Working Capabilities* above describe.

### Copilot (in-backoffice) — intentional design boundaries

These are deliberate constraints that keep the in-editor assistant supporting human judgment, not replacing it — **not** limits of AI-on-Umbraco generally (MCP orchestration crosses most of them).

| Boundary | Detail |
|---|---|
| Builds blocks incrementally; doesn't scaffold whole pages | Copilot adds, removes, and reorders blocks in an existing collection and constructs schema-valid values, but complex multi-block page layouts still start from a template or MCP operations |
| No cross-document writes | Copilot can navigate tree structure and inspect schemas, but its changes are confined to the single open content item — multi-page work is MCP + Management API |
| Stages; doesn't publish | Copilot proposes changes in the workspace; the editor clicks Save/Publish. (MCP `publish-document` *can* publish directly) |
| References media; doesn't upload or generate | Copilot picks existing media via pickers; creating/uploading files is external (`/cms-image` CLI → `create-media`). It can't trigger the backoffice Image Generator |
| Schema-level operations, not content strategy | Constructs schema-valid content and handles conversational scaffolding ("a post about X with three sections"), but doesn't own editorial intent or governance — humans do |

*Philosophy: AI-assisted authoring, not autonomous generation.*

**Real-world limits (from field testing).** Beyond the design boundaries above, a few sharp edges surface in practice:

| Limitation | Detail |
|---|---|
| No transaction rollback | Failed operations — especially near context limits — can leave workspace state corrupted with no per-operation rollback; a refresh may lose staged changes |
| Can't inspect its own error state | Once the workspace is in a failed state, Copilot can't diagnose the error or suggest a recovery path |
| Schema docs must match runtime exactly | Mismatches between documented JSON schemas and actual runtime expectations (e.g. `content` vs `document` in a picker) cause blocking errors |

### MCP Environment

| Limitation | Details |
|---|---|
| `/doctor` static check may report false warnings | MCP env vars work at runtime despite warnings. Note: MCP creds come from the launching shell, not `.env` — launch Claude via the `claude-umb` alias |

### AI Schema Deploy & Search Index

| Limitation | Details |
|---|---|
| Vector search index does not replicate across environments | `UmbAI_Search` is per-environment. After every Cloud deploy affecting content or AI config, rebuild the index via `Settings → Search` and verify doc count > 0 before promoting |

---

## Untested Capabilities

| Capability | Category | Notes |
|---|---|---|
| Media upload/management via MCP | MCP | `media` collection enabled but not exercised (the image CLI uses the Management API directly) |
| Multi-language AI translation | AI | Requires Umbraco variants configuration |
| Content unpublishing via MCP | MCP | `unpublish-document` available, not tested |
| Content validation via MCP | MCP | `validate-document` available, not tested |

---

## Recent additions (since the last update, 2026-05-12)

The full dated history now lives in [ROADMAP.md → Recently shipped](https://github.com/robot-denny/ai-sketchlab/blob/master/ROADMAP.md) and the [git log](https://github.com/robot-denny/ai-sketchlab/commits/master); this list is a capability-level summary of what changed on this page.

- **Innovation showcase** (`/experiments`) — the site's first production **Block Grid** layout; seven bespoke element types. → *Site Features*
- **`/implement-step`** command — dispatches a single plan step to a fresh subagent. → *Custom Commands, Development Workflow*
- **Search service extraction + xUnit** — `search.cshtml` logic moved behind a composer-registered `SearchService`; added the test project.
- **`arch-safety-net`** — two-gate Cloud CI/CD Flow pipeline, pre-push hook, warnings-as-errors, Linux screenshot baselines, CI-failure runbook. → *CI/CD & Build Hygiene, E2E Testing*
- **Image generator `IImageGenerator` seam** — CLI-shellout replaced with a unit-testable interface. → *Backoffice Extensions*
- **SEO routing in-tree** — removed `SeoToolkit`; `/sitemap.xml` rewrite middleware, `/robots.txt` static file, branded 404 finder. → *SEO Routing*
- **Site Search off beta** — `Cms.Search.*` on stable 1.0.0 and `AI.Search` on the 17.x line; `AddBackOfficeSearch()` re-enabled. → *Site Search*
- **AI stack → `Umbraco.AI` 17.x line** — the suite realigned onto the CMS-17 versioning; Copilot/UI packages; `$`-config-key allow-list; **all four AI entity families (agents included) now deploy as `.uda`**. → *AI Content Generation, AI Schema Deployment*
- **Pillar 2 architecture push (complete 2026-06-30)** — two-project **RCL split**, folder-by-kind taxonomy, ModelsBuilder `SourceCodeManual`, cross-assembly composer auto-discovery, migrated Search / premium-role / routing slices. Architectural separation 2 → 4. → *Solution Architecture*
