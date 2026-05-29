# Feature: Fix E2E Dev-Only Failures

The Playwright-against-Dev gate goes from "perpetually red on 5 known failures with ~27 serial-sibling blocked tests" to "1 deliberately skipped + 0 failed, with the remaining 4 originally-failing tests passing." Three independent fix paths — a CI env-var fix (guides-cli), a content fix (imageCarousel), and a documented deferral (imageGenerator) — each verifiable on its own. A durable diagnostic playbook lands in CLAUDE.md so future contributors don't habituate to red without diagnosis.

**Each of the three original hypotheses turned out to be wrong**: the imageGenerator failure was a Cloud runtime Node-launch gap (not an OpenAI key issue), the guides-cli failure was an env-var naming mismatch in CI (not an OAuth client issue), and the imageCarousel failure was a content gap on both Live and Dev (not a Live→Dev sync issue). The diagnosis-and-fix recipes capture both the wrong hypotheses (for future "don't repeat this dead end" value) and the real root causes.

**Source spec**: `_specs/fix-e2e-dev-only-failures.md`
**Last verified**: 2026-05-29 — targeted Playwright runs against Dev (guides-cli 9/9 pass, imageCarousel 50/50 pass, dashboard 1 skipped + 8 passed). Full Gate 2 verification pending merge to master.

---

## Increments

The per-feature mini-roadmap: shipped increments + planned increments + parking-lot ideas. Newest planned items first.

- [x] Fix 4 of 5 known Dev-only Playwright failures + defer the 5th + capture the diagnostic playbook in CLAUDE.md — shipped 2026-05-29 (spec: `_specs/fix-e2e-dev-only-failures.md`, plan: `_plans/fix-e2e-dev-only-failures.md`)
- [ ] **Followup: `cloud-image-generator-launch-path`** — the deferred 5th. Fixes Cloud Windows runtime Node-launch path so `dashboard.spec.ts:141` can un-skip. Spec: `_specs/cloud-image-generator-launch-path.md`
- [ ] **Followup: `fix-imagecarousel-first-image-picker`** — test brittleness; `imageCarousel.spec.ts:337` picks first 3 images by tree-walk order, will re-rot when media tree reshuffles. No spec yet
- [ ] Parking lot — triage any newly-surfaced failures from the ~27 previously-blocked serial-sibling tests, once Gate 2 actually runs them post-merge (no spec yet)

---

## Behaviors

Scenarios are grouped by Rule. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

### Rule: The Playwright-against-Dev gate goes from red to actionable after the three fix paths ship

```scenario
Scenario: Master push after all three fix paths land
  Given the guides-cli env-var fix ships in the workflow
  And the imageCarousel alt-text content fix is mirrored from Live to Dev
  And the imageGenerator failure is deliberately deferred via test.skip on Cloud URLs
  When a commit lands on master and Gate 2 runs
  Then Gate 1 (Build + xUnit) passes
  And the Cloud sync + artifact + deploy-to-Dev jobs all pass
  And the Playwright-against-Dev job reports 0 failed + 1 deliberately skipped
  And the 3 guides-cli tests pass
  And imageCarousel.spec.ts:742 passes
  And dashboard.spec.ts:141 is skipped with a comment pointing at the follow-up spec
```

### Rule: Dev's image generator failure is a Cloud-runtime infrastructure gap, not an OpenAI-key issue

```scenario
Scenario: dashboard.spec.ts:141 skips on Cloud URLs pending the launch-path fix
  Given the Cloud Dev container's worker PATH only has ancient Node 0.10.28 (no npx)
  And CliImageGenerator's npx-resolution probe is Unix-shaped (no .cmd/.exe extension)
  And scripts/image-generator/node_modules is not deployed to Cloud
  When dashboard.spec.ts:141 is executed against a URL matching /\.umbraco\.io/i
  Then the test is skipped with the message "Pending _specs/cloud-image-generator-launch-path.md..."
  And the other 8 dashboard tests still run and pass
  And running the same spec against localhost still exercises the full controller → CLI → Umbraco pipeline
```

### Rule: Dev's guide-generator CLI hits Dev (not localhost) after the workflow env block enumerates UMBRACO_BASE_URL

```scenario
Scenario: guides-cli tests pass on Dev after the CI env block sets UMBRACO_BASE_URL
  Given the Playwright job's env block includes UMBRACO_BASE_URL: ${{ vars.URL }}
  When execFileSync spawns the guide-generator CLI inside a guides-cli.spec.ts test
  Then the CLI's loadEnv reads process.env.UMBRACO_BASE_URL as Dev's URL
  And the CLI's token request against Dev returns HTTP 200
  And the CLI's subsequent Guides API + AI Agent SSE calls succeed
  And all 9 guides-cli tests pass (the originally-named 3 plus the 6 that were gated on the same URL)
```

### Rule: The carousel's first images have alt text on Live and Dev after the content fix

