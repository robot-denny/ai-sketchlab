# Plan: Editor How-To Guides

**Spec**: `_specs/editor-how-to-guides.md`
**Branch**: `claude/feature/editor-how-to-guides`

## Context

Editors have no central place to learn how each block, setting, or global element on the site actually works. The existing Style Guide (`/styleguide/`) is brand/tokens; the Components page (`/styleguide/components`) is a visual showcase. This feature adds a new **Guides** section under Home — hidden from the main top nav but reachable by URL — where each documentable feature gets one page combining a live block instance, an editable AI-written description, an optional editor screenshot, and a read-only generation-metadata field. A `/guide` slash command creates and maintains those pages, generating prose through an Umbraco backoffice AI Agent (so brand voice stays editable in the CMS) and never silently overwriting editor work.

The plan reuses existing patterns wherever possible: the `Section Row Controls` composition for the live-example slot (`sectionRows` Block List, data type `8fdfe8f3-7490-4b9b-82f1-c0ffb7fdab0b`); the existing `SEO`, `Header`, `Page Head Pattern`, and `Visibility` compositions; the `_SiteHead.cshtml` nav filter that already honors `hideFromTopNavigation`; the `scripts/image-generator/` shape for a TypeScript CLI helper that auths against the Management API; and the agent SSE protocol documented in CLAUDE.md (`POST /umbraco/ai/management/api/v1/agents/{idOrAlias}/run` → parse `TEXT_MESSAGE_CHUNK` deltas).

---

## Key Decisions

- **Doc type shape**: One `guides` parent doc type (alias `guides`) and one `howToGuidePage` child doc type. Compositions for both: `headerControls`, `seoControls`, `sectionRowControls`, plus a **new** `guideVisibilityControls` composition (see below). `howToGuidePage` adds three own properties: `description` (Rich Text), `screenshot` (Media Picker, single image, optional), and `generationMetadata` (multiline text/JSON, read-only via property action or note in label). Allow `guides` as a child of `home`; allow `howToGuidePage` as a child of `guides`.

- **Default-hidden-from-nav at the doc-type level**: The shared `visibilityControls` composition uses the global True/False data type (no default), so a new How-To Guide Page would default to `hideFromTopNavigation = false`. To honor the spec scenario "a new How-To Guide Page defaults to hidden from the main top navigation," create a new `Guide Visibility Controls` composition with three boolean properties — `hideFromTopNavigation`, `umbracoNaviHide`, `hideFromXMLSitemap` — but with a fresh `True/False (default true)` data type backing `hideFromTopNavigation`. The same property aliases keep `_SiteHead.cshtml` and the sitemap unchanged. Trade-off accepted: we now have two visibility compositions; only the Guides feature uses the new one.

- **Live-example slot = `sectionRows`**: Reuse the existing `Section Row Controls` composition rather than introducing a dedicated single-block slot. The slash command, on first creation, seeds `sectionRows` with one instance of the documented block. Editors can add or modify blocks in that slot freely — the spec's "never silently overwrite" rule means `/guide` will never touch `sectionRows` after creation. The live-example slot for non-block features (settings, header) is simply left empty; the `screenshot` field carries the visual instead.

- **Description field editor**: Use the same Rich Text data type the existing styleguide pages use (TipTap variant — confirm IDs at implementation time via MCP `get-all-data-types`). Plain HTML output round-trips cleanly into the description and is editable by humans without surprises.

- **Source signature**: SHA-256 over a deterministic JSON payload `{ partial: <file path>, partialContent: <utf-8 contents>, elementType: { alias, properties: [{alias, name, dataTypeAlias}, ...sorted] }, agentSystemPromptHash, schemaVersion: 1 }`. Stored as JSON inside the `generationMetadata` text field along with `lastGeneratedAt` (ISO timestamp) and `lastFeatureAlias`. Storing in a doc property (not a side-channel file) keeps the per-page state co-located with the page itself and survives restores.

