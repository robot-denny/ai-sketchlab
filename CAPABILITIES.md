# Umbraco 17 + AI Capabilities Tracker

> **Source of truth** for what has been tested with MCP integration and Umbraco AI.
> This file should be kept in sync with the [Capabilities page](https://umbraco-17-demo-site.useast01.umbraco.io/capabilities/) in the Umbraco backoffice.

**Last Updated:** 2026-03-03

---

## Working Capabilities

### Content Management via MCP

| Capability | Status | Evidence |
|---|---|---|
| Article creation with category assignment and date metadata | Tested, working | MCP `document` tools |
| Multi-author attribution on content blocks (6 element types) | Tested, working | Commits `29666c0`, `d9491f0` |
| Document type property modifications (add/rename fields, swap data types) | Tested, working | Commits `29666c0`, `d9491f0`, `f2ed323` |
| Custom document type creation via MCP | Tested, working | Commit `f3705cd` — created Documentation doc type |
| Data type creation via MCP (MNTP, Markdown, Richtext) | Tested, working | Commits `5b9306f`, `d9491f0`, `f3705cd` |
| Document type schema sync via Deploy `.uda` files | Tested, working | All schema changes tracked in `umbraco/Deploy/Revision/` |
| Structured markdown parsing for bulk operations | Tested, working | Used during content creation workflows |
| Adding composition doc types to existing types | Tested, working | Commit `f3705cd` — Documentation uses 5 compositions |
| Allowing child content types on parent pages | Tested, working | Commit `f3705cd` — Documentation allowed under Home |
| Document search via MCP | Tested, working | Used `search-document` to find Capabilities page |
| Content property update via MCP | Tested, working | Used `update-document-properties` to push markdown content |
| Content publishing via MCP | Tested, working | Used `publish-document` to publish updated Capabilities page |
| Document tree traversal via Management API | Tested, working | Walked tree root → children to locate articles for bulk SEO update |
| Bulk content operations via MCP | Tested, working | Updated SEO fields across all blog articles in a single workflow |
| Block List editor configuration (add/remove block types) | Tested, working | Alert Banner element type registered in Block List data type via MCP |

### AI Content Generation (Copilot)

| Capability | Status | Evidence |
|---|---|---|
| Custom agent personas with distinct personality and voice | Tested, working | Backoffice Settings > AI > Agent config |
| Context management for brand consistency and topic boundaries | Tested, working | Backoffice Settings > AI > Contexts |
| Page property modifications (metadata, titles, descriptions) | Tested, working | Copilot editing via configured permissions |
| Rich Text block population with maintained voice consistency | Tested, working | Requires pre-created block structure |
| SEO metadata generation from page content | Tested, working | Copilot reads current page content and generates metaName, metaDescription, metaKeywords |

### MCP + AI Agent Orchestration

| Capability | Status | Evidence |
|---|---|---|
| Automated content workflow (fetch → generate → update) | Tested, working | Claude Code walked document tree via Management API, extracted article content, called AI Agent API to generate SEO fields, then updated each document |
| AI Agent API invocation from Claude Code | Tested, working | POST to `/umbraco/ai/management/api/v1/agents/{alias}/run` with SSE streaming response |
| Coordinated bulk AI generation | Tested, working | Generated SEO metadata for all blog articles by orchestrating MCP reads, Agent API calls, and Management API writes |

### Backoffice Extensions

| Capability | Status | Evidence |
|---|---|---|
| Dashboard extension via Umbraco Skills plugin | Tested, working | Commit `d5c7cee` — HelloWorld extension |

### Claude Code Custom Commands

| Capability | Status | Evidence |
|---|---|---|
| `/block` — TDD block component creation (RED → GREEN) | Tested, working | Commit `f0fb946` — Alert Banner block created via E2E test-first workflow |
| `/spec` — Feature spec and branch generation from a short idea | Tested, working | Commit `0da9ebe` — Section Navigation spec created, branch auto-generated |

### TDD Block Development Workflow

| Capability | Status | Evidence |
|---|---|---|
| Write Playwright E2E test before element type exists (RED) | Tested, working | `tests/e2e/blocks/alertBanner.spec.ts` — test fails until element type is created |
| Create element type via Management API using `DocumentTypeBuilder` | Tested, working | Alert Banner created with `alertLevel` (dropdown) and `alertContent` (RTE) properties |
| Register new block in Block List data type via MCP | Tested, working | Alert Banner added to site's block list editor |
| Create Razor partial matching element type alias convention | Tested, working | `alertBanner.cshtml` — maps Bootstrap alert classes from dropdown value |
| Verify partial file exists via E2E test (naming mismatch guard) | Tested, working | Second test case validates `{alias}.cshtml` file exists at correct path |
| Full RED → GREEN cycle in a single session | Tested, working | `/block` command orchestrates test → API creation → partial → build → green |

### Feature Planning Workflow (Spec → Plan → Implement)

| Capability | Status | Evidence |
|---|---|---|
| Generate feature spec from short description (`/spec`) | Tested, working | `_specs/section-navigation.md` — functional requirements, acceptance criteria, edge cases |
| Create implementation plan with step-by-step prompts | Tested, working | `_plans/section-navigation.md` — 5 steps, each a self-contained prompt |
| Create composition doc types via Management API scripts | Tested, working | `sectionNavigationControls` composition added to `content` and `documentation` types |
| Multi-step feature implementation across Razor, CSS, and templates | Tested, working | Commits `1f750a9`, `0da9ebe` — section navigation sidebar with responsive layout |
| Responsive layout with Bootstrap collapse for mobile | Tested, working | Desktop sidebar (col-lg-3) + mobile "In this Section" toggle using Bootstrap 5 collapse |

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
| Media upload and management via MCP | MCP | `media` tool collection is enabled but not exercised |
| Multi-language AI translation | AI | Requires Umbraco variants configuration |
| Image generation integration | AI | AI-generated images placed into media library |
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
