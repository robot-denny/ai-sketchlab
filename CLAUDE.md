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

**Entry point**: `src/UmbracoProject/Program.cs` — bootstraps Umbraco with `CreateUmbracoBuilder()`, adds BackOffice + Website middleware and endpoints.

**Key directories under `src/UmbracoProject/`:**

- `Views/` — Razor templates using `UmbracoViewPage<T>` base class with auto-generated published content models (`Umbraco.Cms.Web.Common.PublishedModels`)
- `Views/Partials/` — Reusable partials; navigation and footer use `Html.CachedPartialAsync()` with 60-minute cache
- `Views/Partials/blocklist/Components/` — Block List content components (richText, image, video, codeSnippet, etc.)
- `Views/Partials/blockgrid/` — Block Grid layout rendering (default, area, areas, items)
- `Views/Components/` — MVC View Components (Contact form, Pagination)
- `wwwroot/` — Static assets (Bootstrap 5 via CDN, custom CSS/JS, Highlight.js, Swiffy Slider)
- `umbraco/Deploy/Revision/` — Umbraco Deploy `.uda` metadata files (document types, data types, templates). These are auto-managed by Umbraco Deploy and pushed to Cloud for schema sync.
- `umbraco/Data/` — Local SQLite database and generated temp files (not committed)

**Content model**: Document types are defined in the Umbraco backoffice and stored as `.uda` files in `umbraco/Deploy/Revision/`. C# models are auto-generated at runtime in `umbraco/Data/TEMP/InMemoryAuto/`.

**Backoffice extension**: `src/HelloWorld/` — a sample dashboard extension created via Umbraco Skills plugin, referenced from the main `.csproj`. Uses TypeScript + Vite with a `Client/` subfolder for the frontend build.

**Key NuGet packages**: Umbraco.Cms 17.1.0, Umbraco.Forms 17.1.2, Umbraco.Deploy.Cloud 17.0.1, Clean.Core 7.0.5 (view models for contact form/page headers).

**AI packages**: Umbraco.AI 1.1.0, Umbraco.AI.Agent 1.1.0, Umbraco.AI.Agent.Copilot 1.0.0-alpha2, Umbraco.AI.Agent.UI 1.0.0-alpha1, Umbraco.AI.Anthropic 1.1.0, Umbraco.AI.Google 1.1.0, Umbraco.AI.OpenAI 1.1.0, Umbraco.AI.Prompt 1.1.0.

## AI & Copilot

The backoffice includes an **AI Copilot** that can generate and edit content directly in blocks/fields. Configuration is done in the Umbraco backoffice under **Settings > AI**:

- **AI Connection**: Provider + API credentials (Anthropic key stored in `appsettings.Development.json` under `Anthropic:ApiKey`)
- **Chat Profile**: Links an AI connection to a specific model
- **Agent**: Links a chat profile and defines the agent's role. **Permissions must be set on the agent** to allow content editing (scope controls which document types/properties it can modify).
- **Contexts**: Define data access boundaries (e.g., brand voice guidelines)

The **Umbraco MCP server** enables Claude Code to interact with backoffice content. Connection settings are in `.env` with tool collections for `document`, `media`, `document-type`, and `data-type`.

## Modifying Umbraco Content from Claude Code

Claude Code can read and write Umbraco document properties directly via the Management API. The Umbraco MCP server's tools are designed for the backoffice browser UI, so Claude Code must call the REST API using the same OAuth credentials.

### Authentication

```bash
# Get a bearer token (expires in ~5 minutes, refresh as needed)
curl -sk -X POST "https://localhost:44367/umbraco/management/api/v1/security/back-office/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${UMBRACO_CLIENT_ID}&client_secret=${UMBRACO_CLIENT_SECRET}"
# Returns: { "access_token": "...", "token_type": "Bearer", "expires_in": 299 }
```

Credentials are in `.env` (`UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET`).

### Key Management API Endpoints

All endpoints require `Authorization: Bearer {token}`.

| Action | Method | Endpoint |
|--------|--------|----------|
| Document tree root | GET | `/umbraco/management/api/v1/tree/document/root?skip=0&take=100` |
| Document tree children | GET | `/umbraco/management/api/v1/tree/document/children?parentId={id}&skip=0&take=100` |
| Get document | GET | `/umbraco/management/api/v1/document/{id}` |
| Update document | PUT | `/umbraco/management/api/v1/document/{id}` |
| Document type tree root | GET | `/umbraco/management/api/v1/tree/document-type/root?skip=0&take=100` |
| Document type tree children | GET | `/umbraco/management/api/v1/tree/document-type/children?parentId={id}&skip=0&take=100` |
| Get document type | GET | `/umbraco/management/api/v1/document-type/{id}` |

### Workflow for Updating Page Properties

1. **Find the document** — Walk the tree (`/tree/document/root` then `/tree/document/children?parentId=...`) to locate the target page by name
2. **Read the document** — GET `/document/{id}` to retrieve all current property values. The response includes a `values` array with objects like `{ "alias": "title", "value": "..." }`
3. **Identify property aliases** — If unsure of field names, GET the document type or its compositions to see available properties. Common compositions include SEO Controls (`metaName`, `metaDescription`, `metaKeywords`), Header Controls (`title`, `subtitle`), etc.
4. **Build the update payload** — The PUT body requires `template`, `values`, and `variants` from the original document. Modify or add entries in the `values` array:
   ```json
   {
     "template": { "id": "..." },
     "values": [
       { "alias": "metaName", "culture": null, "segment": null, "value": "New SEO Title" },
       { "alias": "metaDescription", "culture": null, "segment": null, "value": "New description" }
     ],
     "variants": [{ "culture": null, "segment": null, "name": "Page Name", "state": "Draft" }]
   }
   ```