- **Slash command location**: `.claude/commands/guide.md` is the operator-facing prompt; the heavy lifting lives in a TypeScript CLI at `scripts/guide-generator/src/cli.ts`, mirroring `scripts/image-generator/`. The `.md` file invokes the CLI and post-processes the output for the operator.

- **Backoffice agent**: One agent named **How-To Guide Writer**, alias `how-to-guide-writer`. References the existing **Site Content Guidelines** context (`site-content-guidelines`) plus a new **How-To Guide Style** context that owns the structural template (intro paragraph → "When to use it" → "Configuration" → "Tips"). Setup is per-environment because of the `Umbraco.AI.Agent.Deploy` caveat in CLAUDE.md (agents stay DB-only); the new context deploys via `Umbraco.AI.Prompt.Deploy` like the existing one. The agent's system prompt instructs it to amend (not rewrite) when an existing description is provided in the user message.

- **Page naming + URL slug**: Page name = `How to use the {Feature Display Name}`. URL slug derives from the name on first publish (`/guides/how-to-use-the-alert-banner/`); subsequent renames in the source do not change the slug (Umbraco preserves URLs, and the slash command never renames an existing page).

- **Audit scope (v1)**: `/guide --audit` walks `src/UmbracoProject/Views/Partials/blocklist/Components/*.cshtml` (auto-discovered) **and** a hand-curated registry of named global features. Initial registry entries: `siteHeader`, `siteFooter`, `siteSettings`, `search`, `articleList`. Each registry entry declares `{ alias, displayName, kind: 'block' | 'global', sources: string[] }` — `sources` is the list of files whose contents feed the SHA-256 signature for that feature. Block features auto-seed `sectionRows` with one instance of the documented block; global features leave `sectionRows` empty and rely on the editor-uploaded `screenshot` field for their visual. Registry lives in `scripts/guide-generator/src/features.ts`; adding a new global feature is a single PR. Orphan detection: any `howToGuidePage` whose `generationMetadata.lastFeatureAlias` is not in the merged (block + curated) feature list.

- **Non-interactive runs**: When `process.stdin.isTTY === false`, the command refuses to apply an amend and exits with `amend pending — re-run interactively or pass --auto-apply`. `--auto-apply` is documented but should be reserved for trusted automation.

- **Token discipline**: The CLI re-fetches the OAuth bearer token before each logical phase (resolve feature, find existing page, generate, write) — same pattern as the image-generator. Tokens expire in 299s and the agent SSE call can take longer than a single token's lifetime.

- **Test runner**: Reuse `tests/e2e/` Playwright. New spec file `tests/e2e/guides.spec.ts` for the schema + nav-visibility checks. Each `/guide` behavior (create, skip, amend, audit) gets its own describe block in `tests/e2e/guides-cli.spec.ts` that shells out to the CLI with `child_process.execFileSync` and asserts on stdout + Management API state. Tests must clean stale `How to use *` pages in `beforeAll` per the E2E Test Resilience Rules.

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Schema: Guides parent + How-To Guide Page doc types + new visibility composition

> **Prompt**: Implement Step 1 of `_plans/editor-how-to-guides.md`. Create three Umbraco schema entities via the Management API: (a) a new "True/False (default true)" data type cloned from the shared True/False data type with `values: [{alias: "default", value: "1"}]`; (b) a new "Guide Visibility Controls" composition document type (alias `guideVisibilityControls`) with three boolean properties `hideFromTopNavigation` (using the new default-true data type), `umbracoNaviHide`, `hideFromXMLSitemap` (both using the existing shared True/False), all on a "Visibility" tab — match the existing `Visibility Controls` composition in shape so `_SiteHead.cshtml` continues to work; (c) a `guides` parent doc type (alias `guides`, allowed as root child of `home` only, no own properties, compositions = `headerControls` + `seoControls` + `sectionRowControls` + `guideVisibilityControls`, allowedChildren = `howToGuidePage`); (d) a `howToGuidePage` doc type with three own properties — `description` (Rich Text, mandatory=false), `screenshot` (Media Picker, single image, mandatory=false), `generationMetadata` (multiline text, mandatory=false, description="Auto-managed by /guide command — do not edit manually") — plus the same four compositions; allowedChildren = none. Modify the `home` doc type's `allowedDocumentTypes` to include `guides` (sortOrder after `styleGuidePage`). Use a one-shot setup script at `scripts/setup-guides-schema.mjs` that exits cleanly when entities already exist (idempotent). Before writing the script, write `tests/e2e/guides.spec.ts` with assertions that the new doc types exist with the expected aliases, properties, compositions, and `home`'s allowedChildren list contains `guides`. Run the test → expect RED. Then run the setup script. Re-run the test → expect GREEN. Use MCP tools (`get-all-data-types`, `get-all-document-types`) to look up live IDs for the existing compositions and data types — do not hardcode them.

