---
name: project_gate2_transient_deploy_flakiness
description: Gate 2 (master deploy) fails four non-code ways — status-poll 500, post-deploy 503 warmup, terminal verify-timeout (DeploymentStatus Failed), and a cold-AI.Search POST /document 500 cascade; verify-timeout needs a full-workflow rerun, cold-AI.Search needs a Dev restart (not an index rebuild), the rest re-run with --failed
metadata: 
  node_type: memory
  type: project
  originSessionId: 528d658a-1a75-4a7f-ac7e-9cdcdc08b09f
  modified: 2026-07-30T15:27:14.326Z
---

Gate 2 (the master-only Cloud deploy → Playwright pipeline) fails **four transient, non-code** ways that look alarming but are infra timing, not your diff. First read the actual failing step (CLAUDE.md "Diagnosing a red CI run") and confirm Dev serves 200 (`curl $URL/`), then pick the rerun by mode:

1. **`Await deployment to finish` → `Unexpected API Response Code: 500` (empty body).** Cloud's deployment-status API 500s on a poll; `get_deployment_status.sh` has no 5xx retry so it exits 1, even though the deployment keeps running and usually **succeeds**. → **`gh run rerun <id> --failed`** re-polls the same live deploymentId and reports the real green state.

2. **`Playwright (against Dev)` fails at `Sanity check Dev is up` with `curl: (22) … 503`.** Deploy succeeded but Cloud restarts Dev afterward; the sanity curl hits it mid-cold-start. Wait ~1 min (curl `URL` until 200), then → **`gh run rerun <id> --failed`**.

3. **`Await deployment to finish` → `DeploymentStatus: Failed` after `Unable to verify Deployment has finished`.** Distinct from mode 1: the deployment object is **terminally Failed** (Cloud's post-Git-Push *verify* step timed out during cold-start warmup), not a transient poll 500. Build/Kudu already passed and the app actually serves — but `--failed` re-runs only `Await deployment to finish`, which re-polls the same dead deploymentId → Failed again (`Start Deployment` isn't re-run). → **`gh run rerun <run-id>` WITHOUT `--failed`** (full workflow), so `Start Deployment` fires a fresh deployment against the now-warm app. Verified 2026-06-19 (PR #7): first run failed verify, Dev still served 200 on `/`, `/search`, 404; full-workflow rerun went all-green.

4. **`Playwright (against Dev)` `POST /document → 500 "Unknown error"` cascade** (~9 failed / ~266 passed): `Umbraco.AI.Search` comes up **cold** after the deploy and its publish-pipeline embedding hook throws, so every fixture-creating test 500s. Diagnostic tell: `GET $URL/search?q=article` returns 200 but **"No matches"** — a cold *searcher*, NOT an empty index (vector data persists across deploy). → **Restart Dev via Cloud Portal** (re-warms the searcher; `/search` serves within ~15s), then `gh run rerun <id> --failed`. **Do NOT rebuild the index** — a `UmbAI_Search` rebuild repopulates data but does NOT rehydrate the running searcher (disproven 2026-07-01), and correlates with beta.9 Provider.Examine "index was locked" errors; only a Portal restart rehydrates. Index rebuild is for a genuinely fresh/first-deploy env only. A CI gate (`wait_for_search_warm.sh` in `playwright-against-dev`) DETECTS + FAILS FAST at a ~180s budget with one legible diagnostic instead of the 9-test cascade — it does NOT auto-heal. Full mechanism + playbook: **CLAUDE.md "Post-deploy search readiness gate"** and [CI Failure Recipes → cold AI.Search 500 cascade](docs/ci-failure-recipes.md).

Don't treat any of these as PR defects. Candidate hardening (the `.github/scripts/` already carry local upstream-bug patches): 5xx retry in `get_deployment_status.sh`, a warmup retry loop on the Playwright sanity curl, a longer/retried verify window. The deeper cold-serving root cause is a v18 follow-up (ROADMAP `search-cold-serving-health`, clustered with `deps-ai-search-version-realignment`).
