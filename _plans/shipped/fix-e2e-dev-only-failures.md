# Plan: Fix E2E Dev-Only Failures

**Spec**: `_specs/fix-e2e-dev-only-failures.md`
**Branch**: `claude/feature/fix-e2e-dev-only-failures`

## Context

Gate 2's Playwright-against-Dev job has been red on every recent master push (today: 218 passed / 31 failed). All 31 trace back to 5 distinct root causes plus ~27 serial-sibling tests reported "did not run." Verified 2026-05-27: all 5 pass against a local site, so these are Dev environment/content gaps, not test bugs or code regressions. Leaving the gate red is actively training the team to dismiss CI — the antidote is to fix the three categories of root cause, restore the gate to green, and capture the diagnostic playbook so future habituation is structurally discouraged.

Three independent fix categories: (1) Dev's `OPENAI__APIKEY` Cloud Secret unset/invalid → `dashboard.spec.ts:141` fails; (2) guide-generator's Dev OAuth client unverified → 3 tests in `guides-cli.spec.ts` fail; (3) one carousel media item on Dev has empty alt text → `imageCarousel.spec.ts:742` fails. Each is ship-able on its own. None require repo code changes — fixes live in Cloud configuration (Portal) and content (backoffice). The only repo deliverables are docs: a "Diagnosing a red CI run" section in CLAUDE.md (durable playbook), per-failure diagnosis-and-fix recipes in the feature doc, and the ROADMAP entry move from "Next" to "Recently shipped."

---

## Key Decisions

- **No test skips.** `dashboard.spec.ts:141` and the others stay live and red until properly fixed. Skipping would hide the failure and defeat the entire point of this feature (de-habituating from red). Trade-off accepted: each fix lands the gate one step closer to green incrementally rather than flipping a single skip switch.
- **Dedicated Dev OpenAI key, not shared with Live.** Per CLAUDE.md and `[[project_cloud_shared_secrets_one_shot]]`, Cloud secrets default to per-environment. A dedicated Dev key gives separate billing visibility, lets us revoke/rotate Dev independently if it leaks, and matches the existing pattern. Live and Dev each have their own AI Connection in their respective backoffices already pointing at `$OpenAI:ApiKey` — only the secret value differs.
- **Order of operations: imageGenerator → guides-cli → imageCarousel.** Highest impact first: imageGenerator likely unblocks the most serial siblings (it sits early in the alphabetical spec ordering — `imageGenerator/dashboard.spec.ts` runs before `guides-cli.spec.ts` and `blocks/imageCarousel.spec.ts`), guides-cli is 3 tests, imageCarousel is 1 test + content-only. Steps remain independent — any can ship on its own if the others are blocked.
- **Verification cadence: manual Gate 2 dispatch, not commits.** `.github/workflows/main.yml` exposes `workflow_dispatch:`. After each fix, run `gh workflow run main.yml --ref master` to trigger the full pipeline against Dev with the current master commit — no empty-commit noise. Faster signal than waiting for the next real master push.
- **Faster local-feedback loop: targeted Playwright run against Dev's URL** before triggering Gate 2. `URL=https://<dev>.umbraco.io npx playwright test tests/e2e/imageGenerator/dashboard.spec.ts` validates a single fix against Dev in ~10s; reserve the full Gate 2 dispatch for confirming no regressions across the suite.
- **For imageCarousel: edit Live first, then restore Live→Dev.** Per `[[project_content_authoring_direction]]`, content authoring flows local → Live; Dev is a periodic mirror via "restore from Live to Dev." If Live already has alt text and Dev doesn't, restore is the entire fix. If Live also lacks alt text, edit on Live (via local→Live transfer or direct on Live), then restore Dev. Editing Dev directly is a non-starter — the next restore will wipe it.
- **guides-cli OAuth client: investigate during Step 2, decide between "rotate existing" and "create new."** Spec's open question; can't resolve without portal inspection. Plan acknowledges both paths; Step 2's prompt drives the investigation and chooses.
- **Diagnosis-and-fix recipes live in the feature doc; generic playbook lives in CLAUDE.md.** The feature doc captures specifics for these 5 failures (failure signature, verification command, fix step) — useful when the same failure recurs (e.g. secret rotation). CLAUDE.md captures the *method* (which gate? which job? new or pre-existing?) — useful for any future red pipeline.
- **Step ordering puts the CLAUDE.md playbook AFTER the fixes, not before.** Writing it post-hoc lets it reflect what was actually learned during the fix process rather than what was hypothesized in the spec. The fixes themselves are the playbook's prototype.
- **No new test files. No code changes to `src/` or `tests/`.** Per AC6. If a fix turns out to require code changes (e.g. a controller diagnostic message needs improving), surface it during the step and reassess scope rather than silently expanding.

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new chat.