**What to build**:
- `scripts/setup-guides-schema.mjs` — Node script using `node:https` + `.env` credentials. Auths via `/security/back-office/token`, then POSTs to `/data-type` (default-true clone), `/document-type` (composition + Guides + How-To Guide Page), and PUTs to `/document-type/{home-id}` to extend `allowedDocumentTypes`. Idempotent — checks for existing entities by alias before creating.
- `tests/e2e/guides.spec.ts` — `test.describe('Guides schema')` with three tests:
  - `'guides parent doc type has the expected shape'`
  - `'How-To Guide Page doc type has description, screenshot, generationMetadata properties'`
  - `'Home allows Guides as a child'`
  Use `umbracoApi.documentType.getByName('Guides')` etc., walk `properties` flat, assert `compositions` includes the four expected IDs.

**Test first**:
- Write `tests/e2e/guides.spec.ts` with the three assertions above
- Run: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/guides.spec.ts` — confirm RED before running setup script

**Validation**:
- Automated: `PATH="..." npx playwright test tests/e2e/guides.spec.ts` — all three tests GREEN after setup runs
- Manual: Open backoffice → Settings → Document Types — confirm "Guides" and "How-To Guide Page" appear; open How-To Guide Page → Visibility tab → confirm "Hide From Top Navigation" appears with a toggle
- Manual (.uda check): `git status src/UmbracoProject/umbraco/Deploy/Revision/` — three or four new `document-type__*.uda` files and one `data-type__*.uda` should appear; run `/check-uda` for sanity before committing

---

### Step 2 — Razor templates: `guides.cshtml` and `howToGuidePage.cshtml`

> **Prompt**: Implement Step 2 of `_plans/editor-how-to-guides.md`. Schema from Step 1 must be in place. Create two Razor templates that render the new doc types: (a) `Views/guides.cshtml` — the Guides landing template, inherits `UmbracoViewPage<Guides>`, layout = `_Layout`, renders the page header (title from name) and the `sectionRows` Block List via the existing `_RenderSectionRows.cshtml` (or whatever the styleguide uses — match the styleguide's pattern); (b) `Views/howToGuidePage.cshtml` — the How-To Guide Page template, also inherits `UmbracoViewPage<HowToGuidePage>`, renders the page header, the `description` rich text, the `screenshot` image (only if present), and the `sectionRows` block list (the live-example slot). Wire each template to its doc type via the Management API setup script `scripts/setup-guides-schema.mjs` (extend the script — set `defaultTemplate` and `allowedTemplates` on each doc type). Run `dotnet build` to confirm both templates compile. Manually check by visiting `/guides/` (after creating the parent page) and any guide page — both should render. Do not write a new E2E test in this step; the existing `tests/e2e/guides.spec.ts` already asserts the templates are wired.

**What to build**:
- `src/UmbracoProject/Views/guides.cshtml`
- `src/UmbracoProject/Views/howToGuidePage.cshtml`
- Extend `scripts/setup-guides-schema.mjs` to create the templates via `POST /template` and link them to the doc types

**Validation**:
- Automated: `cd src/UmbracoProject && dotnet build` — succeeds with no warnings about the new views
- Manual: Both templates visible in backoffice → Settings → Templates; doc types reference them as default

---

### Step 3 — Create the Guides parent page; verify nav hiding + URL access

> **Prompt**: Implement Step 3 of `_plans/editor-how-to-guides.md`. Steps 1 and 2 must be done. Create the Guides parent page itself (one piece of content under Home) with name "Guides", URL slug `/guides/`, `hideFromTopNavigation = true`, published. Add this as an extension to `scripts/setup-guides-schema.mjs` (idempotent — skip if a Guides page already exists under Home). Then add two new tests to `tests/e2e/guides.spec.ts`: (a) `'/guides/ returns 200 and renders the landing page'` — uses `request.get('/guides/')` and asserts status 200 and that the response body contains "Guides"; (b) `'main top navigation does not contain a Guides link'` — loads the home page in a browser, asserts the top nav has no link with text matching `/guides/i`. Write the two tests first, expect RED, then run the setup script extension, expect GREEN. Restart `dotnet run` between adding the page and re-running the test if necessary.

**What to build**:
- Extend `scripts/setup-guides-schema.mjs` — POST `/document` to create the Guides page, then POST `/document/{id}/publish`. Set `hideFromTopNavigation: true` in the values array.
- Add 2 tests to `tests/e2e/guides.spec.ts`

**Test first**:
- Add the two new tests, run the spec — confirm the new tests RED while existing pass
- Run the script extension
- Re-run — all GREEN

**Validation**:
- Automated: `PATH="..." npx playwright test tests/e2e/guides.spec.ts` — all 5 tests pass
- Manual: Open `https://localhost:44367/` in browser — top nav has no "Guides" link; visit `https://localhost:44367/guides/` directly — page loads and shows "Guides"
- Manual: Backoffice → Content → Home → Guides — the page exists, "Hide From Top Navigation" toggle is checked

