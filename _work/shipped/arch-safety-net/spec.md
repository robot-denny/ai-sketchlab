# Spec for arch-safety-net

> **Bundle spec — no feature doc.** This is an infrastructure bundle, not a user-facing feature, so it does not earn a `_features/arch-safety-net.md` doc (same playbook as `site-polish-2026-05`). It bundles four ROADMAP "Now" items into a single coherent spec because their decisions interlock.

branch: claude/feature/arch-safety-net

## Summary

Build the safety net that makes the upcoming `arch-feature-folder-migration` fearless rather than anxious. The migration will move ~60 Razor files plus most of the C# surface into a new `Features/<FeatureName>/` layout. Without automated build + visual-regression + null-safety checks, every slice of that refactor is a leap of faith. This bundle installs those checks now, while the surface is still small and the fix-up is bounded.

It covers four ROADMAP items as a single integrated workstream:

1. **arch-ci-pipeline** — adopt **Umbraco Cloud CI/CD Flow** as the deploy mechanism. Replaces the current git-push-to-Cloud pipeline with a GitHub Actions workflow in two gates: **Gate 1 (runner-local, pre-deploy)** — `cloud-sync` → `dotnet build` → xUnit; failures abort with no artifact upload and no deploy. **Gate 2 (post-deploy, against Dev)** — package artifact → upload via Cloud API → deploy to **Dev** → Playwright runs against Dev's URL. Master push runs both gates; feature-branch push runs gate 1 only (Playwright requires a Dev deploy to test against, which is master-only). Plus a pre-push git hook locally so failures surface before the push, not after.
2. **arch-screenshot-baselines** — Playwright `toHaveScreenshot()` baselines for every block component and the page templates that compose them, so visual regressions during the migration surface as a snapshot diff.
3. **arch-nullable-warnings-as-errors** — enable `<Nullable>enable</Nullable>` + `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` on both `.csproj` files, catching null-safety bugs at build time before they ship.
4. **test-infra-centralise-nodetls** — consolidate the `NODE_TLS_REJECT_UNAUTHORIZED = '0'` boilerplate (duplicated across every Playwright spec) into `playwright.config.ts`. Direct prereq for the screenshot work, which will add many new spec files.

The bundle's "user" is the developer who will subsequently run the migration, and the Cloud deploy pipeline that ships to Dev (and ultimately, by manual promotion, to Live). Success looks like: any Razor file move, any service extraction, any composer rewire either (a) is caught by Gate 1 and *blocks* the deploy from happening, or (b) deploys to Dev and is caught by Gate 2 (Playwright against Dev) before the human promotes to Live, or (c) ships cleanly because the build, tests, and screenshots all confirm equivalent behavior. "No PR workflow" is true, but "no deploy gate" is *not* — Gate 1 controls whether the deploy fires; Gate 2 controls whether the deploy is promotable.