```scenario
Scenario: imageCarousel.spec.ts:742 passes on Dev after the local→Live→Dev content propagation
  Given the carousel test picks the first 3 images by tree-walk order (Codegarden keynote, Say Cheese, ...)
  And an editor has set altText on those media items in the local backoffice and published
  And the local→Live content transfer has propagated the altText to Live
  And the Cloud Portal's Live→Dev media restore has propagated it to Dev
  When the test fetches the rendered page
  Then the first .carousel-item.active img has a non-empty alt attribute
  And the test passes
  And re-running the full imageCarousel spec returns 50/50 passing
```

### Rule: Each fix is independently verifiable and ship-able

```scenario
Scenario: guides-cli fix can ship without the others
  Given only the workflow env block has been updated with UMBRACO_BASE_URL
  And the imageCarousel content fix and the imageGenerator deferral are still pending
  When the master push runs Gate 2
  Then the 9 guides-cli tests pass
  And the imageCarousel + imageGenerator tests still fail
  And the guides-cli fix is verified without dependency on the others
```

### Rule: Each diagnosed root cause has a durable diagnosis-and-fix recipe — including the wrong hypotheses

```scenario
Scenario: A future contributor faces the same imageGenerator failure on Dev
  Given a future master push fails on dashboard.spec.ts:141 with success: false
  When the contributor reads the feature doc's "imageGenerator — Dev returns success: false" recipe
  Then they see the failure signature ("Failed to launch image generator: ...Win32Exception...")
  And they see the original wrong hypothesis (OPENAI__APIKEY) flagged as such, so they don't waste a day re-deriving it
  And they see the four-layer real root cause stack (Worker PATH / CliImageGenerator Windows-shape / node_modules deployment / OpenAI key)
  And they see the verification curl + the follow-up spec link
  And they resolve the failure without re-investigating
```

### Rule: A red CI run is structurally easier to diagnose after this feature

```scenario
Scenario: A contributor faces a red master pipeline for the first time
  Given a contributor has pushed a commit to master and Gate 2 went red
  When they open CLAUDE.md and find "Diagnosing a red CI run"
  Then they see the 3-step playbook (which gate? which job? new or pre-existing?)
  And they see exact gh commands to identify the failing job
  And they see how to compare against the previous master run to determine novelty
  And they see a table mapping failure surface to first diagnostic next step
  And they avoid habituating to red without diagnosis
```

---

## Diagnosis & Fix Recipes

Per-failure playbooks for the originally-named 5 Dev-only failures. Each captures the failure signature, the *actual* root cause (not the initial hypothesis where they differ), the verification command, the fix step, and why it can recur.

### imageGenerator — Dev returns `success: false`

**Failure signature** — `tests/e2e/imageGenerator/dashboard.spec.ts:141` reports the generate endpoint returned 200 with `{ success: false, output: "Failed to launch image generator: ..." }` or `{ success: false, output: "...OpenAI..." }`.

**Original hypothesis (wrong, captured for posterity)** — Dev's `OPENAI__APIKEY` Cloud Secret is unset/invalid, so the CLI's OpenAI embedding call 401s.

**Actual root cause stack** (discovered 2026-05-29 during Step 1 of this feature): four layered blockers, all in front of the OpenAI key.

1. **Worker PATH lacks modern Node.** Cloud Dev's Azure App Service Windows container only has `C:\Program Files (x86)\nodejs\0.10.28\` on the worker's PATH. No `npx`. `WEBSITE_NODE_DEFAULT_VERSION` is unset. Modern Node versions (10.x–24.x including 22.22.2 matching local) live at `C:\Program Files\nodejs\<version>\` but aren't reachable without `ImageGenerator__NodeBinPath` pointing there.
2. **[CliImageGenerator.cs:73](src/HelloWorld/CliImageGenerator.cs#L73) is Unix-shaped.** Candidate probe is `Path.Combine(nodeBinPath, "npx")` — no `.cmd`/`.exe` extension. On Windows the actual binary is `npx.cmd`, so `File.Exists` always fails, and the controller falls back to bare `"npx"` on PATH (still missing).
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

**Failure signature** — 3+ tests in [tests/e2e/guides-cli.spec.ts](tests/e2e/guides-cli.spec.ts) fail on Dev. The CLI prints `ECONNREFUSED` or `connect EINVAL ::1:44367` (or similar localhost-targeted error) before any Umbraco interaction. The test's own `fetch` calls against Dev work fine; it's the CLI subprocess that fails.

**Original hypothesis (wrong, captured for posterity)** — Dev's guide-generator OAuth client is missing, expired, or scope-insufficient.

**Actual root cause** (discovered 2026-05-29 during Step 2 of this feature): **env-var name mismatch between the test and the CLI.**

- The test reads `process.env.URL` for its own `API_BASE` ([guides-cli.spec.ts:17](tests/e2e/guides-cli.spec.ts#L17)).
- The CLI reads `process.env.UMBRACO_BASE_URL` (or a fallback `.env` file) for its base URL — both in [scripts/guide-generator/src/umbracoApi.ts:39](scripts/guide-generator/src/umbracoApi.ts#L39) and [scripts/guide-generator/src/agentClient.ts:39](scripts/guide-generator/src/agentClient.ts#L39).
- CI's Playwright job ([.github/workflows/main.yml:155-159](.github/workflows/main.yml#L155-L159)) sets `URL` and `UMBRACO_URL` but **not `UMBRACO_BASE_URL`**. The CI runner has no `.env` file (it's gitignored). The CLI therefore falls back to its hardcoded default `https://localhost:44367` and tries to hit a non-existent host.

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