---

### Step 4 — Backoffice agent setup (manual, documented)

> **Prompt**: Implement Step 4 of `_plans/editor-how-to-guides.md`. This is a backoffice-only step — no code. In the local Umbraco backoffice, go to Settings → AI and: (a) create a new **Context** named "How-To Guide Style" (alias `how-to-guide-style`) with body content describing the structural template every generated guide should follow (intro paragraph naming the feature, "When to use it" section, "Configuration" section enumerating each property in the element type, "Tips" section, all in the brand voice from the existing Site Content Guidelines context); (b) create a new **Agent** named "How-To Guide Writer" (alias `how-to-guide-writer`), link it to the default chat profile, attach both the existing `site-content-guidelines` context and the new `how-to-guide-style` context. Set the agent's system prompt to instruct it to: produce HTML (not Markdown), respect the structural template from the context, never invent properties that are not in the source payload, and — when an existing description is provided — amend rather than rewrite, preserving any prose that does not need to change. Save each entity once so the `Umbraco.AI.Prompt.Deploy` package writes a `umbraco-ai-context__*.uda` and the deploy machinery captures the context (the agent itself stays DB-only per the Agent.Deploy caveat). After saving, document the exact backoffice click-path in `.claude/commands/guide.md`'s "Setup" section so other developers (and Cloud environments) can recreate the agent. Do not commit any raw API keys; verify only `$Anthropic:ApiKey` / `$OpenAI:ApiKey` placeholders appear in the new `.uda` artifacts.

**What to build**:
- One Context entity (will produce a `umbraco-ai-context__*.uda`)
- One Agent entity (DB-only, manual recreation per environment — captured as a setup section in the slash command doc)
- Stub of `.claude/commands/guide.md` containing only the "Setup — Backoffice agent" section for now (Step 9 fills in the rest)

