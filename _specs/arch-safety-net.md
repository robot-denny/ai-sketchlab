# Spec for arch-safety-net

> **Bundle spec — no feature doc.** This is an infrastructure bundle, not a user-facing feature, so it does not earn a `_features/arch-safety-net.md` doc (same playbook as `site-polish-2026-05`). It bundles four ROADMAP "Now" items into a single coherent spec because their decisions interlock.

branch: claude/feature/arch-safety-net

## Summary

Build the safety net that makes the upcoming `arch-feature-folder-migration` fearless rather than anxious. The migration will move ~60 Razor files plus most of the C# surface into a new `Features/<FeatureName>/` layout. Without automated build + visual-regression + null-safety checks, every slice of that refactor is a leap of faith. This bundle installs those checks now, while the surface is still small and the fix-up is bounded.

It covers four ROADMAP items as a single integrated workstream:

1. **arch-ci-pipeline** — adopt **Umbraco Cloud CI/CD Flow** as the deploy mechanism. Replaces the current git-push-to-Cloud pipeline with a GitHub Actions workflow that runs `cloud-sync` → `dotnet build` → `dotnet test` → Playwright → package artifact → upload via Cloud API → trigger deploy → poll status. Build/test failures genuinely *gate* the deploy (no artifact upload, no API call). Feature-branch pushes run build/test only as feedback; master triggers the full deploy chain. Plus a pre-push git hook locally so failures surface before the push, not after.
2. **arch-screenshot-baselines** — Playwright `toHaveScreenshot()` baselines for every block component and the page templates that compose them, so visual regressions during the migration surface as a snapshot diff.
3. **arch-nullable-warnings-as-errors** — enable `<Nullable>enable</Nullable>` + `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` on both `.csproj` files, catching null-safety bugs at build time before they ship.
4. **test-infra-centralise-nodetls** — consolidate the `NODE_TLS_REJECT_UNAUTHORIZED = '0'` boilerplate (duplicated across every Playwright spec) into `playwright.config.ts`. Direct prereq for the screenshot work, which will add many new spec files.

The bundle's "user" is the developer who will subsequently run the migration, and the Cloud deploy pipeline that ships to Live. Success looks like: any Razor file move, any service extraction, any composer rewire either (a) is caught by CI and *blocks* the deploy before it reaches Live, or (b) ships cleanly because the build, tests, and screenshots all confirm equivalent behavior. "No PR workflow" is true, but "no deploy gate" is *not* — under Cloud CI/CD Flow the API call to deploy is the gate, and we control whether it fires.

## Functional Requirements

### CI pipeline (Umbraco Cloud CI/CD Flow)

This bundle replaces the current git-push-to-Cloud deploy with Cloud's CI/CD Flow API. The repo's existing `.umbraco` project-root pointer remains for Cloud's build, but the *trigger* for deploys moves from "git push to the Cloud git remote" to "GitHub Actions calls the Cloud CI/CD API."

- **Workflow topology** — based on the upstream sample (4 YAMLs under `.github/workflows/`):
  - `main.yml` — orchestrator triggered by repo pushes
  - `cloud-sync.yml` — pulls Cloud's auto-commits (e.g. normalised `.uda` re-serialisation) back to the repo before we build
  - `cloud-artifact.yml` — packages the project as a Cloud-compliant zip and uploads to `https://api.cloud.umbraco.com`
  - `cloud-deployment.yml` — POSTs the deployment, then polls status (recommended cadence: every 25 seconds for up to ~15 minutes)
- **Triggers**:
  - Push to `master` → full chain: `cloud-sync` → build → xUnit → Playwright → `cloud-artifact` → `cloud-deployment`
  - Push to `claude/feature/**` → feedback-only: build → xUnit → Playwright. *No* artifact upload, *no* deploy call.
