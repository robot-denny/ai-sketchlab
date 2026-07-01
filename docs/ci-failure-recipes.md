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

**Root cause** — `Umbraco.AI.Search` comes up **cold** after a Gate 2 deploy to Dev. `cloud-deployment` reports "finished" before the deployed app is actually *serving* search: the vector data survives the deploy (`documentCount` stays ~179), but the searcher isn't hydrated yet. Because `AI.Search` hooks the publish pipeline to embed each document, every `POST /document` throws `500` while the embedding path is cold — and Playwright creates its fixtures via `POST /document`, so one cold subsystem cascades into ~9 misleading test failures.

**Diagnostic tell** — `GET $URL/search?q=article` returns **HTTP 200 but the body says "No matches"** (cold), instead of containing an `article-grid-card` marker (serving). This distinguishes a cold subsystem from an empty index — the vector data is present, the searcher just isn't serving from it yet.

```bash
DEV_URL="https://dev-umbraco-17-demo-site.useast01.umbraco.io"
# "No matches" in the body ⇒ cold (data intact, searcher unhydrated); an
# `article-grid-card` in the body ⇒ serving.
curl -sk "$DEV_URL/search?q=article" | grep -c 'article-grid-card'
```

**This is a cold subsystem, NOT an empty index.** For a **human** the correct move is to **restart Dev from the Cloud Portal** — do **not** rebuild the index (the data is fine; a rebuild is churn a restart avoids). CI, however, has **no restart lever**: the Cloud CI/CD Flow API exposes deployment/artifact endpoints only, so restart is Portal-only. The CI-automatable equivalent of the human "restart" is therefore a **Management API `UmbAI_Search` rebuild**, which rehydrates the serving searcher to the same end state.

**Fix (now automated in CI)** — the warm-up gate [`.github/scripts/wait_for_search_warm.sh`](../.github/scripts/wait_for_search_warm.sh), wired into `playwright-against-dev` (it replaced the old "Sanity check Dev is up" home-page curl, and runs *before* the Playwright step), self-heals this: it polls `GET $URL/search?q=article` for the `article-grid-card` serving marker; if still cold after a 60s passive grace it fires **one** `UmbAI_Search` rebuild via the Management API (`PUT {URL}/umbraco/search/api/v1/rebuild?indexAlias=UmbAI_Search`, Bearer auth), keeps polling to a 600s ceiling, and fails fast — **without launching Playwright** — if search never warms. So a cold deploy self-heals instead of needing a hand restart + `gh run rerun --failed`.

**Reading the gate's log:**
- A `>>> ESCALATION` line means the passive grace expired and the gate fired the one-time rebuild — normal for a genuinely cold deploy.
- A `did not warm up within …` line means the gate hit the 600s ceiling and **skipped Playwright** — search never came up serving; investigate Dev (Cloud Portal deploy log, restart) rather than re-running blindly.
- Neither line (a quick clean exit) means Dev was already warm and the gate passed without firing a rebuild.

**Verification run id** — `TODO(backfill after first master merge): <run-id>`. The end-to-end proof (a real cold master deploy self-healing to green Playwright) can only be observed *after* this change is on master; capture the run id from the first such run and backfill it here.

**Why this recurs** — every master merge triggers a fresh Dev deploy, and whether the searcher comes up warm or cold is timing-dependent (not controllable from CI). The gate makes the outcome deterministic regardless. If the gate itself starts failing at the ceiling repeatedly, that's a *real* Dev-health problem (or a search-stack regression), not the transient cold-start this recipe covers.
