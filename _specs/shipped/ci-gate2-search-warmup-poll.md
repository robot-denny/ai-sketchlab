# Spec for ci-gate2-search-warmup-poll

> This spec captures initial requirements and design rationale. For **current system behavior**, see the doc named on the **Work type** line below. This is `fix-infra` — the durable record lands in the [CI Failure Recipes runbook](../docs/ci-failure-recipes.md) and the CI/CD section of CLAUDE.md, not a `_features/` doc.

branch: claude/feature/ci-gate2-search-warmup-poll
**Work type**: fix-infra — see CLAUDE.md → Workflow layers → "Work types". A CI reliability fix with no standing change to a documented site capability, so it earns no feature doc.

## Summary

Every master merge currently risks a spurious red run. After Gate 2 deploys to Dev, the `Umbraco.AI.Search` subsystem comes up **cold** — its vector data survives the deploy, but the subsystem is not yet *serving*. `Umbraco.AI.Search` hooks the publish pipeline to embed each document, so while it is cold every `POST /document` throws a `500 "Unknown error"`. The `playwright-against-dev` job creates test fixtures via `POST /document` in its setup, so those 500s cascade into ~9 failed / ~266 passed / 2 flaky — all downstream of a single cold-subsystem cause, none of them real regressions in the merged diff.

The only current readiness check before Playwright launches is `curl -fSs "$URL"` against the Dev home page (`main.yml` → `playwright-against-dev` → "Sanity check Dev is up"). The home page returns `200` while search is still cold, so the gate passes and Playwright launches into a subsystem that isn't ready.

Today the human fix is: restart the Dev environment via the Cloud Portal (which re-warms `AI.Search` within ~15s), confirm `/search?q=article` returns results, then `gh run rerun <id> --failed`. This spec replaces that manual ritual with an automated post-deploy **search warm-up gate** that sits between the Dev deployment and the Playwright job, so a cold deploy self-heals (or fails fast with a clear diagnostic) instead of producing a misleading multi-test cascade that a human has to recognise and re-run.

The diagnostic tell that distinguishes this failure mode: `GET $URL/search?q=article` returns HTTP `200` but the page body says **"No matches"** (the results grid renders `article-grid-card` markers when warm). This is a *cold subsystem*, **not** an empty index — the vector data persists across the deploy, so the fix is to warm/restart, never to rebuild the index (rebuild is only for a genuinely fresh first-deploy environment).

## Functional Requirements

- A warm-up gate runs on master Gate-2 runs only, **after** the `cloud-deployment` (Dev) job reports success and **before** the `playwright-against-dev` e2e run begins.
- The gate's readiness signal is that Dev's **search subsystem is actually serving results**, not merely that the home page returns `200`. The concrete probe is `GET $URL/search?q=article` returning a body that contains at least one result marker (`article-grid-card`), rather than the "No matches" empty state.
- When the subsystem is cold, the gate **actively drives Dev to a warm state without human intervention** — the whole point is that a merge no longer requires someone to notice the red, restart Dev by hand, and re-run. (Whether "drive to warm" means repeatedly hitting `/search`, an API-triggered environment restart, or an explicit warm-up endpoint is an open design question below.)
- The gate is **time-bounded**: it retries within a defined budget and, if search still isn't serving when the budget expires, it **fails the run with a single clear "Dev search subsystem did not warm up" diagnostic** — not a downstream cascade of ~9 unrelated Playwright failures.
- Transient errors during warm-up (a `500`/`503` on an individual probe while the app finishes cold-starting) are **retried within the budget**, not treated as terminal.
- The existing `playwright-against-dev` job downstream of the gate is **not** modified to tolerate cold search — once the gate is green, Playwright runs exactly as it does today.
- Feature-branch pushes (Gate 1 only — no Cloud deploy, no Playwright) are **unaffected**: the gate is scoped to master Gate 2 like the other Gate-2 jobs.
- The durable diagnosis and the new self-heal behavior are recorded in the [CI Failure Recipes runbook](../docs/ci-failure-recipes.md), the CI/CD & Build hygiene section of CLAUDE.md is updated, and the `ci-gate2-search-warmup-poll` ROADMAP "Next" entry is closed.

