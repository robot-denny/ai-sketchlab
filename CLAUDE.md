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

**Key NuGet packages**: Umbraco.Cms 17.4.0, Umbraco.Cms.DevelopmentMode.Backoffice 17.4.0, Umbraco.Cloud.Cms 17.1.3, Umbraco.Cloud.StorageProviders.AzureBlob 17.0.0, Umbraco.Forms 17.1.2, Umbraco.Forms.Deploy 17.0.0, Umbraco.Deploy.Cloud 17.1.0, Clean.Core 7.0.5 (view models for contact form/page headers), jcdcdev.Umbraco.ExtendedMarkdownEditor 17.0.5.

**AI packages**: Umbraco.AI 1.11.0, Umbraco.AI.Agent 1.10.0, Umbraco.AI.Agent.Copilot 1.0.0 (copilot chat surface), Umbraco.AI.Agent.UI 1.0.0 (shared chat UI components), Umbraco.AI.AGUI 1.10.0 (AG-UI protocol SDK), Umbraco.AI.Anthropic 1.3.2, Umbraco.AI.Google 1.1.7, Umbraco.AI.OpenAI 1.2.2, Umbraco.AI.Prompt 1.8.4.

**AI Deploy packages** (serializes AI entities as `.uda` artifacts for schema deploy to Umbraco Cloud): Umbraco.AI.Deploy 1.0.0, Umbraco.AI.Prompt.Deploy 1.0.0, Umbraco.AI.Agent.Deploy 1.0.0. Auto-registered — no composer code required. As of 1.0.0, **all four AI entity families (connections/profiles/contexts/prompts, plus agents) deploy as `.uda`** — agents no longer need to be recreated manually per Cloud environment.

**Search packages** (beta — see *v18 upgrade path* under Pinned betas): Umbraco.Cms.Search.Core 1.0.0-beta.3, Umbraco.Cms.Search.Provider.Examine 1.0.0-beta.3, Umbraco.Cms.Search.BackOffice 1.0.0-beta.3, Umbraco.Cms.Search.DeliveryApi 1.0.0-beta.3, Umbraco.AI.Search 1.0.0-beta3. See **Pinned betas** below for the version constraints.

## Pinned betas — do not float

Several beta packages have known compatibility traps. Don't let NuGet float them within their declared version ranges; pin exact versions until stable releases ship.

| Package | Pinned version | Why pinned |
|---|---|---|
| Umbraco.Cms.Search.Core | 1.0.0-beta.3 | `IndexMetadata` signature changed in beta.4; `Umbraco.AI.Search 1.0.0-beta3` is binary-compiled against beta.3. Opening **Settings → Search** throws `MissingMethodException` if Core floats. |
| Umbraco.Cms.Search.Provider.Examine | 1.0.0-beta.3 | Must match Core beta.3. |
| Umbraco.Cms.Search.BackOffice | 1.0.0-beta.3 | Must match Core beta.3. **Known beta.3 bug:** its `AddBackOfficeSearch()` registration crashes the backoffice Media/Content list-view search box — `'field name' cannot be null or empty` from Examine — so [SearchComposer.cs](src/UmbracoProject/SearchComposer.cs) deliberately does *not* call it (list-view search falls back to built-in Umbraco Examine). Re-enable when an `AI.Search` build compatible with `Cms.Search.* beta.4+` lets us float past the beta.3 fix. Tracked: `fix-backoffice-search-beta3-fieldname-crash`. |
| Umbraco.Cms.Search.DeliveryApi | 1.0.0-beta.3 | Must match Core beta.3. |
| Umbraco.AI.Search | 1.0.0-beta3 | Compiled against `Cms.Search.Core` beta.3 (see above). |

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

With the `Umbraco.AI.Deploy` + `Umbraco.AI.Prompt.Deploy` + `Umbraco.AI.Agent.Deploy` packages installed, every AI Connection, Context, Guardrail, Chat Profile, Embedding Profile, Prompt, Agent, and AI Setting saved in **Settings > AI** auto-serializes to a `umbraco-ai-*.uda` artifact under [src/UmbracoProject/umbraco/Deploy/Revision/](src/UmbracoProject/umbraco/Deploy/Revision/). Those artifacts flow through the same git → Umbraco Cloud pipeline as document types.

**Secrets stay per-environment**: `.uda` artifacts reference API keys via placeholders (e.g. `$OpenAI:ApiKey`, `$Anthropic:ApiKey`), never the raw value. Each Cloud environment (Development, Staging, Live) must have its own keys set in that environment's app settings via the Cloud portal — **never paste raw keys into the backoffice connection form** (they get encrypted to the DB and break on Data Protection key rotation).