**Validation**:
- Automated: `grep -rE '(sk-[A-Za-z0-9]{20,}|ANTHROPIC_)' src/UmbracoProject/umbraco/Deploy/Revision/` — no matches
- Manual: Settings → AI → Agents → "How-To Guide Writer" appears, can be selected
- Manual: Settings → AI → Contexts → "How-To Guide Style" appears
- Manual: Open the AI Copilot chat surface, select the agent, and send "draft a paragraph about a fictional ImageRow block" — agent responds in the expected tone
- Manual: A new `umbraco-ai-context__*.uda` appears under `umbraco/Deploy/Revision/`

---

### Step 5 — TypeScript helper modules: source signature + agent SSE client + Management API client

> **Prompt**: Implement Step 5 of `_plans/editor-how-to-guides.md`. Create the foundational TypeScript modules under `scripts/guide-generator/src/`. (a) `umbracoApi.ts` — copy the auth + request helpers from `scripts/image-generator/src/umbraco-api.ts`, exporting `getToken()`, `request()`, plus higher-level helpers `getDocumentTypeByAlias()`, `findGuidePageByFeatureAlias()`, `createGuidePage()`, `updateGuidePage()`, `publishDocument()`. (b) `sourceSignature.ts` — a pure module exporting `computeSourceSignature(featureAlias: string): Promise<{ signature: string, payload: object }>`. The function reads `src/UmbracoProject/Views/Partials/blocklist/Components/{featureAlias}.cshtml`, looks up the matching element type via the Management API by name (case-insensitive match on `featureAlias` → element type display name), builds the deterministic JSON described in Key Decisions, and returns the SHA-256 hex digest plus the payload. (c) `agentClient.ts` — exports `runAgent(idOrAlias: string, message: string, opts: { token: string, threadId?: string, timeoutMs?: number }): Promise<string>` that POSTs to `/umbraco/ai/management/api/v1/agents/{idOrAlias}/run`, parses the SSE stream, concatenates all `TEXT_MESSAGE_CHUNK.delta` values, throws on `ERROR` or stream drop before `TEXT_MESSAGE_END`, and returns the assembled text. Write Vitest unit tests under `scripts/guide-generator/test/` for `sourceSignature.ts` (deterministic output for the same inputs; different signatures when partial content changes) and for the SSE parser inside `agentClient.ts` (using a mock readable stream). Run `npm run test:unit` and confirm GREEN.

**What to build**:
- `scripts/guide-generator/src/umbracoApi.ts`
- `scripts/guide-generator/src/sourceSignature.ts`
- `scripts/guide-generator/src/agentClient.ts`
- `scripts/guide-generator/test/sourceSignature.test.ts`
- `scripts/guide-generator/test/agentClient.test.ts`
- `scripts/guide-generator/package.json` (or extend root one) and `tsconfig.json` if needed — match what `scripts/image-generator/` uses

**Test first**:
- Write the two Vitest test files first (RED)
- Then implement the modules (GREEN)

**Validation**:
- Automated: `npm run test:unit` — both test files pass
- Manual: `tsx scripts/guide-generator/src/sourceSignature.ts alertBanner` (with a quick `if (require.main === module)` smoke harness) prints a stable hex digest

---

### Step 6 — `/guide <feature>` create-fresh flow

> **Prompt**: Implement Step 6 of `_plans/editor-how-to-guides.md`. Steps 1–5 must be in place. Create the CLI entry point `scripts/guide-generator/src/cli.ts` that parses positional `<feature-alias>` and flags (`--audit`, `--auto-apply`, `--dry-run`). Implement the create-fresh code path: (a) if no guide page exists for the feature, call `runAgent('how-to-guide-writer', generatePrompt(payload))` to produce the description; (b) `POST /document` to create a `howToGuidePage` under the Guides parent with name "How to use the {Feature Display Name}", `description = <agent output>`, `generationMetadata = JSON.stringify({signature, lastGeneratedAt, lastFeatureAlias})`, `hideFromTopNavigation = true`, `sectionRows` seeded with one block of the documented element type when `featureAlias` matches a known block; (c) publish. Print "created /guides/how-to-use-the-{slug}/" on success. Add a Playwright spec `tests/e2e/guides-cli.spec.ts` with one test that shells out to the CLI for a `tests/test-fixtures/sandbox` feature alias (or just `alertBanner` if alertBanner has no existing guide), then asserts via the Management API: a guide page exists under Guides, has a populated description ≥ 50 chars, has a `generationMetadata.signature` matching the current source signature, and is published with `hideFromTopNavigation = true`. The test cleans up before and after. Write the test first → expect RED → implement the CLI path → GREEN.

