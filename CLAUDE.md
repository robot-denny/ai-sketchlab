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
- `Views/Partials/blocklist/Components/` — Block List content components (richText, image, video, codeSnippet, etc.)
- `Views/Partials/blockgrid/` — Block Grid layout rendering (default, area, areas, items)
- `Views/Components/` — MVC View Components (Contact form, Pagination)
- `wwwroot/` — Static assets (Bootstrap 5 via CDN, custom CSS/JS, Highlight.js, Swiffy Slider)
- `umbraco/Deploy/Revision/` — Umbraco Deploy `.uda` metadata files (document types, data types, templates). These are auto-managed by Umbraco Deploy and pushed to Cloud for schema sync.
- `umbraco/Data/` — Local SQLite database and generated temp files (not committed)

**Content model**: Document types are defined in the Umbraco backoffice and stored as `.uda` files in `umbraco/Deploy/Revision/`. C# models are auto-generated at runtime in `umbraco/Data/TEMP/InMemoryAuto/`.

**Backoffice extension**: `src/HelloWorld/` — a backoffice extension project referenced from the main `.csproj`. Uses TypeScript + Vite with a `Client/` subfolder for the frontend build. Includes a dashboard, property actions, an image generator module, and an auto-generated OpenAPI client.

**Key NuGet packages**: Umbraco.Cms 17.3.0, Umbraco.Cms.DevelopmentMode.Backoffice 17.3.0, Umbraco.Cloud.Cms 17.1.0, Umbraco.Cloud.StorageProviders.AzureBlob 17.0.0, Umbraco.Forms 17.1.2, Umbraco.Forms.Deploy 17.0.0, Umbraco.Deploy.Cloud 17.0.2, Clean.Core 7.0.5 (view models for contact form/page headers), jcdcdev.Umbraco.ExtendedMarkdownEditor 17.0.5.

**AI packages**: Umbraco.AI 1.9.0, Umbraco.AI.Agent 1.8.0, Umbraco.AI.Agent.Copilot 1.0.0-alpha5 (copilot chat surface), Umbraco.AI.Agent.UI 1.0.0-alpha5 (shared chat UI components), Umbraco.AI.AGUI 1.8.0 (AG-UI protocol SDK), Umbraco.AI.Anthropic 1.3.0, Umbraco.AI.Google 1.1.5, Umbraco.AI.OpenAI 1.2.0, Umbraco.AI.Prompt 1.8.0.

**AI Deploy packages** (beta — serializes AI entities as `.uda` artifacts for schema deploy to Umbraco Cloud): Umbraco.AI.Deploy 1.0.0-beta3, Umbraco.AI.Prompt.Deploy 1.0.0-beta1. Auto-registered — no composer code required. `Umbraco.AI.Agent.Deploy` is intentionally **not installed**; agents stay DB-only and are recreated manually per Cloud environment. See **Pinned betas** below for the version constraints.

**Search packages** (beta — destined to replace legacy Examine search in v18): Umbraco.Cms.Search.Core 1.0.0-beta.3, Umbraco.Cms.Search.Provider.Examine 1.0.0-beta.3, Umbraco.Cms.Search.BackOffice 1.0.0-beta.3, Umbraco.Cms.Search.DeliveryApi 1.0.0-beta.3, Umbraco.AI.Search 1.0.0-beta3. See **Pinned betas** below for the version constraints.

## Pinned betas — do not float

Several beta packages have known compatibility traps. Don't let NuGet float them within their declared version ranges; pin exact versions until stable releases ship.