## Possible Edge Cases

- **Partial warmth**: `/search` starts returning *some* results but fewer than a fully-warm index. The gate should treat "≥1 result marker" as ready rather than demanding an exact count (result counts drift with content).
- **Deploy actually failed**: if `cloud-deployment` did not succeed, the warm-up gate must not run (or must not mask the real deploy failure) — it depends on a successful deploy the same way `playwright-against-dev` does today.
- **Genuinely empty index (fresh environment)**: on a brand-new environment the index really is empty and warming alone can't produce results — this needs a rebuild, not a warm-up. The gate should fail with a clear message that distinguishes this from the ordinary cold-subsystem case rather than looping until timeout with a vague error.
- **Warm-up budget too short** → false red on a slow-but-healthy warm-up; **too long** → slow feedback and wasted CI minutes on a genuinely broken deploy. The budget needs a defensible default.
- **Search warms but the query embedding path is what's cold**: the readiness probe must exercise the same path Playwright's fixtures depend on (document publish / embedding), so a green gate actually predicts green fixtures — a probe that only reads a cached page could pass while `POST /document` still 500s.
- **Concurrency cancellation**: a newer master push cancels an in-flight run mid-warm-up (existing `cancel-in-progress`). The gate must behave sanely when cancelled — no partial state that wedges the next run.

## Acceptance Criteria

- **AC1** — On a master Gate-2 run, a search warm-up gate executes between the Dev deployment finishing and the Playwright e2e run starting.
- **AC2** — The gate only reports ready when Dev's `/search?q=article` returns at least one result marker; a home-page `200` alone is not sufficient to proceed.
- **AC3** — When Dev's search subsystem is cold after a deploy, the run reaches a green Playwright result **without any human restarting Dev or manually re-running the job**.
- **AC4** — If the search subsystem does not become ready within the warm-up budget, the run fails at the gate with a single clear cold-search diagnostic, and Playwright does not run.
- **AC5** — A transient `500`/`503` on an individual warm-up probe does not fail the run; the gate retries within its budget.
- **AC6** — Feature-branch pushes run Gate 1 only and never execute the warm-up gate.
- **AC7** — The CI Failure Recipes runbook and CLAUDE.md describe the cold-`AI.Search` failure mode and the automated self-heal, and the ROADMAP `ci-gate2-search-warmup-poll` entry is closed.

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation. This is `fix-infra`, so the verified record lives in the runbook, not a `_features/` doc.

### Rule: The warm-up gate runs after the Dev deploy and before the e2e run (AC1)

```scenario
Scenario: Gate sits between deployment and Playwright on a master merge
  Given a pull request is merged to master
  And the Cloud deployment to Dev has finished successfully
  When the pipeline continues past the deployment
  Then the search warm-up gate runs before the Playwright e2e run
  And the Playwright e2e run does not start until the gate reports a result
```

### Rule: Readiness means search is serving, not just the home page responding (AC2)

```scenario
Scenario: Home page is up but search is still cold
  Given the Dev home page returns 200
  And "/search?q=article" shows "No matches"
  When the warm-up gate evaluates readiness
  Then the gate does not report ready
  And the Playwright e2e run has not started

Scenario: Search is serving results
  Given "/search?q=article" returns a page containing at least one "article-grid-card"
  When the warm-up gate evaluates readiness
  Then the gate reports ready
  And the Playwright e2e run starts
```

### Rule: A cold deploy self-heals without human intervention (AC3)

```scenario
Scenario: Cold search after deploy warms up on its own within the pipeline
  Given a master merge has just deployed to Dev
  And Dev's search subsystem is cold, returning "No matches"
  When the warm-up gate drives the subsystem toward a warm state
  Then "/search?q=article" eventually returns at least one "article-grid-card"
  And the Playwright e2e run proceeds and passes
  And no one restarted the Dev environment by hand
  And no one re-ran the failed job by hand
```

### Rule: If warm-up never succeeds, fail fast with one clear diagnostic (AC4)

