# Umbraco 17 + AI Capabilities Tracker

> **Source of truth** for what has been tested with MCP integration and Umbraco AI.
> This file should be kept in sync with the [Capabilities page](https://umbraco-17-demo-site.useast01.umbraco.io/capabilities/) in the Umbraco backoffice.

**Last Updated:** 2026-02-18

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

### AI Content Generation (Copilot)

| Capability | Status | Evidence |
|---|---|---|
| Custom agent personas with distinct personality and voice | Tested, working | Backoffice Settings > AI > Agent config |
| Context management for brand consistency and topic boundaries | Tested, working | Backoffice Settings > AI > Contexts |
| Page property modifications (metadata, titles, descriptions) | Tested, working | Copilot editing via configured permissions |
| Rich Text block population with maintained voice consistency | Tested, working | Requires pre-created block structure |
| Ethical self-awareness in generated content | Tested, working | Agent persona configuration |
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

---

## Known Limitations

### AI Copilot Block Management

| Limitation | Details |
|---|---|
| Cannot autonomously create new Rich Text Row blocks | Copilot can only edit existing blocks, not add new ones |
| Cannot populate empty blocks without prior manual setup | Block structure must be pre-created before Copilot can fill content |
| Requires pre-created block structure for content generation | Manual block scaffolding needed first |
| Agent permissions must be explicitly configured | Settings > AI > Agent > Permissions must define scope (doc types/properties). Packages + API key alone are not enough. |
| Copilot is scoped to the current page only | Cannot navigate the document tree or modify content on other pages. Cross-page operations require MCP + Management API orchestration. |

### MCP Environment

| Limitation | Details |
|---|---|
| `/doctor` static check may report false warnings | MCP environment variables work at runtime despite warnings |

---

## Untested Capabilities

| Capability | Category | Notes |
|---|---|---|
| Block List editor configuration modifications | MCP | Adding/removing block types from a Block List data type config (element types *within* blocks have been modified successfully) |
| Media upload and management via MCP | MCP | `media` tool collection is enabled but not exercised |
| Multi-language AI translation | AI | Requires Umbraco variants configuration |
| Image generation integration | AI | AI-generated images placed into media library |
| NotebookLM audio embeds | Integration | External audio content embedded in pages |
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
