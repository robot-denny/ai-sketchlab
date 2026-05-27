# Plan: Arch Safety Net

**Spec**: `_specs/arch-safety-net.md`
**Branch**: `claude/feature/arch-safety-net`

## Context

This is an infrastructure bundle, not a user-facing feature — it installs the safety net (CI/CD, screenshot baselines, nullable warnings-as-errors, test-infra cleanup) that lets the upcoming `arch-feature-folder-migration` move ~60 Razor files without a leap of faith. No `_features/arch-safety-net.md` doc (same playbook as `site-polish-2026-05`).

The bundle integrates four ROADMAP items because their decisions interlock: the Cloud CI/CD Flow workflow defines where Playwright runs (against deployed Dev, not localhost), which dictates that the screenshot baselines must be Linux-generated to match the CI runner. The pre-push hook needs `dotnet build` to be warnings-clean, so nullable-warnings-as-errors precedes it. NODE_TLS hoist is a hard prereq for the screenshot spec proliferation.

**What already exists**: both `UmbracoProject.csproj` and `HelloWorld.csproj` already have `<Nullable>enable</Nullable>`; only `<TreatWarningsAsErrors>` is missing. The pre-commit hook (`.githooks/pre-commit`) is the established pattern with `SKIP_UDA_CHECK=1` mirror. The existing `.githooks/pre-push` is an opt-in AI code review (disabled by default) — it will be replaced. Tests project (`UmbracoProject.Tests`) is already in the solution and runs xUnit. There are ~13 hand-written `.cs` files in scope. Playwright spec files (~20 of them) currently each set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` at module scope.

---

## Key Decisions

- **Step order driven by dependency, not by spec section order**: NODE_TLS hoist first (prereq for many new specs), then nullable-as-errors (so pre-push hook can rely on a warnings-clean baseline), then pre-push hook, then CI workflows, then screenshot specs, then docs, then end-to-end verification.
- **The new pre-push hook replaces (not chains) the existing AI-review pre-push**: existing pre-push is opt-in (disabled by default), low usage, and the new hook is the canonical pre-push for this project. If anyone is using the AI review, they can run it via `.claude/commands/review.md` instead. Keep the `.githooks.conf.example` pattern intact for any future hook toggles.
- **Workflow shape mirrors the upstream Umbraco Cloud CI/CD Flow sample verbatim where possible**: `main.yml` orchestrator + reusable workflows for `cloud-sync.yml`, `cloud-artifact.yml`, `cloud-deployment.yml`. The Gate 1 build+xUnit step lives between `cloud-sync` and `cloud-artifact` in `main.yml` (the upstream's documented extension point). Playwright step also lives in `main.yml`, after `cloud-deployment` completes successfully. `cloud.gitignore` + `cloud.zipignore` are committed verbatim from the upstream sample.
- **Master-only deploy, feature branches Gate 1 only**: master push triggers full chain; `claude/feature/**` push runs `dotnet build -c Release` + `dotnet test --no-build` only. No conditional inside reusable workflows — done at the `main.yml` job level (`if: github.ref == 'refs/heads/master'` guards on the deploy/playwright jobs).
- **Concurrency**: `concurrency: ${{ github.ref }}` + `cancel-in-progress: true` at the `main.yml` workflow level. Prevents stacked runs on rapid pushes.
- **Screenshot baselines committed empty initially**: specs are committed first with `toHaveScreenshot()` calls; baselines are generated on Linux (CI runner) via a `workflow_dispatch` trigger (`update-snapshots.yml`) that runs Playwright with `--update-snapshots` against Dev and opens a PR (or auto-commits) with the new PNGs. Mac-side regeneration is forbidden — fonts differ. Document the workflow in CLAUDE.md.
- **Canonical test pages for block screenshots**: existing content on Dev provides coverage for most blocks (styleguide, experiments landing page, articles, home). Where a block has no canonical render surface, add it to the styleguide page rather than fabricating new test pages. Spec design uses real, content-bearing routes; masking handles dynamic regions (latestArticles, timestamps).
- **Shim equivalence specs**: for the 4 shim blockgrid components (alertBanner, iconLinkRow, imageRow, richTextRow), the equivalence spec is a *single* spec per shim that screenshots the blocklist render on one page and the blockgrid render on another, then asserts via `expect(blocklistShot).toEqual(blockgridShot)` after both clip to the same component bounding box. This avoids generating two separate baselines per shim that drift independently.
- **Per-block tolerance**: default `maxDiffPixelRatio: 0.01`. Tighter (`0`) for byte-identical assertions on the shim-equivalence specs. Document the override pattern via per-spec config.
- **Cloud secrets convention reminder**: GitHub Secrets carry CI auth (`UMBRACO_CLOUD_API_KEY`, `PROJECT_ID`, `UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET`) plus the `URL` variable (Dev's URL). AI keys (`OPENAI__APIKEY`, `ANTHROPIC__APIKEY` — Cloud Portal's `__` form) are set in Umbraco Cloud Secrets Management, never GitHub. CLAUDE.md must document this mapping.
- **First master deploy is a no-op commit** (e.g., a CLAUDE.md typo fix) — the very first invocation of the CI/CD Flow API against this project must be against a content-stable change so any wiring failure has no functional blast radius.
- **xUnit project verification**: `UmbracoProject.Tests` is already in `umbraco-17-demo-site.sln`. `dotnet build` and `dotnet test` at the solution level will pick it up. No new sln edits required.

### Discovered IDs / aliases (record so implementers don't re-look-up)

- Block components in scope:
  - **blocklist** (11): alertBanner, codeSnippetRow, colorPaletteBlock, generalElementsBlock, iconLinkRow, imageCarouselRow, imageRow, latestArticlesRow, richTextRow, typographyShowcaseBlock, videoRow
  - **blockgrid** (12): alertBanner, commandBadge, embeddedSketch, featureCard, iconLinkRow, imageRow, pillarSection, pullQuoteBlock, richTextRow, showcaseHero, statCallout, timelineRow
  - **shim** equivalence pairs (4): alertBanner, iconLinkRow, imageRow, richTextRow — each renders identically across blocklist and blockgrid
- Page templates in scope: `home.cshtml`, `articleList.cshtml`, `article.cshtml`, `experimentsLandingPage.cshtml`, `search.cshtml`, `contact.cshtml`
- Hand-written `.cs` files in scope for nullable fix-up (13): HelloWorld/Constants.cs, HelloWorld/PaletteService.cs, HelloWorld/PaletteServiceComposer.cs, HelloWorld/ImageGeneratorController.cs, UmbracoProject/Program.cs, UmbracoProject/SearchComposer.cs, UmbracoProject/AssignMembersToPremiumRoleComposer.cs, UmbracoProject/AssignMembersToPremiumRoleHandler.cs, UmbracoProject/Helpers/PageHeadPatternExtension.cs, UmbracoProject/Helpers/SwatchTokenParser.cs, UmbracoProject/Helpers/ReadingTime.cs, UmbracoProject/Services/SearchService.cs (plus ISearchService, SearchMode, SearchResult, SearchServiceComposer)
- Existing pre-push hook: `.githooks/pre-push` (opt-in AI review, disabled by default — replace cleanly).

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Hoist NODE_TLS_REJECT_UNAUTHORIZED to playwright.config.ts

> **Prompt**: Implement Step 1 of `_plans/arch-safety-net.md`. Hoist `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` from every Playwright spec file into [playwright.config.ts](playwright.config.ts) at module scope, then delete the per-spec lines. After the hoist, grep `tests/e2e/` for any other module-scope env-var setup duplicated 3+ times across specs; if anything qualifies, hoist it too. Otherwise leave alone. Validate by running the full Playwright suite locally and confirming zero per-spec `NODE_TLS_REJECT_UNAUTHORIZED` matches via `grep -r "NODE_TLS_REJECT_UNAUTHORIZED" tests/`.

**What to build**:
- Modify [playwright.config.ts](playwright.config.ts): after the existing `dotenv.config()` call, add `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';` at module scope (alongside the existing `STORAGE_STAGE_PATH` line).
- Delete the `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';` line from each Playwright spec file that currently has it (18 files based on initial grep — re-grep at implementation time to be exhaustive).
- After the hoist, audit `tests/e2e/` with a grep sweep for other module-scope `process.env.*` assignments and any other duplicated boilerplate (e.g., URL/`API_BASE` re-derivation, identical helper functions repeated inline). Anything duplicated 3+ times: hoist into either `playwright.config.ts`, a shared helper module under `tests/e2e/_helpers.ts`, or document why it stayed. Default scope is NODE_TLS only — only expand if duplication is real.

**Validation**:
- `grep -rn "NODE_TLS_REJECT_UNAUTHORIZED" tests/` returns exactly one match in `tests/e2e/.auth/user.json` (if any cached token still has it) or zero matches outside `playwright.config.ts`.
- Run the full Playwright suite locally (HTTPS dev cert):
  - `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test`
  - All previously-passing specs continue to pass; no spec fails with a TLS error.
- [Manual]: glance through 3-4 hoisted specs to confirm the deleted line was the only change in each, no incidental edits.

---

### Step 2 — Enable `<TreatWarningsAsErrors>` and fix surfaced warnings

> **Prompt**: Implement Step 2 of `_plans/arch-safety-net.md`. Add `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` to all three `.csproj` files in this repo. Both production projects already have `<Nullable>enable</Nullable>` — confirm and leave alone. Then run `cd src/UmbracoProject && dotnet build -c Release` and fix every surfaced warning in hand-written `.cs` files (the ~13 listed in the plan's Key Decisions). Auto-generated published models (`umbraco/Data/TEMP/InMemoryAuto/`) are gitignored — ignore them. Razor `.cshtml` files compile via the Razor compiler at runtime and aren't gated here. If a specific warning code becomes recurring noise in test code, add it to a surgical `<NoWarn>` on the test `.csproj` with an inline comment explaining the iteration-friction it addresses; do not relax the whole policy. Goal: `dotnet build -c Release` from the solution root produces zero warnings and zero errors.

**What to build**:
- Modify [src/UmbracoProject/UmbracoProject.csproj](src/UmbracoProject/UmbracoProject.csproj), [src/HelloWorld/HelloWorld.csproj](src/HelloWorld/HelloWorld.csproj), [tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj](tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj): add `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` inside the existing `<PropertyGroup>` that holds `<Nullable>enable</Nullable>`.
- Run `dotnet build -c Release` from the repo root (or `umbraco-17-demo-site.sln`). Iteratively fix warnings:
  - Nullable warnings (`CS8600`, `CS8601`, `CS8602`, `CS8603`, `CS8604`, `CS8625`, etc.): annotate types with `?`, add `?.`/`??` guards, or call `ArgumentNullException.ThrowIfNull` at boundaries.
  - For Umbraco's `Model.Value<T>(...)` style calls that may return null, annotate per-call (not per-project).
  - Other warnings (e.g., unused vars, async-without-await): fix surgically.
- If test code surfaces a recurring noisy warning that's pure iteration friction (most likely `CS0219` unused local during incremental test authoring), add `<NoWarn>CS0219</NoWarn>` (or whichever specific code) on the test `.csproj` only, with an inline `<!-- comment -->` explaining the reason.

**Validation**:
- `cd src/UmbracoProject && dotnet build -c Release` exits 0, prints "Build succeeded. 0 Warning(s) 0 Error(s)".
- `dotnet test --no-build -c Release` exits 0; existing `SmokeTests.True_IsTrue` still passes.
- [Manual]: `git diff` shows the three csproj edits plus only the necessary `.cs` fixes. No view (`.cshtml`) edits.

---

### Step 3 — Add pre-push git hook (build + xUnit, timings, SKIP_PREPUSH)

> **Prompt**: Implement Step 3 of `_plans/arch-safety-net.md`. The existing [.githooks/pre-push](.githooks/pre-push) is an opt-in AI code review (disabled by default) — replace it with a new pre-push hook that runs `dotnet build` + `dotnet test --no-build` and prints per-step timings. Honour `SKIP_PREPUSH=1` (mirrors the existing `SKIP_UDA_CHECK=1` pattern in `.githooks/pre-commit`). Honour the `.githooks.conf` config-file pattern (add an `ENABLE_PREPUSH=true` default key to [.githooks.conf.example](.githooks.conf.example)). Add a sibling smoke script `.githooks/test-pre-push.sh` that validates: (a) hook runs build + tests, (b) hook blocks on test failure, (c) hook honours `SKIP_PREPUSH=1`, (d) hook prints timings. The smoke script is a one-time verification artifact — committed but not wired into CI. Update [README.md](README.md) where it mentions `git config core.hooksPath .githooks` to also describe the new pre-push behavior.

**What to build**:
- Replace [.githooks/pre-push](.githooks/pre-push) with a POSIX `sh` script (per pre-commit precedent) that:
  1. Reads `.githooks.conf` if present (existing pattern).
  2. Skips if `SKIP_PREPUSH=1` or `ENABLE_PREPUSH=false`, printing a one-line "Pre-push checks skipped" notice.
  3. Records start timestamps. Runs `dotnet build -c Release --nologo` (capture timing). On failure: prints the elapsed time, the failing build output's tail, and exits 1.
  4. Runs `dotnet test --no-build -c Release --nologo` (capture timing). On failure: prints elapsed time + failing test name + exits 1.
  5. On success: prints `build: X.Xs, test: Y.Ys, total: Z.Zs` (mirrors the format in the spec).
- Update [.githooks.conf.example](.githooks.conf.example): add a new section near the bottom:
  ```
  # Pre-push checks (pre-push)
  # Runs dotnet build + xUnit before each push.
  # Enabled by default. Set to "false" to disable.
  # Env var equivalent: SKIP_PREPUSH=1
  ENABLE_PREPUSH=true
  ```
- Create `.githooks/test-pre-push.sh` (executable, POSIX `sh`):
  - Asserts hook file exists and is executable.
  - Asserts hook output contains "build:" and "test:" timing tokens on success.
  - Asserts hook exits 0 with `SKIP_PREPUSH=1` and exits non-zero on a forced test failure (uses a temp branch + intentionally-broken test, OR mocks the test outcome via env).
  - Documented as "one-time validation" in a comment header.
- Update [README.md](README.md): in the section that explains `git config core.hooksPath .githooks`, add a paragraph describing the new pre-push behavior (build + xUnit + timings, SKIP_PREPUSH=1 escape).

**Test first (smoke validation, not TDD)**:
- The smoke script `.githooks/test-pre-push.sh` *is* the test. Run it manually after writing the hook:
  - `chmod +x .githooks/pre-push .githooks/test-pre-push.sh`
  - `./.githooks/test-pre-push.sh` — expect green output with all four assertions passing.

**Validation**:
- [Automated]: `./.githooks/test-pre-push.sh` exits 0.
- [Manual]: from the repo root, run `.githooks/pre-push` directly (no args) and confirm:
  - It prints `build: X.Xs, test: Y.Ys, total: Z.Zs` on a green codebase.
  - Set `SKIP_PREPUSH=1 ./.githooks/pre-push` — confirm it skips with a one-line notice.
  - Break a unit test (temporarily edit `SmokeTests.True_IsTrue` to `Assert.True(false)`), run `./.githooks/pre-push` — confirm exit code is non-zero and the failing test name is printed. Revert.
- [Manual]: confirm the total runtime is < 30s on a primed build. If > 30s, add a TODO comment in the hook header pointing at the runtime-budget mitigation (drop xUnit, mark slow tests).

---

### Step 4 — Cloud CI/CD Flow GitHub Actions workflows + ignore files

> **Prompt**: Implement Step 4 of `_plans/arch-safety-net.md`. Add the Umbraco Cloud CI/CD Flow GitHub Actions workflows to `.github/workflows/`. The shape is taken from Umbraco's upstream Cloud CI/CD Flow sample (search Umbraco's docs for "CI/CD Flow GitHub Actions sample" — the canonical repo is what to mirror; commit the sample's `cloud-sync.yml`, `cloud-artifact.yml`, `cloud-deployment.yml` largely verbatim, with the project-specific tweaks below). Add `cloud.gitignore` and `cloud.zipignore` from the same sample, also verbatim. The orchestrator `main.yml` triggers on push to all branches; jobs are gated by branch (Gate 1 always, Gate 2 master-only). Document the required GitHub Secrets/Variables inline at the top of `main.yml` as a comment. Do **not** push any commits yet — the first master push under this pipeline must be a dedicated no-op commit (Step 8).

**What to build**:
- Create `.github/workflows/main.yml` — orchestrator. Outline:
  - `on: push: branches: ['**']`
  - `concurrency: group: ${{ github.ref }}, cancel-in-progress: true`
  - Job `gate-1-build-test` (always runs):
    - Checkout, setup .NET 10, `dotnet restore`, `dotnet build -c Release --no-restore`, `dotnet test --no-build -c Release`
    - `if` guard: this job runs on all branches.
  - Job `cloud-sync` (depends on `gate-1-build-test`, master-only):
    - `if: github.ref == 'refs/heads/master' && success()`
    - `uses: ./.github/workflows/cloud-sync.yml`
    - Needs: `secrets: inherit`
  - Job `cloud-artifact` (depends on `cloud-sync`, master-only):
    - `uses: ./.github/workflows/cloud-artifact.yml`
  - Job `cloud-deployment` (depends on `cloud-artifact`, master-only):
    - `uses: ./.github/workflows/cloud-deployment.yml`
    - Inputs: project ID, target environment alias (Dev)
  - Job `playwright-against-dev` (depends on `cloud-deployment`, master-only):
    - Sanity check: `curl -fSs $URL` (smoke that Dev's homepage responds).
    - Setup Node 22, `npm ci`, `npx playwright install chromium --with-deps`
    - `npx playwright test --project=e2e`
    - Upload `playwright-report/` as a workflow artifact on failure for triage.
- Create `.github/workflows/cloud-sync.yml` — verbatim from upstream sample. Pulls Cloud's auto-commits back to the repo before subsequent steps.
- Create `.github/workflows/cloud-artifact.yml` — verbatim from upstream sample. Swaps `.gitignore` for `cloud.gitignore`, uses `cloud.zipignore`, zips source files, POSTs to `https://api.cloud.umbraco.com`.
- Create `.github/workflows/cloud-deployment.yml` — verbatim from upstream sample. POSTs deployment to target env, polls every ~25 seconds, fails after ~15 minutes.
- Create `cloud.gitignore` and `cloud.zipignore` at repo root, verbatim from upstream sample. Do NOT modify them — Cloud's zip artifact validator is strict.
- Add a header comment in `main.yml` documenting required secrets/variables:
  ```yaml
  # Required GitHub Secrets:
  #   UMBRACO_CLOUD_API_KEY — Cloud Portal → Configuration → CI/CD Flow (project-wide)
  #   UMBRACO_CLIENT_ID, UMBRACO_CLIENT_SECRET — Dev's backoffice OAuth for Playwright
  # Required GitHub Variables:
  #   PROJECT_ID — Cloud project ID
  #   TARGET_ENVIRONMENT_ALIAS — Dev environment alias
  #   URL — Dev's URL (used by Playwright auth.setup.ts via process.env.URL)
  # NOTE: AI API keys are NOT in GitHub Secrets. They're set in Umbraco Cloud
  #   Secrets Management on the Dev environment.
  ```

**Validation**:
- [Automated]: YAML validity via `yq` or `actionlint` if available; fall back to `python -c "import yaml; yaml.safe_load(open('.github/workflows/main.yml'))"` for each file.
- [Manual]: open each workflow file and check job dependencies + `if` guards match the spec's two-gate model.
- [Manual]: `cloud.gitignore` and `cloud.zipignore` exist at repo root and contain Cloud's canonical exclusions (not edited).
- **Do NOT push to master yet.** Step 8 handles the no-op dry run. Feature-branch verification happens after Step 6 lands the screenshot specs (so the first feature-branch push has the whole bundle to lift).

---

### Step 5 — Block component screenshot baselines (blocklist + blockgrid + shim equivalence)

> **Prompt**: Implement Step 5 of `_plans/arch-safety-net.md`. Add Playwright screenshot specs for every block component under `Views/Partials/blocklist/Components/` (11 components) and `Views/Partials/blockgrid/Components/` (12 components). Plus 4 shim-equivalence specs proving alertBanner / iconLinkRow / imageRow / richTextRow render identically across blocklist and blockgrid. Specs live under `tests/e2e/blocks/screenshots/` (new directory). Each spec navigates to a canonical content-bearing page on the running Umbraco instance and asserts `toHaveScreenshot()` on the block's bounding box. Use `mask:` for dynamic regions (timestamps, `latestArticlesRow` content). Default `maxDiffPixelRatio: 0.01`; shim equivalence specs use a pixel-perfect compare (`maxDiffPixelRatio: 0`). Reduce motion in test context (`page.emulateMedia({ reducedMotion: 'reduce' })`). Do NOT commit any baseline PNGs locally — baselines must be generated on Linux. Add a `.github/workflows/update-snapshots.yml` `workflow_dispatch` job that runs Playwright with `--update-snapshots` against Dev's URL and either auto-commits or opens a PR with the new PNGs.

**What to build**:
- Helper module `tests/e2e/blocks/screenshots/_helpers.ts`:
  - `discoverBlockOnPage(page, blockTestId)` — navigates to a known page, scrolls block into view, waits for fonts to load, returns the locator.
  - `screenshotOptions(overrides?)` — returns a stable `{ maxDiffPixelRatio: 0.01, animations: 'disabled', mask: [...] }` config.
  - Reduce-motion + animations-off applied in a shared `beforeEach`.
- Map each block component to a canonical page (record the mapping in a comment at the top of `_helpers.ts`):
  - `alertBanner` → article body page (has alert blocks in copy) or styleguide
  - `codeSnippetRow` → styleguide or a doc page that renders code
  - `colorPaletteBlock` → styleguide
  - `generalElementsBlock` → styleguide
  - `iconLinkRow` → home or styleguide
  - `imageCarouselRow` → home or article page
  - `imageRow` → article body
  - `latestArticlesRow` → home (mask the article titles/dates region)
  - `richTextRow` → article body
  - `typographyShowcaseBlock` → styleguide
  - `videoRow` → article body or styleguide
  - All blockgrid components → `experimentsLandingPage` (the blockgrid canonical surface). Each section/area on that page exposes the relevant blockgrid block.
  - If a block has no canonical page surface, add a section on the styleguide page that renders it. Coordinate with content authoring on Dev (Live → Dev restore for content).
- For each of 11 + 12 = 23 components, write `tests/e2e/blocks/screenshots/<componentName>.screenshot.spec.ts`:
  - Single test per spec: `test('renders <componentName> matching baseline', async ({ page }) => { ... })`
  - Navigate, locate block via stable selector (data attribute, semantic tag, role+name, or block CSS class), assert `await expect(locator).toHaveScreenshot(...)`.
- For the 4 shim equivalence specs (`tests/e2e/blocks/screenshots/_shim-equivalence/<componentName>.equivalence.spec.ts`):
  - Two `await expect(locator).toHaveScreenshot('shared-baseline.png', { maxDiffPixelRatio: 0 })` calls — one navigating to the blocklist render page, one to the blockgrid render page. They share a baseline file name on disk; Playwright will fail the second call if the rendered pixels diverge from the first.
  - Alternative approach if shared baselines prove flaky: take both screenshots into memory via `locator.screenshot()`, then `expect(blocklistBuf).toEqual(blockgridBuf)` with a `compare-png` helper. Choose the cleanest approach at implementation time.
- Add `.github/workflows/update-snapshots.yml`:
  - `on: workflow_dispatch:`
  - One job: checkout, setup Node, install Playwright, `URL=$DEV_URL npx playwright test --update-snapshots --project=e2e tests/e2e/blocks/screenshots/`
  - Auto-commit the resulting `tests/e2e/**/-snapshots/` directory back to the branch (use `peter-evans/create-pull-request` or `git commit && git push` with a GH App token).
- Verify `.gitignore` does NOT exclude `tests/e2e/**/-snapshots/`. Baselines are committed once they exist.

**Test first** *(this step IS the test artifact)*:
- Each spec file IS the test. After authoring, run locally:
  - `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/blocks/screenshots/`
  - First run will fail with "A snapshot doesn't exist" — expected (baselines live on Linux). Verify the failure is the expected one, not a navigation/locator failure.
  - If you see a navigation/locator failure on any spec, fix it. The spec must run cleanly enough to reach the snapshot assertion.

**Validation**:
- [Automated]: `find tests/e2e/blocks/screenshots/ -name "*.spec.ts" | wc -l` returns 23 (one per component) plus 4 shim-equivalence specs = 27 spec files (give or take depending on how shim equivalence is structured).
- [Automated]: `npx playwright test tests/e2e/blocks/screenshots/` runs without crashing; failures are all "snapshot missing" — never navigation/locator/timeout errors.
- [Manual]: skim the `_helpers.ts` block-to-page mapping comment — every component is accounted for.
- [Manual]: open `.github/workflows/update-snapshots.yml` and confirm it targets Dev's URL via the `URL` GitHub variable.

---

### Step 6 — Page template screenshot baselines

> **Prompt**: Implement Step 6 of `_plans/arch-safety-net.md`. Add a page-level screenshot spec for each of the 6 page templates: home, articleList, article, experimentsLandingPage, search, contact. Specs live under `tests/e2e/pages/` (new directory). Each spec navigates to the canonical instance of that page type on the running Umbraco instance, asserts a full-page screenshot, and masks any dynamic regions (timestamps, search results, latest-articles widget). Use the helpers from Step 5 (`tests/e2e/blocks/screenshots/_helpers.ts` — consider moving them to `tests/e2e/_helpers.ts` if both blocks and pages share them). Reuse the `update-snapshots.yml` workflow added in Step 5 to generate baselines on Linux.

**What to build**:
- If the helpers from Step 5 are sharable between block and page specs, move them to `tests/e2e/_helpers.ts` (one level up) and re-import from both block specs and the new page specs. Otherwise keep them in the block-screenshots subdir.
- Create 6 spec files under `tests/e2e/pages/`:
  - `home.screenshot.spec.ts` — navigates to `/`, full-page screenshot, mask the `latestArticlesRow` block.
  - `articleList.screenshot.spec.ts` — navigates to the canonical article-list URL (look up dynamically per the test-resilience rule). Mask article titles/dates if Dev content drift causes thrash; otherwise leave unmasked.
  - `article.screenshot.spec.ts` — navigates to a specific stable article (look up by name, not slug). Mask published-date timestamp.
  - `experimentsLandingPage.screenshot.spec.ts` — navigates to the experiments landing route.
  - `search.screenshot.spec.ts` — navigates to `/search?q=umbraco` (stable test query). Mask result snippets if they're rank-dependent.
  - `contact.screenshot.spec.ts` — navigates to the contact page.
- Default `maxDiffPixelRatio: 0.01` per spec.
- Use `fullPage: true` for page-level shots (not `locator.screenshot()`).
- Reduce motion, disable animations, wait for `networkidle` before screenshot.

**Test first**:
- After authoring, run locally:
  - `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/pages/`
  - First run will fail with "snapshot missing" — expected. Confirm no navigation/locator failures.

**Validation**:
- [Automated]: `find tests/e2e/pages/ -name "*.screenshot.spec.ts" | wc -l` returns 6.
- [Automated]: `npx playwright test tests/e2e/pages/` runs cleanly to the snapshot-missing failure on each spec.
- [Manual]: review one full-page screenshot taken locally to confirm the mask regions are correct — open `test-results/<spec>/test-failed-1.png` after a missing-baseline failure.

---

### Step 7 — CLAUDE.md documentation update

> **Prompt**: Implement Step 7 of `_plans/arch-safety-net.md`. Update [CLAUDE.md](CLAUDE.md) with a new top-level section documenting the Cloud CI/CD Flow safety net. Cover: (1) two-gate workflow shape, (2) Dev-as-deploy-target / Live-as-promotion-only model, (3) Live-canonical / Dev-mirror-via-restore content workflow, (4) pre-push hook behavior + timings printing + SKIP_PREPUSH=1 escape, (5) screenshot baseline regeneration workflow (Linux only, via `workflow_dispatch`), (6) nullable + warnings-as-errors expectations + surgical NoWarn exemption pattern, (7) required GitHub secrets/variables and how they map to Cloud Portal values, (8) the rule that AI keys live in Umbraco Cloud Secrets Management on Dev, NOT in GitHub Secrets.

**What to build**:
- Add a new section near the top of [CLAUDE.md](CLAUDE.md), after **Architecture** and before **AI & Copilot** (or wherever the existing "Schema Management" / "Search" sections sit — place CI/CD docs near them for thematic grouping). Title: `## CI/CD & Build hygiene`.
- Subsections:
  - **Cloud CI/CD Flow (two gates)** — describe Gate 1 (build + xUnit, runner-local) and Gate 2 (Playwright against deployed Dev). Note that feature branches run Gate 1 only.
  - **Master → Dev → manual promotion to Live** — explain that CI never deploys to Live; promotion is a human action via Cloud Portal.
  - **Content workflow under CI** — Live is canonical; Dev is a periodic mirror via Cloud Portal "restore from Live to Dev." Local → Dev content transfers are NOT used; the existing "local → Live" content-transfer habit is preserved.
  - **Pre-push hook** — describes the `dotnet build` + `dotnet test --no-build` checks, timing output, `SKIP_PREPUSH=1` bypass, `.githooks.conf` toggle.
  - **Screenshot baselines** — generated on Linux only (CI runner). Document the `workflow_dispatch` regenerate workflow. Note the `prefers-reduced-motion: reduce` + masking strategy.
  - **Nullable warnings as errors** — explain that `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` is on across all three projects. Surgical `<NoWarn>` per warning code with inline justification is the only relaxation pattern. Razor `.cshtml` files and auto-generated published models are out of scope (compile elsewhere).
  - **GitHub Secrets / Variables** — table mapping each one to its Cloud Portal source (`UMBRACO_CLOUD_API_KEY`, `PROJECT_ID`, `TARGET_ENVIRONMENT_ALIAS`, `UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET`, `URL`). Call out that AI keys (`OPENAI__APIKEY`, `ANTHROPIC__APIKEY`) live in Umbraco Cloud Secrets Management on Dev, never in GitHub.
