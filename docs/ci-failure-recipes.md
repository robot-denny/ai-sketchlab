# CI Failure Recipes

Durable diagnosis-and-fix playbooks for previously-seen CI failures. This is a **runbook**, not a feature behavioral spec — it records "we already learned this lesson; here's the playbook" so future contributors don't re-derive a dead end or habituate to a red pipeline.

- The **generic method** for any red run (which gate → which job → new or pre-existing?) lives in [CLAUDE.md → "Diagnosing a red CI run"](../CLAUDE.md#diagnosing-a-red-ci-run).
- The **per-failure recipes** below are the specific cases seen so far. Each captures the failure signature, the *actual* root cause (not the initial hypothesis where they differ), the verification command, the fix, and why it can recur.

> History: these recipes were authored during the `fix-e2e-dev-only-failures` work (2026-05-29) — see `_specs/shipped/fix-e2e-dev-only-failures.md` for that effort's spec and acceptance criteria. They were relocated here from the former `_features/fix-e2e-dev-only-failures.md` on 2026-06-16, when that transition-style feature doc was retired (the `_features/` folder is reserved for evergreen capability behavior, not records of fix work).

---

## Recipes

Per-failure playbooks for the originally-named 5 Dev-only failures.

### imageGenerator — Dev returns `success: false`

**Failure signature** — `tests/e2e/imageGenerator/dashboard.spec.ts:141` reports the generate endpoint returned 200 with `{ success: false, output: "Failed to launch image generator: ..." }` or `{ success: false, output: "...OpenAI..." }`.

**Original hypothesis (wrong, captured for posterity)** — Dev's `OPENAI__APIKEY` Cloud Secret is unset/invalid, so the CLI's OpenAI embedding call 401s.

**Actual root cause stack** (discovered 2026-05-29): four layered blockers, all in front of the OpenAI key.

1. **Worker PATH lacks modern Node.** Cloud Dev's Azure App Service Windows container only has `C:\Program Files (x86)\nodejs\0.10.28\` on the worker's PATH. No `npx`. `WEBSITE_NODE_DEFAULT_VERSION` is unset. Modern Node versions (10.x–24.x including 22.22.2 matching local) live at `C:\Program Files\nodejs\<version>\` but aren't reachable without `ImageGenerator__NodeBinPath` pointing there.
2. **[CliImageGenerator.cs:73](../src/HelloWorld/CliImageGenerator.cs#L73) is Unix-shaped.** Candidate probe is `Path.Combine(nodeBinPath, "npx")` — no `.cmd`/`.exe` extension. On Windows the actual binary is `npx.cmd`, so `File.Exists` always fails, and the controller falls back to bare `"npx"` on PATH (still missing).
3. **`scripts/image-generator/node_modules/` likely not deployed.** Gitignored, and Cloud's CI/CD pipeline doesn't run `npm install` (see `[[project_cloud_build_no_npm]]`). Even with Node available, `npx tsx ...` can't resolve `tsx` from a non-existent local `node_modules`.
4. **`OPENAI__APIKEY` Cloud Secret.** The original suspected gap — set on Dev 2026-05-29; actual state can't be verified from the test until 1–3 are fixed.

**Verification command** (read-only path check + write-shaped generate probe; expect Win32 launch error today, `success: true` once shipped):

```bash
DEV_URL="https://dev-umbraco-17-demo-site.useast01.umbraco.io"
TOKEN=$(curl -sk -X POST "$DEV_URL/umbraco/management/api/v1/security/back-office/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=$UMBRACO_CLIENT_ID&client_secret=$UMBRACO_CLIENT_SECRET" \
  | jq -r .access_token)
ARTICLE_ID=$(curl -sk -H "Authorization: Bearer $TOKEN" \
  "$DEV_URL/umbraco/api/image-generator/articles" | jq -r '.[0].id')
curl -sk -X POST -H "Authorization: Bearer $TOKEN" \
  "$DEV_URL/umbraco/api/image-generator/generate/$ARTICLE_ID?force=true" | jq .
```

**Fix step** — *deferred to `_specs/cloud-image-generator-launch-path.md`* (ROADMAP entry filed 2026-05-29). Real fix requires (a) Windows-compat patch in `CliImageGenerator`, (b) `node_modules` deployment strategy, (c) `ImageGenerator__NodeBinPath` Cloud App Setting on Dev (and Live when promoting). In the meantime, `dashboard.spec.ts:141` is `test.skip`-ed on Cloud URLs (`API_BASE` matches `/.umbraco.io/i`) with a comment pointing at the spec. Local dev still exercises the test.

**Why this recurs** — three independent surfaces (code, deploy artifact, Cloud App Settings) all need to stay in sync. If any one regresses (Node version pinned to a path that gets GC'd; node_modules dropped from artifact; App Setting cleared during a portal refactor) the launch path breaks again. The recipe should be hit before assuming "OpenAI key" the next time this fails.

**Lesson — what the original spec missed** — the spec assumed a single-layer root cause based on the recipe pattern from other Cloud-secret incidents. Always run the curl probe and read the actual error message *before* committing to a hypothesis. The controller's diagnostic string (`"Failed to launch image generator..."`) is specific enough to distinguish launch failures from API-key failures from CLI-internal failures.

### guides-cli — Dev CLI hits localhost instead of Dev

**Failure signature** — 3+ tests in [tests/e2e/guides-cli.spec.ts](../tests/e2e/guides-cli.spec.ts) fail on Dev. The CLI prints `ECONNREFUSED` or `connect EINVAL ::1:44367` (or similar localhost-targeted error) before any Umbraco interaction. The test's own `fetch` calls against Dev work fine; it's the CLI subprocess that fails.

**Original hypothesis (wrong, captured for posterity)** — Dev's guide-generator OAuth client is missing, expired, or scope-insufficient.

**Actual root cause** (discovered 2026-05-29): **env-var name mismatch between the test and the CLI.**

- The test reads `process.env.URL` for its own `API_BASE` ([guides-cli.spec.ts:17](../tests/e2e/guides-cli.spec.ts#L17)).
- The CLI reads `process.env.UMBRACO_BASE_URL` (or a fallback `.env` file) for its base URL — both in [scripts/guide-generator/src/umbracoApi.ts:39](../scripts/guide-generator/src/umbracoApi.ts#L39) and [scripts/guide-generator/src/agentClient.ts:39](../scripts/guide-generator/src/agentClient.ts#L39).
- CI's Playwright job ([.github/workflows/main.yml:155-159](../.github/workflows/main.yml#L155-L159)) sets `URL` and `UMBRACO_URL` but **not `UMBRACO_BASE_URL`**. The CI runner has no `.env` file (it's gitignored). The CLI therefore falls back to its hardcoded default `https://localhost:44367` and tries to hit a non-existent host.

OAuth client, scopes, Guides parent, `How-To Guide Page` doc type, and the `how-to-guide-writer` AI Agent (with its Anthropic connection) are all healthy on Dev. The original spec's hypothesis was based on a 401 assumption that never materialized.

**Verification command** (read-only — confirm Dev's infra is healthy):

```bash
DEV_URL="https://dev-umbraco-17-demo-site.useast01.umbraco.io"
TOKEN=$(curl -sk -X POST "$DEV_URL/umbraco/management/api/v1/security/back-office/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=$UMBRACO_CLIENT_ID&client_secret=$UMBRACO_CLIENT_SECRET" \
  | jq -r .access_token)
# Token len > 0 + 200 on the next tree call ⇒ OAuth + scopes are fine.
curl -sk -H "Authorization: Bearer $TOKEN" \
  "$DEV_URL/umbraco/management/api/v1/tree/document/root?skip=0&take=20" | jq '.items[].name'
```

**Fix step** — one-line YAML change in [.github/workflows/main.yml:155-159](../.github/workflows/main.yml#L155-L159) Playwright env block:

```yaml
env:
  URL: ${{ vars.URL }}
  UMBRACO_URL: ${{ vars.URL }}
+ UMBRACO_BASE_URL: ${{ vars.URL }}    # guide-generator CLI reads this name
  UMBRACO_CLIENT_ID: ${{ secrets.UMBRACO_CLIENT_ID }}
  UMBRACO_CLIENT_SECRET: ${{ secrets.UMBRACO_CLIENT_SECRET }}
```

**Local verification command** (simulates post-fix CI):

```bash
DEV_URL="https://dev-umbraco-17-demo-site.useast01.umbraco.io/"
URL="$DEV_URL" UMBRACO_BASE_URL="$DEV_URL" UMBRACO_URL="$DEV_URL" \
  PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" \
  npx playwright test tests/e2e/guides-cli.spec.ts --project=e2e
```

Verified 2026-05-29: 9/9 pass in ~2 minutes (the full spec, not just the originally-named 3).

**Why this recurs** — the codebase has at least three names in flight for the same concept (Dev/local base URL): `URL`, `UMBRACO_URL`, `UMBRACO_BASE_URL`. Any new script that reads a different name silently goes to localhost on the CI runner. Long-term: unify on a single env var (probably `URL`, since CI's GitHub Variable is named that). For now, the workflow's env block needs to enumerate every alias the scripts read.

**Lesson — what the original spec missed** — the spec assumed an OAuth-shaped failure (401 from token, or 403 from API) without doing a read-only probe to verify. The actual failure mode is an outbound connection refusal *before* OAuth is ever attempted. Lesson generalizes: when the failure is localized to one of two clients (test vs. CLI) calling the same backend, suspect env-var divergence between them before blaming the backend.

### imageCarousel — Dev media missing alt text (Live also affected)

**Failure signature** — [tests/e2e/blocks/imageCarousel.spec.ts:742](../tests/e2e/blocks/imageCarousel.spec.ts#L742) fails on Dev with:

```
Expected pattern: /.+/
Received string:  ""
locator resolved to <img alt="" loading="eager" class="d-block w-100" src="/media/bj5gpm45/codegarden-keynote.jpg"/>
```

If the 5-second wait window is long enough for the carousel to auto-advance, the trace also shows the next slide(s) — useful because the same media items light up across multiple test runs (e.g. `codegarden-keynote.jpg` + `say-cheese.jpg`), which is the brittleness signal.

**Original hypothesis (partly wrong)** — Dev's media records are out of sync with Live; a Live→Dev restore is the entire fix.

**Actual root cause** (discovered 2026-05-29): **both Live and Dev had empty `altText` on the affected images**, so restoring from Live didn't help — Live was equally broken. Plus a test-design wrinkle: the test picks the first images by depth-first tree-walk order ([imageCarousel.spec.ts:337](../tests/e2e/blocks/imageCarousel.spec.ts#L337)) rather than a known seeded media item. Any future media upload that lands "first" in tree-walk order will re-break the assertion, even after this fix.

`Clean.Core.Extensions.GetAltText()` (Clean.Core 7.0.5) reads the media's `altText` property and returns `""` if unset — no Name fallback. So an editor who skipped Alt Text in the Media editor produces an `<img alt="">` in the carousel, which fails the assertion AND is a real accessibility bug.

**Verification command** (read-only — confirm both images have non-empty `altText`):

```bash
DEV_URL="https://dev-umbraco-17-demo-site.useast01.umbraco.io"
TOKEN=$(curl -sk -X POST "$DEV_URL/umbraco/management/api/v1/security/back-office/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=$UMBRACO_CLIENT_ID&client_secret=$UMBRACO_CLIENT_SECRET" \
  | jq -r .access_token)
# First two images by tree-walk order — adjust IDs if media tree changes
for ID in 0521b485-98b6-409d-ad35-8745f3e4287c 13e63ebb-2f82-4e65-84f0-e3b79241a971; do
  curl -sk -H "Authorization: Bearer $TOKEN" \
    "$DEV_URL/umbraco/management/api/v1/media/$ID" \
    | jq '{name: .variants[0].name, altText: (.values[] | select(.alias == "altText") | .value)}'
done
```

Both `altText` values should be non-empty descriptive strings. If `.altText` is `null` or absent from the `values` array, the media has no alt text — and the test will fail.

**Fix step** — per `[[project_content_authoring_direction]]`, content fixes flow local → Live → Dev:

1. Open the local Umbraco backoffice → Media → set Alt Text on the affected media items (at minimum the first two by tree-walk order; ideally all of them as a content-policy improvement). Publish.
2. Local → Live content transfer via the Deploy dashboard.
3. Cloud Portal → Live → restore content + media to Dev.
4. Re-run verification command above.

**Verified 2026-05-29**: 50/50 imageCarousel tests pass on Dev (~31s) after the content transfer + restore landed.

**Why this recurs** — **two distinct failure modes** under the same symptom:

1. *Content drift*: an editor uploads a new media item without alt text, OR existing alt text gets cleared. As long as the failing media is in the "first 3 by tree-walk order" zone, the test fails. The "first 3" set is unstable — any media reshuffle changes which items it picks.
2. *Cross-environment drift*: editing alt text on Live but skipping the media restore to Dev (content restore alone doesn't pull binaries OR property edits to Dev's pre-existing records — see [Media files](../CLAUDE.md#media-files) in CLAUDE.md).

**Followup ROADMAP entry**: `fix-imagecarousel-first-image-picker` — make the test deterministic (seed a known media item with known altText, or set altText in `beforeAll` with restoration in `afterAll`). Captured 2026-05-29.

**Lesson — what the original spec missed** — assumed Live was a usable "source of truth" without probing Live's actual content. Always verify the suspected source environment matches the desired end state BEFORE planning a restore as the fix. And: when a test passes locally but fails on Dev+Live, suspect a local-only content drift (someone set the alt text locally but never pushed up) more than a Live→Dev sync gap.

### cold AI.Search — `POST /document` 500 cascade after a Dev deploy

**Failure signature** — `playwright-against-dev` goes red with ~9 failures. The primary tell is a cluster of fixture-creation failures: `POST /document` returns `500 "Unknown error"` in test `beforeAll`/setup blocks (spread across `search`, `search.screenshot`, `articleCardMetaDescription`, `ellaBlockAttribution`, `experiments.blockgrid`, `guides-cli`, `sectionNavigation`), followed by downstream `toBeVisible` / locator-resolution timeouts on the pages that depended on those never-created fixtures. The failures look scattered across unrelated specs, but they share one upstream cause.

**Root cause** — After a Gate 2 deploy to Dev, the **Examine keyword index `Umb_PublishedContent` comes up CORRUPTED** (beta.9 `Provider.Examine` fragility — *"The index was locked and could not be unlocked"*). The public `/search` is **hybrid**: SHORT queries run the **keyword** index (`Umb_PublishedContent`); LONG natural-language queries run the **AI vector** index (`UmbAI_Search`). `UmbAI_Search` stays **Healthy** across deploys (~179 docs), so semantic search keeps working — but the corrupt keyword index returns 0 for short queries. `AI.Search` also hooks the publish pipeline, so `POST /document` throws `500` while the search subsystem is unhealthy — and Playwright creates fixtures via `POST /document`, cascading into ~7-9 misleading failures.

**Diagnostic tell** — SHORT/keyword queries return 0 while LONG/semantic queries return results:

```bash
DEV_URL="https://dev-umbraco-17-demo-site.useast01.umbraco.io"
curl -sk "$DEV_URL/search?q=article" | grep -c 'article-grid-card'                       # SHORT/keyword → 0 when corrupt
curl -sk "$DEV_URL/search?q=what%20can%20AI%20teach%20us" | grep -c 'article-grid-card'  # LONG/semantic → >0 (Healthy)
```

Confirm in the backoffice: **Settings → Search** shows `Umb_PublishedContent` **Corrupted** (or **Empty** after a failed rebuild) while `UmbAI_Search` is **Healthy**.

**THE FIX — restart Dev from the Cloud Portal.** On boot the app rebuilds the Examine indexes cleanly and keyword `/search` serves within a few minutes (verified 2026-07-06: post-restart `q=article` 0 → 10). CI can't restart (the Cloud CI/CD Flow API has no restart endpoint), so the gate fails fast and a human restarts + reruns.

**⚠️ Do NOT use the dashboard "Rebuild" on `Umb_PublishedContent`** — it fails: the row goes Corrupted → **Empty** and the detail view shows *"A fatal server error occurred."* (beta.9 can't rebuild the corrupt index in place). Only a restart rebuilds it cleanly.

**⚠️ Two earlier theories were WRONG — recorded so we don't loop back:**
- *"Rebuild `UmbAI_Search` self-heals it"* (run `28539245107`) targeted the **wrong index** — `UmbAI_Search` is Healthy; the corrupt one is `Umb_PublishedContent`. Removed.
- *"It self-warms, just wait ~20-30 min"* was a **confounded** 2026-07-02 reading (Dev had been logged into during the window). **Disproven 2026-07-06:** a clean deploy sat cold **90+ min untouched**; only a restart fixed it.

**What the gate does (detect + fail-fast)** — [`.github/scripts/wait_for_search_warm.sh`](../.github/scripts/wait_for_search_warm.sh), before the Playwright step, polls `GET $URL/search` with a **long/semantic query** (`$PROBE_QUERY`, default *"what can AI teach us about ethics and humanity"*) for the `article-grid-card` marker — deliberately exercising the **Healthy `UmbAI_Search` vector path**, not the fragile keyword index (changed 2026-07-06). Serves → gate opens. Never serves within the budget → **fails fast, does NOT launch Playwright**. It also runs a one-shot **non-gating** keyword check (`q=article`) and logs a WARNING if keyword search is down — so routine post-deploy keyword corruption is *visible but no longer blocks CI*. A gate FAILURE now means **semantic** search is down (UmbAI_Search unhealthy / query-time embeddings failing / broken deploy) — a worse, rarer condition than keyword corruption.

**When the gate fails** (`did not serve within …`): **restart Dev from the Portal**, confirm `curl -s "$DEV_URL/search?q=article" | grep -c article-grid-card` returns `> 0`, then `gh run rerun <run-id> --failed` (re-runs only Playwright; deploy jobs already succeeded, so it won't re-deploy and re-cold the app).

**Verification** — root cause + remedy confirmed on run `28811260310` (2026-07-06): keyword `/search` dead (`article`=0) while semantic (`what can AI teach us`)=18; `Umb_PublishedContent` shown **Corrupted** in Settings → Search; dashboard rebuild failed (→ Empty + fatal error); **Portal restart** rebuilt it (`article` 0 → 10); `--failed` rerun then passed gate + Playwright green.

**Why this recurs / durable fix** — every master deploy re-corrupts the Examine keyword index (beta.9 fragility). **DONE (2026-07-06):** the gate now probes the semantic path, so this **no longer fails CI** — keyword corruption is logged, non-gating. Keyword search on Dev is still broken until a Portal restart (the manual remedy if you actually need short-query search there). Remaining durable options: (b) make `/search` + fixture creation resilient to a corrupt keyword index, and (c) move to a **stable `Provider.Examine`** at the v18 upgrade — the real root fix (pinned at beta.9 only because no stable exists). `.github/scripts/measure_search_warmup.sh` remains useful to confirm a deploy is/isn't recovering.

**Why this recurs** — every master merge triggers a fresh Dev deploy; the search indexes come up cold and take ~20-30 min to hydrate (not controllable from CI). The gate makes the *cold window* deterministic and legible; the standing remedy is **wait-then-rerun**. To eliminate the manual rerun, the options are (a) raise the gate budget to the measured warm-up time (slow: ~30 min runner time per master run), or (b) make Playwright fixture creation resilient to the cold window so no long gate is needed — tracked as follow-up.

**v18-upgrade revisit** — the `Umbraco.Cms.Search` / `AI.Search` stack is still beta (core integration lands ~v19; see the `deps-ai-search-version-realignment` ROADMAP item). On the v18 upgrade, re-verify on the new version: (a) whether cold-serving still happens at all, (b) whether a real CI-reachable warm/restart lever appears, and (c) that this gate's readiness marker (`article-grid-card`) and the `/search` path are still correct.

---

### stale screenshot baseline — `toHaveScreenshot` size/pixel mismatch after an intentional visual change

**Failure signature** — `playwright-against-dev` goes red with **one** (or a few) failing tests, all `toHaveScreenshot`, e.g. `Error: expect(locator).toHaveScreenshot(expected) failed — Expected an image 754px by 1020px, received 754px by 1197px. Snapshot: typographyShowcaseBlock.png`. **Gate 1 and all deploy jobs succeed** — only the Playwright job fails. Crucially it is a **size/pixel mismatch naming a specific `*.png` baseline**, not a cluster of `POST /document` 500s.

**Root cause** — an intentional CSS/markup change (new element, changed spacing, a restyle) altered what a screenshotted block or page renders, so the committed **Linux** baseline under `tests/e2e/**/*-snapshots/*` is now correctly *stale*. This is a real diff, **not** a flake and **not** the Examine cascade.

**Diagnostic tell — how to tell this apart from the [cold AI.Search cascade](#cold-aisearch--post-document-500-cascade-after-a-dev-deploy):**

| | Stale baseline | Cold AI.Search cascade |
|---|---|---|
| Failing tests | 1–few, all `toHaveScreenshot` | ~7–9, clustered `POST /document` 500 in `beforeAll` + downstream timeouts |
| Error text | "Expected an image WxH, received WxH′" naming a `.png` | `500 "Unknown error"`, locator/`toBeVisible` timeouts |
| `/search?q=article` on Dev | fine (`> 0`) | `0` (keyword index corrupt) |
| Does a **Dev restart** fix it? | **No** — it's a pixel diff, not an index | Yes — restart rebuilds the Examine index |
| Does `gh run rerun --failed` fix it? | **No** — re-runs the same mismatch | Yes, *after* a restart |

If a restart + rerun "failed a second time" on a screenshot test, it's this recipe, not the cascade.

**THE FIX — regenerate the baseline on Linux, then dispatch a fresh run.** Two steps, and both matter:

```bash
# 1. Regenerate ONLY the affected baseline against Dev (narrow the filter so
#    unrelated baselines aren't touched). Commits the new PNG to master as
#    github-actions[bot].
gh workflow run update-snapshots.yml --ref master \
  -f testFilter=tests/e2e/blocks/screenshots/typographyShowcaseBlock.screenshot.spec.ts

# 2. Dispatch a fresh pipeline on master HEAD to verify (see gotcha below).
gh workflow run main.yml --ref master
```

**⚠️ Gotcha — the baseline commit does NOT auto-trigger CI.** The `update-snapshots` job pushes with the default `GITHUB_TOKEN`, and GitHub suppresses workflow runs for `GITHUB_TOKEN` pushes (recursion guard). So master will *not* re-run on its own — you must `gh workflow run main.yml --ref master` (main.yml has `workflow_dispatch`, and dispatching on `master` satisfies the `github.ref == master` guard so Gate 2 runs).

**⚠️ Do NOT `gh run rerun <failed-run>`** to verify — a `push`-triggered run re-checks-out its original SHA (the pre-baseline commit), so it just fails again. You need a *new* run on the commit that contains the regenerated baseline.

**⚠️ Do NOT regenerate as a reflex** — confirm the diff is an *intended* visual change first (review the `received` image / the size delta against what you changed). A size change you can't explain may be a real regression; see the "WHEN NOT TO RUN" header in [update-snapshots.yml](../.github/workflows/update-snapshots.yml).

**Verification** — run `29162152715` (2026-07-11, `blog-content-styles` merge): single failure, `typographyShowcaseBlock.png` 1020 → **1197px** tall after a `.pull-quote-accent` demo `<p>` was added to the showcase block; `article.png` and all other screenshots passed (no unintended drift). Regenerated via `update-snapshots.yml` (bot commit `aa13c5e`); dispatched `main.yml` (`29163813003`) → Playwright green. A Dev restart + `--rerun` beforehand had failed twice, confirming the restart path is the wrong lever here.

**Why this recurs** — any intentional restyle/markup change to a block or page that has a committed screenshot baseline. Baselines are Linux-only (macOS/Windows PNGs are `.gitignore`d), so they can only be regenerated on the runner, never locally. The standing habit: after landing a screenshot-affecting change, regenerate its baseline and dispatch a verify run — don't wait for the red to surprise you (see [CLAUDE.md → Screenshot baselines](../CLAUDE.md#screenshot-baselines)).

### guides-cli — `Error: Agent request failed: 500` (live AI agent, cold Dev runtime)

**Symptom:** Gate 2 `Playwright (against Dev)` — Gate 1 green, deploy green, ~296 specs pass, but the two live-agent groups in [tests/e2e/guides-cli.spec.ts](../tests/e2e/guides-cli.spec.ts) (`guide create-fresh`, `guide skip / amend`) fail with `Error: Agent request failed: 500`, repeated across retries. The search-readiness gate passes (semantic search serves), so the AI *connection/embeddings* are fine — it's the agent-*run* (LLM) endpoint 500ing.

**Cause:** those groups drive the guide-generator CLI, which calls a live Umbraco AI agent to write/amend guide copy. After a Dev deploy the AI *agent runtime* can come up cold/unhealthy (same family as the cold-AI.Search cascade above, which the readiness gate only covers for *search*). A live-LLM dependency is non-deterministic and unfit for a required gate.

**Fix (durable, shipped 2026-07-20):** both agent-dependent groups now **self-skip against Cloud/Dev** (`RUNS_AGAINST_CLOUD = (process.env.URL ?? '').includes('umbraco.io')`) — they still run locally against a healthy agent, and the deterministic coverage (Vitest unit tests for `sourceSignature` + the SSE parser, and the `guide --audit` group) stays gating everywhere. So this should no longer redden master.

**If you still see it** (locally, or a future un-skip): it's the Dev AI runtime, not the code — check Dev → Settings → AI (agent/connection health, `$Anthropic`/`$OpenAI` keys in Cloud Secrets, the config-key allow-list), and a Portal restart rehydrates the AI runtime (like the search cold case). Do NOT chase it as a guide-generator regression — the deterministic wiring is unit-tested.

**Further follow-up:** mock the agent, or gate on a healthy-agent probe (like `keywordSearchAvailable` for search), so these can run in CI deterministically.
