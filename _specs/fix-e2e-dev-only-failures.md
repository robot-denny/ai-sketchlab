# Spec for fix-e2e-dev-only-failures

> This spec captures initial requirements and design rationale. For **current system behavior**, see `_features/fix-e2e-dev-only-failures.md`.

branch: claude/feature/fix-e2e-dev-only-failures

## Summary

The Playwright-against-Dev gate (Gate 2's final job in [.github/workflows/main.yml](.github/workflows/main.yml)) has been red on every recent master push despite the affected behaviors working fine on Live and locally. Today's run reports **218 passed / 31 failed**; the 31 trace back to **5 distinct root causes** plus ~27 serial-sibling tests that "did not run" because Playwright workers were blocked by the first failures. All five are **Dev-environment or Dev-content gaps**, not test bugs or code regressions — verified 2026-05-27 by running each spec against a local site (local renders byte-identically to Live).

Leaving the gate red trains the team to **dismiss CI**: every master push goes red, every red is "the known Dev failures," and the moment a real regression slips in nobody notices because the canary's been crying wolf for weeks. This spec is the antidote — fix the three categories of root cause, restore the gate to green, and make it a meaningful signal again.

The three categories (5 tests total):

1. **imageGenerator** — 1 test ([dashboard.spec.ts:141](tests/e2e/imageGenerator/dashboard.spec.ts#L141), `generate endpoint succeeds end-to-end for an existing article`). The controller returns `{ success: false, output: <error> }` on Dev because Dev's `OPENAI__APIKEY` Cloud Secret is missing/invalid — when `CliImageGenerator` shells out to the Node CLI, the OpenAI embedding call fails, the CLI exits non-zero, and the controller faithfully reports the failure.
2. **guides-cli** — 3 tests in [guides-cli.spec.ts](tests/e2e/guides-cli.spec.ts). The guide-generator CLI authenticates against Dev's Management API with a client-credentials OAuth client. The Dev client id/secret/scopes are unverified — likely either missing, expired, or scope-insufficient.
3. **imageCarousel** — 1 test ([imageCarousel.spec.ts:742](tests/e2e/blocks/imageCarousel.spec.ts#L742), `first image has a non-empty alt attribute`). The carousel slide media on Dev has empty `alt` text. Pure **content** fix — Dev's media records are out of sync with Live (likely from the last "restore from Live to Dev" being incomplete, or from a content edit on Live that didn't fan out).

The fix for each category is independent; this spec ships them as three small increments under one feature so each closes cleanly and the gate flips green incrementally as fixes land.

This is also the first feature where the **process for diagnosing a red CI run** gets exercised end-to-end on a known set of failures — pairs naturally with adding a "Diagnosing a red CI run" section to CLAUDE.md so the playbook becomes durable.

## Functional Requirements

- **Diagnostic loop closed for all 5 named failures.** For each test, the spec records (a) the observed failure mode on Dev, (b) the root-cause hypothesis, (c) the concrete fix step (Cloud Secret update / OAuth client rotation / content edit), and (d) the post-fix verification command. The plan derives implementation steps from this catalog.
- **imageGenerator root cause resolved.** Dev's `OPENAI__APIKEY` Cloud Secret is set to a working value (using the double-underscore form per CLAUDE.md). The Cloud-portal-secret naming rules (no `:` permitted; portal flattens `__` → `:` at runtime) are honored. After the fix, a manual hit on `POST https://<dev>/umbraco/api/image-generator/generate/<id>?force=true` returns `{ success: true, output: "...Done..." }`.
- **guides-cli root cause resolved.** Dev's guide-generator OAuth client (separate from the Playwright test client) has a valid client_id, client_secret, and the scopes needed to read/write under the Guides parent. After the fix, the guide-generator CLI run from the spec's setup completes without auth errors.
- **imageCarousel root cause resolved.** The carousel media on Dev has non-empty `alt` text. The fix path is either (a) update the alt text directly on Dev (one-time content edit) **and** mirror it on Live so the next Live→Dev restore doesn't undo it, or (b) re-run a Live→Dev content restore from the Cloud Portal so Dev inherits Live's already-correct alt text. Decide during /plan based on whether Live's media has alt text today.
- **Gate 2's Playwright-against-Dev job runs fully green** after all three categories are resolved. No `failed` entries in the headline output; the previously-blocked ~27 "did not run" tests run on their own merits.
- **A diagnostic playbook is captured in CLAUDE.md** — a "Diagnosing a red CI run" section that documents the 3-step procedure (which gate? which job? new or pre-existing?) with the exact `gh` commands. Future contributors don't re-derive this; future habituation-to-red is structurally discouraged.
- **The ROADMAP entry for `fix-e2e-dev-only-failures` is closed** and the feature doc moves into the `Recently shipped` section once verified green.

## Possible Edge Cases

- **Cloud Secret naming**: Cloud portal rejects `:` in secret names. Must use `OPENAI__APIKEY` / `ANTHROPIC__APIKEY`. The `.uda` connection placeholders (`$OpenAI:ApiKey`) and `appsettings.Development.json` (`"OpenAI:ApiKey"`) keep the colon form — .NET flattens `__` → `:` when building `IConfiguration`. Setting the wrong form (e.g. `OPENAI:APIKEY` rejected, or `OPENAI_APIKEY` single-underscore silently not bound) is a real risk.
- **AI Connection placeholder pointing at a key that's not set**: the backoffice AI Connection references `$OpenAI:ApiKey`; if Dev's Cloud Secret is unset, the placeholder resolves empty and OpenAI calls 401 silently. Verify both the secret value AND the AI Connection's reference.
- **Live→Dev content restores wipe local Dev edits**: if the alt-text fix is applied directly on Dev (Option A above), the next "restore from Live to Dev" via the portal will revert it unless Live also got the same edit. Live must be the authoritative source for content fixes.
- **OAuth client scope insufficiency vs missing client**: the guides-cli failure could be the client doesn't exist, or it exists but lacks scopes to write under Guides. The diagnostic must distinguish: a missing client returns 401 on `/token`; an under-scoped client returns 200 on `/token` but 403 on the actual API call.
- **Serial-sibling cascade**: the 5 failures don't fail in isolation — they block ~27 dependent tests reported as "did not run". Fixing the 5 may surface new failures from those previously-blocked siblings. Plan should account for one or two unmasked failures to triage on the first green-attempt master push.
- **Token cache staleness**: `guides-cli.spec.ts` reuses a token for 250s. If a fix involves rotating the OAuth client, in-flight tests with cached tokens may misreport. Plan should refresh tokens between fix and verification.
- **Memory note about Cloud shared secrets being one-shot**: per `[[project_cloud_shared_secrets_one_shot]]`, Cloud's shared/project-wide secrets can't be retroactively converted from per-env without rotating actual API keys. If the OpenAI key was intended to be shared but is currently per-env (or vice versa), the fix may require a key rotation step.

## Acceptance Criteria

- **AC1**: After fixes, all 5 originally-failing Playwright tests **pass on the next master push's Gate 2 Playwright-against-Dev run** — `dashboard.spec.ts:141` (imageGenerator), the 3 tests in `guides-cli.spec.ts`, and `imageCarousel.spec.ts:742`.
- **AC2**: The Gate 2 Playwright-against-Dev job ends with **0 failed** in the headline output (any test reporting `did not run` because of unrelated infra resolves to either pass or a properly-attributed new failure).
- **AC3**: Each of the three root-cause categories has a **documented diagnosis-and-fix recipe** captured in the feature doc — what the failure looks like, how to confirm the cause, the exact fix step (with placeholders for secret names / OAuth client paths / content node IDs), the verification command. The recipe is concrete enough that the next person facing the same failure can resolve it without re-investigating.
- **AC4**: The three categories are addressed as **three independent fix steps**, each ship-able and verifiable on its own — the plan does not bundle them into a single all-or-nothing change.
- **AC5**: A **"Diagnosing a red CI run"** section is added to CLAUDE.md — the 3-step playbook (which gate? which job? was it failing before my commit?) with the exact `gh run list` / `gh run view --job <id> --log` commands. Captured durably so the next contributor doesn't re-derive it.
- **AC6**: No code changes required in `src/HelloWorld/`, `src/UmbracoProject/`, or `tests/e2e/` — the existing tests are correct; the fixes live in Cloud configuration and (for imageCarousel) Cloud content. If a code change turns out to be needed, surface it as an open question and reassess scope.
- **AC7**: After fixes, the ROADMAP.md `fix-e2e-dev-only-failures` bullet is **removed** from "Next" and the feature is moved to "Recently shipped" with a link to the feature doc.

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation. See `_features/fix-e2e-dev-only-failures.md` for the verified version.

### Rule: The Playwright-against-Dev gate goes green after the three root-cause fixes ship (AC1, AC2)

```scenario
Scenario: Master push after all three fixes lands a green Gate 2
  Given the imageGenerator, guides-cli, and imageCarousel root causes are all resolved
  When a commit lands on master and the pipeline runs
  Then Gate 1 (Build + xUnit) passes
  And the Cloud sync + artifact + deploy-to-Dev jobs all pass
  And the Playwright (against Dev) job reports 0 failed
  And the 5 originally-failing tests now pass
```

### Rule: Dev's image generator works end-to-end after the OpenAI secret is set (AC1)

```scenario
Scenario: dashboard.spec.ts generate-success test passes on Dev
  Given Dev's OPENAI__APIKEY Cloud Secret is set to a working OpenAI key
  And the AI Connection in Dev's backoffice references $OpenAI:ApiKey
  When the dashboard.spec.ts:141 test runs against Dev
  Then POST /umbraco/api/image-generator/generate/<id>?force=true returns HTTP 200
  And the body is { success: true, output: "...Done...|generated..." }
  And the test passes
```

### Rule: Dev's guide-generator CLI authenticates and operates after the OAuth client is fixed (AC1)

```scenario
Scenario: guides-cli tests pass on Dev
  Given Dev's guide-generator OAuth client has a valid id and secret
  And the client has scopes sufficient to read/write under the Guides parent
  When the 3 tests in guides-cli.spec.ts run against Dev
  Then the CLI's token request returns HTTP 200
  And the CLI's subsequent Guides API calls succeed
  And all 3 tests pass
```

### Rule: The carousel's first slide has alt text on Dev after the content fix (AC1)

```scenario
Scenario: imageCarousel.spec.ts:742 alt-text test passes on Dev
  Given the carousel media item used by the multi-caption test slide has non-empty alt text on Dev
  When the imageCarousel.spec.ts:742 test runs against Dev
  Then the first .carousel-item.active img has a non-empty alt attribute
  And the test passes
```

### Rule: Each fix is independently verifiable and ship-able (AC4)

```scenario
Scenario: imageGenerator fix can ship on its own
  Given only the OPENAI__APIKEY Cloud Secret has been set
  And the guides-cli and imageCarousel fixes are still pending
  When the master push runs Gate 2
  Then dashboard.spec.ts:141 passes
  And the guides-cli and imageCarousel tests still fail
  And the imageGenerator fix is verified without dependency on the others
```

### Rule: Each root cause has a durable diagnosis-and-fix recipe (AC3)

```scenario
Scenario: A future contributor faces the same imageGenerator failure
  Given a future master push fails on dashboard.spec.ts:141 with success: false
  When the contributor reads the feature doc's diagnosis-and-fix recipe for imageGenerator
  Then they see the failure signature ({ success: false, output: "..." with OpenAI/auth keyword)
  And they see the verification command to confirm the root cause
  And they see the exact Cloud-portal step to rotate or set OPENAI__APIKEY
  And they can resolve the failure without re-investigating
```

### Rule: A red CI run is structurally easier to diagnose after this feature (AC5)

```scenario
Scenario: A contributor faces a red master pipeline for the first time
  Given a contributor has pushed a commit to master and Gate 2 went red
  When they open CLAUDE.md and find "Diagnosing a red CI run"
  Then they see the 3-step playbook (which gate? which job? new or pre-existing?)
  And they see exact gh commands to identify the failing job
  And they see how to compare against the previous master run to determine novelty
  And they avoid habituating to red without diagnosis
```

## Open Questions

- **Is the OpenAI key on Live the same one that should go on Dev, or should Dev have its own?** Per CLAUDE.md (and the [[project_cloud_shared_secrets_one_shot]] memory), Cloud secrets are per-environment by default. Recommend Dev gets its own dedicated OpenAI key — different billing visibility, easier to rotate/revoke independently. Confirm during /plan.
- **The Dev OAuth client for guides-cli**: does one exist at all, or does it need to be created from scratch? If it exists, what's the source of truth for its credentials (1Password? Cloud portal app-settings? a `.env`-style file on the runner?). The GitHub Secrets table in CLAUDE.md lists `UMBRACO_CLIENT_ID` / `UMBRACO_CLIENT_SECRET` for the Playwright test client — is the guide-generator CLI supposed to use the same client, or a separate one with broader scopes?
- **For imageCarousel: is Live's media correct?** If Live has alt text on the slides, the fix is "restore Live→Dev". If Live also has the empty alt, the fix is "edit on Live, then restore Live→Dev". Need to inspect Live's media before deciding. The pre-existing local→Live content-transfer habit ([[project_content_authoring_direction]]) means the edit is done locally first, then transferred.
- **Should `dashboard.spec.ts:141` be marked `test.skip()` on Dev pending the fix to unblock the gate immediately?** Argument for: gets the gate green now, lets the broader signal recover. Argument against: hides the failure, and the whole point of this feature is to NOT habituate to red. Recommend NOT skipping — let the gate stay red on the specific known failures until they're properly fixed, in chronological order across the three increments.
- **Order of operations for the three fixes**: imageGenerator → guides-cli → imageCarousel is the natural order (imageGenerator is highest-impact / blocks more siblings; imageCarousel is content-only and easy). Or do them in parallel as three independent commits? Decide during /plan.
- **What about the ~27 serial-sibling "did not run" tests?** After the 5 root causes are fixed, those should run. They MAY surface new failures of their own that have been masked all along. Plan should explicitly check this after each fix lands, and triage any newly-surfaced failures with the standard /spec → /plan loop rather than letting them silently re-pollute the gate.

## Testing Guidelines

This feature has **no new test files**. The existing Playwright tests are the verification surface — they pass on Dev = the fix worked.

What to verify per fix (no new tests required):

- **After imageGenerator fix**: run `PATH="..." npx playwright test tests/e2e/imageGenerator/dashboard.spec.ts --project=e2e` with `URL=https://<dev>`. Expected: all dashboard tests pass, including the generate-success test at line 141.
- **After guides-cli fix**: run `PATH="..." npx playwright test tests/e2e/guides-cli.spec.ts --project=e2e` with `URL=https://<dev>`. Expected: all 3 tests pass.
- **After imageCarousel fix**: run `PATH="..." npx playwright test tests/e2e/blocks/imageCarousel.spec.ts --project=e2e` with `URL=https://<dev>` AND verify alt text in the backoffice Settings → Media on Dev. Expected: the first-image alt-text test at line 742 passes; backoffice shows non-empty alt text on the multi-caption carousel media.
- **Final gate verification**: after all three fixes land, push a commit to master and watch the Gate 2 Playwright job — expected `0 failed`, with any newly-surfaced "did not run → now runs" failures triaged separately per the open question above.

The CLAUDE.md "Diagnosing a red CI run" section is the durable artifact — it documents the diagnostic loop this feature exercises so the next contributor doesn't re-discover it.