**Cloud portal secret-key naming**: the portal's app-settings UI rejects `:` in key names (validator allows only `0-9 a-z A-Z _`). Use the .NET Core double-underscore convention — `Anthropic__ApiKey` / `OpenAI__ApiKey`. .NET Core flattens `__` back to `:` when building `IConfiguration`, so the backoffice connection references (`$OpenAI:ApiKey`) and `appsettings.Development.json` entries (`"OpenAI:ApiKey": "..."`) keep the colon form unchanged.

**Bootstrapping existing AI config into Deploy** (one-time, when adopting the Deploy packages on an established install): existing DB-only entities do **not** auto-export on package install — the serializer only writes on save. Open **Settings → AI** and click Save on every entity once, in this order (matches Deploy's dependency chain):

1. Connections → Contexts → Guardrails
2. Chat Profiles → Embedding Profiles
3. Prompts → Settings (default chat profile, default embedding profile)
4. Agents

Verify new `umbraco-ai-*.uda` files appear under `umbraco/Deploy/Revision/`. Before committing, grep the folder for raw secrets (`grep -rE '(sk-[A-Za-z0-9]{20,}|ANTHROPIC_)' src/UmbracoProject/umbraco/Deploy/Revision/`) to make sure only placeholder references are present. Run `/check-uda` for the usual schema-conflict pre-commit scan.

**What still needs manual per-environment work**: only the vector search index (see Search section below) — every AI entity, agents included, now flows through Deploy.

## Search

The site search at [src/UmbracoProject/Views/search.cshtml](src/UmbracoProject/Views/search.cshtml) uses the new **Umbraco.Cms.Search** framework (the v18-forward replacement for legacy Examine search — see the *v18 upgrade path* note under Pinned betas) with **Umbraco.AI.Search** layered on top for semantic/vector search.

### Architecture

Three packages cooperate at runtime, registered via [src/UmbracoProject/SearchComposer.cs](src/UmbracoProject/SearchComposer.cs):

- **`Umbraco.Cms.Search.Core`** — provides the `ISearcher` / `ISearcherResolver` abstractions used by the Razor view. Doesn't do indexing itself; it's the façade that routes queries to a registered provider.
- **`Umbraco.Cms.Search.Provider.Examine`** — Lucene/keyword provider. Used as a safety net for short, exact-match queries (author names, "contact", etc.) where pure-vector search underperforms.
- **`Umbraco.AI.Search`** — vector/semantic search on top of Core. Calls the configured embedding model to chunk + embed documents on publish and to embed the query at search time.

The public `/search` page is wired to the AI searcher; the Examine provider stays registered for hybrid fallback. **`AddBackOfficeSearch()` is intentionally NOT called** — in beta.3 it crashes the backoffice Media/Content list-view search box (`'field name' cannot be null or empty`), so those searches fall back to Umbraco 17's built-in Examine search. See the `Cms.Search.BackOffice` row in *Pinned betas* for the re-enable signal.

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

A small middleware in [src/UmbracoProject/Program.cs](src/UmbracoProject/Program.cs) (registered before `app.UseUmbraco()`) rewrites `/sitemap.xml` → `/xmlsitemap` internally. The existing `xMLSitemap` doc-type's template at [Views/xMLSitemap.cshtml](src/UmbracoProject/Views/xMLSitemap.cshtml) then renders the response via [Views/Partials/xmlSitemap.cshtml](src/UmbracoProject/Views/Partials/xmlSitemap.cshtml), wrapped in `Html.CachedPartialAsync(..., TimeSpan.FromMinutes(60))` and served with `Cache-Control: public, max-age=3600` for CDN/crawler edge-caching. The rewrite is internal — client-visible URL stays `/sitemap.xml`. Both `/sitemap.xml` and `/xmlsitemap` reach the same content node and serve identical bodies.

Why a rewrite and not a `SurfaceController` or `IContentFinder`? Both alternatives were tried and rejected:

- **SurfaceController**: the controller action can render the partial, but `IUmbracoContext` is disposed before the partial actually renders. The canonical workaround — `using UmbracoContextReference contextRef = _umbracoContextFactory.EnsureUmbracoContext()` — releases the context at the `using` block's end, which is when the action returns; the `PartialView` result executes *later* in MVC's pipeline, so `IPublishedContent.Url(mode:UrlMode.Absolute)` (and anything else that requires an active context) throws at render time.
- **IContentFinder**: Umbraco's content routing treats URLs with file extensions (`.xml`, `.txt`, etc.) as static-asset requests and filters them out before any `IContentFinder` runs. The finder never gets a chance to claim `/sitemap.xml`.

The rewrite sidesteps both: by the time Umbraco's routing sees the request, the path is `/xmlsitemap` (no extension) and resolves to the doc-type node through the normal pipeline, with `IUmbracoContext` active throughout. The comment in `Program.cs` documents the same.

### `/robots.txt` — static file

Served by ASP.NET Core's static-file middleware from [src/UmbracoProject/wwwroot/robots.txt](src/UmbracoProject/wwwroot/robots.txt). Edit it in-repo, deploy via the normal pipeline. The `Sitemap:` directive references Live's URL by convention (absolute URLs are required by the robots.txt spec) — Dev and local environments intentionally name Live's host too, since crawlers discover `/sitemap.xml` by convention regardless of which host the directive points at.

### 404s — `IContentLastChanceFinder`

[NotFoundContentFinder.cs](src/UmbracoProject/NotFoundContentFinder.cs) (registered via [NotFoundComposer.cs](src/UmbracoProject/NotFoundComposer.cs); both at the project root, **not** in a `Controllers/` folder) resolves unmatched URLs to the published `Error` doc-type node (alias `error`, expected as a direct child of `Home` alias `home`) and sets HTTP 404. Uses `IDocumentNavigationQueryService` (the v18-forward navigation API) to walk by doc-type alias rather than "first root node", so multi-root or reordered setups don't silently break.

**Static-asset 404s are NOT intercepted.** The `IContentLastChanceFinder` interface only fires when Umbraco's content routing has exhausted every `IContentFinder` without a match — which happens *after* ASP.NET's static-file middleware has already given up on `/media/...`, `/assets/...`, etc. Those still get the framework's plain 404.

The finder also has an explicit path-prefix guard that skips `/umbraco` and `/api/` requests — defense in depth so a future route registration that bypasses standard middleware order doesn't get an HTML error response on what should be a JSON 404.

### Rename-redirects — built-in URL Tracker

Umbraco's built-in URL Tracker is active (default; `Umbraco:CMS:WebRouting:DisableRedirectUrlTracking` is unset) and handles rename-redirects automatically without code — when a content node's URL changes, the old URL 301s to the new one for as long as the redirect entry exists in `umbracoRedirectUrl`.

## CI/CD & Build hygiene

The safety net that lets schema/structural refactors (e.g. moving ~60 Razor files) ship without a leap of faith. Four interlocking pieces: GitHub Actions running Umbraco Cloud CI/CD Flow, a `dotnet build`+xUnit pre-push hook, Playwright screenshot baselines pinned to Linux, and `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` across all C# projects.

### Cloud CI/CD Flow (two gates)

[.github/workflows/main.yml](.github/workflows/main.yml) is the orchestrator. It runs a **two-gate** pipeline on every push:

- **Gate 1 — `gate-1-build-test`** (every branch): `dotnet restore` → `dotnet build -c Release` → `dotnet test --no-build`. Runner-local; takes < 1 minute on a warm cache. Mirrors the local pre-push hook exactly so anything that slipped past the hook (or was skipped via `SKIP_PREPUSH=1`) still fails CI.
- **Gate 2 — Cloud sync → artifact → deploy to Dev → Playwright** (master only): the four jobs are guarded by `if: github.ref == 'refs/heads/master'` at the `main.yml` level. Feature branches stop at Gate 1.

The three Cloud jobs (`cloud-sync` / `cloud-artifact` / `cloud-deployment`) are reusable workflows under [.github/workflows/](.github/workflows/), mostly verbatim from the upstream Umbraco Cloud CI/CD Flow sample. The six bash scripts they call live under [.github/scripts/](.github/scripts/) — two of them carry local patches for upstream bugs (search the scripts for "Fixed locally:" to see the rationale).

`concurrency: ${{ github.ref }}` with `cancel-in-progress: true` is set at the `main.yml` workflow level — rapid pushes to the same branch cancel any in-flight runs.

### Master → Dev → manual promotion to Live

CI **never deploys to Live**. The `cloud-deployment` job's `targetEnvironmentAlias` is wired to Dev only. Promotion from Dev to Live (or via Staging if you add one later) is a human action via the Umbraco Cloud Portal, on whatever cadence makes sense.

This is deliberate: Live is the canonical content/media surface and shouldn't be redeployed every time master moves. A failed Playwright run on Dev gives you a chance to investigate without Live being affected.

### Content workflow under CI

Live is canonical for content; Dev is a periodic mirror via Cloud Portal **"restore from Live to Dev"**. The existing local → Live content-transfer habit (see [Media files](#media-files) for the parallel pattern with binaries) is preserved — local is still where you author content if you're not in the Live backoffice directly.

**Do not use local → Dev content transfers.** Dev's content lifecycle is "periodically re-mirrored from Live" — anything you push to Dev directly will get clobbered the next time someone restores. If you need Dev content to match a local edit, push the schema first via master, then content via Live, then restore Dev from Live.

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

The workflow runs Playwright with `--update-snapshots=all` against Dev (using the `URL` GitHub variable), then commits any new/changed PNGs back to the branch as `github-actions[bot]`. Two non-obvious requirements, both learned the hard way (`db1df8f` / `5d4cdb1`) and easy to re-break: Playwright 1.56+ needs an explicit **mode** on the flag (the bare `--update-snapshots` swallows the `testFilter` path as its mode arg), and the job must set `UMBRACO_BASE_URL: ${{ vars.URL }}` — `guides.spec.ts` drives the guide-generator CLI, which otherwise hits localhost and fails the run *before* the baseline-commit step. The default `testFilter` input is `tests/e2e/`, covering both block and page-template specs; pass a narrower path to regenerate a subset.

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

**Surgical `<NoWarn>` per warning code with inline justification is the only relaxation pattern.** No project-wide suppression of CS-prefixed warnings. The two NoWarn exemptions currently in the tree:

- `UmbracoProject.csproj` — `NoWarn=NU1903` (Lucene.Net.Replicator 4.8.0-beta00016, GHSA-2qw8-ppr5-m96c) — transitive via Umbraco.Cms.Search.Provider.Examine → Examine → Lucene.Net. Cannot pin a patched version without breaking Umbraco's locked Examine chain.
- `UmbracoProject.Tests.csproj` — `NoWarn=NU1903;NU1904` — same Lucene.Net inheritance plus `NU1904` Microsoft.AspNetCore.DataProtection 10.0.4 (GHSA-9mv3-2cwr-p262), pulled transitively into the test host via `Microsoft.NET.Test.Sdk`. Tests don't exercise those APIs.

Both exemptions have inline XML comments naming the CVE and the upgrade signal that should retire them. **Out of scope**: Razor `.cshtml` files (compile inside the runtime, not the csproj's `dotnet build`) and the auto-generated published-content models under `umbraco/Data/TEMP/InMemoryAuto/` (regenerated on startup).

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

When master's pipeline goes red, work through three questions in order: **which gate failed → which job inside it → was it failing before my commit?** Skipping straight to "fix the test" without answering all three is the habit that lets a perpetually-red gate become background noise.

The recipes for previously-seen failures live in the relevant feature doc (e.g. [_features/fix-e2e-dev-only-failures.md](_features/fix-e2e-dev-only-failures.md) → *Diagnosis & Fix Recipes*). The procedure below is the generic method — use it when you face a failure not already captured in a feature doc.

### 1. Which gate failed?

```bash
# List the last few runs on your branch; note the failing run id
gh run list --branch <branch> --limit 3

# For that run, show each job's conclusion and name
gh run view <run-id> --json jobs -q '.jobs[] | "\(.conclusion)\t\(.name)"'
```

Two gates exist (see [CI/CD & Build hygiene](#cicd--build-hygiene)):

- **Gate 1** (`gate-1-build-test`) runs on every branch — `dotnet build -c Release` + `dotnet test --no-build`. Failing here means the same thing the pre-push hook checks, so reproducing is one command: `cd src/UmbracoProject && dotnet build -c Release && dotnet test --no-build`.
- **Gate 2** (`cloud-sync` → `cloud-artifact` → `cloud-deployment` → `playwright-against-dev`) runs only on master pushes. Failures here split four ways, see the table below.

### 2. Which job inside the gate?

| Failure surface | First diagnostic next step |
|---|---|
| Gate 1 (build or test) | Reproduce locally with the commands above; the failure should be identical. If it isn't, check `dotnet --info` parity (CI uses the .NET SDK pinned by `global.json` if present). |
| `cloud-sync` (Gate 2) | Cloud's `.uda` sync produced a conflict or pushed normalized commits back. Run [/check-uda](.claude/commands/check-uda.md) locally; also `git fetch` to see if Cloud committed via `Umbraco Cloud <support@umbraco.io>`. |
| `cloud-artifact` (Gate 2) | The deploy artifact build failed inside Cloud's Kudu Lite container. See `[[project-cloud-no-wildcard-versions]]` and `[[project_cloud_build_no_npm]]` for the two most-common traps. |
| `cloud-deployment` (Gate 2) | Schema deploy hit a database conflict, or runtime Razor compile rejected something. Cloud Portal → Dev → Deploy log is the source of truth; `[[project_cloud_razor_honors_twae]]` covers the most-common CS-warnings-as-errors trap. |
| `playwright-against-dev` (Gate 2) | Read the actual error first (next subsection); then go to question 3. |

### 3. New or pre-existing?

For Playwright failures especially, distinguish "I broke this" from "this was already broken." A failure that's been red for 5 master pushes is structural — it shouldn't gate your PR, and acting like it does is how red becomes background noise. A failure that's new with your push is a real regression.

```bash
# The go-to command for actually reading the error (replace <job-id>)
gh run view --job <job-id> --log 2>&1 | grep -B 1 -A 5 "Error:" | head -50

# Compare against the previous master run — does the same test fail there too?
gh run list --branch master --limit 10
gh run view <previous-run-id> --json jobs -q '.jobs[] | select(.conclusion == "failure") | .name'
```

If the failure was already red on the previous master run, it's pre-existing. **File a ROADMAP entry under "Next" and unblock your work** — don't bundle a pre-existing infra/content issue into an unrelated feature PR. (The `fix-e2e-dev-only-failures` feature exists specifically because this hygiene was missing for several weeks.)

If the failure is new with your push, it's yours to fix — and likely deserves a `/spec` if non-trivial.

### Habituation avoidance

Every recurring red run without diagnosis is a broken-window signal. The cost compounds: the first ignored red costs zero, the tenth costs the team's faith in CI. Tools alone can't prevent this — the discipline is to (a) always run questions 1–3 before dismissing a red, and (b) file pre-existing failures as ROADMAP work rather than letting them sit. When in doubt, treat the feature doc's *Diagnosis & Fix Recipes* section as the durable record of "we already learned this lesson; here's the playbook."

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

**In CI** (the Gate 2 `playwright-against-dev` job in [.github/workflows/main.yml](.github/workflows/main.yml)) auth points at **Dev's URL, not localhost**, via the `URL` GitHub variable. `UMBRACO_CLIENT_ID` / `UMBRACO_CLIENT_SECRET` come from GitHub Secrets and must match an OAuth client registered on the Dev backoffice. See [CI/CD & Build hygiene > GitHub Secrets / Variables](#github-secrets--variables) for the full mapping.

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

**Token lifetime** — the 299-second expiry (see *Auth Setup* above) bites long-running scripts too: re-authenticate before each logical operation group, don't reuse one token across a whole multi-call `beforeAll`.

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

## Project Planning

- `_specs/` — feature specification documents (initial requirements, design rationale, open questions — the "why"). Shipped specs archive under `_specs/shipped/`.
- `_plans/` — implementation plans for features (TDD steps with paste-ready prompts — the "how"). Shipped plans archive under `_plans/shipped/`.
- `_features/` — living BDD-style behavioral specifications (current feature behavior as Given/When/Then scenarios — the "what")
- `_prds/` — optional PRDs for bodies of work spanning 3+ features (see *Workflow layers* above)
- `_audits/` — architecture audit reports produced by the `architecture-audit` skill. Dated filenames (`YYYY-MM-DD-<slug>.md`). Kept in git as historical baselines and as fixtures for skill-creator eval runs.

## Feature Behavioral Specs

- `_features/` contains one file per logical feature, using Given/When/Then scenario format grouped by `Rule:` headings
- **Source of truth** for what a feature does right now — used for QA regression testing and developer onboarding
- Draft scenarios are generated by `/spec`, verified/updated as the final step of every `/plan`
- Use `/feature` to generate or update a feature doc from specs, plans, and tests
- Follows BDD principles from `.claude/skills/BDD.md`: Example Mapping, Specification by Example, Ubiquitous Language
- `_specs/` remain as historical records of original requirements and design rationale

## Deployment

Deploys are wired through **GitHub Actions → Umbraco Cloud CI/CD Flow** — see [`## CI/CD & Build hygiene`](#cicd--build-hygiene) above for the full pipeline (two gates, master-only deploy to Dev, manual promotion to Live in the Cloud Portal). The `.umbraco` file at the repo root still tells Cloud which `.csproj` to build; it just isn't triggered by a direct git push to a Cloud remote anymore — GitHub Actions calls the Cloud CI/CD Flow API instead. Environment-specific config is in `appsettings.{Development,Staging,Production}.json`.

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