**Content workflow (set during spec drafting):** Live is canonical for content. Dev is a periodic mirror via Cloud Portal "restore from Live to Dev," done on judgment-based cadence (when Dev's content gets stale, or before testing a content-dependent change). Content is *not* pushed local → Dev directly; the existing "local → Live" content-transfer habit is preserved. This means Playwright against Dev tests against content that mirrors Live, not bespoke fixtures.

## Functional Requirements

### CI pipeline (Umbraco Cloud CI/CD Flow)

This bundle replaces the current git-push-to-Cloud deploy with Cloud's CI/CD Flow API. The repo's existing `.umbraco` project-root pointer remains; the *trigger* for deploys moves from "git push to the Cloud git remote" to "GitHub Actions calls the Cloud CI/CD API."

**Two-gate model.** Gate 1 (runner-local) runs build + xUnit before any artifact upload — failures abort the chain with no deploy. Gate 2 (post-deploy) runs Playwright against the deployed Dev environment — failures don't undo the Dev deploy but mark the workflow red, signaling "do not promote to Live." Live is protected by the manual promotion step in the Cloud Portal, gated by the green/red signal from Gate 2.

- **Workflow topology** — based on the upstream sample (under `.github/workflows/`):
  - `main.yml` — orchestrator triggered by repo pushes
  - `cloud-sync.yml` — pulls Cloud's auto-commits (e.g. normalised `.uda` re-serialisation) back to the repo before we build
  - `cloud-artifact.yml` — packages the project as a Cloud-compliant zip and uploads to `https://api.cloud.umbraco.com`
  - `cloud-deployment.yml` — POSTs the deployment to Dev, then polls status (recommended cadence: every 25 seconds for up to ~15 minutes)
  - Playwright step (could live in `main.yml` or its own `playwright.yml`) — runs **after** `cloud-deployment` completes, against Dev's URL
- **Triggers**:
  - Push to `master` → both gates: cloud-sync → build → xUnit → cloud-artifact → cloud-deployment (deploy to Dev) → Playwright against Dev
  - Push to `claude/feature/**` → Gate 1 only: build → xUnit. *No* artifact upload, *no* deploy, *no* Playwright (Dev only deploys from master)
- **Gate 1 — pre-deploy steps on master push** (between `cloud-sync` and `cloud-artifact`; the upstream sample's explicit extension point):
  1. Restore + build (`dotnet build -c Release`)
  2. xUnit (`dotnet test --no-build -c Release`)
  3. *Only if all above pass*: proceed to `cloud-artifact`. Any failure short-circuits with no upload, no deploy.
- **Gate 2 — post-deploy Playwright on master push**:
  1. After `cloud-deployment` reports success, install Node + Playwright + browsers in the runner
  2. Run Playwright suite against Dev's URL (`npx playwright test --project=chromium`)
  3. Workflow result: green = Dev deploy proven; red = Dev has the deploy but it has issues — do not promote to Live
- **Target environment**: master deploys to **Dev** (the leftmost Cloud environment, alias set in `TARGET_ENVIRONMENT_ALIAS`). Promotion Dev → Live is a deliberate manual action in the Cloud Portal, performed by a human after Gate 2 is green and any other verification (eyes-on Dev, content review, etc.) is satisfied. Live is *never* a direct deploy target from CI in this bundle.
- **Why Playwright runs against Dev, not the runner**: Dev has a real DB synced from Live, a real Cloud-managed Umbraco install, and the AI API keys via Cloud Secrets Management. The runner would need a fabricated DB, an `appsettings.CI.json`, GitHub-side AI keys, and a content-fixtures strategy — all of which dissolve when we test against a real environment instead.
- **Runtime budget**: target Gate 1 (build + xUnit) end-to-end on the runner under 10 minutes. Gate 2 runtime is dominated by the Cloud deploy itself (isolated-instance startup adds wall-clock time per Cloud docs) — that's accepted as the cost of testing against reality and not budgeted here.
- **Secrets** (GitHub repository secrets / variables):
  - `UMBRACO_CLOUD_API_KEY` — from Cloud Portal → Configuration → CI/CD Flow (project-wide, project-specific, not restorable if regenerated)
  - `PROJECT_ID` — Cloud project ID
  - `TARGET_ENVIRONMENT_ALIAS` — Dev environment's alias string (variable, not secret)
  - `UMBRACO_CLIENT_ID` / `UMBRACO_CLIENT_SECRET` / `URL` — Playwright auth.setup.ts against Dev's backoffice (URL points at Dev, not localhost)
  - *No* AI API keys needed in GitHub — Dev's runtime gets those from Umbraco Cloud Secrets Management
- **Zip artifact format**: must match Cloud's required source-file format. The sample workflow overwrites `.gitignore` with `cloud.gitignore` and uses `cloud.zipignore` to exclude developer files from the package — both files come from the sample and must be added to the repo.
- **Concurrency**: `concurrency: ${{ github.ref }}` + `cancel-in-progress: true` to prevent stacked runs on rapid pushes to the same branch.
- **cloud-sync identity and the `.uda` pre-commit hook**: `cloud-sync` runs on a clean CI runner where `core.hooksPath` is *not* set, so the developer-side `.githooks/pre-commit` `.uda` drift check does not fire on bot-driven cloud-sync commits. Developers manually invoking cloud-sync locally retain the existing `SKIP_UDA_CHECK=1` escape. (A separate ROADMAP item — `arch-uda-ci-guard` — will promote the `.uda` check into a CI step in a follow-up bundle.)

### Pre-push git hook

Provides fast local feedback before a push triggers CI. Under Cloud CI/CD Flow, the *real* gate is CI itself (since CI is what calls the deploy API). The pre-push hook is a developer-ergonomics layer: catch the failure in <60s locally instead of waiting for CI minutes.

- **Trigger**: `git push` from any contributor's local machine.
- **Behavior**: Runs build + xUnit locally before allowing the push to proceed. Playwright is *not* in the pre-push hook (too slow, and now runs against Dev post-deploy anyway).
- **Skip mechanism**: Setting `SKIP_PREPUSH=1` bypasses the hook for emergencies (mirrors the `SKIP_UDA_CHECK=1` precedent in `.githooks/pre-commit`).
- **Installation**: Hook lives in `.githooks/pre-push`; activated via the existing `git config core.hooksPath .githooks` setup (see README).
- **Runtime printing**: hook prints per-step timings on completion (e.g. `build: 12.3s, test: 4.1s, total: 16.4s`). Gives us data for the "do we need to narrow the hook?" decision later.
- **Runtime budget**: target <30s today; <60s long-term ceiling. If runtime climbs past 30s, revisit (drop xUnit, mark slow tests, etc.). Above 60s and contributors will `--no-verify` it and the gate becomes theater.

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
- **Test project policy**: same strict settings as production code. If a specific warning code becomes recurring noise in test code (most likely candidate: `CS8632` for nullability annotation context, or `CS0219` for unused locals during test iteration), add it to a `<NoWarn>` exemption on the test `.csproj` *for that specific code*. Do *not* relax the whole policy. The default stays strict; exemptions are surgical.
- **Razor views**: nullable warnings in `.cshtml` files compile via the Razor compiler at runtime; these are *not* gated by `TreatWarningsAsErrors` at the `.csproj` level. Out of scope.
- **Auto-generated published models** (`Umbraco.Cms.Web.Common.PublishedModels`): generated at runtime under `umbraco/Data/TEMP/InMemoryAuto/`, gitignored. Out of scope.

### Test-infra centralisation

- **Move**: Hoist `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` from individual spec files into `playwright.config.ts` (single location).
- **Audit**: After the hoist, grep `tests/e2e/` for any other duplicated module-scope environment setup or boilerplate; if anything else is duplicated 3+ times, hoist that too. Otherwise leave alone — don't speculatively abstract.
- **Verification**: All existing Playwright specs continue to pass with no per-spec NODE_TLS line present.

## Possible Edge Cases

- **`cloud-deployment` succeeds but Playwright against Dev fails**: Dev is left in a broken state. This is by design (Dev's purpose is to absorb this risk), but the workflow result must be unambiguously red so the human knows not to promote to Live. The next master push that fixes the issue will redeploy Dev clean.
- **Dev URL changes**: the `URL` env var Playwright uses points at Dev's hostname. If Cloud ever changes Dev's URL (env recreated, environment-alias change), update the GitHub variable. Worth a brief sanity-check step at the start of the Playwright job — "can I curl Dev's homepage?" — before the full suite runs.
- **Dev content drift causing screenshot baseline failures**: if Live → Dev restore hasn't happened recently, Dev's content may diverge from what baselines expect. Mitigation: do a Live → Dev restore before re-baselining; document this in CLAUDE.md as a "before baselining, sync Dev from Live" reminder.
- **Playwright auth.setup.ts hits Cloud's rate limit during repeated CI runs**: the OAuth client credentials grant against Dev's backoffice can throttle if hit too quickly across many concurrent runs. If observed, add a cached-token strategy or a small delay.
- **Screenshot baseline thrash across font-rendering differences**: macOS vs Linux render fonts subtly differently. Baselines must be generated on Linux (the CI runner is Linux; Dev runs on Linux) to be the authoritative source; Mac-side regeneration produces diffs that block CI. Document the workflow: regenerate on Linux only (or via a `--update-snapshots` run on a CI workflow_dispatch trigger).
- **Nullable warnings surface in third-party-package-derived code paths**: some Umbraco contracts may return `null` from typed properties (e.g., `Model.Value<string>("alias")`). The fix is per-call annotation, not turning off the rule.
- **Pre-push hook runtime creep**: if build + xUnit climbs past 30 seconds in practice, the hook is at risk of being `--no-verify`'d. The runtime-printing requirement gives us data; revisit scope (drop xUnit? mark slow tests?) before crossing 60s.
- **CI runs concurrently from multiple developers**: GitHub Actions concurrency keys should cancel in-progress runs on stale commits to a branch (`concurrency: ${{ github.ref }}` + `cancel-in-progress: true`). Otherwise CI queue grows unbounded.
- **Screenshot baselines for blocks that depend on dynamic content** (e.g., `latestArticlesRow` which queries the live content tree): each baseline spec needs to either (a) `mask:` the dynamic content regions, or (b) target a content-stable test page. Plan addresses per-block.
- **Tests project not yet included in the solution's CI build path**: confirm [umbraco-17-demo-site.sln](umbraco-17-demo-site.sln) includes `tests/UmbracoProject.Tests` so `dotnet build` covers it.
- **Zip artifact format non-compliance**: Cloud's API rejects artifacts that don't match its expected zip structure. The sample workflow handles this via `cloud.gitignore` + `cloud.zipignore` swap-in. Both files must come from the upstream sample and be committed to the repo unmodified.
- **Cloud isolated-instance startup adds deploy duration**: per Cloud docs, CI/CD Flow deploys are slower than direct git-push deploys due to isolated instance startup. Gate 2's wall-clock time is dominated by this. Accepted.
- **Local-only schema changes still required**: Cloud CI/CD Flow does not relax the existing "author schema locally, never on Cloud" rule documented in CLAUDE.md. The risk surface is the same as today.
- **File casing conflicts (e.g. `README.md` vs `Readme.md`)**: documented Cloud constraint. Likely a non-issue here but worth checking once during implementation.
- **First master deploy under the new pipeline ships an unverified change**: before flipping `master`'s deploy mechanism from git-push-to-Cloud to CI/CD Flow, do a dry run on a non-Live env (or a throwaway pre-flight). The very first invocation of the API for this project should be against an empty no-op commit to confirm the wiring.

## Acceptance Criteria

### CI pipeline (Cloud CI/CD Flow)

1. **GitHub Actions workflows exist** under `.github/workflows/` matching the upstream Cloud CI/CD Flow sample shape: `main.yml`, `cloud-sync.yml`, `cloud-artifact.yml`, `cloud-deployment.yml` (or an equivalent merged structure), plus a Playwright step that runs against Dev after `cloud-deployment` completes.
2. **Push to master triggers the full chain** in order: `cloud-sync` → `dotnet build` → xUnit → `cloud-artifact` (zip upload) → `cloud-deployment` (deploy to Dev + status polling) → Playwright against Dev's URL.
3. **Gate 1 failures abort the deploy**: any failure in `cloud-sync`, `dotnet build`, or xUnit short-circuits the workflow before `cloud-artifact` runs. No artifact is uploaded; no deploy is triggered.
4. **Gate 2 failures don't undo the deploy**: if Playwright against Dev fails after a successful deploy, the workflow result is red. Dev retains the deployed build (broken or not). Human does not promote to Live until a subsequent push fixes the issue and the workflow goes green.
5. **Push to `claude/feature/**` runs Gate 1 only** — `dotnet build` + xUnit. No cloud-sync (master-only). No artifact upload. No deploy. No Playwright (no Dev to run against).
6. **Gate 1 completes under 10 minutes** for a typical no-flake run on the default GitHub Actions runner.
7. **Cloud-side artifacts are committed**: `cloud.gitignore` and `cloud.zipignore` (from the upstream Umbraco sample) are present in the repo and used by the artifact-packaging step.
8. **Required GitHub secrets/variables are documented in CLAUDE.md**: `UMBRACO_CLOUD_API_KEY`, `PROJECT_ID`, `TARGET_ENVIRONMENT_ALIAS` (= Dev's alias), `UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET`, `URL` (= Dev's URL). *No AI API keys in GitHub Secrets* — Dev's runtime gets those from Umbraco Cloud Secrets Management.
9. **Master deploys exclusively to Dev**, never to Live. Promotion Dev → Live is a manual Cloud Portal action by a human; CI never calls the API with a Live target alias in this bundle.

### Pre-push hook

10. **Pre-push git hook** at `.githooks/pre-push` runs `dotnet build` + xUnit locally and blocks the push on any failure (Playwright is CI-only).
11. **Pre-push hook prints per-step timings** on completion (e.g., `build: 12.3s, test: 4.1s, total: 16.4s`).
12. **Pre-push hook honours `SKIP_PREPUSH=1`** to bypass for emergencies.

### Screenshot baselines

13. **Every block component** under `blocklist/Components/` and `blockgrid/Components/` has at least one Playwright spec asserting a screenshot baseline.
14. **Every page template** (home, articleListing, article, experimentsLandingPage, search, contact) has at least one Playwright spec asserting a page-level screenshot baseline.
15. **Shim blockgrid components** (the 4 that delegate to blocklist) have a baseline that explicitly proves render equivalence with the blocklist counterpart.

### Build hygiene

16. **All three `.csproj` files** have `<Nullable>enable</Nullable>` + `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`.
17. **`dotnet build`** produces zero warnings and zero errors under the new settings.
18. **Test-project warning exemptions are surgical**: if any `<NoWarn>` codes are added to the test `.csproj`, each one is documented inline with a comment explaining the specific iteration-friction it addresses.

### Test infrastructure

19. **`NODE_TLS_REJECT_UNAUTHORIZED` is set in `playwright.config.ts` exactly once**; no Playwright spec file contains a module-scope `process.env.NODE_TLS_REJECT_UNAUTHORIZED` line.
20. **All existing tests** (xUnit + Playwright) continue to pass under the new infrastructure.

### Documentation

21. **CLAUDE.md** is updated to document:
    - The Cloud CI/CD Flow workflow shape (two gates)
    - The Dev-as-deploy-target / Live-as-promotion-only model
    - The Live-canonical / Dev-mirror-via-restore content workflow
    - The pre-push hook behavior and timings printing
    - The screenshot baseline regeneration workflow (Linux-only)
    - The nullable + warnings-as-errors expectations and the surgical exemption pattern
    - The required GitHub secrets and how they map to Cloud Portal values

## Scenarios (Draft)

### Rule: Master push runs Gate 1 (pre-deploy) and Gate 2 (post-deploy against Dev)

```scenario
Scenario: Developer pushes a fully passing master commit
  Given the developer has committed code that builds, passes xUnit, and passes Playwright against Dev
  When they push to master
  Then cloud-sync runs and pulls any pending Cloud auto-commits
  And dotnet build succeeds
  And xUnit passes
  And cloud-artifact zips and uploads the artifact to the Cloud API
  And cloud-deployment POSTs the deployment to Dev and polls until completion
  And the deploy completes successfully on Dev
  And Playwright runs against Dev's URL
  And every spec passes including the screenshot baselines
  And the workflow result is green
  And Live is unchanged (promotion is a separate manual step)
```

```scenario
Scenario: Gate 1 catches a failing xUnit test and blocks the deploy
  Given the developer has committed code where one xUnit test fails
  When they push to master
  Then cloud-sync runs
  And dotnet build runs (success) then xUnit runs (failure)
  And the workflow aborts before cloud-artifact
  And NO artifact is uploaded
  And NO deploy is triggered
  And Dev is unchanged
  And Live is unchanged
  And the developer sees a failure notification in GitHub
```

```scenario
Scenario: Gate 2 catches a Playwright regression against Dev after deploy
  Given the developer has committed a template change that builds and passes xUnit but alters alertBanner's rendered HTML
  When they push to master
  Then Gate 1 passes (build + xUnit succeed)
  And cloud-artifact uploads the artifact
  And cloud-deployment deploys to Dev successfully
  And Playwright runs against Dev's URL
  And the alertBanner screenshot spec fails with a visible pixel diff
  And the workflow result is red
  And Dev retains the deployed-but-flagged build (this is by design)
  And the developer does NOT promote to Live until a subsequent push fixes the issue
  And Live remains unchanged
```

### Rule: Feature-branch pushes run Gate 1 only — no deploy, no Playwright

```scenario
Scenario: Developer pushes a feature branch
  Given the developer has committed code on claude/feature/example-feature
  When they push the branch
  Then dotnet build runs
  And xUnit runs
  And cloud-sync does NOT run (master-only)
  And cloud-artifact does NOT run (master-only)
  And cloud-deployment does NOT run (master-only)
  And Playwright does NOT run (no Dev deploy to test against)
  And Dev is unchanged
  And Live is unchanged
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

All open questions surfaced during spec drafting were resolved through conversation with the developer. Captured here for traceability so `/plan` and implementation can reference the rationale.

- ~~**Where should CI live — `.github/workflows/` or `.umbraco/`?**~~ **Resolved:** `.github/workflows/` per the Cloud CI/CD Flow sample. The `.umbraco` file stays as the project-root pointer; the deploy trigger moves from git-push-to-Cloud-remote to GitHub-Actions-calls-the-API.
- ~~**Should CI run on every push to feature branches, or only on master?**~~ **Resolved:** feature branches run Gate 1 (build + xUnit) only. Master runs both gates. Playwright is master-only because it tests against the deployed Dev environment.
- ~~**Does the Umbraco Cloud build pipeline already run our xUnit project?**~~ **Resolved:** under CI/CD Flow, *we* own the build; Cloud only deploys the artifact we upload. xUnit *must* run in CI or it never runs.
- ~~**Screenshot baseline generation: baseline current state, or fix pre-existing rendering issues first?**~~ **Resolved (developer):** baseline what's there. Any subsequent intentional fix is a baseline-update commit.
- ~~**Should test-infra-centralise sweep beyond NODE_TLS?**~~ **Resolved (developer):** if implementation discovers other 3+ duplicated patterns, flag and ask. Default-scope is NODE_TLS only.
- ~~**Target environment for the master-triggered deploy.**~~ **Resolved (developer):** Dev. Live is reached only via deliberate human promotion via Cloud Portal.
- ~~**Staging/Live promotion strategy.**~~ **Resolved:** manual promotion via Cloud Portal until the Cloud promotion endpoint stabilises. Automation is a follow-up bundle, not in scope here.
- ~~**Pre-push hook budget.**~~ **Resolved:** hook runs `dotnet build` + xUnit (Playwright is CI-only). Current expected runtime ~15–20s, well inside the 60s budget. Hook prints per-step timings; revisit scope if runtime climbs past 30s.
- ~~**`<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` for the test project.**~~ **Resolved:** same strict policy as production code. If a specific warning code becomes recurring noise in tests, add it to a surgical `<NoWarn>` exemption on the test `.csproj` with an inline comment justifying it. Don't relax the whole policy.
- ~~**CI-side AI credentials.**~~ **Dissolved:** Playwright runs against deployed Dev, which gets AI keys from Umbraco Cloud Secrets Management. No AI keys needed in GitHub Secrets. Existing E2E specs already avoid AI calls (per CLAUDE.md); audit during `/plan` to confirm.
- ~~**`cloud-sync` collision with the `.uda` pre-commit hook.**~~ **Resolved:** the CI runner doesn't set `core.hooksPath`, so the opt-in pre-commit hook never fires on cloud-sync's commits. Developers manually invoking cloud-sync locally retain the existing `SKIP_UDA_CHECK=1` escape. The opt-in fragility of the hook itself is being addressed in a separate ROADMAP item (`arch-uda-ci-guard`).
- ~~**`appsettings.{User}.json` patterns in CI / "CI cannot start the Umbraco site".**~~ **Dissolved:** Playwright runs against deployed Dev, not a runner-local Umbraco site. No `appsettings.CI.json` needed; no per-user config required; no DB seeding strategy required. Dev is the test target and is fully managed by Cloud.

## Testing Guidelines

This bundle is itself test infrastructure, so the "tests for the new feature" are the new tests we're committing:

- **Screenshot baseline specs** — one per block component, one per page template. Committed under `tests/e2e/blocks/` and `tests/e2e/pages/` (new directory). Each spec navigates to a canonical test page or block-rendering harness and asserts `toHaveScreenshot()`.
- **Shim equivalence specs** — for the 4 shim blockgrid components, a spec that renders both versions with identical input and asserts equivalent screenshots.
- **A smoke test for the pre-push hook itself** — a shell script under `.githooks/test-pre-push.sh` that asserts: (a) hook runs build + tests, (b) hook blocks on failure, (c) hook honours `SKIP_PREPUSH=1`. Not blocking — just a one-time validation we run during implementation.
- **Workflow validation runs** — once the YAMLs are committed, validate three flows end-to-end:
  - **Feature-branch push**: push this branch (`claude/feature/arch-safety-net`) and confirm Gate 1 (build + xUnit) runs but no Playwright, no cloud-sync, no artifact upload, no deploy.
  - **Master push, all green**: merge to master and confirm the full chain (cloud-sync → build → xUnit → cloud-artifact → cloud-deployment → Playwright-against-Dev) succeeds and Dev shows the new deploy. Watch the deploy-status polling complete cleanly. Confirm the workflow result is green.
  - **Master push, Gate 1 failure**: on a throwaway branch, intentionally break an xUnit test, push to master, prove that **no artifact is uploaded and Dev is unchanged**. Then revert. This is the single most important verification in the entire bundle — the Gate 1 deploy-block is the load-bearing property.
- **A Gate 2 failure validation** — also on a throwaway branch, intentionally introduce a screenshot regression (e.g., add 4px padding to alertBanner), push to master, prove that **the deploy lands on Dev but the workflow is red and the alertBanner screenshot spec fails**. Then revert. This verifies Gate 2 surfaces the post-deploy signal correctly.
- **Pre-push hook validation** — a shell script under `.githooks/test-pre-push.sh` that asserts: (a) hook runs build + xUnit, (b) hook blocks on failure, (c) hook honours `SKIP_PREPUSH=1`, (d) hook prints timings. Not blocking — just a one-time validation during implementation.
- **Cloud-side dry run** — before the first real master deploy under CI/CD Flow, push a no-op commit (e.g., a CLAUDE.md typo fix) to confirm the API wiring end-to-end. This is the first time this project's API key is used against this project's API endpoint.
- **No new xUnit tests** in this bundle — we're not extracting services here, just installing safety nets around the existing ones. The next bundle (`arch-image-generator-extraction`) is where new xUnit coverage lands.
