# CI/CD & Build hygiene

The safety net that lets schema/structural refactors (e.g. moving ~60 Razor files) ship without a leap of faith. Four interlocking pieces: GitHub Actions running Umbraco Cloud CI/CD Flow, a `dotnet build`+xUnit pre-push hook, Playwright screenshot baselines pinned to Linux, and `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` across all C# projects.

## Cloud CI/CD Flow (two gates)

[.github/workflows/main.yml](../.github/workflows/main.yml) is the orchestrator. It runs a **two-gate** pipeline on every push:

- **Gate 1 — `gate-1-build-test`** (every branch): `dotnet restore` → `dotnet build -c Release` → `dotnet test --no-build`. Runner-local; takes < 1 minute on a warm cache. Mirrors the local pre-push hook exactly so anything that slipped past the hook (or was skipped via `SKIP_PREPUSH=1`) still fails CI.
- **Gate 2 — Cloud sync → artifact → deploy to Dev → search readiness gate → Playwright** (master only): the four jobs are guarded by `if: github.ref == 'refs/heads/master'` at the `main.yml` level. Feature branches stop at Gate 1. (`playwright-against-dev` runs a search readiness gate before Playwright — see *Post-deploy search readiness gate* below.)

The three Cloud jobs (`cloud-sync` / `cloud-artifact` / `cloud-deployment`) are reusable workflows under [.github/workflows/](../.github/workflows/), mostly verbatim from the upstream Umbraco Cloud CI/CD Flow sample. The six bash scripts they call live under [.github/scripts/](../.github/scripts/) — two of them carry local patches for upstream bugs (search the scripts for "Fixed locally:" to see the rationale).

`concurrency: ${{ github.ref }}` with `cancel-in-progress: true` is set at the `main.yml` workflow level — rapid pushes to the same branch cancel any in-flight runs.

## Post-deploy search readiness gate (between Dev deploy and Playwright)

`cloud-deployment` reports "finished" before Dev search actually *serves*, so the `playwright-against-dev` job runs [`.github/scripts/wait_for_search_warm.sh`](../.github/scripts/wait_for_search_warm.sh) (env `URL` only) right after checkout, *before* Playwright. It **polls `GET $URL/search` with a long/semantic query** (every 10s, budget `TOTAL_BUDGET` default **180s**) to exercise the **Healthy `UmbAI_Search` vector path** — not the fragile Examine keyword index, which routinely comes up corrupt after a deploy. It logs a **non-gating WARNING** if the keyword check (`q=article`) is down but opens the gate as soon as semantic search serves.