Steps 1–3 are **user-driven** (Cloud Portal access required); the prompts describe what the user does and what to verify. Steps 4–6 are repo changes a subagent can drive end-to-end.

---

### Step 1 — Fix imageGenerator: set Dev's `OPENAI__APIKEY`

> **Prompt**: Implement Step 1 of `_plans/fix-e2e-dev-only-failures.md`. Resolve the `dashboard.spec.ts:141` failure on Dev. Investigate Dev's current OpenAI configuration via the Umbraco Cloud Portal, set/rotate the `OPENAI__APIKEY` Cloud Secret to a working dedicated Dev OpenAI key, verify Dev's backoffice AI Connection references `$OpenAI:ApiKey`, restart Dev's web app, then verify both via direct curl AND a targeted Playwright run against Dev's URL. Record the diagnosis-and-fix recipe in `_features/fix-e2e-dev-only-failures.md` under a new "Diagnosis & Fix Recipes" section. Do not commit yet — recipe additions land in the Step 4 doc commit.

**What to do** (Cloud Portal + verification, no repo code):

1. **Investigate Dev's current state**:
   - Open the Umbraco Cloud Portal → project → Development environment → Configuration → App Settings (the secrets management surface).
   - Check whether `OPENAI__APIKEY` exists. Note the form: **double-underscore** required by the portal (it rejects `:`); .NET flattens it to `OpenAI:ApiKey` at runtime.
   - Log in to Dev's backoffice → **Settings → AI → Connections**. Find the OpenAI connection. Confirm its API Key field is the placeholder reference `$OpenAI:ApiKey` (not a raw key). If it's a raw key, that's the "encrypted-into-DB-breaks-on-DPK-rotation" footgun from CLAUDE.md — replace with `$OpenAI:ApiKey`.