**Fix step** — one-line YAML change in [.github/workflows/main.yml:155-159](.github/workflows/main.yml#L155-L159) Playwright env block:

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

**Failure signature** — [tests/e2e/blocks/imageCarousel.spec.ts:742](tests/e2e/blocks/imageCarousel.spec.ts#L742) fails on Dev with:

```
Expected pattern: /.+/
Received string:  ""
locator resolved to <img alt="" loading="eager" class="d-block w-100" src="/media/bj5gpm45/codegarden-keynote.jpg"/>
```

If the 5-second wait window is long enough for the carousel to auto-advance, the trace also shows the next slide(s) — useful because the same media items light up across multiple test runs (e.g. `codegarden-keynote.jpg` + `say-cheese.jpg`), which is the brittleness signal.

**Original hypothesis (partly wrong)** — Dev's media records are out of sync with Live; a Live→Dev restore is the entire fix.

**Actual root cause** (discovered 2026-05-29 during Step 3): **both Live and Dev had empty `altText` on the affected images**, so restoring from Live didn't help — Live was equally broken. Plus a test-design wrinkle: the test picks the first images by depth-first tree-walk order ([imageCarousel.spec.ts:337](tests/e2e/blocks/imageCarousel.spec.ts#L337)) rather than a known seeded media item. Any future media upload that lands "first" in tree-walk order will re-break the assertion, even after this fix.

`Clean.Core.Extensions.GetAltText()` ([Clean.Core 7.0.5](~/.nuget/packages/clean.core/7.0.5/lib/net10.0/Clean.Core.dll)) reads the media's `altText` property and returns `""` if unset — no Name fallback. So an editor who skipped Alt Text in the Media editor produces an `<img alt="">` in the carousel, which fails the assertion AND is a real accessibility bug.

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
2. *Cross-environment drift*: editing alt text on Live but skipping the media restore to Dev (content restore alone doesn't pull binaries OR property edits to Dev's pre-existing records — see [Media files](CLAUDE.md#media-files) in CLAUDE.md).

**Followup ROADMAP entry**: `fix-imagecarousel-first-image-picker` — make the test deterministic (seed a known media item with known altText, or set altText in `beforeAll` with restoration in `afterAll`). Captured 2026-05-29.

**Lesson — what the original spec missed** — assumed Live was a usable "source of truth" without probing Live's actual content. Always verify the suspected source environment matches the desired end state BEFORE planning a restore as the fix. And: when a test passes locally but fails on Dev+Live, suspect a local-only content drift (someone set the alt text locally but never pushed up) more than a Live→Dev sync gap.

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Master push after all three fix paths land | [.github/workflows/main.yml](.github/workflows/main.yml) Gate 2 job `playwright-against-dev` | Pending post-merge Gate 2 run |
| dashboard.spec.ts:141 skips on Cloud URLs pending the launch-path fix | [tests/e2e/imageGenerator/dashboard.spec.ts:141](tests/e2e/imageGenerator/dashboard.spec.ts#L141) | Covered (verified 2026-05-29 against Dev: 1 skipped + 8 passed) |
| guides-cli tests pass on Dev after the CI env block sets UMBRACO_BASE_URL | [tests/e2e/guides-cli.spec.ts](tests/e2e/guides-cli.spec.ts) | Covered (verified 2026-05-29 against Dev: 9/9 passed) |
| imageCarousel.spec.ts:742 passes on Dev after local→Live→Dev propagation | [tests/e2e/blocks/imageCarousel.spec.ts:742](tests/e2e/blocks/imageCarousel.spec.ts#L742) | Covered (verified 2026-05-29 against Dev: 50/50 passed) |
| guides-cli fix can ship without the others | Implicit via independent commits — `🔧 ci:` (commit 4d8ec85) is the env fix in isolation | Covered by commit history |
| A future contributor faces the same imageGenerator failure on Dev | `## Diagnosis & Fix Recipes` → *imageGenerator — Dev returns success: false* (this doc) | Covered |
| A contributor faces a red master pipeline for the first time | [CLAUDE.md → Diagnosing a red CI run](CLAUDE.md#diagnosing-a-red-ci-run) | Covered |

---

## Revision Notes

- 2026-05-29 (initial): Draft scenarios from initial spec.
- 2026-05-29 (verified): All three fix paths exercised against Dev via targeted Playwright runs. Updated each Rule to reflect the *actual* root cause (which differed from the original hypothesis in all three cases). Test Coverage table filled in. Draft banner removed. Filed two follow-up ROADMAP entries: `cloud-image-generator-launch-path` (deferred imageGenerator fix) and `fix-imagecarousel-first-image-picker` (test brittleness around tree-walk-order picker). Full Gate 2 verification pending PR merge.