- Update the existing "Testing" → "Auth Setup" subsection to note that for CI, Playwright auth points at Dev's URL (not localhost) via the `URL` GitHub variable.
- Update the existing "Schema Management" subsection's "How schema drift happens" mechanism (3) (Umbraco auto-regenerates `.uda` on local startup) to mention that under CI/CD Flow, `cloud-sync` pulls Cloud's auto-commits back to the repo before each deploy — this is now an additional drift surface that `/check-uda` already covers.

**Validation**:
- [Manual]: open CLAUDE.md and verify each of the 8 spec subsections is present and accurate.
- [Manual]: cross-reference the secrets table against the comment header in `.github/workflows/main.yml` (added in Step 4) — they must agree on names and purposes.
- [Manual]: `grep "_features/arch-safety-net" CLAUDE.md` returns no matches (bundle has no feature doc, so no link target).

---

### Step 8 — CI dry-run + Gate-1 and Gate-2 failure verification

> **Prompt**: Implement Step 8 of `_plans/arch-safety-net.md`. This is the load-bearing verification step for the entire bundle — exercise every gate end-to-end on real GitHub Actions runners and real Cloud deploys, while the bundle's surface is still small. Three separate verification flows on three temporary branches: (a) full master push with all green, (b) Gate 1 failure (broken xUnit) blocks the deploy, (c) Gate 2 failure (broken screenshot) lands on Dev but fails Playwright. Each is an independently-revertable change. Before any of these: configure GitHub Secrets/Variables per Step 4's comment header. Before the very first master push: ensure the first master commit under the new pipeline is a no-op (e.g., a CLAUDE.md typo fix), so any wiring failure has no functional blast radius. Final action: generate the canonical Linux-side screenshot baselines via the `update-snapshots.yml` workflow_dispatch, then commit them.