**What to build**:
- `scripts/guide-generator/src/cli.ts` (only the create-fresh path in this step; other paths in Steps 7–8)
- `scripts/guide-generator/src/prompts.ts` — `generatePrompt(payload)` returns the message body sent to the agent in fresh-create mode
- `tests/e2e/guides-cli.spec.ts` — `describe('guide create-fresh')` block

**Test first**:
- `tests/e2e/guides-cli.spec.ts` — RED before CLI implementation
- Implement create-fresh path → GREEN

**Validation**:
- Automated: `PATH="..." npx playwright test tests/e2e/guides-cli.spec.ts` — passes
- Manual: From repo root, run `tsx scripts/guide-generator/src/cli.ts alertBanner` (after deleting any existing alertBanner guide). Open backoffice → Content → Home → Guides → "How to use the Alert Banner" — review the description; confirm sectionRows contains a real Alert Banner block that renders.
- Manual: Open `https://localhost:44367/guides/how-to-use-the-alert-banner/` — page loads, shows description + live block

---

### Step 7 — `/guide <feature>` skip-no-change + amend-with-approval flows

> **Prompt**: Implement Step 7 of `_plans/editor-how-to-guides.md`. Step 6 must be in place. Extend `scripts/guide-generator/src/cli.ts` with two more code paths. (a) **Skip no-change**: when a guide page exists and the recorded `generationMetadata.signature` matches `computeSourceSignature(featureAlias).signature`, exit cleanly with `no changes — {feature} guide is up to date`, make no AI call, no document write. (b) **Amend with approval**: when a guide page exists and the signature has drifted, build an amend prompt that includes `existingDescription`, `previousSignaturePayload`, `currentSignaturePayload`, and the explicit instruction "amend the existing description; preserve any prose the editor has added; only change paragraphs that need to reflect the source diff." Call the agent. Render a unified diff (use the `diff` npm package) of `existingDescription` vs the agent's proposed amend on stdout in a colored format. Wait on stdin for `y/N`. On `y`, write the amend + update `generationMetadata`. On `n` (or any other input), exit with `no changes written`. If `process.stdin.isTTY === false` and `--auto-apply` is not passed, refuse with `amend pending — re-run interactively or pass --auto-apply`. With `--auto-apply`, write without prompting. Add four new tests to `tests/e2e/guides-cli.spec.ts`: skip-no-change, amend-approve, amend-decline, amend-non-interactive-refuses. Use child process with stdin piping to simulate y/n. Write tests first → RED → implement → GREEN.

**What to build**:
- Extend `scripts/guide-generator/src/cli.ts` — three new branches
- `scripts/guide-generator/src/diff.ts` — small wrapper around the `diff` npm package that produces a colored unified diff
- 4 new tests in `tests/e2e/guides-cli.spec.ts`

**Test first**:
- Add the 4 tests, RED
- Implement → GREEN

**Validation**:
- Automated: `PATH="..." npx playwright test tests/e2e/guides-cli.spec.ts` — all tests pass
- Manual: Run `tsx scripts/guide-generator/src/cli.ts alertBanner` — outputs `no changes — alertBanner guide is up to date` and exits 0
- Manual: Edit `Views/Partials/blocklist/Components/alertBanner.cshtml` (add a comment), run the CLI again — terminal shows a unified diff and waits for `y/N`. Type `n` — page is not modified. Type `y` (after a fresh edit/run) — description is updated, `generationMetadata` reflects the new signature
- Manual: `tsx scripts/guide-generator/src/cli.ts alertBanner < /dev/null` (non-TTY) — exits with the refusal message; pass `--auto-apply` to override