2. **Acquire a dedicated Dev OpenAI key** (do **not** reuse Live's). Generate it in the OpenAI dashboard (`platform.openai.com` → API keys) with a label like `umbraco-cloud-dev`. Note the value (you only see it once).

3. **Set the Cloud Secret**:
   - In the Cloud Portal Dev environment's App Settings, add or update `OPENAI__APIKEY` (capital, double underscore) with the value from step 2.
   - Save. Portal may require a restart of the web app for it to take effect — if not auto-restarted, trigger one from the portal.

4. **Verify via direct curl**:
   ```bash
   # Acquire an auth token using the Playwright test client (same one CI uses):
   TOKEN=$(curl -sk -X POST "https://<dev-host>/umbraco/management/api/v1/security/back-office/token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=client_credentials&client_id=$UMBRACO_CLIENT_ID&client_secret=$UMBRACO_CLIENT_SECRET" \
     | jq -r .access_token)

   # Get an article id:
   ARTICLE_ID=$(curl -sk -H "Authorization: Bearer $TOKEN" \
     "https://<dev-host>/umbraco/api/image-generator/articles" | jq -r '.[0].id')

   # Trigger generate:
   curl -sk -X POST -H "Authorization: Bearer $TOKEN" \
     "https://<dev-host>/umbraco/api/image-generator/generate/$ARTICLE_ID?force=true" | jq .
   ```
   Expected: `{ "success": true, "output": "...Done...|generated..." }`. If `success: false`, the `output` field will name the actual error — read it and adjust (likely a typo in the secret name or value, or the AI Connection still references a missing/wrong placeholder).

5. **Verify via targeted Playwright run** (faster than full Gate 2):
   ```bash
   URL=https://<dev-host>/ PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" \
     npx playwright test tests/e2e/imageGenerator/dashboard.spec.ts --project=e2e
   ```
   Expected: all 8 dashboard tests pass, including `generate endpoint succeeds end-to-end`.

6. **Record the diagnosis-and-fix recipe** in `_features/fix-e2e-dev-only-failures.md` — add a new top-level section called `## Diagnosis & Fix Recipes` after `## Behaviors` (before `## Test Coverage`). Add a subsection `### imageGenerator — Dev returns success:false` with: failure signature (what to look for in CI logs / dashboard output), root cause description (1–2 sentences), verification command (the curl from step 4 with placeholders), exact fix step (the Cloud Portal navigation + secret name), why this recurs (key rotation, accidental deletion, etc.). Keep it terse and actionable — 5–10 lines.

**Validation**:
- [Manual]: Step 4 curl returns `success: true` with a non-empty `output` containing `Done:` or `generated`.
- [Automated]: Step 5 Playwright run completes with 0 failed tests in the imageGenerator dashboard spec.
- [Manual]: The feature doc now has a `Diagnosis & Fix Recipes` section with the imageGenerator recipe.

---

### Step 2 — Fix guides-cli: verify Dev OAuth client and rotate if needed

> **Prompt**: Implement Step 2 of `_plans/fix-e2e-dev-only-failures.md`. Resolve the 3 failing tests in `tests/e2e/guides-cli.spec.ts` on Dev. The guide-generator CLI runs against Dev's Management API using OAuth client credentials. Investigate whether the Dev client exists, whether its credentials are current, and whether its scopes are sufficient to read/write under the Guides parent. Decide between "rotate existing" and "create new" based on findings. Verify via a targeted Playwright run against Dev. Record the recipe in the feature doc. Do not commit.

**What to do** (Cloud Portal + verification):

1. **Determine the client identity**:
   - Read `tests/e2e/guides-cli.spec.ts` top of file to see how it authenticates. Look for env vars it uses (likely `UMBRACO_CLIENT_ID` / `UMBRACO_CLIENT_SECRET`, the same the Playwright test client uses — but possibly different vars for guide-gen).
   - Check `scripts/guide-generator/src/umbracoApi.ts` for the auth path it uses at runtime.
   - **Question to resolve**: is the guide-generator CLI client the **same** as the Playwright test client, or a **separate** one with broader/different scopes? The spec flagged this as open.

2. **Probe the live Dev endpoint**:
   ```bash
   # If guide-gen uses the same client as Playwright:
   curl -sk -X POST "https://<dev-host>/umbraco/management/api/v1/security/back-office/token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=client_credentials&client_id=$UMBRACO_CLIENT_ID&client_secret=$UMBRACO_CLIENT_SECRET"
   ```
   - HTTP 200 + access_token → client exists; scope issue is elsewhere. Try a guides-related API call (e.g. fetch the Guides parent document) — 403 = scope insufficient; 404/400 = the parent isn't where the CLI expects.
   - HTTP 401 → client missing or credentials wrong.

3. **Fix based on findings**:
   - **Missing client**: In Dev's backoffice → **Settings → OAuth** (or similar; per CLAUDE.md's `/umbraco-edit` skill description). Create the client with scopes for document read/write/publish. Store the credentials in GitHub Secrets if the CI workflow needs them (`UMBRACO_CLIENT_ID` and/or a `UMBRACO_GUIDE_GEN_CLIENT_*` pair — match what the spec file expects).
   - **Insufficient scopes**: Edit the existing client to add the needed scopes.
   - **Wrong credentials**: Reset the secret in the OAuth client UI, then update the matching GitHub Secret.