**What to build / verify** (this step is mostly verification, with one small commit at the end):

1. **Pre-flight: configure GitHub Secrets/Variables.** On the GitHub repo, set:
   - Secrets: `UMBRACO_CLOUD_API_KEY` (from Cloud Portal → Configuration → CI/CD Flow), `UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET` (Dev's backoffice OAuth).
   - Variables: `PROJECT_ID`, `TARGET_ENVIRONMENT_ALIAS` (Dev's alias), `URL` (Dev's URL).
   - Confirm via the comment header in `main.yml`.

2. **Pre-flight: confirm AI keys in Umbraco Cloud Secrets Management on Dev** — `OPENAI__APIKEY` and `ANTHROPIC__APIKEY` (or whatever this project actually uses). If these aren't already set on Dev, set them via the Cloud Portal. This is a one-time setup per environment.

3. **Verification 1 — feature-branch push runs Gate 1 only.**
   - Push the current `claude/feature/arch-safety-net` branch (with all preceding steps' work) to origin.
   - Watch the workflow in GitHub Actions: confirm `gate-1-build-test` runs and succeeds; confirm `cloud-sync`, `cloud-artifact`, `cloud-deployment`, `playwright-against-dev` are all **skipped** (master-only). Confirm Dev is unchanged.

4. **Verification 2 — master push, all green (no-op dry run).**
   - Merge `claude/feature/arch-safety-net` to master via fast-forward (this is the first real master push under CI/CD Flow). The bundle's CLAUDE.md edits + workflow YAMLs + nullable enforcement provide enough "real" change that the artifact will be non-trivial; no separate typo-only commit needed if confidence is already high. (If implementer wants extra caution, push a CLAUDE.md typo fix as the FIRST master commit before the merge.)
   - Watch the full workflow: cloud-sync → build → xUnit → cloud-artifact → cloud-deployment → playwright-against-dev. Confirm each job goes green.
   - After cloud-deployment succeeds, browse Dev's URL and confirm the deploy landed.
   - Confirm the workflow result is green.
   - Confirm Live is unchanged (no automated promotion).

5. **Generate Linux-side screenshot baselines (now that master is deployed and CI is wired).**
   - Trigger `update-snapshots.yml` via GitHub Actions workflow_dispatch. The workflow runs Playwright with `--update-snapshots` against Dev, then either auto-commits or opens a PR with the new PNGs under `tests/e2e/**/-snapshots/`.
   - Merge that PR (or pull the auto-commit). The screenshot specs now have canonical baselines.
   - Push master again — Gate 2 (Playwright against Dev) should now run with real baseline comparisons and pass.

6. **Verification 3 — Gate 1 failure blocks the deploy.**
   - On a throwaway branch from master (e.g., `claude/verify/gate-1-failure`), intentionally break an xUnit test (`SmokeTests.True_IsTrue` → `Assert.True(false)`).
   - Merge to master (or push to a temp branch and rebase — confirm rebase preserves the broken state).
   - Watch the workflow: `gate-1-build-test` fails. Confirm:
     - `cloud-sync` does NOT run.
     - `cloud-artifact` does NOT run.
     - `cloud-deployment` does NOT run.
     - `playwright-against-dev` does NOT run.
     - **Dev is unchanged** (browse Dev's URL — content/build matches the previous successful deploy).
   - Revert the broken commit on master. Confirm the next master push redeploys cleanly.

7. **Verification 4 — Gate 2 failure lands on Dev but marks the workflow red.**
   - On a throwaway branch from master, intentionally introduce a screenshot regression (e.g., add 4px of vertical padding to `Views/Partials/blocklist/Components/alertBanner.cshtml` — wrap the content in a `<div style="padding-top: 4px;">`).
   - Merge to master.
   - Watch the workflow: Gate 1 passes (build + xUnit clean), cloud-artifact + cloud-deployment succeed (Dev gets the broken padding), playwright-against-dev FAILS on the alertBanner screenshot spec with a visible pixel diff. Workflow result: red.
   - Confirm Dev retains the broken-but-deployed change (this is by design).
   - **Do NOT promote to Live** in the Cloud Portal — this is the human gate.
   - Revert the broken commit. Push to master. Next workflow run goes green; Dev is healed.

**Validation**:
- [Manual]: each of the 7 numbered steps above runs end-to-end with the expected outcome. Document any deviations in a `_specs/shipped/arch-safety-net.md` shipping note when archiving.
- [Manual]: at the end of Step 8, both Dev and Live are in healthy state. Master is green. The bundle is verified.

---

## File Summary

| Action | File |
|--------|------|
| Modify | `playwright.config.ts` |
| Modify (multiple) | `tests/e2e/**/*.spec.ts` (delete per-spec `NODE_TLS_REJECT_UNAUTHORIZED` lines) |
| Modify | `src/UmbracoProject/UmbracoProject.csproj` |
| Modify | `src/HelloWorld/HelloWorld.csproj` |
| Modify | `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` |
| Modify (multiple) | `src/UmbracoProject/**/*.cs`, `src/HelloWorld/*.cs` (~13 hand-written files, nullable fix-up) |
| Replace | `.githooks/pre-push` |
| Modify | `.githooks.conf.example` |
| Create | `.githooks/test-pre-push.sh` |
| Modify | `README.md` (pre-push hook reference) |
| Create | `.github/workflows/main.yml` |
| Create | `.github/workflows/cloud-sync.yml` |
| Create | `.github/workflows/cloud-artifact.yml` |
| Create | `.github/workflows/cloud-deployment.yml` |
| Create | `.github/workflows/update-snapshots.yml` |
| Create | `cloud.gitignore` |
| Create | `cloud.zipignore` |
| Create | `tests/e2e/_helpers.ts` (or `tests/e2e/blocks/screenshots/_helpers.ts`) |
| Create | `tests/e2e/blocks/screenshots/*.screenshot.spec.ts` (23 files) |
| Create | `tests/e2e/blocks/screenshots/_shim-equivalence/*.equivalence.spec.ts` (4 files) |
| Create | `tests/e2e/pages/*.screenshot.spec.ts` (6 files) |
| Create | `tests/e2e/**/-snapshots/*.png` (generated on Linux via update-snapshots.yml, then committed) |
| Modify | `CLAUDE.md` (new CI/CD & Build hygiene section) |
| No file | GitHub Secrets/Variables configuration (Step 8 pre-flight, manual via GitHub UI) |
| No file | Umbraco Cloud Secrets Management for Dev's AI keys (Step 8 pre-flight, manual via Cloud Portal) |

**No `_features/arch-safety-net.md`** — this is a bundle spec, same precedent as `site-polish-2026-05`.