---

### Step 8 — `/guide --audit` mode

> **Prompt**: Implement Step 8 of `_plans/editor-how-to-guides.md`. Step 7 must be in place. First create `scripts/guide-generator/src/features.ts` exporting `listFeatures()` that returns the merged list: auto-discovered block features (one per `*.cshtml` under `src/UmbracoProject/Views/Partials/blocklist/Components/`) **plus** a hand-curated array of named global features. Each entry has `{ alias, displayName, kind: 'block' | 'global', sources: string[] }`. Initial curated entries: `siteHeader` (sources: `Views/Partials/v2/_SiteHead.cshtml`, the Header Controls composition properties), `siteFooter` (sources: footer partials), `siteSettings` (sources: Site Settings doc type properties), `search` (sources: `Views/search.cshtml`), `articleList` (sources: `Views/articleList.cshtml` + Article List doc type properties). Then add the `--audit` branch to `cli.ts`: it (a) calls `listFeatures()` for the canonical list; (b) lists every `howToGuidePage` under Guides via the Management API; (c) prints two sections grouped by kind — `Missing guides — Blocks (N):`, `Missing guides — Global (N):`, and `Orphaned guides (N):` (pages whose `generationMetadata.lastFeatureAlias` is not in the merged feature list). Print counts in each header. Exit code: 0 if all sections empty, 1 otherwise. Update `sourceSignature.ts` from Step 5 if needed so it can hash either a block partial (block kind) or a list of source files (global kind). Add three tests to `tests/e2e/guides-cli.spec.ts`: a missing block feature appears under Missing — Blocks; a missing global feature (e.g. `siteHeader`) appears under Missing — Global; a guide with `lastFeatureAlias` = `legacyBanner` appears under Orphaned. Tests first → RED → implement → GREEN.

**What to build**:
- `--audit` branch in `cli.ts`
- 2 tests in `tests/e2e/guides-cli.spec.ts`

**Test first**:
- Add the 2 tests, RED
- Implement → GREEN

**Validation**:
- Automated: `PATH="..." npx playwright test tests/e2e/guides-cli.spec.ts` — all audit tests pass
- Manual: `tsx scripts/guide-generator/src/cli.ts --audit` — prints the missing + orphaned report; exit code matches state

---

### Step 9 — Slash command file `.claude/commands/guide.md`

> **Prompt**: Implement Step 9 of `_plans/editor-how-to-guides.md`. Step 8 must be in place. Replace the stub from Step 4 with the full operator-facing slash command. Sections to include: (a) **Usage** — `/guide <feature-alias>` for create/amend, `/guide --audit` for the gap report, `/guide --auto-apply <feature-alias>` for non-interactive amends; (b) **What it does** — one-paragraph behavior summary linking to the spec and feature doc; (c) **Setup — Backoffice agent** — the click-path from Step 4 (Settings → AI → Context "How-To Guide Style" → Agent "How-To Guide Writer" → attach contexts → save in dependency order so `Umbraco.AI.Prompt.Deploy` writes the `.uda`); (d) **What it doesn't touch** — the screenshot field, sectionRows after creation, anything except `description` + `generationMetadata`; (e) **Per-environment notes** — Cloud environments must recreate the agent manually (Agent.Deploy caveat); contexts deploy via `.uda`; (f) **The actual prompt body** that Claude executes when the command runs — invokes the CLI with the right args, parses output, prints the result. Match the structure of `.claude/commands/cms-image.md` and `.claude/commands/check-uda.md` for tone and shape.

**What to build**:
- Full content for `.claude/commands/guide.md` (replacing the Step 4 stub)

**Validation**:
- Manual: In a fresh Claude Code chat in this repo, type `/guide alertBanner` — the command discovers `.claude/commands/guide.md`, runs the CLI, reports the result
- Manual: `/guide --audit` — runs the audit and reports missing/orphaned

---

### Step 10 — Smoke test against a real block + commit `.uda` artifacts