4. **Verify via targeted Playwright run**:
   ```bash
   URL=https://<dev-host>/ PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" \
     npx playwright test tests/e2e/guides-cli.spec.ts --project=e2e
   ```
   Expected: all 3 tests pass.

5. **Record the diagnosis-and-fix recipe** in `_features/fix-e2e-dev-only-failures.md` under `## Diagnosis & Fix Recipes`. Add `### guides-cli — Dev CLI auth fails`. Same format as Step 1's recipe. Include the decision (same client vs. separate) so a future contributor doesn't have to re-investigate.

**Validation**:
- [Automated]: Step 4 Playwright run completes with 0 failed in `guides-cli.spec.ts`.
- [Manual]: The feature doc now has a `guides-cli` recipe.

**Notes**:
- If this turns out to need a code change (e.g. the spec file references the wrong env var name and the test client genuinely is supposed to be a different one), pause and surface as a scope question. Per AC6, no `src/` or `tests/` code changes expected.

---

### Step 3 — Fix imageCarousel: restore Live→Dev so the carousel media has alt text

> **Prompt**: Implement Step 3 of `_plans/fix-e2e-dev-only-failures.md`. Resolve `imageCarousel.spec.ts:742` on Dev. The first slide of the multi-caption carousel block on Dev has empty alt text. Determine whether Live's media has alt text (the easy path = restore Live→Dev) or doesn't (the harder path = edit Live first, then restore). Either way, Live becomes the source of truth before Dev gets fixed. Verify via a targeted Playwright run against Dev. Record the recipe in the feature doc. Do not commit.

**What to do** (Cloud Portal + backoffice + verification):

1. **Locate the offending media** — find the page that hosts the multi-caption carousel test block. The test uses `testBlockKeys.multiCaptionsOn` from a `beforeAll` setup; the page rendering it is referenced via `targetDocUrl`. Read `tests/e2e/blocks/imageCarousel.spec.ts` `beforeAll` to identify the page name / URL the test expects.

2. **Inspect Live**:
   - Open Live's backoffice → navigate to the page identified in step 1 → find the multi-caption carousel block → click the first media item → check the **Alternative text** field.
   - Live has alt text → skip to step 3a.
   - Live has empty alt text → skip to step 3b.

3a. **Live is correct → restore Live to Dev**:
   - In Live's backoffice → **Settings → Deploy** (or the equivalent in the current Umbraco version) → trigger a content restore from Live to Dev. Include media in the restore (per the [Media files](#media-files) section in CLAUDE.md, content restore alone won't pull binaries; do the media restore in the same pass).
   - Wait for the restore to complete (minutes).

