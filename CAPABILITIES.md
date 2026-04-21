# Umbraco 17 + AI Capabilities Tracker

> **My Source of truth** for what I've tested with MCP integration and Umbraco AI.
> This file should be kept in sync with the [Capabilities page](https://umbraco-17-demo-site.useast01.umbraco.io/capabilities/) in the Umbraco backoffice.

**Last Updated:** 2026-04-21

---

## Working Capabilities

### Content Management via MCP

| Capability | Status | Notes |
|---|---|---|
| Article creation with category assignment and date metadata | ✅ | MCP `document` tools |
| Multi-author attribution on content blocks (6 element types) | ✅ | Commits `29666c0`, `d9491f0` |
| Document type property modifications (add/rename fields, swap data types) | ✅ | Commits `29666c0`, `d9491f0`, `f2ed323` |
| Custom document type creation via MCP | ✅ | Commit `f3705cd` — created Documentation doc type |
| Data type creation via MCP (MNTP, Markdown, Richtext) | ✅ | Commits `5b9306f`, `d9491f0`, `f3705cd` |
| Document type schema sync via Deploy `.uda` files | ✅ | All schema changes tracked in `umbraco/Deploy/Revision/` |
| Structured markdown parsing for bulk operations | ✅ | Used during content creation workflows |
| Adding composition doc types to existing types | ✅ | Commit `f3705cd` — Documentation uses 5 compositions |
| Allowing child content types on parent pages | ✅ | Commit `f3705cd` — Documentation allowed under Home |
| Document search via MCP | ✅ | Used `search-document` to find Capabilities page |
| Content property update via MCP | ✅ | Used `update-document-properties` to push markdown content |
| Content publishing via MCP | ✅ | Used `publish-document` to publish updated Capabilities page |
| Document tree traversal via Management API | ✅ | Walked tree root → children to locate articles for bulk SEO update |
| Bulk content operations via MCP | ✅ | Updated SEO fields across all blog articles in a single workflow |
| Block List editor configuration (add/remove block types) | ✅ | Alert Banner element type registered in Block List data type via MCP |
| Dynamic category resolution from backoffice (no hardcoding) | ✅ | Commit `d30aa50` — categories pulled from category list via Management API |

### AI Content Generation (Copilot)

| Capability | Status | Notes |
|---|---|---|
| Custom agent personas with distinct personality and voice | ✅ | Backoffice Settings > AI > Agent config |
| Context management for brand consistency and topic boundaries | ✅ | Backoffice Settings > AI > Contexts |
| Page property modifications (metadata, titles, descriptions) | ✅ | Copilot editing via configured permissions |
| Rich Text block population with maintained voice consistency | ✅ | Requires pre-created block structure |
| SEO metadata generation from page content | ✅ | Copilot reads current page content and generates metaName, metaDescription, metaKeywords |
| Text summarization prompt | ✅ | Backoffice Settings > AI > Prompts — summarize selected text in-place |
| Image alt text generation prompt | ✅ | Backoffice Settings > AI > Prompts — generates descriptive alt text for selected images |
| SEO content agent | ✅ | Backoffice Settings > AI > Agents — dedicated agent for generating SEO titles, descriptions, and keywords |
| CMS editor support agent | ✅ | Backoffice Settings > AI > Agents — support agent that helps train editors how to navigate and use Umbraco |

### MCP + AI Agent Orchestration

| Capability | Status | Notes |
|---|---|---|
| Automated content workflow (fetch → generate → update) | ✅ | Claude Code walked document tree via Management API, extracted article content, called AI Agent API to generate SEO fields, then updated each document |
| AI Agent API invocation from Claude Code | ✅ | POST to `/umbraco/ai/management/api/v1/agents/{alias}/run` with SSE streaming response |
| Coordinated bulk AI generation | ✅ | Generated SEO metadata for all blog articles by orchestrating MCP reads, Agent API calls, and Management API writes |

### Backoffice Extensions

| Capability | Status | Notes |
|---|---|---|
| Dashboard extension via Umbraco Skills plugin | ✅ | Commit `d5c7cee` — HelloWorld extension |
| Custom Settings dashboard (Image Generator — single/batch generation controls) | ✅ | Commit `55306d4` — Lit dashboard in Settings section with C# API controller. Palette editing moved to standard Umbraco content editor in `c30de0b` |
| Property action on media picker (one-click image generation from article edit page) | ✅ | Commit `55306d4` — registered on `Umbraco.MediaPicker3` properties |
| C# API controller backing a backoffice extension (generation + process spawning) | ✅ | `src/HelloWorld/ImageGeneratorController.cs` |

### Claude Code Custom Commands

| Capability | Status | Notes |
|---|---|---|
| `/spec` — Feature spec and branch generation from a short idea | ✅ | Outputs `_specs/{slug}.md` — functional requirements, acceptance criteria, edge cases, auto-generated branch |
| `/plan` — Phased, TDD-first implementation plan from a spec | ✅ | Outputs `_plans/{slug}.md` — step-by-step prompts, each self-contained |
| `/block` — TDD block component creation (RED → GREEN) | ✅ | Commit `f0fb946` — Alert Banner block created via E2E test-first workflow |
| `/feature` — Living BDD feature spec from specs, plans, and tests | ✅ | Outputs `_features/{slug}.md` — Given/When/Then scenarios grouped by Rule, test coverage table; source of truth for current behavior |
| `/code-review` — Orchestrates three subagents in parallel (accessibility, code quality, performance) to review uncommitted changes | ✅ | Commits `f330598`, `a9e5f6b`, `a60fb21` — three specialized agents run concurrently and report findings |
| `/check-uda` — Detailed pre-commit analysis of Umbraco Deploy schema conflicts (fetches remote state, rates severity, gives remediation steps) | ✅ | Commit `f5ee9bb` — also ships pre-commit/pre-push/post-merge git hooks in `.githooks/` |
| `/cms-image` — Generate flow-field featured images from article metadata and publish to CMS | ✅ | Commit `8bd4457` — CLI + backoffice integration |

### Development Workflow

End-to-end pipeline from idea to shipped feature. Each stage has a dedicated command that reads the previous stage's artifact and produces the next. Five features have travelled this pipeline so far (see `_features/`): `section-navigation`, `alert-banner-icons`, `image-carousel-captions-controls`, `image-generator`, `site-header`.

| Stage | Command | Artifact | Notes |
|---|---|---|---|
| 1. Idea → spec | `/spec` | `_specs/{slug}.md` | Functional requirements, acceptance criteria, edge cases; creates a feature branch |
| 2. Spec → plan | `/plan` | `_plans/{slug}.md` | TDD-first implementation steps, each a self-contained prompt |
| 3. Plan → TDD block (RED → GREEN) | `/block` | E2E spec + element type + Razor partial | E2E test fails first, then element type created via Management API, then partial added until test passes. Registers block in Block List data type via MCP and guards against `{alias}.cshtml` naming drift. |
| 4. Implementation → living BDD spec | `/feature` | `_features/{slug}.md` | Given/When/Then scenarios grouped by Rule, test coverage table; kept in sync as the feature evolves — the regression source of truth |
| 5. Uncommitted changes → review | `/code-review` | — | Three parallel subagents: accessibility, code quality, performance |

### Site Features

| Capability | Status | Notes |
|---|---|---|
| Section navigation sidebar (desktop `col-lg-3` + mobile "In this Section" Bootstrap collapse toggle) | ✅ | Commits `1f750a9`, `0da9ebe` — `sectionNavigationControls` composition doc type added to `content` and `documentation` types via Management API scripts |
| Article list grid view display mode (editor-selectable list vs grid, `displayMode` dropdown on `latestArticlesRow` block) | ✅ | Commit `ede1bcf` — Bootstrap grid rendering, 24-test E2E suite |
| Updated site footer (multi-column layout, branding, link groups, CSS custom properties) | ✅ | Commit `8239aca` — new `footer.cshtml` partial, new document type for footer content, E2E suite |

### Procedural Image Generation

| Capability | Status | Notes |
|---|---|---|
| Deterministic flow-field PNG generation seeded from article metadata | ✅ | Commit `8bd4457` — TypeScript CLI at `scripts/image-generator/` |
| Category-to-color palette mapping with multi-category merging | ✅ | Palettes read from "Site Settings" CMS content (see below); `config/palettes.json` retained as seed/fallback |
| Palette configuration stored as CMS content (editable in standard Umbraco content editor, transfers between environments via Umbraco Deploy) | ✅ | Commit `c30de0b` — `PaletteService` reads from published "Site Settings" document via `IPublishedContentQuery`, with hex→RGB conversion and default-palette fallback |
| "Site Settings" document type hidden from navigation via composition | ✅ | Commits `a3b3ebc`, `1f0bb56` — document type for site-wide config; composition hides it from nav/menus |
| `[BlockList] Category Palettes` data type with per-category color blocks | ✅ | Commit `98ee79f` — Block List of category→(primary/mid/deep) hex colors using Eye Dropper color picker |
| Batch image generation + upload to Umbraco media library via Management API | ✅ | CLI `--batch` flag; backoffice dashboard batch mode |
| End-to-end pipeline: generate → upload media → assign mainImage property | ✅ | CLI orchestrates metadata fetch, canvas render, media upload, and property assignment |

### E2E Testing

| Capability | Status | Notes |
|---|---|---|
| E2E resilience rules (dynamic UUIDs, stale cleanup, token refresh, regex assertions) | ✅ | Commit `05d5b91` — 7 rules codified in CLAUDE.md and applied to section nav tests |
| Article list grid view E2E suite (24 tests: rendering, edge cases, responsive breakpoints) | ✅ | Commit `ede1bcf` — `tests/e2e/articleListGridView.spec.ts` |
| Site footer E2E suite (column layout, links, branding, responsive behavior) | ✅ | Commit `8239aca` — `tests/e2e/footer/updatedFooter.spec.ts` |

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
