# Plan: Gate 2 Post-Deploy Search Warm-Up Gate

**Spec**: `_specs/ci-gate2-search-warmup-poll.md`
**Branch**: `claude/feature/ci-gate2-search-warmup-poll`
**Work type**: fix-infra — carried from the spec. Final step records durable residue in `docs/ci-failure-recipes.md` + CLAUDE.md and closes the ROADMAP entry; **no `_features/` doc**.

## Context

Every master merge risks a spurious red run: after Gate 2 deploys to Dev, `Umbraco.AI.Search` comes up **cold** (its vector data survives the deploy, but the searcher isn't *serving*). Because `AI.Search` hooks the publish pipeline to embed each document, every `POST /document` throws `500` while cold — and `playwright-against-dev` creates fixtures via `POST /document`, so a single cold-subsystem cause cascades into ~9 misleading test failures. The only current readiness check is a home-page `curl` (`main.yml` → `playwright-against-dev` → "Sanity check Dev is up"), which passes while search is still cold. Today the human fix is a Cloud Portal restart + `gh run rerun --failed`. This plan replaces that ritual with an automated warm-up gate between the Dev deploy and Playwright, so a cold deploy self-heals (or fails fast with one clear diagnostic).

---

## Key Decisions

- **Cloud-API restart is ruled out (resolved during planning).** The Umbraco Cloud CI/CD Flow API (`https://api.cloud.umbraco.com/v2/projects/{id}/…`, authed via `Umbraco-Cloud-Api-Key`) exposes deployment/artifact endpoints only — **no environment-restart endpoint**; restart is a Portal-only button ([Cloud API docs](https://docs.umbraco.com/umbraco-cloud/build-and-customize-your-solution/handle-deployments-and-environments/umbraco-cicd/umbraco-cloud-api), [issue #364](https://github.com/umbraco/Umbraco.Cloud.Issues/issues/364)). So the spec's "API-driven Dev restart" option is off the table for CI.
- **The actuator is the Dev app's Management API, which CI can already reach.** `playwright-against-dev` already authenticates to Dev's Management API with `UMBRACO_CLIENT_ID`/`UMBRACO_CLIENT_SECRET` (client-credentials OAuth — see `tests/e2e/auth.setup.ts`). The reachable self-heal lever is a **search index rebuild of `UmbAI_Search`** via the Management API, which re-embeds + repopulates the serving searcher. This intentionally differs from the *human* guidance ("restart, don't rebuild" — see the `project_gate2_transient_deploy_flakiness` memory): a human has the Portal restart button; CI does not, so the Management API rebuild is the automatable equivalent that produces the same "searcher now serving" end state.
- **Architecture: poll → escalate-to-rebuild → poll → fail-fast.** Robust to whichever cause is real. (1) Poll `GET $URL/search?q=article` for the readiness marker; if it warms on its own within an initial sub-budget, we spent nothing but time. (2) If still cold after the sub-budget, fire the Management API `UmbAI_Search` rebuild once. (3) Keep polling to a total budget. (4) If still cold at the total budget, fail the run with a single clear cold-search diagnostic — no Playwright launch, no `POST /document` cascade. This self-heals both the "just needed more time" and the "needed a repopulate kick" cases.
- **Readiness marker = search actually serving, not any `200`.** Ready ⇔ `GET $URL/search?q=article` body contains ≥1 `article-grid-card`. The "No matches" empty state ⇒ still cold. This keys off the exact publish/embedding path Playwright's fixtures depend on, so a green gate predicts green fixtures.
- **Placement: a step group inside `playwright-against-dev`, backed by `.github/scripts/wait_for_search_warm.sh`.** Chosen over a new reusable-workflow job because it reuses the runner/checkout/env already set up in that job and avoids a new `cloud-*.yml` file; the new step replaces the thin "Sanity check Dev is up" curl and runs *before* "Run Playwright", so the failure surface is still distinct and pre-Playwright. The logic lives in a script (not inline YAML) so it is unit-testable with a local harness (mirroring `.githooks/test-pre-push.sh`).
- **Budgets (starting values, tuned by the Step 1 spike):** initial passive sub-budget ~3 min, total budget ~8–10 min, probe interval ~15s, transient `500`/`503` on an individual probe are retried (not fatal). Final values are pinned by Step 1's measurements.
- **Exact rebuild endpoint + auth are pinned by the Step 1 spike**, not guessed — the new-search-stack (`Umbraco.Cms.Search.BackOffice 1.0.0`) rebuild route wasn't derivable from the package DLL offline; it's read from Dev's authenticated `/umbraco/swagger` during the spike. **See "Step 1 findings" below for the pinned endpoint.**

### Step 1 findings (spike executed 2026-07-01 — resolves the open question)

> **⚠️ SUPERSEDED (2026-07-01).** The spike *inferred* (couldn't directly observe — Dev was warm) that a `UmbAI_Search` rebuild would rehydrate a cold searcher. A real cold master run (`28539245107`) **disproved this**: the rebuild repopulates the index (→179/Healthy) but does NOT make `/search` serve — only a Cloud Portal restart does — and it correlated with index-lock errors. The rebuild escalation was therefore **removed**; the gate is now **detect-and-fail-fast only** (see the reframe on branch `claude/fix/search-warmup-gate-fail-fast`, the [CI Failure Recipes runbook](../../docs/ci-failure-recipes.md), and ROADMAP `search-cold-serving-health`). The endpoint/auth findings below remain accurate as *reference*, but the gate no longer calls them.

- **Auth against Dev works with the existing `.env` credentials.** `POST {DevURL}/umbraco/management/api/v1/security/back-office/token`, `Content-Type: application/x-www-form-urlencoded`, body `grant_type=client_credentials` + `client_id` + `client_secret`. The `.env` `UMBRACO_CLIENT_ID`/`UMBRACO_CLIENT_SECRET` authenticate against Dev (HTTP 200) — same client, so the same values live in GitHub Secrets for CI. Returns a Bearer `access_token`, `expires_in: 300`. **Refresh the token per operation** — 300s is shorter than the total warm-up budget, so the script must re-fetch before the rebuild call, not reuse one token for the whole wait.
- **The actuator (pinned): `PUT {DevURL}/umbraco/search/api/v1/rebuild?indexAlias=UmbAI_Search`**, header `Authorization: Bearer <token>`, **no request body**. This is the new-stack **"Umbraco Search Management API"** group (swagger at `/umbraco/swagger/search/swagger.json`). 
  - ⚠️ **Not** the legacy Examine route `POST /umbraco/management/api/v1/indexer/{indexName}/rebuild` — that endpoint's index list does **not** include `UmbAI_Search` (it only covers Examine indexes: `Umb_Content`, `Umb_Media`, `ExternalIndex`, etc.). The AI vector index is `UmbAI_Search`, provider `ai-vector-search-provider`, and is only reachable via the `search` API group.
- **The rebuild is asynchronous.** `PUT /rebuild` returns **HTTP 200 immediately** with an empty body and kicks off a background rebuild — the 200 does **not** mean "done." The gate must poll for readiness after firing it, never treat the 200 as success.
- **Readiness signal (confirmed): `GET {DevURL}/search?q=article` body contains ≥1 `article-grid-card`.** **Do NOT gate on `documentCount`** from `GET /umbraco/search/api/v1/indexes/UmbAI_Search`: during a rebuild `documentCount` drops to `1` and climbs back over several minutes, while `/search` keeps serving normally the whole time. `documentCount` is misleading; the public `/search` marker reflects actual serving capability (what Playwright's fixtures depend on).
- **Rebuild timing + safety (measured on a warm index):** docs went `179 → 1` (~15s after firing), sat at `1` for ~90s, then climbed `27 → 64 → 94 → 179`; **full repopulate ≈ 3–4 min**. Throughout the entire rebuild, `GET /search?q=article` returned a steady **10 hits** — **firing a rebuild does not disrupt `/search` serving.** ⇒ escalating to a rebuild is *safe* even if the index was actually fine, which is what makes the poll-then-rebuild design low-risk.
- **Cloud CI/CD Flow API restart: re-confirmed absent.** `https://api.cloud.umbraco.com/v2/projects/{id}/…` exposes deployment/artifact endpoints only; restart is Portal-only. Ruled out as a CI actuator.
- **Honest caveat — the cold→warm-via-rebuild transition was NOT directly observed.** Dev was warm (179 docs / Healthy / 10 `/search` hits) throughout the spike, left over from the morning Portal restart, and a cold state **cannot be cleanly induced**: no Cloud API restart, a master deploy would run the *pre-gate* pipeline (disruptive), and a rebuild does not cold `/search`. The "cold = unhydrated searcher, data intact" model is strongly supported (this morning `/search` showed "No matches" for 20+ min while `documentCount` persisted at 179 across the deploy; only a restart re-warmed it). That firing a rebuild rehydrates a cold searcher is **strongly inferred** (a rebuild rewrites the segments the searcher serves from) but will be **empirically confirmed by the Step 3 end-to-end run**, whose script logs whether it warmed passively or only after the rebuild fired. The design is safe regardless, because a rebuild provably does not disrupt an already-warm index.

**Pinned budget values (supersede the "starting values" bullet above):**
- `PROBE_INTERVAL = 10` (seconds) — Dev tolerated 5s polling fine; 10s is easy on the runner.
- `INITIAL_POLL_BUDGET = 60` (seconds) — passive grace before escalating to a rebuild. Kept short because a genuinely cold subsystem did **not** self-heal within 20+ min this morning; the grace exists only to (a) pass instantly when the deploy already hydrated search, and (b) ride out a transient blip without an unnecessary rebuild.
- `TOTAL_BUDGET = 600` (seconds, 10 min) — hard ceiling. Sized for: 60s grace + async rebuild fire + ~3–4 min repopulate + margin. A false red is worse than waiting, so err generous; at 600s, fail fast with the single cold-search diagnostic and do not launch Playwright.
- **Escalation policy:** fire the rebuild **once** when the grace expires with search still cold, then keep polling to `TOTAL_BUDGET`. (Re-firing is unnecessary — the first rebuild runs to completion in the background; a second `PUT` mid-rebuild would just restart the churn.)

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Spike: pin the warm-up mechanism, endpoint, and budgets (resolves the open question)

> **Prompt**: Execute Step 1 of `_plans/ci-gate2-search-warmup-poll.md` — an investigation spike, **no production/pipeline code changes**. Goal: empirically resolve how CI can warm a cold `Umbraco.AI.Search` on Dev, pin the exact Management API rebuild endpoint, and choose budget values. Do this: (1) Obtain a Management API bearer token against Dev using client-credentials — replicate `tests/e2e/auth.setup.ts` / the `/umbraco-edit` skill token dance, using `URL` (Dev) + `UMBRACO_CLIENT_ID`/`UMBRACO_CLIENT_SECRET` (from `.env` or GitHub secrets locally). (2) Fetch Dev's Management API OpenAPI (`GET {DevURL}/umbraco/swagger/…` — try the management swagger.json) and find the search index **rebuild** route for the new search stack (`Umbraco.Cms.Search.BackOffice`); record the exact method + path + payload for rebuilding `UmbAI_Search`. (3) Determine, against a genuinely cold Dev (either right after the next master deploy, or by asking the user to trigger a deploy), whether passive polling of `GET {DevURL}/search?q=article` warms it on its own and how long that takes, versus firing the rebuild endpoint and timing how long until `/search` returns ≥1 `article-grid-card`. (4) Confirm (already established in planning, just re-verify) that the Cloud CI/CD Flow API has no restart endpoint. Record all findings in the plan's **Key Decisions** (append a "Step 1 findings" subsection): the rebuild endpoint/auth, whether the passive sub-budget is worth keeping, and the final `INITIAL_POLL_BUDGET` / `TOTAL_BUDGET` / `PROBE_INTERVAL` values. Do not edit `main.yml` or add scripts in this step.

**What to build**: No shipped artifacts — a findings note appended to `_plans/ci-gate2-search-warmup-poll.md` under **Key Decisions → Step 1 findings**. Optionally a throwaway probe script under the scratchpad (not committed).

**Validation**:
- [Manual]: The plan now contains the exact rebuild endpoint (method + path + body + auth header), a yes/no on "does passive polling alone warm it," and concrete budget numbers — enough that Step 2 can be implemented without re-investigating.
- [Manual]: If the spike shows the rebuild endpoint is unavailable or ineffective, the plan is updated with the fallback actuator before proceeding (do not silently proceed on an unverified lever).

---

### Step 2 — Warm-up script + local test harness (TDD)

> **Prompt**: Implement Step 2 of `_plans/ci-gate2-search-warmup-poll.md`. First write the test harness `.github/scripts/test-wait-for-search-warm.sh` (mirroring the style of `.githooks/test-pre-push.sh`), then implement `.github/scripts/wait_for_search_warm.sh` to make it pass. The script polls Dev search readiness, escalates to a Management API `UmbAI_Search` rebuild if still cold after the initial sub-budget, keeps polling to the total budget, and fails fast with a clear cold-search diagnostic if never ready. Use the exact endpoint + budgets pinned in the plan's Step 1 findings. Structure the script so its HTTP calls (the `/search` probe, the token fetch, the rebuild POST) are injectable/overridable via env vars or overridable shell functions, so the harness drives all decision paths with canned responses and **no real network**. Make both scripts executable (`chmod +x`).

**What to build**:
- `.github/scripts/wait_for_search_warm.sh` — inputs via env: `URL` (Dev), `UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET`, and tunables (`INITIAL_POLL_BUDGET`, `TOTAL_BUDGET`, `PROBE_INTERVAL`) with the Step-1 defaults. Behavior: readiness = `/search?q=article` body contains `article-grid-card`; on transient `500`/`503` keep polling; after the initial sub-budget with no readiness, obtain a token + POST the `UmbAI_Search` rebuild once (log it clearly); continue polling to total budget; exit `0` when ready, non-zero with a single `Dev search subsystem did not warm up …` message on budget exhaustion. Seam for tests: e.g. `SEARCH_PROBE_CMD` / `REBUILD_CMD` / `TOKEN_CMD` overrides (or `_probe_search`/`_rebuild_index`/`_get_token` functions overridable by sourcing).
- `.github/scripts/test-wait-for-search-warm.sh` — drives the script with canned inputs and asserts:
  - warm on first probe → exit 0, rebuild **not** fired
  - cold for < sub-budget then warm → exit 0, rebuild **not** fired
  - cold past sub-budget then warm after rebuild → exit 0, rebuild fired **once**
  - single transient `503` mid-poll → retried, not fatal
  - cold for the whole total budget → non-zero exit, message contains "did not warm up", rebuild attempted
  - (use tiny budgets like `TOTAL_BUDGET=2 PROBE_INTERVAL=1` so the harness runs in seconds)

**Test first**:
- Write `.github/scripts/test-wait-for-search-warm.sh` before the implementation and run it — expect RED (script doesn't exist / cases fail).
- Run: `bash .github/scripts/test-wait-for-search-warm.sh` — confirm RED, then implement until GREEN.

**Validation**:
- [Automated]: `bash .github/scripts/test-wait-for-search-warm.sh` — all cases pass (prints per-case PASS, exits 0).
- [Manual]: Skim the script for a clear final diagnostic line and a clear one-line log when the rebuild escalation fires.

---

### Step 3 — Wire the warm-up gate into the pipeline

> **Prompt**: Implement Step 3 of `_plans/ci-gate2-search-warmup-poll.md`. Edit `.github/workflows/main.yml`: in the `playwright-against-dev` job, replace the "Sanity check Dev is up" step with a "Wait for Dev search to warm up" step that runs `bash .github/scripts/wait_for_search_warm.sh`, with env `URL: ${{ vars.URL }}`, `UMBRACO_CLIENT_ID: ${{ secrets.UMBRACO_CLIENT_ID }}`, `UMBRACO_CLIENT_SECRET: ${{ secrets.UMBRACO_CLIENT_SECRET }}` (plus any budget vars). It must run **before** the "Run Playwright (e2e project)" step and after Node/deps setup is not required (the script only needs curl + the secrets — place it as the first step after checkout, or keep the checkout + this step, then Node setup, then Playwright). Update the file's top-of-file comment block and the inline comment to describe the warm-up gate. Do not modify the Playwright step itself or any Playwright specs. Confirm the workflow YAML is valid.

**What to build**:
- Modify `.github/workflows/main.yml` `playwright-against-dev`: swap the thin `curl -fSs "$URL"` sanity step for the script-backed warm-up gate step; thread the secrets/vars; keep ordering so the gate blocks Playwright.
- Update the `main.yml` header comment (pipeline-shape section) to mention the warm-up gate between deploy and Playwright.

**Validation**:
- [Automated]: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/main.yml'))"` (or `actionlint` if available) — YAML parses, no syntax errors.
- [Manual / end-to-end proof]: Merge to master and observe a real Gate 2 run. On a cold Dev deploy, the "Wait for Dev search to warm up" step drives Dev to serving (logs the rebuild escalation if it fires), then Playwright runs green — **with no human restart and no manual `gh run rerun`**. Capture the run id for the runbook. If Dev happens to be warm, confirm the gate passes quickly and doesn't fire the rebuild.

---

### Step 4 — Record durable residue and close out (fix-infra final step)

> **Prompt**: Complete Step 4 of `_plans/ci-gate2-search-warmup-poll.md` (fix-infra — **no feature doc**). (1) Add a recipe to `docs/ci-failure-recipes.md` for the cold-`AI.Search` `POST /document 500` cascade: the diagnostic tell (`/search` 200 but "No matches"), that it's a cold subsystem not an empty index (never rebuild-as-first-move for a human; but CI's automated actuator IS a Management API rebuild), and that the warm-up gate now self-heals it — cite the verification run id from Step 3. (2) Update the CI/CD & Build hygiene section of CLAUDE.md to describe the warm-up gate step and point to the script. (3) In `ROADMAP.md`, remove the `ci-gate2-search-warmup-poll` entry from "Next" and note it shipped under "Recently shipped" (with date 2026-07-01 or the actual ship date). (4) Archive `_specs/ci-gate2-search-warmup-poll.md` → `_specs/shipped/` and `_plans/ci-gate2-search-warmup-poll.md` → `_plans/shipped/`. Confirm nothing was filed under `_features/`.

**Validation**:
- [Manual]: `docs/ci-failure-recipes.md` has the new recipe with the verification run id; CLAUDE.md describes the gate; ROADMAP no longer lists the item under "Next"; spec + plan are under their `shipped/` folders; no `_features/ci-gate2-search-warmup-poll.md` exists.

---

## File Summary

| Action | File |
|--------|------|
| Update (findings note) | `_plans/ci-gate2-search-warmup-poll.md` (Step 1) |
| Create | `.github/scripts/wait_for_search_warm.sh` |
| Create | `.github/scripts/test-wait-for-search-warm.sh` |
| Modify | `.github/workflows/main.yml` (`playwright-against-dev` job + header comment) |
| Update *(fix-infra)* | `docs/ci-failure-recipes.md` (new cold-AI.Search recipe) |
| Update *(fix-infra)* | `CLAUDE.md` (CI/CD & Build hygiene — warm-up gate) |
| Update | `ROADMAP.md` (close the "Next" entry) |
| Move | `_specs/ci-gate2-search-warmup-poll.md` → `_specs/shipped/` |
| Move | `_plans/ci-gate2-search-warmup-poll.md` → `_plans/shipped/` |