5. **Update the document** — PUT `/document/{id}` with the payload. HTTP 200 = success. This saves a draft; it does not publish.

### Using the AI Agent API for Content Generation

AI agents configured in the backoffice can be invoked via the Agent API to generate content. Endpoints are under `/umbraco/ai/management/api/v1/agents/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all agents |
| GET | `/{idOrAlias}` | Get agent by ID or alias |
| POST | `/{idOrAlias}/run` | Run agent (SSE stream) |

**Important**: Agent tools (`get_page_info`, `set_property_value`, `search_umbraco`) are **frontend/client-side tools** that only work in the Copilot browser UI. When calling from Claude Code, provide the page content directly in the message and parse the agent's text response instead.

```bash
# Run an agent (returns Server-Sent Events stream)
curl -sk -N -X POST "https://localhost:44367/umbraco/ai/management/api/v1/agents/website-content-assistant/run" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"threadId":"t1","runId":"r1","messages":[{"id":"m1","role":"user","content":"Generate SEO for this article: ..."}]}'
```

The response is an SSE stream. Extract text from `TEXT_MESSAGE_CHUNK` events:
```
data: {"type":"TEXT_MESSAGE_CHUNK","messageId":"...","role":"assistant","delta":"partial text"}
```

Reassemble all `delta` values to get the full agent response.

## Testing

### E2E Tests (Playwright)

Tests live in `tests/e2e/`. The test runner and dependencies are in the root `package.json` (separate from the C# project).

```bash
# Node is managed via nvm — prefix commands with PATH if node isn't in your shell PATH
PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test

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

**Tokens expire in 299 seconds.** Auth re-runs automatically before each Playwright session.

### Block Development Workflow (TDD)

Use the `/block` command (`.claude/commands/block.md`) to build new blocklist components using a RED → GREEN loop:

1. **Write the E2E test** — describe the element type name and expected property aliases
2. **Run to confirm RED** — test fails because the element type doesn't exist yet
3. **Create the element type** via Management API using `DocumentTypeBuilder`
4. **Create the Razor partial** named `{elementTypeAlias}.cshtml` in `Views/Partials/blocklist/Components/` — the alias is derived from the element type name (e.g. "Alert Banner" → `alertBanner.cshtml`). **Do not add "Row" to the file name unless "Row" is part of the element type name itself** — existing blocks follow this convention ("Rich Text Row" → alias `richTextRow` → `richTextRow.cshtml`). For rich text properties, add `@using Umbraco.Cms.Core.Strings` — `IHtmlEncodedString` is not in the default `_ViewImports.cshtml`
5. **Build** with `dotnet build` to catch Razor errors
6. **Run tests again** — GREEN

### Umbraco 17 Management API Quirks

Hard-won lessons from building tests against the live API:

**Reserved property aliases** — These aliases are rejected silently or cause validation errors:
- `level` — reserved (use `alertLevel`, `severityLevel`, etc.)
- When in doubt, prefix with the block name (e.g., `alertContent` not `content`)

**Correct dropdown editor UI alias:**
```
Umb.PropertyEditorUi.Dropdown
```
`SelectBox` does not exist. The property editor alias (schema) is `Umbraco.DropDown.Flexible`.

**`getByName()` returns `false`, not `null`** when an entity isn't found. Use `.toBeTruthy()` / `.toBeFalsy()`, not `.toBeNull()` / `.not.toBeNull()`.

**Flat `properties` array** — The Management API returns document type properties directly on the object:
```typescript
// WRONG — no groups nesting in the API response
elementType.groups?.flatMap((g) => g.properties)

// CORRECT
elementType.properties ?? []
```

**Token lifetime** — Access tokens expire in 299 seconds (~5 min). For long-running scripts, re-authenticate before each logical operation.

## Deployment

Git push to Umbraco Cloud triggers the build pipeline — the `.umbraco` file at the repo root tells Cloud which `.csproj` to build. No separate CI/CD is configured. Environment-specific config is in `appsettings.{Development,Staging,Production}.json`.

## Conventions

- Views inherit from `UmbracoViewPage<ContentType>` where `ContentType` is an auto-generated model
- `_ViewImports.cshtml` imports `Umbraco.Cms.Web.Common.PublishedModels`, `Umbraco.Extensions`, and ASP.NET tag helpers
- The `.env` file contains Umbraco MCP server connection settings for local development
- `appsettings.Development.json` is **gitignored** — it contains the Anthropic API key. Each developer must create their own with their credentials.
- `umbraco-cloud.json` is managed by Umbraco Cloud — do not manually edit

## Claude Code Plugins

The **Umbraco CMS Backoffice Skills** plugin is installed via the Claude Code CLI (not the VS Code extension). It provides 60+ skills for building backoffice extensions:

```
/plugin marketplace add umbraco/Umbraco-CMS-Backoffice-Skills
/plugin install umbraco-cms-backoffice-skills@umbraco-backoffice-marketplace
/plugin install umbraco-cms-backoffice-testing-skills@umbraco-backoffice-marketplace
```