| Package | Pinned version | Why pinned |
|---|---|---|
| Umbraco.Cms.Search.Core | 1.0.0-beta.3 | `IndexMetadata` signature changed in beta.4; `Umbraco.AI.Search 1.0.0-beta3` is binary-compiled against beta.3. Opening **Settings → Search** throws `MissingMethodException` if Core floats. |
| Umbraco.Cms.Search.Provider.Examine | 1.0.0-beta.3 | Must match Core beta.3. |
| Umbraco.Cms.Search.BackOffice | 1.0.0-beta.3 | Must match Core beta.3. |
| Umbraco.Cms.Search.DeliveryApi | 1.0.0-beta.3 | Must match Core beta.3. |
| Umbraco.AI.Search | 1.0.0-beta3 | Compiled against `Cms.Search.Core` beta.3 (see above). |
| Umbraco.AI.Prompt.Deploy | 1.0.0-beta1 | beta2 references the unpublished `Umbraco.AI.Agent.Core 1.8.1` — `dotnet restore` succeeds but the site fails to start. (`Umbraco.AI.Deploy` itself is fine on beta3.) |
| Umbraco.AI.Agent.Deploy | **not installed** | beta1 throws `MissingMethodException` on `AIAgent.ContextIds`; beta2 depends on the unpublished `Umbraco.AI.Agent.Core 1.8.1`. The practical fallout: AI agents don't deploy alongside prompts/connections/profiles, so they stay DB-only and must be recreated manually in each Cloud environment alongside the vector index rebuild. Tracking comment: [UmbracoProject.csproj:14-16](src/UmbracoProject/UmbracoProject.csproj#L14-L16). |

**v18 upgrade path**: Both `Cms.Search.*` and `AI.Search` are destined to replace the legacy Examine-backed `IPublishedContentQuery.Search()` API in Umbraco v18. Expect API-breaking changes — revisit composer registration in [SearchComposer.cs](src/UmbracoProject/SearchComposer.cs), the `ISearcher` call in [search.cshtml](src/UmbracoProject/Views/search.cshtml), and this table as part of the v18 upgrade PR.

## AI & Copilot

The backoffice includes an **AI Copilot** that can generate and edit content directly in blocks/fields. Configuration is done in the Umbraco backoffice under **Settings > AI**:

- **AI Connection**: Provider + API credentials (Anthropic key stored in `appsettings.Development.json` under `Anthropic:ApiKey`)
- **Chat Profile**: Links an AI connection to a specific model
- **Agent**: Links a chat profile and defines the agent's role. **Permissions must be set on the agent** to allow content editing (scope controls which document types/properties it can modify).
- **Contexts**: Define data access boundaries (e.g., brand voice guidelines)

What's been validated end-to-end with MCP + AI is tracked in [docs/capabilities.md](docs/capabilities.md), which mirrors the **Capabilities** page in the backoffice.

The **Umbraco MCP server** enables Claude Code to interact with backoffice content. Connection settings are in `.env` with tool collections for `document`, `media`, `document-type`, and `data-type`.

### AI schema deployment to Umbraco Cloud

With the `Umbraco.AI.Deploy` + `Umbraco.AI.Prompt.Deploy` packages installed, every AI Connection, Context, Guardrail, Chat Profile, Embedding Profile, Prompt, and AI Setting saved in **Settings > AI** auto-serializes to a `umbraco-ai-*.uda` artifact under [src/UmbracoProject/umbraco/Deploy/Revision/](src/UmbracoProject/umbraco/Deploy/Revision/). Those artifacts flow through the same git → Umbraco Cloud pipeline as document types. **Agents are the one exception** (see the Agent.Deploy caveat above) — they stay DB-only and must be recreated manually per environment.

**Secrets stay per-environment**: `.uda` artifacts reference API keys via placeholders (e.g. `$OpenAI:ApiKey`, `$Anthropic:ApiKey`), never the raw value. Each Cloud environment (Development, Staging, Live) must have its own keys set in that environment's app settings via the Cloud portal — **never paste raw keys into the backoffice connection form** (they get encrypted to the DB and break on Data Protection key rotation).

**Cloud portal secret-key naming**: the portal's app-settings UI rejects `:` in key names (validator allows only `0-9 a-z A-Z _`). Use the .NET Core double-underscore convention — `Anthropic__ApiKey` / `OpenAI__ApiKey`. .NET Core flattens `__` back to `:` when building `IConfiguration`, so the backoffice connection references (`$OpenAI:ApiKey`) and `appsettings.Development.json` entries (`"OpenAI:ApiKey": "..."`) keep the colon form unchanged.