- **Build + test steps inserted between `cloud-sync` and `cloud-artifact`** (this is the upstream sample's explicit extension point):
  1. Restore + build (`dotnet build -c Release`)
  2. xUnit (`dotnet test --no-build -c Release`)
  3. Install Node + Playwright + browsers
  4. Run Playwright E2E suite (`npx playwright test --project=chromium`)
  5. *Only if all above pass*: proceed to `cloud-artifact`. Any failure short-circuits with no upload, no deploy.
- **Outcome on failure**: workflow fails red. Because the API deploy call hasn't been made, **Live is not touched**. This is the real gate the safety net depends on.
- **Target environment**: the first deploy target is the **leftmost Cloud environment** (typically Development) per the CI/CD Flow default. Promotion to Staging/Live is a follow-up (see Open Questions — the promotion endpoint is documented as "not fully operational").
- **Runtime budget**: target end-to-end CI run (build + tests, *before* deploy) under 10 minutes on default GitHub runners. The Cloud deploy itself adds isolated-instance startup time; that's separate from CI runtime and not optimised here.
- **Secrets** (GitHub repository secrets / variables):
  - `UMBRACO_CLOUD_API_KEY` — from Cloud Portal → Configuration → CI/CD Flow (project-specific, not restorable if regenerated)
  - `PROJECT_ID` — Cloud project ID
  - `TARGET_ENVIRONMENT_ALIAS` — environment alias (variable, not secret)
  - `UMBRACO_CLIENT_ID` / `UMBRACO_CLIENT_SECRET` / `URL` — *still needed* for Playwright auth.setup.ts against the runner-local Umbraco site
- **Zip artifact format**: must match Cloud's required source-file format. The sample workflow overwrites `.gitignore` with `cloud.gitignore` and uses `cloud.zipignore` to exclude developer files from the package — both files come from the sample and must be added to the repo.
- **Concurrency**: `concurrency: ${{ github.ref }}` + `cancel-in-progress: true` to prevent stacked runs on rapid pushes to the same branch.

### Pre-push git hook

Provides fast local feedback before a push triggers CI. Under Cloud CI/CD Flow, the *real* gate is CI itself (since CI is what calls the deploy API). The pre-push hook is a developer-ergonomics layer: catch the failure in <60s locally instead of waiting for CI minutes.

- **Trigger**: `git push` from any contributor's local machine.
- **Behavior**: Runs build + xUnit locally before allowing the push to proceed. Playwright is *not* in the pre-push hook (too slow); the full Playwright suite runs in CI.
- **Skip mechanism**: Setting `SKIP_PREPUSH=1` bypasses the hook for emergencies (mirrors the `SKIP_UDA_CHECK=1` precedent in `.githooks/pre-commit`).
- **Installation**: Hook lives in `.githooks/pre-push`; activated via the existing `git config core.hooksPath .githooks` setup (see README).
- **Runtime budget**: target <60s. If exceeded regularly, contributors will `--no-verify` it and the gate becomes theater.

### Screenshot baselines

- **Coverage**: One Playwright spec per block component, asserting a screenshot baseline for the rendered output on a canonical test page. Covers:
  - All 11 components under `Views/Partials/blocklist/Components/`
  - All 12 components under `Views/Partials/blockgrid/Components/`
  - The 4 "shim" blockgrid components (alertBanner, iconLinkRow, imageRow, richTextRow) explicitly assert that the blockgrid render matches the blocklist render — these shims must stay in sync.
- **Page-level coverage**: One screenshot per page template (`home.cshtml`, `articleListing.cshtml`, `article.cshtml`, `experimentsLandingPage.cshtml`, `search.cshtml`, `contact.cshtml`).
- **Stability strategy**:
  - Baselines are generated and committed by CI's Linux runner so they're authoritative across machines. Developers regenerate locally via `npx playwright test --update-snapshots`.
  - Per-spec tolerance: `maxDiffPixelRatio: 0.01` (1% pixel tolerance) by default; tighter for blocks that should be byte-identical.
  - Hide non-deterministic elements (timestamps, animations) via `mask:` option or by setting `prefers-reduced-motion: reduce` in the test context.
- **Storage**: snapshots under `tests/e2e/**/<spec>-snapshots/`. Committed to git so future migrations diff against them.

### Nullable + warnings-as-errors

- **Projects affected**: [src/UmbracoProject/UmbracoProject.csproj](src/UmbracoProject/UmbracoProject.csproj), [src/HelloWorld/HelloWorld.csproj](src/HelloWorld/HelloWorld.csproj), and [tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj](tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj).
- **Properties added**:
  - `<Nullable>enable</Nullable>`
  - `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`
- **Fix-up scope**: ~11 hand-written .cs files outside Views, plus any warnings the upgrade surfaces in test code. Bounded; expected fix-up under a half-day.
- **Razor views**: nullable warnings in `.cshtml` files compile via the Razor compiler at runtime; these are *not* gated by `TreatWarningsAsErrors` at the `.csproj` level. Out of scope.
- **Auto-generated published models** (`Umbraco.Cms.Web.Common.PublishedModels`): generated at runtime under `umbraco/Data/TEMP/InMemoryAuto/`, gitignored. Out of scope.

### Test-infra centralisation

- **Move**: Hoist `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` from individual spec files into `playwright.config.ts` (single location).
- **Audit**: After the hoist, grep `tests/e2e/` for any other duplicated module-scope environment setup or boilerplate; if anything else is duplicated 3+ times, hoist that too. Otherwise leave alone — don't speculatively abstract.
- **Verification**: All existing Playwright specs continue to pass with no per-spec NODE_TLS line present.

## Possible Edge Cases

- **CI cannot start the Umbraco site**: SQLite is bundled but the site needs a working `appsettings.Development.json` analog (CI must inject one with test credentials, or use a minimal `appsettings.CI.json`). Missing AI keys must not block the build — the AI features should degrade gracefully or be skipped entirely in CI test runs.
- **Playwright auth.setup.ts hits a rate limit during repeated CI runs**: the OAuth client credentials grant can exhaust if hit too quickly. If the auth setup uses a token cache (it should), this is a non-issue; otherwise CI runs will need a delay or a cached-token strategy.
- **Screenshot baseline thrash across font-rendering differences**: macOS vs Linux render fonts subtly differently. Baselines must be generated on Linux (the CI runner) to be the authoritative source; Mac-side regeneration produces diffs that block CI. Document the workflow: regenerate on Linux only.
- **Nullable warnings surface in third-party-package-derived code paths**: some Umbraco contracts may return `null` from typed properties (e.g., `Model.Value<string>("alias")`). The fix is per-call annotation, not turning off the rule.
- **Pre-push hook makes pushes painful for one-line doc commits**: an env-var skip mechanism is mandatory (e.g., `SKIP_PREPUSH=1`). Also: if the hook regularly exceeds 60 seconds, contributors will start using `--no-verify` and the gate becomes theater. Set a runtime budget.
- **CI runs concurrently from multiple developers pushing to feature branches**: GitHub Actions concurrency keys should cancel in-progress runs on stale commits to a branch (`concurrency: ${{ github.ref }}` + `cancel-in-progress: true`). Otherwise CI queue grows unbounded.
- **Screenshot baselines for blocks that depend on dynamic content** (e.g., `latestArticlesRow` which queries the live content tree): each baseline spec needs a fixed-content test page or a mock-data strategy to be stable.
- **Tests project not yet included in the solution's CI build path**: confirm [umbraco-17-demo-site.sln](umbraco-17-demo-site.sln) includes `tests/UmbracoProject.Tests` so `dotnet build` covers it.
- **`cloud-sync` race condition mid-pipeline**: if a Cloud auto-commit (e.g. normalised `.uda`) lands during the build/test phase, the artifact uploaded won't include it. The sample's `cloud-sync` step runs *first*, but doesn't lock Cloud against further commits during the run. Mitigation: rely on the sample's flow (sync → build → deploy → poll); if a stale-deploy issue surfaces in practice, add a post-deploy sync verification step.
- **Zip artifact format non-compliance**: Cloud's API rejects artifacts that don't match its expected zip structure. The sample workflow handles this via `cloud.gitignore` + `cloud.zipignore` swap-in. Both files must come from the upstream sample and be committed to the repo unmodified.
- **Cloud isolated-instance startup adds deploy duration**: per Cloud docs, CI/CD Flow deploys are slower than direct git-push deploys due to isolated instance startup. CI runtime budget (under 10 min) covers build+test only — the deploy itself can run longer and is not optimised here.
- **AI calls during Playwright runs would require CI-side keys**: confirm no existing E2E spec triggers an OpenAI/Anthropic call. If any do, either stub them or accept the key-in-CI cost (with appropriate spending limits). Cloud's deploy itself does *not* execute AI calls; only test runs might.
- **Promotion to Staging/Live**: per Cloud docs, the promotion endpoint is "not fully operational." This bundle deploys only to the leftmost env (Development); Staging→Live promotion remains a manual or follow-up workflow.
- **Local-only schema changes still required**: Cloud CI/CD Flow does not relax the existing "author schema locally, never on Cloud" rule documented in CLAUDE.md. The risk surface is the same as today.
- **File casing conflicts (e.g. `README.md` vs `Readme.md`)**: documented Cloud constraint. Likely a non-issue here but worth checking once during implementation.

## Acceptance Criteria

1. **GitHub Actions workflows exist** under `.github/workflows/` matching the upstream Cloud CI/CD Flow sample shape: `main.yml`, `cloud-sync.yml`, `cloud-artifact.yml`, `cloud-deployment.yml` (or an equivalent merged structure).
2. **Push to master triggers the full chain** in order: `cloud-sync` → build → xUnit → Playwright → `cloud-artifact` (zip upload) → `cloud-deployment` (API call + status polling). Any failure before `cloud-artifact` aborts the chain with no upload and no deploy.
3. **Push to `claude/feature/**` triggers build + xUnit + Playwright only** as feedback — no artifact upload, no deploy call.
4. **CI build + test phase completes under 10 minutes** for a typical no-flake run on the default GitHub Actions runner. Deploy duration is separate and not budgeted here.
5. **Cloud-side artifacts are committed**: `cloud.gitignore` and `cloud.zipignore` (from the upstream sample) are present in the repo and used by the artifact-packaging step.
6. **Required GitHub secrets/variables are documented in CLAUDE.md**: `UMBRACO_CLOUD_API_KEY`, `PROJECT_ID`, `TARGET_ENVIRONMENT_ALIAS`, plus the existing `UMBRACO_CLIENT_ID` / `UMBRACO_CLIENT_SECRET` / `URL` for Playwright auth.
7. **Pre-push git hook** at `.githooks/pre-push` runs build + xUnit locally and blocks the push on any failure.
8. **Pre-push hook honours `SKIP_PREPUSH=1`** to bypass for emergencies.
9. **Every block component** under `blocklist/Components/` and `blockgrid/Components/` has at least one Playwright spec asserting a screenshot baseline.
10. **Every page template** (home, articleListing, article, experimentsLandingPage, search, contact) has at least one Playwright spec asserting a page-level screenshot baseline.
11. **Shim blockgrid components** (the 4 that delegate to blocklist) have a baseline that explicitly proves render equivalence with the blocklist counterpart.
12. **All three `.csproj` files** have `<Nullable>enable</Nullable>` + `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`.
13. **`dotnet build`** produces zero warnings and zero errors under the new settings.
14. **`NODE_TLS_REJECT_UNAUTHORIZED` is set in `playwright.config.ts` exactly once**; no Playwright spec file contains a module-scope `process.env.NODE_TLS_REJECT_UNAUTHORIZED` line.
15. **All existing tests** (xUnit + Playwright) continue to pass under the new infrastructure.
16. **CLAUDE.md** is updated to document the new Cloud CI/CD Flow workflow, the pre-push hook, the screenshot baseline regeneration workflow (Linux-only), the new nullable/warnings-as-errors expectations, and the required GitHub secrets.

## Scenarios (Draft)

### Rule: Push to master triggers the full deploy chain; failures before artifact upload block the deploy

```scenario
Scenario: Developer pushes a passing master commit
  Given the developer has committed code that builds, passes xUnit, and passes Playwright
  When they push to master
  Then cloud-sync runs and pulls any pending Cloud auto-commits
  And build, xUnit, and Playwright run in order — all pass
  And cloud-artifact zips and uploads the artifact to the Cloud API
  And cloud-deployment POSTs the deployment and polls until completion
  And the deploy completes successfully on the target environment
```

```scenario
Scenario: Developer pushes a master commit with a broken xUnit test
  Given the developer has committed code where one xUnit test fails
  When they push to master
  Then cloud-sync runs and pulls any pending Cloud auto-commits
  And build runs (success) then xUnit runs (failure)
  And the workflow aborts before Playwright runs
  And cloud-artifact does NOT run — no artifact is uploaded
  And cloud-deployment does NOT run — no deploy is triggered
  And Live is unchanged
  And the developer sees a failure notification in GitHub
```

```scenario
Scenario: Developer pushes a screenshot-regressing template change to master
  Given the developer has committed a template change that alters the rendered HTML of alertBanner
  When they push to master
  Then build succeeds, xUnit passes, Playwright runs the alertBanner screenshot spec
  And the spec fails with a visible pixel diff in the workflow artifact
  And cloud-artifact does NOT run
  And cloud-deployment does NOT run
  And Live is unchanged until the regression is intentional and the baseline is updated
```

### Rule: Feature-branch pushes run build + test as feedback only — no deploy

```scenario
Scenario: Developer pushes a feature branch
  Given the developer has committed code on claude/feature/example-feature
  When they push the branch
  Then build, xUnit, and Playwright run in order
  And cloud-sync does NOT run (master-only)
  And cloud-artifact does NOT run (master-only)
  And cloud-deployment does NOT run (master-only)
  And Live is unchanged regardless of the outcome
```

### Rule: A pre-push hook gives developers fast local feedback before they push

```scenario
Scenario: Pre-push hook blocks a failing push
  Given the developer has committed code that fails an xUnit test
  When they run git push
  Then the pre-push hook runs build then xUnit (Playwright is CI-only)
  And xUnit fails
  And the hook prints the failing test name and exits non-zero
  And the push is aborted before any network call
  And CI is never triggered (so the deploy chain never starts either)
```

```scenario
Scenario: Pre-push hook honours SKIP_PREPUSH=1 for emergencies
  Given the developer needs to push a doc-only commit and knows the test suite is currently flaky
  When they run SKIP_PREPUSH=1 git push
  Then the pre-push hook detects the env var and skips all checks
  And the push proceeds immediately
  And no CI workflow change is needed (CI still runs on the push)
```

### Rule: Every block component and page template has a Playwright screenshot baseline

```scenario
Scenario: Every blocklist component has a screenshot baseline
  Given the developer lists every .cshtml file under Views/Partials/blocklist/Components/
  When they grep tests/e2e/ for a corresponding screenshot spec
  Then every component has at least one matching spec asserting toHaveScreenshot()
```

```scenario
Scenario: Shim blockgrid component proves render equivalence with blocklist counterpart
  Given the alertBanner shim under blockgrid/Components/ delegates to the blocklist version
  When the equivalence spec runs in CI
  Then it renders both blocklist alertBanner and blockgrid alertBanner with identical input
  And asserts the rendered HTML and screenshot match exactly
```

```scenario
Scenario: Refactoring a template without changing output produces zero screenshot diffs
  Given the developer extracts a helper from blocklist/Components/richTextRow.cshtml without changing its rendered output
  When CI runs the richTextRow screenshot spec
  Then the spec passes with no diff against the committed baseline
```

```scenario
Scenario: Refactoring a template with an unintended visual change is caught
  Given the developer accidentally adds 4px of vertical padding to alertBanner during a template move
  When CI runs the alertBanner screenshot spec
  Then the spec fails with a visible pixel diff
  And the workflow artifact contains the actual, expected, and diff images
```

### Rule: Nullable + warnings-as-errors catch null-safety bugs at build time

```scenario
Scenario: Build succeeds when all code is null-safe
  Given the codebase compiles with no warnings under the new settings
  When the developer runs dotnet build
  Then the build succeeds with exit code 0
  And no warning is emitted
```

```scenario
Scenario: Build fails when a non-nullable reference is assigned null
  Given the developer adds the line `string foo = null;` to a service file
  When they run dotnet build
  Then the build fails
  And the error message points at the offending file and line
  And the developer cannot push (pre-push hook also fails)
```

```scenario
Scenario: Existing typed Umbraco property access requires explicit null-handling
  Given a service calls `content.Value<string>("alias")` which may return null
  When the developer assigns the result to a non-nullable string
  Then the build fails until the null case is handled (??, ?., or annotation)
```

### Rule: NODE_TLS_REJECT_UNAUTHORIZED is set exactly once, in playwright.config.ts

```scenario
Scenario: Adding a new Playwright spec does not require boilerplate
  Given the developer writes a new spec at tests/e2e/blocks/newBlock.spec.ts
  When they add no NODE_TLS_REJECT_UNAUTHORIZED line
  Then the spec runs successfully against the local HTTPS dev server
  And the global config is what set the env var
```

```scenario
Scenario: Grep confirms zero per-spec duplication
  Given the developer runs `grep -r "NODE_TLS_REJECT_UNAUTHORIZED" tests/`
  When the grep returns
  Then it shows exactly one match (or zero matches outside playwright.config.ts)
```

## Open Questions

**Resolved during spec drafting** (kept here for traceability):

- ~~**Where should CI live — `.github/workflows/` or `.umbraco/`?**~~ — Resolved: `.github/workflows/` per the Cloud CI/CD Flow sample. The `.umbraco` file stays as the project-root pointer; the deploy trigger moves from git-push to API call.
- ~~**Should CI run on every push to feature branches, or only on master?**~~ — Resolved: feature branches run build+test+Playwright only (feedback). Master runs the full deploy chain.
- ~~**Does the Umbraco Cloud build pipeline already run our xUnit project?**~~ — Resolved: under CI/CD Flow, *we* own the build; Cloud only deploys the artifact we upload. xUnit *must* run in CI or it's never run.
- ~~**Screenshot baseline generation: do we baseline what's currently there, or fix any pre-existing rendering issues first?**~~ — Resolved (developer): baseline what's there. Any subsequent intentional fix is a baseline-update commit.
- ~~**Should test-infra-centralise sweep beyond NODE_TLS?**~~ — Resolved (developer): if implementation discovers other 3+ duplicated patterns, flag and ask. Default-scope is NODE_TLS only.

**Still open — need a call before `/plan`**:

- **Target environment for the master-triggered deploy.** Cloud has Development / Staging / Live. CI/CD Flow's `TARGET_ENVIRONMENT_ALIAS` variable points the deploy at one of them. Default per docs is the "leftmost" env (typically Development). Question: do master pushes deploy to Development (safest, requires manual promotion), or straight to Live (matches current git-push behaviour, less safe)? *Strong recommendation: Development. Promotion to Live becomes a deliberate step.*
- **Staging/Live promotion strategy.** Cloud's promotion endpoint is documented as "not fully operational." Options: (a) manual promotion via Cloud Portal until the endpoint stabilises, (b) script around whatever API surface does work, (c) defer to a follow-up bundle. *Recommendation: (a) for this bundle; address in a follow-up.*
- **Pre-push hook budget**: confirmed scope is build + xUnit only (Playwright is CI-only). Expected runtime ~10–20s. Acceptable? Or should xUnit be opt-out too (only build in pre-push)?
- **`<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` for the test project**: a test project that uses unused vars during a debugging session shouldn't break the build. Should the test project have a softer policy (e.g., warnings-as-errors disabled, or specific warning codes excluded)?
- **CI-side AI credentials**: confirm no test in the existing E2E suite triggers an OpenAI/Anthropic call (otherwise CI will need keys or the test will need stubbing). Need to audit `tests/e2e/` during planning.
- **`cloud-sync` collision with our pre-commit `.uda` guard**: `.githooks/pre-commit` warns about staged `.uda` files. `cloud-sync` *commits* `.uda` files when Cloud has normalised them. Does cloud-sync run from CI as a service account that bypasses the hook, or do we need a "cloud-bot" path in the hook? Resolve during planning.
- **Existing `dotnet-cli` / `appsettings.{User}.json` patterns**: the CI runner won't have a per-user config; need to confirm `appsettings.Development.json` (or a CI-specific overlay) covers the runtime. This intersects the "CI cannot start the Umbraco site" edge case.

## Testing Guidelines

This bundle is itself test infrastructure, so the "tests for the new feature" are the new tests we're committing:

- **Screenshot baseline specs** — one per block component, one per page template. Committed under `tests/e2e/blocks/` and `tests/e2e/pages/` (new directory). Each spec navigates to a canonical test page or block-rendering harness and asserts `toHaveScreenshot()`.
- **Shim equivalence specs** — for the 4 shim blockgrid components, a spec that renders both versions with identical input and asserts equivalent screenshots.
- **A smoke test for the pre-push hook itself** — a shell script under `.githooks/test-pre-push.sh` that asserts: (a) hook runs build + tests, (b) hook blocks on failure, (c) hook honours `SKIP_PREPUSH=1`. Not blocking — just a one-time validation we run during implementation.
- **Workflow validation runs** — once the four workflow YAMLs are committed, validate two flows end-to-end:
  - **Feature-branch push**: push this branch (`claude/feature/arch-safety-net`) and confirm build+test+Playwright run but no deploy chain fires.
  - **Master push**: merge to master and confirm the full chain (cloud-sync → build → tests → cloud-artifact → cloud-deployment) succeeds and the target environment shows the new deploy. Watch the deploy-status polling complete cleanly.
- **A controlled-failure validation** — before declaring the bundle complete, intentionally introduce a failing xUnit test on a throwaway branch and push to master to prove the deploy *does not* fire. Then revert. This is the single most important verification in the entire bundle.
- **No new xUnit tests** in this bundle — we're not extracting services here, just installing safety nets around the existing ones. The next bundle (`arch-image-generator-extraction`) is where new xUnit coverage lands.
