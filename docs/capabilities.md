# Umbraco 17 + AI Capabilities Tracker

> **My Source of truth** for what I've tested with MCP integration and Umbraco AI.
> This file should be kept in sync with the [Capabilities page](https://ai-sketchlab.dev/capabilities/) in the Umbraco backoffice.

**Last Updated:** 2026-05-12

---

## Working Capabilities

### Content Management via MCP

| Capability | Notes |
|---|---|
| Article creation with category assignment and date metadata | MCP `document` tools |
| Multi-author attribution on content blocks (6 element types) | Commits `29666c0`, `d9491f0` |
| Document type property modifications (add/rename fields, swap data types) | Commits `29666c0`, `d9491f0`, `f2ed323` |
| Custom document type creation via MCP | Commit `f3705cd` — created Documentation doc type |
| Data type creation via MCP (MNTP, Markdown, Richtext) | Commits `5b9306f`, `d9491f0`, `f3705cd` |
| Document type schema sync via Deploy `.uda` files | All schema changes tracked in `umbraco/Deploy/Revision/` |
| Structured markdown parsing for bulk operations | Used during content creation workflows |
| Adding composition doc types to existing types | Commit `f3705cd` — Documentation uses 5 compositions |
| Allowing child content types on parent pages | Commit `f3705cd` — Documentation allowed under Home |
| Document search via MCP | Used `search-document` to find Capabilities page |
| Content property update via MCP | Used `update-document-properties` to push markdown content |
| Content publishing via MCP | Used `publish-document` to publish updated Capabilities page |
| Document tree traversal via Management API | Walked tree root → children to locate articles for bulk SEO update |
| Bulk content operations via MCP | Updated SEO fields across all blog articles in a single workflow |
| Block List editor configuration (add/remove block types) | Alert Banner element type registered in Block List data type via MCP |
| Dynamic category resolution from backoffice (no hardcoding) | Commit `d30aa50` — categories pulled from category list via Management API |
| Large-scale schema rollout with `.uda` drift management | Package C design-system rollout introduced 1 new data type, 1 new composition, 12 dictionary keys, and modified ~7 existing doc types across 9 phases. `/check-uda` used to detect drift before each push; one Live restart (per the documented "import pending schema" canonical fix) cleared a stuck import. Net: zero conflicts merged |

### AI Content Generation (Copilot)

| Capability | Notes |
|---|---|
| Custom agent personas with distinct personality and voice | Backoffice Settings > AI > Agent config |
| Context management for brand consistency and topic boundaries | Backoffice Settings > AI > Contexts |
| Page property modifications (metadata, titles, descriptions) | Copilot editing via configured permissions |
| Rich Text block population with maintained voice consistency | Requires pre-created block structure |
| SEO metadata generation from page content | Copilot reads current page content and generates metaName, metaDescription, metaKeywords |
| Text summarization prompt | Backoffice Settings > AI > Prompts — summarize selected text in-place |
| Image alt text generation prompt | Backoffice Settings > AI > Prompts — generates descriptive alt text for selected images |
| SEO content agent | Backoffice Settings > AI > Agents — dedicated agent for generating SEO titles, descriptions, and keywords |
| CMS editor support agent | Backoffice Settings > AI > Agents — support agent that helps train editors how to navigate and use Umbraco |
| AI configuration auto-serializes to `.uda` for Cloud deploy | Commit `2801c20` — `Umbraco.AI.Deploy` + `Umbraco.AI.Prompt.Deploy` packages serialize Connections, Contexts, Guardrails, Chat Profiles, Embedding Profiles, Prompts, and Settings to `umbraco-ai-*.uda` artifacts on save. Secret references stay as placeholders (`$OpenAI:ApiKey` etc.); raw keys never enter the artifact stream |
| AI agents auto-serialize to `.uda` for Cloud deploy | `Umbraco.AI.Agent.Deploy 1.0.0` (added 2026-05-14, alongside the Deploy/Prompt.Deploy stable graduations and the bump to `Umbraco.AI 1.11.0` / `Umbraco.AI.Agent 1.10.0`) serializes agents to `umbraco-ai-agent-*.uda` on save. Closes the prior "agents must be recreated per Cloud environment" gap |

### MCP + AI Agent Orchestration

| Capability | Notes |
|---|---|
| Automated content workflow (fetch → generate → update) | Claude Code walked document tree via Management API, extracted article content, called AI Agent API to generate SEO fields, then updated each document |
| AI Agent API invocation from Claude Code | POST to `/umbraco/ai/management/api/v1/agents/{alias}/run` with SSE streaming response |
| Coordinated bulk AI generation | Generated SEO metadata for all blog articles by orchestrating MCP reads, Agent API calls, and Management API writes |

### Backoffice Extensions

| Capability | Notes |
|---|---|
| Dashboard extension via Umbraco Skills plugin | Commit `d5c7cee` — HelloWorld extension |
| Custom Settings dashboard (Image Generator — single/batch generation controls) | Commit `55306d4` — Lit dashboard in Settings section with C# API controller. Palette editing moved to standard Umbraco content editor in `c30de0b` |
| Property action on media picker (one-click image generation from article edit page) | Commit `55306d4` — registered on `Umbraco.MediaPicker3` properties |
| C# API controller backing a backoffice extension (generation + process spawning) | `src/HelloWorld/ImageGeneratorController.cs` |
| TipTap `styleMenu` extension manifest for editor-applied typography classes | Commit `972bf37` — replaces the legacy TinyMCE `/**umb_name:Label*/` annotation approach (which TipTap doesn't parse). Manifest at `src/HelloWorld/Client/src/richtext/manifest.ts` declares `overwrites: 'Umb.Tiptap.Toolbar.StyleSelect'` so the built-in toolbar entry is replaced in-place — no data type edit required. Adds Editorial classes (Lead, Overline, Pull quote, Caption), full h2–h6 headers, and container styles to the rich-text Style Select dropdown |

### Claude Code Custom Commands

| Capability | Notes |
|---|---|
| `/spec` — Feature spec and branch generation from a short idea | Outputs `_specs/{slug}.md` — functional requirements, acceptance criteria, edge cases, auto-generated branch |
| `/plan` — Phased, TDD-first implementation plan from a spec | Outputs `_plans/{slug}.md` — step-by-step prompts, each self-contained |
| `/block` — TDD block component creation (RED → GREEN) | Commit `f0fb946` — Alert Banner block created via E2E test-first workflow |
| `/feature` — Living BDD feature spec from specs, plans, and tests | Outputs `_features/{slug}.md` — Given/When/Then scenarios grouped by Rule, test coverage table; source of truth for current behavior |
| `/code-review` — Orchestrates three subagents in parallel (accessibility, code quality, performance) to review uncommitted changes | Commits `f330598`, `a9e5f6b`, `a60fb21` — three specialized agents run concurrently and report findings |
| `/check-uda` — Detailed pre-commit analysis of Umbraco Deploy schema conflicts (fetches remote state, rates severity, gives remediation steps) | Commit `f5ee9bb` — also ships pre-commit/pre-push/post-merge git hooks in `.githooks/` |
| `/cms-image` — Generate flow-field featured images from article metadata and publish to CMS | Commit `8bd4457` — CLI + backoffice integration |
| `/guide` — Generate / amend editor-facing how-to guide pages for blocks and global features | Commit `eff0370` — TypeScript CLI that calls a backoffice AI agent (with editable brand-voice contexts) to write each guide's description. Preserves editor-uploaded screenshots and live-example slots across re-runs. `--audit` mode reports missing-blocks, missing-globals, and orphaned guides (exit code 1 when gaps exist); `--auto-apply` skips the interactive approval prompt |

### Development Workflow

End-to-end pipeline from idea to shipped feature. Each stage has a dedicated command that reads the previous stage's artifact and produces the next. Nine features have travelled this pipeline so far (see `_features/`): `section-navigation`, `alert-banner-icons`, `image-carousel-captions-controls`, `image-generator`, `site-header`, `umbraco-ai-search`, `living-style-guide`, `editor-how-to-guides`, `ella-block-attribution`. Shipped specs and plans are archived under `_specs/shipped/` and `_plans/shipped/` so the top-level lists reflect only active work. The pipeline now sits on top of a roadmap layer: [ROADMAP.md](../ROADMAP.md) tracks active and queued work across features, and each `_features/<slug>.md` carries an `Increments` section listing shipped + planned iterations within that feature.

| Stage | Command | Artifact | Notes |
|---|---|---|---|
| 1. Idea → spec | `/spec` | `_specs/{slug}.md` | Functional requirements, acceptance criteria, edge cases; creates a feature branch |
| 2. Spec → plan | `/plan` | `_plans/{slug}.md` | TDD-first implementation steps, each a self-contained prompt |
| 3. Plan → TDD block (RED → GREEN) | `/block` | E2E spec + element type + Razor partial | E2E test fails first, then element type created via Management API, then partial added until test passes. Registers block in Block List data type via MCP and guards against `{alias}.cshtml` naming drift. |
| 4. Implementation → living BDD spec | `/feature` | `_features/{slug}.md` | Given/When/Then scenarios grouped by Rule, test coverage table; kept in sync as the feature evolves — the regression source of truth |
| 5. Uncommitted changes → review | `/code-review` | — | Three parallel subagents: accessibility, code quality, performance |

**Roadmap + Increments layer** (commit `6925fcb`): [ROADMAP.md](../ROADMAP.md) at repo root is the project-level queue (Now / Next / Later / Bundles). Each `_features/<slug>.md` has an `Increments` section listing shipped + planned iterations for that feature, so a "feature" is now durable across multiple spec/plan cycles. Every workflow command (`/spec`, `/plan`, `/feature`, `/code-review`) ends with a `Next:` segue line pointing at the next stage. The layer model is documented under **Workflow layers** in [CLAUDE.md](../CLAUDE.md).

### Site Features

| Capability | Notes |
|---|---|
| Section navigation sidebar (desktop `col-lg-3` + mobile "In this Section" Bootstrap collapse toggle) | Commits `1f750a9`, `0da9ebe` — `sectionNavigationControls` composition doc type added to `content` and `documentation` types via Management API scripts |
| Article list grid view display mode (editor-selectable list vs grid, `displayMode` dropdown on `latestArticlesRow` block) | Commit `ede1bcf` — Bootstrap grid rendering, 24-test E2E suite |
| Updated site footer (multi-column layout, branding, link groups, CSS custom properties) | Commit `8239aca` — new `footer.cshtml` partial, new document type for footer content, E2E suite |
| Site-wide design-system overhaul ("v2 chrome" rollout) | Phased rollout via parallel `master-v2.cshtml` layout. Foundation (`c5c4ae9`), v2 partials (`1107aa3`), Phase 0 schema + helpers (`b9b11ca`), then per-template cutover: articleList (`0b10638`), search (`7c203b4`), content/documentation + section-nav (`a3b87db`), article (`8d82dce`), home (`2287375`), final retire of legacy chrome and `master-v2 → master` rename (`2443d31`). Page-by-page browser verification at desktop and 390px-narrow against locked HTML mocks |
| Schema additions for v2 chrome | New `pageHeadPatternControls` composition (Page Head Pattern dropdown: none/scatter/stochastic) applied to 6 doc types; new Home fields (`manifestoTitle`, `manifestoBody`, `manifestoEyebrowLeft/Right`, `manifestoAudience`, `pullQuote`, `pullQuoteAttribution`); `[Dropdown] Page Head Pattern` data type. All distributed via MCP and `.uda` files |
| Reading-time helper computed from word count | `src/UmbracoProject/Helpers/ReadingTime.cs` — iterates `BlockListModel` rows, strips HTML, divides by 225 wpm, floor of 1 minute. Per-request `IMemoryCache` keyed on `article.Id + UpdateDate.Ticks`. Wired into `_MastheadArticle`, `_LatestSection`, `_ArticleCard` partials |
| Editorial dictionary keys for chrome strings | 12 new dictionary keys seeded for v2 chrome (`Home.HeroEyebrow`, `Home.LatestTitle`, `Footer.PublicationHeading`, `Article.By`, `Navigation.MenuTitle`, etc.) — managed under Translation in the backoffice |
| E2E selector retargeting alongside template cutover | `siteHeader.spec.ts`, `sectionNavigation.spec.ts`, `linkStyles.spec.ts`, `updatedFooter.spec.ts` retargeted phase-by-phase from legacy markup (`header.masthead`, `#mainNav`, `.section-nav-desktop`) to v2 class vocabulary (`.site-head`, `.site-nav`, `.section-nav`, `.foot`, `.page-head`, `.art-head`) |
| Living style guide as block-driven CMS content (`/styleguide` + `/styleguide/components`) | Commits `75538dc`, `c9a786d`, `d70f35d` — three new programmatic element types (`colorPaletteBlock`, `typographyShowcaseBlock`, `generalElementsBlock`) replace the previous hardcoded sections; editors arrange rows in the CMS and can add narrative rich-text around the showcase blocks. Color swatches and typography examples read live from `typography.css` at render time via the `/**umb_swatch:LABEL*/` annotation |
| Editor how-to guides as CMS content (`/guides/` section, `How-To Guide Page` doc type with description + screenshot + generation-metadata) | Commits `eff0370`, `aa5f1c6`, `d9b7ef2` — `/guide` CLI (see Custom Commands) keeps descriptions in sync with source. Descriptions are written by a backoffice AI agent so brand voice stays editable in the CMS. Live-example slot for block features, optional screenshot for non-block features. Hidden from main top nav by default; reachable by URL |
| AI-author per-block attribution (`.ella-wrap` inline-note treatment for blocks whose author is an AI persona) | Commits `9aff6b3`, `601b98c`, `b5cde01` — new `AI Persona Properties` composition adds an `isAi` toggle to the Author doc type. In a human-led article, any block whose Author is `isAi=true` is wrapped in `.ella-wrap` with a CSS-generated "Written by {persona} · inline note" eyebrow and warm-stone callout treatment. All-AI articles suppress the per-block treatment entirely |

### Procedural Image Generation

| Capability | Notes |
|---|---|
| Deterministic flow-field PNG generation seeded from article metadata | Commit `8bd4457` — TypeScript CLI at `scripts/image-generator/` |
| Category-to-color palette mapping with multi-category merging | Palettes read from "Site Settings" CMS content (see below); `config/palettes.json` retained as seed/fallback |
| Palette configuration stored as CMS content (editable in standard Umbraco content editor, transfers between environments via Umbraco Deploy) | Commit `c30de0b` — `PaletteService` reads from published "Site Settings" document via `IPublishedContentQuery`, with hex→RGB conversion and default-palette fallback |
| "Site Settings" document type hidden from navigation via composition | Commits `a3b3ebc`, `1f0bb56` — document type for site-wide config; composition hides it from nav/menus |
| `[BlockList] Category Palettes` data type with per-category color blocks | Commit `98ee79f` — Block List of category→(primary/mid/deep) hex colors using Eye Dropper color picker |
| Batch image generation + upload to Umbraco media library via Management API | CLI `--batch` flag; backoffice dashboard batch mode |
| End-to-end pipeline: generate → upload media → assign mainImage property | CLI orchestrates metadata fetch, canvas render, media upload, and property assignment |

### Site Search

Public-site search at `/search` runs on the new `Umbraco.Cms.Search` framework (destined to replace the legacy Examine-backed `IPublishedContentQuery.Search()` API in Umbraco v18) with `Umbraco.AI.Search` layered on top for vector/semantic search. Examine stays registered as a hybrid keyword-fallback and as the backoffice search provider.

| Capability | Notes |
|---|---|
| Hybrid keyword + semantic search at `/search` | Commit `e192ffc` — `Umbraco.Cms.Search.Provider.Examine` (keyword) + `Umbraco.AI.Search` (vector) registered side-by-side; OpenAI `text-embedding-3-small` 512-dim embeddings; documents auto-chunked + embedded on publish |
| Semantic recall on paraphrased queries | Pages surface on conceptually-related queries that don't share keywords (e.g. paraphrased "how do I get started" matches relevant content even without those literal words). Quality on the demo content set was stronger than expected |
| System pages excluded from results | Search page, Error, XMLSitemap, Category/CategoryList pages filtered out at render time |
| Article results render author + publish date | Article-typed results render a "Posted by {author} on {date}" line; non-article results omit it |
| Vector index rebuild from backoffice | `Settings → Search → UmbAI_Search` row → rebuild icon. ~3–4 vector chunks per published document on the demo site, ~115 chunks total across 33 documents; under 1 minute end-to-end |
| Replaces legacy `IPublishedContentQuery.Search()` | Public `/search` route no longer calls Examine directly; the `ISearcher`/`ISearcherResolver` façade routes to the AI provider with Examine as keyword fallback |

### E2E Testing

| Capability | Notes |
|---|---|
| E2E resilience rules (dynamic UUIDs, stale cleanup, token refresh, regex assertions) | Commit `05d5b91` — 7 rules codified in CLAUDE.md and applied to section nav tests |
| Article list grid view E2E suite (24 tests: rendering, edge cases, responsive breakpoints) | Commit `ede1bcf` — `tests/e2e/articleListGridView.spec.ts` |
| Site footer E2E suite (column layout, links, branding, responsive behavior) | Commit `8239aca` — `tests/e2e/footer/updatedFooter.spec.ts` |

---

## Known Limitations

### AI Copilot Block Management

| Limitation | Details |
|---|---|
| Cannot autonomously create new Rich Text Row blocks | Copilot can only edit existing blocks, not add new ones |
| Cannot populate empty blocks without prior manual setup | Block structure must be pre-created before Copilot can fill content |
| Requires pre-created block structure for content generation | Manual block scaffolding needed first |
| Copilot is scoped to the current page only | Cannot navigate the document tree or modify content on other pages. Cross-page operations require MCP + Management API orchestration. |

### MCP Environment

| Limitation | Details |
|---|---|
| `/doctor` static check may report false warnings | MCP environment variables work at runtime despite warnings |

### AI Schema Deploy & Search Index

| Limitation | Details |
|---|---|
| Vector search index does not replicate across environments | The `UmbAI_Search` index is per-environment. After every Cloud deploy that affects content or AI configuration, rebuild the index via `Settings → Search` on that environment before promoting further |

---

## Untested Capabilities

| Capability | Category | Notes |
|---|---|---|
| Media upload and management via MCP | MCP | `media` tool collection is enabled but not exercised (CLI uses Management API directly) |
| Multi-language AI translation | AI | Requires Umbraco variants configuration |
| Content unpublishing via MCP | MCP | `unpublish-document` tool available but not tested |
| Content validation via MCP | MCP | `validate-document` tool available but not tested |

---

## Changelog

| Date | Change | Related Commits |
|---|---|---|
| 2026-02-13 | Added author field to 6 block element types via MCP | `29666c0` |
| 2026-02-16 | Upgraded article author to multi-pick, created Authors Multi data type | `d9491f0` |
| 2026-02-16 | Added categories display and notes section to articles | `f2ed323` |
| 2026-02-16 | Created Documentation document type with markdown editor | `f3705cd` |
| 2026-02-17 | Added Documentation template | `cc53a7a` |
| 2026-02-18 | Created this tracking file, reconciled with Capabilities page | — |
| 2026-02-18 | Validated document search, content update, and publishing via MCP | — |
| 2026-02-18 | AI Copilot generated SEO fields for current page; confirmed Copilot is single-page scoped | — |
| 2026-02-18 | MCP + AI Agent orchestration: bulk SEO update across all blog articles via tree traversal, Agent API, and Management API | — |
| 2026-03-01 | Created `/block` custom command for TDD block development; built Alert Banner block (E2E test → element type → Razor partial) | `f0fb946` |
| 2026-03-01 | Created `/spec` custom command for feature spec generation; created Section Navigation spec and branch | `0da9ebe` |
| 2026-03-02 | Implemented section navigation sidebar for content and documentation pages (composition, partial, responsive layout, CSS) | `1f750a9` |
| 2026-03-03 | Updated Capabilities tracker with new workflows and features | — |
| 2026-03-03 | Hardened section navigation E2E tests with 7 resilience rules | `05d5b91` |
| 2026-03-04 | Added grid view display mode to article list block with 24-test E2E suite | `ede1bcf` |
| 2026-03-04 | Built metadata image generator CLI (flow-field PNGs from article metadata) | `8bd4457`, `7b7596f` |
| 2026-03-09 | Added backoffice image generator dashboard and property action with palette management | `55306d4` |
| 2026-03-09 | Dynamic categories from backoffice; reformatted palettes.json | `d30aa50`, `59443f1` |
| 2026-03-10 | Updated Capabilities tracker with image generator, grid view, E2E testing entries | — |
| 2026-03-13 | Created `/code-review` command; built accessibility and code-quality subagents | `f330598`, `a9e5f6b` |
| 2026-03-16 | Added perf-reviewer subagent to `/code-review` pipeline (three parallel subagents) | `a60fb21` |
| 2026-03-16 | Added `/check-uda` command and git hooks for UDA conflict detection | `f5ee9bb` |
| 2026-03-17 | Built updated site footer (multi-column layout, branding, CSS custom properties, E2E suite) | `8239aca`, `f54d3fc` |
| 2026-03-31 | Configured AI prompts (text summarization, image alt text) and agents (SEO, editor support) in backoffice | — |
| 2026-03-31 | Updated Capabilities tracker with AI prompts/agents, code-review, check-uda, grid view, footer | — |
| 2026-04-21 | Consolidated "TDD Block Development Workflow" and "Feature Planning Workflow" tables into a single "Development Workflow" section; added `/plan` and `/feature` to Custom Commands; swapped table headers from "Evidence" to "Notes" and status cells to ✅ | — |
| 2026-04-21 | Captured migration of image-generator palette storage from JSON file to CMS content: new "Site Settings" document type, `[BlockList] Category Palettes` data type, `PaletteService` reads published content; dashboard palette editor removed in favour of standard Umbraco content editor | `c30de0b`, `a3b3ebc`, `1f0bb56`, `98ee79f` |
| 2026-04-21 | Drafted plan to replace legacy Examine search with `Umbraco.Cms.Search` + `Umbraco.AI.Search` semantic layer | `84aeb60` |
| 2026-04-21 | Installed `Umbraco.AI.Deploy` + `Umbraco.AI.Prompt.Deploy`; AI Connections, Contexts, Profiles, Prompts, and Settings now auto-serialize as `umbraco-ai-*.uda` artifacts for Cloud schema deploy | `2801c20` |
| 2026-04-22 | Migrated `/search` to hybrid keyword + semantic search using OpenAI `text-embedding-3-small` embeddings; first feature drafted directly via `/feature` (no preceding `/spec`) | `e192ffc` |
| 2026-04-23–04-27 | Design-system v2 rollout (Package C) — 9 phases, parallel `master-v2.cshtml` chrome converted page-by-page (error → contact → authors → articleList → search → content/documentation → article → home), legacy partials retired in Phase 9 with `master-v2 → master` rename. Added `pageHeadPatternControls` composition, `ReadingTime` helper, Home manifesto/pull-quote fields, 12 dictionary keys. `/check-uda` used to detect drift across phases; one Live restart needed to import a stuck schema bundle | `c5c4ae9`, `1107aa3`, `b9b11ca`, `0b10638`, `7c203b4`, `a3b87db`, `8d82dce`, `2287375`, `2443d31` |
| 2026-04-28 | Cleanup pass: archived shipped specs/plans into `_specs/shipped/` and `_plans/shipped/`, refreshed CLAUDE.md (consolidated pinned-betas, updated package list and Node path, fixed Cms.Search version), renamed `_specs/template.md` → `_specs/_template.md` | `5d3f636` |
| 2026-04-28 | Updated Capabilities tracker with site search, AI deploy, design-system v2 rollout, schema-rollout-with-`/check-uda`, and AI deploy / vector index limitations | — |
| 2026-05-01 | Converted the living style guide to block-driven authoring: three new programmatic element types (`colorPaletteBlock`, `typographyShowcaseBlock`, `generalElementsBlock`) replace the hardcoded sections; editors arrange rows in the CMS; added `/styleguide/components` child page that demonstrates every reusable block | `75538dc`, `c9a786d`, `d70f35d` |
| 2026-05-04 | Shipped editor how-to guides: `/guide` CLI command, `How-To Guide Page` doc type under `/guides/`, AI-Agent-driven description generation that preserves editor screenshots and live-example slots, `--audit` mode for missing/orphaned guides | `eff0370`, `aa5f1c6`, `d9b7ef2` |
| 2026-05-11 | Added AI-author per-block attribution: `AI Persona Properties` composition adds an `isAi` toggle to the Author doc type; the article orchestrator wraps any block whose author is `isAi=true` inside a `.ella-wrap` inline-note treatment when the article isn't entirely AI-authored | `9aff6b3`, `601b98c`, `b5cde01` |
| 2026-05-11 | Replaced the legacy TinyMCE `/**umb_name:Label*/` Style Select approach with a TipTap `styleMenu` extension manifest in HelloWorld (`overwrites: 'Umb.Tiptap.Toolbar.StyleSelect'`); adds Overline, Caption, h5/h6, and Editorial classes (Lead / Pull quote) to the rich-text Style Select dropdown | `972bf37` |
| 2026-05-12 | Workflow scaffolding: added [ROADMAP.md](../ROADMAP.md) (Now/Next/Later/Bundles) at repo root, an `Increments` section template applied to all 9 `_features/*.md`, `Next:` segue footers on `/spec` `/plan` `/feature` `/code-review`, and a "Workflow layers" section in CLAUDE.md. Defers `/explore` `/prd` `/roadmap` `/implement-step` commands until the conventions have been used for a sprint | `6925fcb` |
| 2026-05-14 | Bumped Umbraco CMS 17.3 → 17.4 and graduated all three AI Deploy packages from beta → stable (`Umbraco.AI.Deploy` 1.0.0, `Umbraco.AI.Prompt.Deploy` 1.0.0, `Umbraco.AI.Agent.Deploy` 1.0.0). Latter is newly installed — agents now auto-deploy as `.uda` like every other AI entity. Companion AI patch bumps: `Umbraco.AI` 1.9.0 → 1.11.0, `Umbraco.AI.Agent` 1.8.0 → 1.10.0, `Umbraco.AI.AGUI` 1.8.0 → 1.10.0, providers + Prompt to latest patches | — |