3b. **Live needs the fix first**:
   - Per `[[project_content_authoring_direction]]`, edit content locally then transfer to Live. Open the local backoffice → navigate to the same media item → set Alternative text (something descriptive, e.g. matching the carousel slide's caption) → publish.
   - Local → Live content transfer: backoffice Deploy dashboard → push the changed media to Live.
   - Then do step 3a (restore Live → Dev) to propagate to Dev.

4. **Verify Dev has the alt text**:
   - Hit Dev's page in the browser; right-click the first carousel image → Inspect → confirm `alt` is non-empty.
   - Or via curl:
     ```bash
     curl -sk "https://<dev-host>/<page-path>" | grep -oE '<img[^>]+>' | grep multiCaptionsOn
     ```

5. **Verify via targeted Playwright run**:
   ```bash
   URL=https://<dev-host>/ PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" \
     npx playwright test tests/e2e/blocks/imageCarousel.spec.ts --project=e2e
   ```
   Expected: the alt-text test at line 742 passes (and other imageCarousel tests stay green).

6. **Record the diagnosis-and-fix recipe** in `_features/fix-e2e-dev-only-failures.md`. Add `### imageCarousel — Dev media missing alt text`. Note the Live-canonical content rule and the restore-vs-edit decision tree.

**Validation**:
- [Automated]: Step 5 Playwright run passes the alt-text test.
- [Manual]: Browser inspection shows non-empty `alt` on the first carousel image on Dev.
- [Manual]: The feature doc has the imageCarousel recipe.

---

### Step 4 — Add "Diagnosing a red CI run" playbook to CLAUDE.md + commit

> **Prompt**: Implement Step 4 of `_plans/fix-e2e-dev-only-failures.md`. Add a new section titled "Diagnosing a red CI run" to CLAUDE.md, capturing the durable 3-step playbook (which gate? which job? new or pre-existing?) with exact `gh` commands. The diagnosis-and-fix recipes for the three specific failures live in `_features/fix-e2e-dev-only-failures.md` (added during Steps 1–3); this playbook is the generic method. Commit the CLAUDE.md change AND the feature-doc recipe additions in a single `📝 docs:` commit.

**What to build**:

- **`CLAUDE.md`**: add a new section called `## Diagnosing a red CI run`, placed logically near the existing `## CI/CD & Build hygiene` section (immediately after it makes sense, so the playbook sits next to the pipeline description it diagnoses). The section should contain:
  - **The 3-step procedure** as numbered steps with one-sentence motivation each:
    1. Identify which gate failed (`gh run list --branch <branch> --limit 3`, then `gh run view <run-id> --json jobs -q '.jobs[] | "\(.conclusion)\t\(.name)"'`).
    2. For each failed job, classify it: Gate 1 (build/test) → reproduce locally; Cloud sync → check `/check-uda`; Cloud deploy → portal logs; Playwright-against-Dev → step 3.
    3. For Playwright failures, distinguish new vs pre-existing by comparing against the previous master run for the same test (`gh run list --branch master --limit 10` then drill into the previous run's Playwright job and grep for the failing test name).
  - **The "go-to" command** for reading the actual error: `gh run view --job <id> --log 2>&1 | grep -B 1 -A 5 "Error:" | head -50`.
  - **A short table** mapping failure surface → diagnostic next step (mirror the one I wrote in conversation: Gate 1 / Cloud Sync / Artifact / Deploy / Playwright).
  - **One paragraph at the end** on habituation avoidance: every recurring red without diagnosis is a broken-window signal; if a failure is pre-existing and infrastructural, file it in the ROADMAP rather than letting it persist as background noise.
- **`_features/fix-e2e-dev-only-failures.md`**: the recipe additions from Steps 1–3 should already be present (added incrementally during each step). If any were skipped or are incomplete, finalize them here.

**Validation**:
- [Manual]: A contributor reading the new CLAUDE.md section can identify (in <2 minutes) which job failed in any given master run and whether the failure existed before their commit.
- [Automated]: `git diff` shows changes only to `CLAUDE.md` and `_features/fix-e2e-dev-only-failures.md`. No `src/` or `tests/` changes.

**Commit**: a single `📝 docs:` commit. Message: "📝 docs: capture red-CI diagnostic playbook + per-failure recipes" with a body explaining the playbook addition, the three recipes added during Steps 1–3, and the link back to the spec.

---

### Step 5 — Trigger Gate 2 against master + close the ROADMAP entry

> **Prompt**: Implement Step 5 of `_plans/fix-e2e-dev-only-failures.md`. With all three fixes deployed on Dev (Steps 1–3) and the playbook + recipes committed (Step 4), trigger Gate 2 to confirm the Playwright-against-Dev job runs fully green. If green, update ROADMAP.md to move the `fix-e2e-dev-only-failures` bullet from "Next" to "Recently shipped." If any tests still fail, triage: pre-existing-but-unmasked siblings get their own ROADMAP entry; an actually-introduced regression rolls back to the relevant step.

**What to do**:

1. **Merge the feature branch to master** (after Step 4's commit lands and the branch is pushed): `git checkout master && git pull github master && git merge --ff-only claude/feature/fix-e2e-dev-only-failures && git push github master`. This fires the full Gate 2 pipeline against the just-deployed Dev (which already has the Step 1–3 fixes applied).
2. **Alternative (faster)**: trigger Gate 2 manually with `gh workflow run main.yml --ref master` without pushing. Useful if you want to verify before merging the branch.
3. **Watch the Playwright-against-Dev job**:
   ```bash
   gh run list --branch master --limit 1
   gh run watch <run-id>
   ```
   Expected: `0 failed` in the headline. Per AC2.
4. **Triage any remaining failures**:
   - **Pre-existing-but-unmasked sibling** (a test that was reported "did not run" yesterday and now runs but fails on its own): file a new ROADMAP entry under "Next" with a short failure-mode description. Do NOT block this feature on those — they're a separate scope.
   - **Actually-new regression** (a test that was passing on the previous master run): roll back the relevant fix step or open a follow-up spec.
   - **Same 5 failures still red**: a fix didn't propagate. Re-verify the relevant step's recipe.
5. **Update ROADMAP.md**:
   - Remove the `fix-e2e-dev-only-failures` bullet from the "Next" section (line 27ish).
   - Add an entry under "Recently shipped" with today's date and a pointer to `_features/fix-e2e-dev-only-failures.md`. Match the format of existing shipped entries (e.g. `- [fix-e2e-dev-only-failures](_features/fix-e2e-dev-only-failures.md) — 2026-MM-DD`).
6. **Commit the ROADMAP change** as a separate `📝 docs:` commit: `docs: close fix-e2e-dev-only-failures roadmap entry`.

**Validation**:
- [Automated]: Gate 2's Playwright-against-Dev job reports `0 failed` (AC1, AC2).
- [Automated]: `git diff --stat ROADMAP.md` shows the entry moved from "Next" to "Recently shipped."

---

### Step 6 — Verify feature behavioral spec

> **Prompt**: Run `/feature update _features/fix-e2e-dev-only-failures.md` to verify the living behavioral spec reflects the actual fixes. Review each scenario against observed behavior on Dev. Fill in the Test Coverage table with the existing E2E test file:line citations (the tests didn't change; the verification is that they now pass on Dev). Remove the "Draft" banner. Update "Last verified" to the date Gate 2 went fully green. The `Diagnosis & Fix Recipes` section that was added incrementally during Steps 1–3 should already be in good shape; reconcile any drift and tighten language. Commit the verified feature doc.

**Validation**:
- [Manual]: Every scenario in the feature doc maps to a passing test on Dev or to observable Cloud-Portal state.
- [Manual]: Test Coverage table cites `tests/e2e/imageGenerator/dashboard.spec.ts:141`, the 3 tests in `tests/e2e/guides-cli.spec.ts`, and `tests/e2e/blocks/imageCarousel.spec.ts:742` — all marked Covered after Gate 2 went green.
- [Manual]: The `Diagnosis & Fix Recipes` section has all three recipes complete (imageGenerator, guides-cli, imageCarousel).
- [Manual]: Draft banner removed; "Last verified" date set.

---

## File Summary

| Action | File |
|--------|------|
| Create | `_features/fix-e2e-dev-only-failures.md` (already drafted in /spec) — Steps 1–3 incrementally add recipes; Step 6 finalizes |
| Modify | `CLAUDE.md` (Step 4 — add "Diagnosing a red CI run" section) |
| Modify | `ROADMAP.md` (Step 5 — move entry from "Next" to "Recently shipped") |
| Out-of-repo | Dev Cloud Portal: `OPENAI__APIKEY` Cloud Secret (Step 1) |
| Out-of-repo | Dev backoffice/Cloud Portal: guide-generator OAuth client config (Step 2) |
| Out-of-repo | Live backoffice (if needed) + Live→Dev content restore (Step 3) |
| Create/Update | `_features/fix-e2e-dev-only-failures.md` (Step 6 verification — final pass) |