> **Prompt**: Implement Step 10 of `_plans/editor-how-to-guides.md`. Steps 1–9 must be done. Run an end-to-end smoke test: (a) `/guide --audit` to confirm the canonical list of blocks vs. existing guides; (b) `/guide alertBanner` from scratch (delete any prior guide first) — confirm the page is created, published, sectionRows seeded, description well-formed, hidden from top nav; (c) re-run `/guide alertBanner` — confirm "no changes" path; (d) edit `alertBanner.cshtml` (add a real new property to the element type via MCP), re-run `/guide alertBanner` — confirm amend diff appears, accept, confirm the description is updated. Then run `/check-uda` to verify schema artifacts are clean. Stage and commit only intentional `.uda` files (the new doc types, new composition, new data type, new context, new templates) — discard any unintended `.uda` regenerations per CLAUDE.md's `git checkout --` recipe. Run the full Playwright suite once: `PATH="..." npx playwright test` — confirm GREEN.

**Validation**:
- Automated: `PATH="..." npx playwright test` — all suites GREEN (no regressions in existing specs)
- Automated: `/check-uda` — no conflicts, drift severity SAFE or LOW
- Manual: Spot-check the rendered guide pages in the browser; spot-check the backoffice editing experience

---

### Step 11 — Verify feature behavioral spec

> **Prompt**: Run `/feature update _features/editor-how-to-guides.md` to verify the living behavioral spec reflects the actual implementation. Review each scenario against the code and test results. Update any scenarios where the implementation diverged from the draft (e.g. exact CLI message text, page-name wording, audit output format). Fill in the test coverage table with the actual `tests/e2e/guides.spec.ts` and `tests/e2e/guides-cli.spec.ts` paths and line numbers. Remove the "Draft" banner. Set the `Last verified` line to today's date. Commit the verified feature doc.

**Validation**:
- Manual: Every scenario in `_features/editor-how-to-guides.md` matches observable behavior (CLI output strings, backoffice property names, page slugs)
- Manual: Test coverage table has no unexpected "Not covered" gaps; each row points to a real `path:line` in a spec file

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/UmbracoProject/Views/guides.cshtml` |
| Create | `src/UmbracoProject/Views/howToGuidePage.cshtml` |
| Modify | `src/UmbracoProject/umbraco/Deploy/Revision/document-type/document-type__a95360e8ff0440b18f467aa4b5983096.uda` (Home — extend `allowedDocumentTypes`) |
| Create | `src/UmbracoProject/umbraco/Deploy/Revision/document-type/*` (Guides, How-To Guide Page, Guide Visibility Controls — three new files) |
| Create | `src/UmbracoProject/umbraco/Deploy/Revision/data-type/*` (True/False default-true) |
| Create | `src/UmbracoProject/umbraco/Deploy/Revision/template/*` (two new templates) |
| Create | `src/UmbracoProject/umbraco/Deploy/Revision/umbraco-ai-context__*.uda` (How-To Guide Style context) |
| Create (delete after running) | `scripts/setup-guides-schema.mjs` |
| Create | `scripts/guide-generator/src/cli.ts` |
| Create | `scripts/guide-generator/src/features.ts` |
| Create | `scripts/guide-generator/src/umbracoApi.ts` |
| Create | `scripts/guide-generator/src/sourceSignature.ts` |
| Create | `scripts/guide-generator/src/agentClient.ts` |
| Create | `scripts/guide-generator/src/prompts.ts` |
| Create | `scripts/guide-generator/src/diff.ts` |
| Create | `scripts/guide-generator/test/sourceSignature.test.ts` |
| Create | `scripts/guide-generator/test/agentClient.test.ts` |
| Create | `scripts/guide-generator/package.json` (or update root) |
| Create | `tests/e2e/guides.spec.ts` |
| Create | `tests/e2e/guides-cli.spec.ts` |
| Create | `.claude/commands/guide.md` |
| Update | `_features/editor-how-to-guides.md` (verify against implementation; remove Draft banner) |