Load-bearing facts: (1) The gate **detects and fails fast; it does NOT self-heal** — if it fails within budget, semantic search itself is down (worse than keyword corruption: check `UmbAI_Search` health / embeddings — see the AI config-key allow-list note — then `gh run rerun <id> --failed`). (2) Routine post-deploy **keyword** corruption is non-gating but leaves short-query `/search` dead on Dev; the fix is a **Portal restart** (the dashboard "Rebuild" on `Umb_PublishedContent` fails, and don't touch the Healthy `UmbAI_Search`). Full forensics + the disproven theories: [CI Failure Recipes → cold AI.Search 500 cascade](ci-failure-recipes.md).

## Master → Dev → manual promotion to Live

CI **never deploys to Live**. The `cloud-deployment` job's `targetEnvironmentAlias` is wired to Dev only. Promotion from Dev to Live (or via Staging if you add one later) is a human action via the Umbraco Cloud Portal, on whatever cadence makes sense.

This is deliberate: Live is the production content/media surface and shouldn't be redeployed every time master moves. A failed Playwright run on Dev gives you a chance to investigate without Live being affected.

## Content workflow under CI

**Content flows local → Dev → Live**, riding the same pipeline as schema. You author content locally (local SQLite, preview locally first), transfer it *up* to Dev via the Cloud Deploy dashboard, verify it on the tested Dev environment, then promote it to Live. Because content follows the same local → Dev → Live path as the code, content that depends on new schema can't reach Live ahead of the code it needs — and everything (including MCP/Ella-authored content) is gated through the tested Dev environment before it lands on Live. The full by-hop discipline is the [content-transfer workflow runbook](content-transfer-workflow.md); the short version:

- **local → Dev**: root-queue freely. Low stakes — Dev already hosts CI fixtures and is the staging surface everything passes through.
- **Dev → Live**: selective / per-item by default. A root-level Dev → Live transfer is only safe **just after a green CI run with the test fixtures cleaned** — otherwise published `[E2E]`-prefixed fixtures can ride up to Live (the decisive test-content-pollution risk).
- **Live → Dev restores**: forbidden by default. A restore is overwrite-not-merge, so it clobbers any unpromoted content sitting on Dev. Live hotfixes are made upstream (local → Dev → Live) and re-promoted, or accepted as small drift.
- **Rule of thumb**: transfer WIP *up* before pulling anything *down* — Umbraco Cloud has no merge story for concurrent same-node edits anywhere.

**Media rides separately** — content transfers and restores do **not** carry media binaries; the separate media restore / `media:sync` step is still required (see [Media files](media.md)).

## Pre-push hook

[.githooks/pre-push](../.githooks/pre-push) runs `dotnet build -c Release` + `dotnet test --no-build` before each push. Enabled via `git config core.hooksPath .githooks` (see [README.md](../README.md) for the one-time setup).

On success, it prints `Pre-push OK — build: Xs, test: Ys, total: Zs` (whole seconds). Runtime budget is < 30s on a warm build.

To bypass:
- **Per-invocation (this hook only)**: `SKIP_PREPUSH=1 git push`.
- **Per-push (bypasses ALL git hooks, pre-commit included)**: `git push --no-verify`.
- **Persistent disable (this hook only)**: set `ENABLE_PREPUSH=false` in `.githooks.conf` (see [.githooks.conf.example](../.githooks.conf.example)). Setting `SKIP_PREPUSH=1` in your shell profile (`~/.zshrc`) achieves the same effect.

This replaced the previous opt-in AI-review pre-push hook. If you want AI review on a push, run the `/code-review` spell manually instead.

A smoke validator at [.githooks/test-pre-push.sh](../.githooks/test-pre-push.sh) exercises the hook's failure paths (build-fail / test-fail / skip flag) so future edits don't silently break the gating.

## Screenshot baselines

Playwright visual-regression specs live under [tests/e2e/blocks/screenshots/](../tests/e2e/blocks/screenshots/) (block components) and [tests/e2e/pages/](../tests/e2e/pages/) (page templates). Shared helpers in [tests/e2e/_helpers.ts](../tests/e2e/_helpers.ts) — `prepareForScreenshot`, `screenshotOptions`, `dynamicRegionMasks`, `discoverBlockOnPage`, `findNavLinkForTemplate`.

**Baselines are Linux-only.** macOS and Linux render fonts differently, so a baseline captured on a Mac will mismatch every time CI runs it. The `.gitignore` blocks `*-darwin.png` and `*-win32.png` to enforce this.

**Regenerating baselines**: trigger [.github/workflows/update-snapshots.yml](../.github/workflows/update-snapshots.yml) via the "Run workflow" button on the GitHub Actions UI, or:

```bash
gh workflow run update-snapshots.yml --ref <branch>
```

The workflow runs Playwright with `--update-snapshots=all` against Dev (using the `URL` GitHub variable), then commits any new/changed PNGs back to the branch as `github-actions[bot]`. The default `testFilter` input is `tests/e2e/`, covering both block and page-template specs; pass a narrower path to regenerate a subset. (The workflow's own setup gotchas — the explicit `--update-snapshots=all` mode Playwright 1.56+ needs, and the `UMBRACO_BASE_URL` env it must set — are recorded in `[[project_screenshot_baselines_never_committed]]`.)

**When to run**: first time you add a new screenshot spec (initial baseline), or after an intentional visual change where existing baselines are now correctly stale. Always review the resulting commit diff before merging. **A new screenshot spec with no committed baseline does not skip — it _fails_** every Gate 2 Playwright run until its PNG lands, and reads as "pre-existing red" (this is exactly how 26 specs sat red for weeks; see [Diagnosing a red CI run](ci-failure-recipes.md)). So after adding any spec, run this workflow and confirm the bot's baseline commit before moving on.

**When NOT to run**: as a "quick fix" for failing visual tests on master. Investigate the diff first — the failure may be a real regression.

**What the specs cover** (and don't): runs are all under `prefers-reduced-motion: reduce`. Motion-on variants, ARIA, alt text, heading levels, and keyboard behavior are **not** baseline-tested. Semantic regression coverage requires separate axe-core / role-assertion specs (not in this bundle). See the header of [tests/e2e/_helpers.ts](../tests/e2e/_helpers.ts) for the full scope statement.

Default tolerance is `maxDiffPixelRatio: 0.01` per block. Shim-equivalence specs (the four blockgrid → blocklist pass-through pairs: `alertBanner`, `iconLinkRow`, `imageRow`, `richTextRow`) override to `0` for byte-identical assertions. Dynamic regions (latestArticles card grid, timestamps) are masked via `dynamicRegionMasks(page)`.

## Warnings as errors + surgical NoWarn

All three C# projects have `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`:

- [src/UmbracoProject/UmbracoProject.csproj](../src/UmbracoProject/UmbracoProject.csproj)
- [src/HelloWorld/HelloWorld.csproj](../src/HelloWorld/HelloWorld.csproj)
- [tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj](../tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj)

`<Nullable>enable</Nullable>` is on the same projects, so any new nullable-reference-type warning fails the build (and therefore Gate 1 and the pre-push hook).

**Surgical `<NoWarn>` per warning code with inline justification is the only relaxation pattern.** No project-wide suppression of CS-prefixed warnings. The NoWarn exemptions currently in the tree — each a transitive advisory that can't be pinned without breaking a locked dependency chain, carrying an inline XML comment naming the advisory + the upgrade signal that retires it:

- **`NU1902`** — AngleSharp 1.4.0 (GHSA-pgww-w46g-26qg, moderate) — transitive via `SmartReader 0.11.0` → AngleSharp. On **all three** C# projects (`UmbracoProject`, `UmbracoProject.Features`, `UmbracoProject.Tests`). Added 2026-07-20: when the advisory landed, NuGet audit failed `dotnet restore` under TWAE across the board (Gate 1 red on a docs-only merge — the advisory, not the change). SmartReader is transitive itself, so pinning AngleSharp risks that chain. Retire when SmartReader (or its parent) bumps to a patched AngleSharp.
- **`NU1903`** — Lucene.Net.Replicator 4.8.0-beta00017 (GHSA-2qw8-ppr5-m96c, high) — transitive via Umbraco.Cms.Search.Provider.Examine → Examine → Lucene.Net. On `UmbracoProject`, `UmbracoProject.Features`, and `UmbracoProject.Tests`. Cannot pin without breaking Umbraco's locked Examine chain. Retire when Umbraco upgrades Examine past that Lucene.Net.
- **`NU1904`** — Microsoft.AspNetCore.DataProtection 10.0.4 (GHSA-9mv3-2cwr-p262, critical) — transitive into the test host via `Microsoft.NET.Test.Sdk`. `UmbracoProject.Tests` only; those APIs are never exercised in tests. Retire when the Test SDK upgrades past it.
- **`CS8600;CS8602;CS8603;CS8604`** — pre-existing nullable-reference warnings across ~22 views on `UmbracoProject` only (not a security advisory); incremental cleanup tracked in ROADMAP `arch-view-nullable-hardening`.

**Out of scope**: Razor `.cshtml` files (compile inside the runtime, not the csproj's `dotnet build`) and the auto-generated published-content models under `umbraco/Data/TEMP/InMemoryAuto/` (regenerated on startup).

## GitHub Secrets / Variables

The pipeline reads CI auth from GitHub Secrets and non-sensitive routing info from GitHub Variables. AI API keys are **not** here — they live in Umbraco Cloud Secrets Management on Dev (see below).

| GitHub kind | Name | Source / purpose |
|---|---|---|
| Secret | `UMBRACO_CLOUD_API_KEY` | Cloud Portal → Configuration → CI/CD Flow (project-wide). Authenticates `cloud-sync` / `cloud-artifact` / `cloud-deployment`. |
| Secret | `UMBRACO_CLIENT_ID` | Dev backoffice OAuth client. Used by Playwright's `tests/e2e/auth.setup.ts` against Dev. |
| Secret | `UMBRACO_CLIENT_SECRET` | Dev backoffice OAuth client secret (matched to `UMBRACO_CLIENT_ID`). |
| Variable | `PROJECT_ID` | Cloud project ID. Non-sensitive — passed as a workflow input to the reusable Cloud workflows. |
| Variable | `TARGET_ENVIRONMENT_ALIAS` | Cloud environment alias for Dev (typically `development`). Controls which environment `cloud-deployment` targets. |
| Variable | `URL` | Dev's URL (e.g. `https://<project-slug>.umbraco.io/`). Read by Playwright auth setup as `process.env.URL` and by the curl sanity check in Gate 2. |

The comment header at the top of [.github/workflows/main.yml](../.github/workflows/main.yml) is the source of truth for this mapping — keep it in sync with this table if names ever change.

## AI keys live on Cloud Dev, NOT in GitHub Secrets

Anthropic and OpenAI keys (`ANTHROPIC__APIKEY`, `OPENAI__APIKEY` — Cloud Portal's double-underscore form, see [AI & Copilot](ai-copilot.md) → "Cloud portal secret-key naming") are set in **Umbraco Cloud Secrets Management** on the Dev environment via the Cloud Portal, referenced by `.uda` artifacts as `$OpenAI:ApiKey` / `$Anthropic:ApiKey` placeholders just like Live and local.

**Never put AI keys in GitHub Secrets.** GitHub Actions doesn't touch the running Umbraco app at runtime — the deployed Dev environment reads its own Cloud Secrets Management entries directly. Putting keys in GitHub would just create another sync surface to drift.

The two Live/Staging environments (if they exist) each have their own Cloud Secrets Management slot for these keys, set per-environment via the Cloud Portal — see the existing [AI & Copilot](ai-copilot.md) and [Search > Umbraco Cloud deploys](search.md#umbraco-cloud-deploys) subsections for the full per-environment ritual.