**Bootstrapping existing AI config into Deploy** (one-time, when adopting the Deploy packages on an established install): existing DB-only entities do **not** auto-export on package install — the serializer only writes on save. Open **Settings → AI** and click Save on every entity once, in this order (matches Deploy's dependency chain):

1. Connections → Contexts → Guardrails
2. Chat Profiles → Embedding Profiles
3. Prompts → Settings (default chat profile, default embedding profile)
4. Agents — save locally for reference, but these won't produce usable `.uda` artifacts; recreate them manually in each target environment.

Verify new `umbraco-ai-*.uda` files appear under `umbraco/Deploy/Revision/`. Before committing, grep the folder for raw secrets (`grep -rE '(sk-[A-Za-z0-9]{20,}|ANTHROPIC_)' src/UmbracoProject/umbraco/Deploy/Revision/`) to make sure only placeholder references are present. Run `/check-uda` for the usual schema-conflict pre-commit scan.

**What still needs manual per-environment work**: (1) the vector search index (see Search section below), and (2) agents — create them in each Cloud environment's backoffice once the deployed chat profiles are in place.

## Search

The site search at [src/UmbracoProject/Views/search.cshtml](src/UmbracoProject/Views/search.cshtml) uses the new **Umbraco.Cms.Search** framework (destined to replace the legacy Examine-backed `IPublishedContentQuery.Search()` API in v18) with **Umbraco.AI.Search** layered on top for semantic/vector search.

### Architecture

Three packages cooperate at runtime, registered via [src/UmbracoProject/SearchComposer.cs](src/UmbracoProject/SearchComposer.cs):

- **`Umbraco.Cms.Search.Core`** — provides the `ISearcher` / `ISearcherResolver` abstractions used by the Razor view. Doesn't do indexing itself; it's the façade that routes queries to a registered provider.
- **`Umbraco.Cms.Search.Provider.Examine`** — Lucene/keyword provider. Used in the backoffice and as a safety net for short, exact-match queries (author names, "contact", etc.) where pure-vector search underperforms.
- **`Umbraco.AI.Search`** — vector/semantic search on top of Core. Calls the configured embedding model to chunk + embed documents on publish and to embed the query at search time.

The public `/search` page is wired to the AI searcher; the Examine provider stays registered for hybrid fallback and for the backoffice search UI.

### Configuration

- **Embedding profile**: `default-embedding` (alias `openai-embeddings`) — OpenAI `text-embedding-3-small`, 512-dim. Set as the **default embedding profile** under `Settings → AI → Settings` in the backoffice. Without a default embedding profile, the AI index rebuild silently completes with 0 documents.
- **Searcher alias**: `UmbAI_Search` — pass this to `ISearcherResolver.GetSearcher(...)` and `ISearcher.SearchAsync(indexAlias: ...)`.
- **OpenAI API key**: stored in `appsettings.Development.json` under `OpenAI:ApiKey` (gitignored). The backoffice AI connection references it as `$OpenAI:ApiKey` — **never paste the raw key into the connection form** (it would be encrypted into the DB and break on Data Protection key rotation).
- **Tuning values**: `Umbraco:AI:Search` block in [appsettings.json](src/UmbracoProject/appsettings.json) — `ChunkSize: 512`, `ChunkOverlap: 50`, `DefaultTopK: 50`, `MinScore: 0.3`.

### Rebuilding the index

Trigger a full rebuild from the backoffice: **`Settings → Search`** → click the rebuild icon on the `UmbAI_Search` row. On the demo site this finishes in < 1 minute and produces ~3–4 vector chunks per published document (~115 chunks total across 33 documents).

**Always verify the document count is non-zero after a rebuild** — the rebuild API returns 200 even when misconfigured (e.g., no default embedding profile).

### Umbraco Cloud deploys

AI connections, profiles, embedding profiles, contexts, guardrails, prompts, and AI settings now auto-deploy as schema via the `Umbraco.AI.Deploy` package family (see **AI schema deployment** subsection under AI & Copilot above). **Agents and the vector index are still local to each environment** and must be set up / rebuilt manually.

After deploying to Cloud:

1. Set `OpenAI__ApiKey` (and `Anthropic__ApiKey` if using Anthropic connections) in that environment's app settings via the Cloud portal — note the double-underscore form, the portal rejects colons.
2. Log into that environment's backoffice and verify **Settings → AI** shows the deployed connections, profiles, contexts, etc.
3. Recreate any agents manually (link each to its deployed chat profile; set document-type permissions).
4. Rebuild the `UmbAI_Search` index once via `Settings → Search`.
5. Verify the document count > 0 before promoting further.

Deploys do not replicate the vector index; skipping the rebuild leaves `/search` returning empty results on that environment.

### Pinned versions

Version constraints for `Cms.Search.*` and `AI.Search` live in **Pinned betas — do not float** near the top of this file, alongside the other beta-package pinning rules.

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

**3. Umbraco auto-regenerates `.uda` on local startup.** Every `dotnet run` can rewrite files based on local DB signatures. If that regeneration gets staged inadvertently, git drifts from Live without any intentional schema change. See the `git checkout --` recipe above.

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

1. In the local backoffice, open **Settings → Deploy** and do a content restore from the target Cloud environment (typically Live).
2. In that same dashboard, also do a **media restore** for the same environment. This is the step that's easy to forget — content restore pulls document records (including the media picker references like `/media/<hash>/<name>.png`), but **does not** pull the media binaries.
3. Verify: browse the restored articles. If `mainImage` fields show broken links, step 2 was skipped.

**Authoring:** Create and edit media in the Cloud backoffice (Live or a shared non-prod environment). Use the Cloud Deploy dashboard to transfer media between environments in either direction. Do not commit `wwwroot/media/` changes — the gitignore rule will block them, but don't bypass it.

### When local media breaks

The usual cause is skipping the media restore after a partial content restore: local DB now points to `/media/<hash>/<filename>` paths whose binaries live on Live but not on disk. To heal:

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

**Tokens expire in 299 seconds.** Auth re-runs automatically before each Playwright session.

### Block Development Workflow (TDD)

Use the `/block` command for the full RED → GREEN TDD workflow for building blocklist components. See [.claude/commands/block.md](.claude/commands/block.md) for details.

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

### E2E Test Resilience Rules

Follow these rules when writing or planning Playwright E2E tests to avoid fragile, environment-coupled, or non-portable tests.

**1. Never hardcode Umbraco UUIDs.** Document IDs, document type IDs, folder IDs, and template IDs change between environments. Always look them up dynamically via the Management API (walk tree roots, search by name). Store the lookup in `beforeAll` and pass to tests via shared variables.

**2. Never hardcode URL slugs.** Don't assume `/parent-name/child-name/` — Umbraco may append `-2`, `-3` etc. when duplicate names exist (e.g., leftover from a failed test run). After creating and publishing a page, fetch its actual URL from the API response or document `urls` property.

**3. Always clean up stale test data before setup.** In `beforeAll`, search for and delete any leftover pages from previous failed runs *before* creating new ones. This prevents name collisions and slug suffixes. Pattern: search by a unique prefix (e.g., `SN Test`) in the document tree, delete matches in reverse-depth order.

**4. Re-acquire tokens before each logical operation group.** Don't rely on a single token for an entire `beforeAll` that does many sequential API calls. Add a helper that refreshes the token if it's near expiry, or re-authenticate at the start of each phase (setup, test, teardown).

**5. Use regex for CSS/file assertions — tolerate whitespace.** When asserting on CSS or file content, never match exact formatting like `.toContain('.section-nav {')`. Use `.toMatch(/\.section-nav\s*\{/)` to survive minification, auto-formatting, or whitespace changes.

**6. Prefer browser assertions over file-content assertions.** Don't assert on specific CSS class names (e.g., `col-lg-3`) or implementation details inside `.cshtml` files — these are implementation details, not behavior. If the browser E2E tests already verify the rendered behavior (sidebar visible, layout correct), file-content checks for the same thing are redundant and fragile. File-content tests should only verify structural concerns that can't be tested in the browser (e.g., which Razor helper method is used).

**7. Make API lookups resilient to testhelpers bugs.** The `getByName()` method in `@umbraco/playwright-testhelpers` has a known bug where `recurseChildren` short-circuits. When looking up entities, always have a fallback strategy (e.g., `getChildren(folderId)` for a known parent). Document the workaround with a comment explaining *why*, so it can be removed when the upstream fix lands.

**General patterns for test setup/teardown:**
```typescript
// Good: dynamic lookup
const home = (await api.document.getRoot()).find(d => d.name === 'Home');
const contentDT = await api.documentType.getByName('Content');

// Good: clean before create
async function cleanStaleTestData(token, prefix) {
  // Search tree for pages starting with prefix, delete them
}

// Good: get actual URL after publish
const doc = await apiFetch(token, 'GET', `/document/${id}`);
const actualUrl = doc.urls?.[0]?.url;
```

## Image Generator

Canvas-based image generator for creating flow-field featured images from article metadata. Lives in two locations:

- `scripts/image-generator/` — standalone CLI tool (`tsx scripts/image-generator/src/cli.ts`)
- `src/HelloWorld/Client/src/imageGenerator/` — backoffice integration module

Uses `@napi-rs/canvas` for server-side rendering. Run via `npm run generate:images`. Unit tests via `npm run test:unit`.

Use the `/cms-image` command to generate and publish images.

## Generative Skills

Three skills from [anthropics/skills](https://github.com/anthropics/skills) are used in this project:

- `/algorithmic-art` — Interactive p5.js generative art for decorative hero visuals. Outputs self-contained HTML with seed navigation and parameter controls. Export PNG via the built-in download button.
- `/canvas-design` — Static PNG visual design with curated typography. Requires fonts (see `skills/README.md` for fetch instructions).
- `frontend-design` — Refined UI design exploration (used during the image-carousel-captions-controls work; see [_plans/shipped/image-carousel-captions-controls.md](_plans/shipped/image-carousel-captions-controls.md) Step 3 for an example invocation).

`/algorithmic-art` and `/canvas-design` assets live in [skills/](skills/); outputs go to `skills/output/` (gitignored). See [skills/README.md](skills/README.md) for full documentation.

`frontend-design` is installed at [.agents/skills/frontend-design/](.agents/skills/frontend-design/) (the Anthropic skills convention) with a symlink at `.claude/skills/frontend-design` so Claude Code discovers it. Hash tracked in [skills-lock.json](skills-lock.json).

## Project Planning

- `_specs/` — feature specification documents (initial requirements, design rationale, open questions — the "why")
- `_plans/` — implementation plans for features (TDD steps with paste-ready prompts — the "how")
- `_features/` — living BDD-style behavioral specifications (current feature behavior as Given/When/Then scenarios — the "what")

## Feature Behavioral Specs

- `_features/` contains one file per logical feature, using Given/When/Then scenario format grouped by `Rule:` headings
- **Source of truth** for what a feature does right now — used for QA regression testing and developer onboarding
- Draft scenarios are generated by `/spec`, verified/updated as the final step of every `/plan`
- Use `/feature` to generate or update a feature doc from specs, plans, and tests
- Follows BDD principles from `.claude/skills/BDD.md`: Example Mapping, Specification by Example, Ubiquitous Language
- `_specs/` remain as historical records of original requirements and design rationale

## Deployment

Git push to Umbraco Cloud triggers the build pipeline — the `.umbraco` file at the repo root tells Cloud which `.csproj` to build. No separate CI/CD is configured. Environment-specific config is in `appsettings.{Development,Staging,Production}.json`.

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