```scenario
Scenario: Search never becomes ready within the budget
  Given the warm-up budget is 8 minutes
  And "/search?q=article" still shows "No matches" after 8 minutes of warm-up attempts
  When the budget expires
  Then the run fails at the warm-up gate
  And the failure message says the Dev search subsystem did not warm up
  And the Playwright e2e run does not start
  And there is no cascade of POST /document 500 test failures in the report
```

### Rule: Transient probe errors are retried, not fatal (AC5)

```scenario
Scenario: A single probe hits a mid-cold-start 503
  Given the warm-up gate is polling "/search?q=article"
  And one probe returns HTTP 503 while Dev finishes cold-starting
  When the gate handles that response
  Then the gate retries within its budget
  And the run does not fail on that single 503
```

### Rule: The gate is master-only, like the rest of Gate 2 (AC6)

```scenario
Scenario: A feature-branch push skips the warm-up gate
  Given a developer pushes to a feature branch
  When the pipeline runs
  Then only Gate 1 (build + xUnit) runs
  And the search warm-up gate does not run
  And no Cloud deploy or Playwright run occurs
```

### Rule: The lesson is captured durably (AC7)

```scenario
Scenario: The runbook and roadmap reflect the shipped fix
  Given the warm-up gate has shipped
  When a developer reads the CI Failure Recipes runbook
  Then it describes the cold-AI.Search POST /document 500 cascade and the automated self-heal
  And the ROADMAP no longer lists ci-gate2-search-warmup-poll under "Next"
```

## Open Questions

- **Does polling `/search` actually warm the subsystem, or does it require an environment restart?** Observed on 2026-07-01: after the deploy finished, Dev's home page served `200` but `/search` stayed "No matches" for 20+ minutes; a single manual `/search` hit did **not** warm it — only a Cloud Portal **restart** did (and then it warmed in ~15s). This strongly suggests a passive poll alone may never self-heal, and the gate must trigger an actual warm-up action. **This is the pivotal design decision for `/plan`.**
- **Can CI trigger a Dev environment restart via the Umbraco Cloud API** using the existing `UMBRACO_CLOUD_API_KEY` (or another credential already available)? Is there a supported restart/recycle endpoint? If yes, the gate can restart-then-poll.
- **Is there a Management API warm-up or embedding-init endpoint** that forces `AI.Search` to start serving without a full environment restart? A targeted warm-up would be cheaper and faster than a restart.
- **What is the right warm-up budget?** The manual restart warmed in ~15s, but detection-after-deploy was slow. Need a default that self-heals the common case without dragging out a genuinely broken deploy.
- **How should the gate distinguish a cold subsystem (warm/restart) from a genuinely empty index (rebuild)** so it does the right thing on a fresh environment instead of looping to timeout?
- **Should the gate be a new reusable workflow job** (mirroring `cloud-sync`/`cloud-deployment`) **or a step inside `playwright-against-dev`** (extending the existing "Sanity check Dev is up" step)? A separate job gives a cleaner failure surface and a distinct name in the run summary.
- **Should the probe also directly exercise `POST /document`** (a create-then-delete throwaway) rather than only `GET /search`, to guarantee the exact path Playwright fixtures use is warm before launching?

## Testing Guidelines

This is CI-infrastructure work; the "tests" are largely the pipeline behaving correctly on a real master run, plus any extractable script logic. Keep it proportionate:

- If the warm-up/readiness logic is extracted into a shell script (e.g. under `.github/scripts/`), give it a small local harness (mirroring `.githooks/test-pre-push.sh`) that exercises its decision paths against canned inputs: a "warm" response (contains `article-grid-card`) → ready/exit 0, a "cold" response (contains "No matches") → keep polling, a transient `503` → retry, and budget-exhausted → fail with the cold-search message.
- Verify the readiness probe keys off a signal that actually predicts warm fixtures (search serving / publish path warm), not just any `200`.
- End-to-end proof is a real master run where a cold Dev deploy is driven to a green Playwright result with no human restart and no manual re-run — capture that run id in the runbook as the verification record.
- Do **not** add Playwright specs that assert on CI internals; the gate is pipeline plumbing, not site behavior.
