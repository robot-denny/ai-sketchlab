# Testing Guide

**Who this is for:** both technical and non-technical team members — anyone who wants to understand what "the tests" actually protect, how to run them, and how to read a red/green result. It assumes **zero** prior experience adding tests to a codebase.

If you only read one thing: **tests are the safety net that lets us change this site confidently.** When a test goes red, something the team decided *must always be true* stopped being true. This guide explains the kinds of tests we have, why each exists, where they live, when to run and write them, and how a test result becomes visible to people.

### How to use this guide

You don't need to read this top to bottom. Pick your path:

- **Editors / PMs / non-technical readers** → [§1 The big picture](#1-the-big-picture-in-plain-language), [§5 Why an editor can't crash a page](#5-the-render-coverage-guardrail-why-an-editor-cant-crash-a-page), and the highlighted takeaway boxes in [§6](#6-how-playwright-screenshots-visual-baselines-work) and [§8](#8-when-tests-run-automatically-cicd).
- **Developers** → all of it; [§7](#7-running-tests--the-practical-commands) and [§12](#12-quick-reference) are your run commands.
- **Just need to run something?** → [§12 Quick reference](#12-quick-reference) is the cheat sheet.
- **Hit an unfamiliar word?** ("red/green", "spec", "baseline", "fixture"…) → jump to the [§13 Glossary](#13-glossary) — every term is defined in plain language.

### Contents

1. [The big picture in plain language](#1-the-big-picture-in-plain-language)
2. [Where everything lives](#2-where-everything-lives)
3. [The three test families in detail](#3-the-three-test-families-in-detail)
4. [How login and test data work](#4-how-login-and-test-data-work-and-how-cleanup-happens)
5. [The render-coverage guardrail](#5-the-render-coverage-guardrail-why-an-editor-cant-crash-a-page)
6. [How Playwright screenshots (visual baselines) work](#6-how-playwright-screenshots-visual-baselines-work)
7. [Running tests — the practical commands](#7-running-tests--the-practical-commands)
8. [When tests run automatically (CI/CD)](#8-when-tests-run-automatically-cicd)
9. [How test results become visible to people](#9-how-test-results-become-visible-to-people)
10. [How the rest of the system references tests](#10-how-the-rest-of-the-system-references-tests)
11. [When should *you* write a test?](#11-when-should-you-write-a-test)
12. [Quick reference](#12-quick-reference)
13. [Glossary](#13-glossary)

---

## 1. The big picture in plain language

This site is an Umbraco CMS website. Content editors build pages out of reusable "blocks" (an alert banner, an image row, a rich-text section, etc.), and the site renders them. There's also search, a contact form, SEO plumbing (sitemap, robots, 404s), and a backoffice image generator.

We protect all of that with **three families of automated tests**, plus a handful of **guardrails** that aren't tests in the traditional sense but run alongside them:

| Family | What it checks | Who writes/reads them | Where it runs | Speed |
|---|---|---|---|---|
| **xUnit (C#) unit tests** | Small pieces of server logic in isolation — a service, a middleware, a schema rule. No browser, no live site. | Developers | Your machine + CI Gate 1 | Seconds |
| **Node unit tests** | The standalone TypeScript CLI tools (image generator, guide generator). | Developers | Your machine (`npm run test:unit`) | Seconds |
| **Playwright end-to-end (E2E) tests** | The real site in a real browser — clicking through pages, asserting what a visitor actually sees, and comparing screenshots pixel-by-pixel. | Developers write them; **PMs/editors read the reports** | Your machine (local site) + CI Gate 2 (against the deployed Dev site) | Minutes |

There are also two **guardrails** worth knowing about:

- **Build warnings-as-errors** — the C# build itself fails on any warning. A compiler warning is treated as a broken test.
- **The block render-coverage test** — a special xUnit test that reads the CMS schema files and proves every block an editor can pick actually has something to render. It stops an editor from being able to crash a page just by adding a block.

The mental model: **fast, cheap tests run on every branch; slow, expensive tests run only when code reaches `master`.** The goal is to catch problems as early (and as cheaply) as possible.

---

## 2. Where everything lives

```
tests/
├─ UmbracoProject.Tests/            ← C# xUnit tests (the fast server-logic tests)
│  ├─ BlockRenderCoverageTests.cs   ← guardrail: every pickable block can render
│  ├─ SmokeTests.cs                 ← "does the test project even run" sanity check
│  ├─ SearchComposerTests.cs
│  ├─ Services/SearchServiceTests.cs
│  ├─ Infrastructure/               ← middleware + handler tests (sitemap, premium role)
│  └─ ImageGenerator/               ← image-generator controller + CLI tests
│
└─ e2e/                             ← Playwright end-to-end tests (browser)
   ├─ auth.setup.ts                 ← logs in once, shares the session with all specs
   ├─ _helpers.ts                   ← shared screenshot + navigation helpers
   ├─ _umbracoApi.ts                ← helpers for creating/deleting test content via the API
   ├─ *.spec.ts                     ← behavior specs (search, authors, SEO, nav, footer…)
   ├─ accessibility/                ← axe-core + link accessibility specs
   ├─ blocks/                       ← per-block behavior + screenshot specs
   │  └─ screenshots/               ← visual-regression specs + baseline images
   ├─ pages/                        ← whole-page screenshot specs
   ├─ experiments/, header/, footer/ … grouped by area of the site
   └─ .auth/user.json               ← the saved login token (git-ignored, regenerated each run)

tests/image-generator/, scripts/guide-generator/test/   ← Node unit tests

docs/testing-guide.md               ← this file
docs/ci-failure-recipes.md          ← what to do when a specific CI failure appears
```

Two configuration files govern the runners:

- **`playwright.config.ts`** (repo root) — Playwright settings: which folder holds tests, the base URL, retries, and Umbraco-specific quirks (e.g. Umbraco uses `data-mark` instead of `data-testid`).
- **`tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj`** — the C# test project.

---

## 3. The three test families in detail

### 3a. xUnit (C#) unit tests — the fast safety net

**Purpose:** verify a single piece of server-side logic without spinning up the whole website. These are the cheapest, fastest tests and should be the first place you reach when the change is in C#.

**What they cover today:**

- **`SearchServiceTests`** — the search service returns the right results for keyword vs. semantic modes and degrades gracefully when the search index is broken.
- **`SitemapRewriteMiddlewareTests`** — `/sitemap.xml` is internally rewritten to the content node that renders the XML.
- **`AssignMembersToPremiumRoleHandlerTests`** — new members get assigned to the premium role.
- **`SearchComposerTests`** — the search packages are wired up correctly at startup.
- **`ImageGenerator` tests** — the backoffice image-generator controller and CLI behave.
- **`BlockRenderCoverageTests`** — the render-coverage guardrail (see §5).
- **`SmokeTests`** — a trivial test that proves the test project builds and runs at all.

**How to run them:**

```bash
cd src/UmbracoProject && dotnet test ../../umbraco-17-demo-site.sln -c Release
# or from the repo root:
dotnet test umbraco-17-demo-site.sln -c Release
```

They need **no running site and no database** — they either test pure logic or read the schema files directly off disk. That's what makes them fast enough to run on every push.

### 3b. Node unit tests — the standalone CLI tools

**Purpose:** the image generator and the how-to-guide generator are TypeScript command-line tools that run outside Umbraco. Their logic is unit-tested with Node's built-in test runner.

```bash
npm run test:unit
# (prefix with the nvm PATH if node isn't on your PATH — see §7)
```

### 3c. Playwright E2E tests — the real site in a real browser

**Purpose:** prove the site *actually works for a visitor*. Playwright drives a real Chrome browser: it navigates pages, clicks things, reads what's on screen, and (for many components) takes a screenshot and compares it against a saved "known-good" image.

E2E tests split into three sub-types:

1. **Behavior specs** (`*.spec.ts`) — assert *what happens*. Example: `search.spec.ts` types a query and checks that result cards appear; `seoRouting.spec.ts` checks `/sitemap.xml` and the 404 page; `sectionNavigation.spec.ts` checks the sidebar nav shows the right siblings.

2. **Screenshot / visual-regression specs** (`blocks/screenshots/*.screenshot.spec.ts`, `pages/*.screenshot.spec.ts`) — render a block or a whole page and compare it pixel-by-pixel against a committed baseline image. These catch *visual* regressions that behavior tests miss (a broken layout, a colour change, a font shift). See §6 for how baselines work.

3. **Accessibility specs** (`accessibility/`) — run the `axe-core` engine against pages to catch accessibility violations, plus targeted checks on card and footer links.

**A crucial scope note** (from the header of `tests/e2e/_helpers.ts`): the screenshot specs all run with **motion turned off** (`prefers-reduced-motion: reduce`). They do **not** check ARIA, alt text, heading levels, or keyboard behavior — that's the job of the separate accessibility specs. Don't assume a green screenshot means a component is accessible.

**How to run them** (see §7 for the full command with the node PATH prefix):

```bash
npm run test:e2e            # headless, against your local site
npm run test:e2e:ui         # interactive UI — great for watching/debugging
npm run test:e2e:debug      # step-through debugger
npx playwright test tests/e2e/search.spec.ts    # a single file
```

Playwright needs the **site running first** (locally at `https://localhost:44367`) — see §7.

---

## 4. How login and test data work (and how cleanup happens)

This is the part people most often get wrong, so it gets its own section.

### Login: one token, shared by every spec

Umbraco's backoffice is a single-page app, so the tests **don't** type a username and password into a login form. Instead, `tests/e2e/auth.setup.ts` runs **once** before all specs, calls Umbraco's Management API with **OAuth client credentials** (from `.env`: `UMBRACO_CLIENT_ID` / `UMBRACO_CLIENT_SECRET`), and writes the resulting token to `tests/e2e/.auth/user.json`. Every spec then reuses that saved session.

- That token file is **git-ignored** and regenerated on every run — never commit it.
- **Tokens expire after 299 seconds.** For long-running specs that create lots of content, the helper in `tests/e2e/_umbracoApi.ts` automatically refreshes the token before it expires. If you write a spec that makes many sequential API calls, use that helper (`freshToken()` / `apiFetch()`) rather than holding one token for the whole run.

### Test content: created fresh, cleaned up, never hardcoded

Many behavior specs need content to exist — e.g. section-navigation needs a parent page with children. Rather than depending on whatever happens to be in the CMS, these specs **create their own fixtures** via the Management API in a `beforeAll` block and **delete them** in `afterAll`.

The rules these follow (documented in full in `CLAUDE.md` → *E2E Test Resilience Rules*) are worth internalizing because they're the difference between a test that works everywhere and one that breaks the moment it runs on Dev:

1. **Never hardcode Umbraco IDs (UUIDs).** Document, doc-type, and template IDs differ between environments. Always look them up dynamically (walk the tree, search by name) — e.g. `sectionNavigation.spec.ts` finds the "Home" node and "Content" doc type by name in `beforeAll`.
2. **Never hardcode URL slugs.** Umbraco appends `-2`, `-3` to duplicate names, so fetch the actual published URL after creating a page.
3. **Clean up stale data *before* creating new data.** Specs search for leftover pages from a previous failed run (by a unique name prefix like `SN Test`) and delete them first, so a crashed run doesn't poison the next one. See `cleanStaleTestPages()` in `sectionNavigation.spec.ts`.
4. **Re-acquire the token between phases** (the 299-second expiry again).
5. **Track everything created and delete it in `afterAll`** (`createdIds[]` pattern).

**What "cleanup" looks like in practice:** a spec keeps a list of the IDs it created, and its `afterAll` deletes them and restores any config it temporarily changed (e.g. re-tightening which doc types are allowed as children). If a run crashes mid-way and leaves junk behind, the *next* run's `beforeAll` "clean stale data" step sweeps it up by name prefix. This is why fixtures use recognizable prefixes.

**Important environment rule:** locally, tests create/delete content in your local SQLite database — harmless. In CI, the Playwright job runs **against the deployed Dev environment** and creates fixtures there via the API. Dev's content is periodically re-mirrored from Live, so this test content is transient by design. **Never point E2E fixture creation at Live.**

---

## 5. The render-coverage guardrail (why an editor can't crash a page)

`tests/UmbracoProject.Tests/BlockRenderCoverageTests.cs` is a special xUnit test that deserves its own explanation because it enforces a project-wide invariant.

**The problem it solves:** in Umbraco, an admin decides which blocks an editor is allowed to add to a page (the "palette"). If a block is offered in the palette but nobody wrote a Razor view to render it, an editor adding that block would produce a blank area or a 500 error on the live site.

**What the test does:** it reads the CMS schema files (`.uda` files under `umbraco/Deploy/Revision/`) directly, finds every block offered by the two page-body palettes (`[BlockList] Main Content` and `[BlockGrid] Experiments Body`), and asserts each one resolves to an actual `.cshtml` view. If someone adds a block to a palette but forgets the view, **the build fails** — before it ever reaches the site.

The only allowed exception is `pillarSection` (a grid-only block), which is explicitly listed and itself checked for staleness by a second test. This is the "build gate" referenced throughout `CLAUDE.md` under *Block / component rendering & parity*.

**Takeaway for editors/PMs:** this is why you can safely experiment with blocks in the backoffice — the combinations that would break a page are prevented at build time.

---

## 6. How Playwright screenshots (visual baselines) work

This is the fuzziest area for most of the team, so we'll build it up slowly and then answer the question everyone eventually asks: *"I just built a new block on my laptop — where does its baseline come from?"*

### What a "baseline" is, in one sentence

A **baseline** is a saved picture of what a block or page is *supposed* to look like. On every test run, Playwright takes a fresh picture and compares it to the saved one. If they differ too much, the test fails and shows you three images side by side — **expected** (the baseline), **actual** (what it looks like now), and **diff** (the pixels that changed highlighted).

Think of it like a "spot the difference" puzzle run automatically: the baseline is the reference photo, and the test flags anything that drifted from it — a broken layout, a shifted font, a wrong colour.

### Where the pictures live

Right next to each screenshot spec, in a folder named after it:

```
tests/e2e/blocks/screenshots/alertBanner.screenshot.spec.ts-snapshots/
   ├─ alertBanner-e2e-linux.png     ← the real baseline (this is what gets compared)
   └─ alertBanner-e2e-darwin.png    ← a Mac copy (ignored by git, NOT used by anything)
```

### Two facts that explain everything confusing about baselines

Almost every "wait, how does this work?" moment comes down to these two facts:

**Fact 1 — Baselines are generated on Linux, because our tests run on Linux.**
Mac, Windows, and Linux each draw text and edges slightly differently. Our automated tests run on Linux servers, so the baselines *must* be Linux pictures — a picture taken on a Mac would mismatch every single time. That's why:
- Only the `*-linux.png` files are committed and count.
- Git actively **blocks** `*-darwin.png` (Mac) and `*-win32.png` (Windows) files so a wrong-OS picture can never sneak in as the baseline.
- **Running Playwright on your own Mac will never produce a usable baseline** — it makes an ignored `-darwin` picture. Great for eyeballing your work locally; useless as the reference the team compares against.

**Fact 2 — Baselines are captured against the deployed *Dev* site, not your laptop.**
The tool that generates baselines is a GitHub workflow called **`update-snapshots.yml`**. It doesn't run on your machine and it doesn't use your branch's code directly — it opens the **Dev environment** in a browser, takes the pictures there, and commits them. So a baseline can only be captured for something that is **actually visible on Dev right now.**

### ⭐ The question everyone asks: "My new block is only local — how does it get a baseline?"

Short answer: **it can't get one yet.** A baseline is a photo of the block *rendered on Dev*, so the block's code has to reach Dev, and an actual instance of the block has to appear on one of Dev's pages, **before** any baseline can be taken. You cannot photograph something that isn't on Dev yet.

So the order of operations for a brand-new block is:

1. **Build the block and its screenshot spec locally.** Confirm it looks right on your Mac (`npm run test:e2e:ui`). The spec will "fail" for now because there's no baseline — that's expected at this stage, not a mistake.
2. **Merge to `master`.** This deploys the block's view + schema to the **Dev** environment (Gate 2). The screenshot spec will go red on Dev too — *still expected*, because the baseline doesn't exist yet. This is the one moment where a red test is normal.
3. **Make sure the block actually appears on Dev.** The screenshot specs photograph blocks on real content pages (e.g. `/styleguide/components/`, `/experiments/`). An instance of your block needs to be present there on Dev. (Code and schema arrive via git/master; the *content instance* arrives the normal content way — authored on Live and mirrored down to Dev. See `CLAUDE.md` → *Content workflow under CI*.)
4. **Run the baseline workflow against Dev:**
   ```bash
   gh workflow run update-snapshots.yml --ref master
   ```
   (Or the "Run workflow" button on `.github/workflows/update-snapshots.yml`.) It opens Dev, photographs your block, and commits the new `*-linux.png` baseline back to the branch as the bot.
5. **Review the committed picture, then merge.** From now on the spec is green and guards the block against future visual drift.

The takeaway: **there's a deliberate window where a new screenshot spec is red — between "merged" and "baseline generated."** That's the system working as designed, not a bug. What you must *not* do is leave it red forever.

> ⚠️ **A screenshot spec with no baseline does not skip — it *fails* every run until its picture lands.** The project has been burned by this: 26 specs once sat red for weeks because nobody ran the baseline workflow after adding them, and the red became background noise. **Rule: the moment you add a screenshot spec and its code is on Dev, run `update-snapshots.yml` and confirm the bot committed the baseline.** (See `docs/ci-failure-recipes.md`.)

### Regenerating baselines for a block that *already exists*

Same workflow, simpler story: when you intentionally change how an existing block looks (new CSS, new markup), its old baseline is now correctly out of date. The block is already on Dev, so once your visual change is deployed there, just run `update-snapshots.yml`, review the new pictures in the bot's commit, and merge.

**Do not** run it as a reflex to "make a failing visual test go green" — a red screenshot might be catching a *real* regression. Look at the diff image first.

### Why some pictures allow small differences (tolerances and masking)

- **Tolerance:** by default a screenshot may differ by up to 1% of its pixels (`maxDiffPixelRatio: 0.01`) before it fails — this absorbs tiny, harmless anti-aliasing noise. The four "shim-equivalence" specs (which prove a block looks *identical* whether placed in a Block List or a Block Grid) use `0` — they demand a byte-for-byte match.
- **Masking:** some regions change constantly and would cause false alarms — the "latest articles" card grid, published dates, bylines. Those are **masked** (blacked out) before comparison via `dynamicRegionMasks()`, so the test ignores them and only judges the stable layout around them.

---

## 7. Running tests — the practical commands

### C# / xUnit (no site needed)

```bash
dotnet test umbraco-17-demo-site.sln -c Release
```

### Node unit tests

```bash
npm run test:unit
```

### Playwright E2E (needs the local site running)

**Step 1 — start the site** in one terminal:

```bash
cd src/UmbracoProject && dotnet run
# serves at https://localhost:44367
```

**Step 2 — run Playwright** in another. Node is managed via `nvm`, so if `node` isn't on your PATH, prefix the command:

```bash
PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npm run test:e2e
```

First-time setup:

```bash
npm install
npx playwright install chromium
```

Useful variants:

```bash
npm run test:e2e:ui                              # watch tests run in a UI
npx playwright test tests/e2e/search.spec.ts     # one file
npm run clean:reports                            # delete old reports/results
```

Credentials come from `.env` (`UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET`, `URL`). Locally these point at your machine; the testhelpers package reads the base URL from `process.env.URL`.

---

## 8. When tests run automatically (CI/CD)

Every push triggers GitHub Actions (`.github/workflows/main.yml`), which runs a **two-gate pipeline**. The jobs run in a fixed order, and that order is the key to understanding *what a failure actually blocks*:

```
Gate 1                     Gate 2 (master only)
──────────                 ─────────────────────────────────────────────
build + xUnit  ──▶  cloud-sync ──▶ artifact ──▶ deploy to Dev ──▶ Playwright (against Dev)
   (all branches)                                (code is now live on Dev)   (verifies Dev)
```

Each arrow means "only runs if the previous step succeeded." Read left to right, that ordering tells you exactly which failures stop a deploy and which don't.

**The whole section in two lines** (the rest just explains why):

- **Build + unit tests (Gate 1)** = a true gate *before* code reaches Dev. Red here → nothing deploys.
- **Playwright (Gate 2)** = a post-deploy smoke test *on* Dev. Red here → the code is *already* on Dev; the failure blocks the human's decision to promote to **Live**, not the Dev deploy.

### Gate 1 — Build + xUnit (runs on *every* branch)

`dotnet restore` → `dotnet build -c Release` (warnings are errors) → `dotnet test`. Fast (< 1 min warm) and mirrors the local pre-push hook exactly. If your branch is red here, reproduce it locally with the same commands.

**This is a true gate before Dev.** If the build or a unit test fails, the Cloud jobs never start — nothing reaches Dev. Feature branches stop here entirely; Playwright never runs on a feature branch in CI.

### Gate 2 — Cloud deploy, *then* Playwright (runs on `master` only)

Only after code merges to `master`: the change syncs to Umbraco Cloud, builds a deploy artifact, **deploys to the Dev environment**, waits for search to warm up, and *then* runs the **full Playwright suite against the now-deployed Dev site**.

The ordering matters enormously, and it's the thing most people get wrong:

> **Playwright runs *after* the Dev deploy, so a Playwright failure does NOT prevent code from reaching Dev.** By the time the browser tests start, the code is already live on Dev. A failure here is a **red notification** (with a downloadable report of the diff images), not a rollback and not a Dev gate.

So what *does* a red Playwright run block? **Promotion to Live.** CI never deploys to Live — a human promotes Dev → Live manually in the Umbraco Cloud Portal. A red Playwright run on Dev is the signal to that human: *"something regressed on Dev — don't promote to Live yet."* Dev is deliberately the place a regression can surface without Live ever being touched.

(That's the two-line summary at the top of this section, now with the full reasoning behind it.)

**Why this split?** Playwright is slow and needs a fully deployed, running site to test against — you can't meaningfully run it until the code is actually deployed somewhere. Dev is that "somewhere." Gate 1 catches the cheap-to-find problems instantly on every branch; Gate 2 uses Dev as a real-world staging check before anything reaches visitors on Live.

### The pre-push hook (local Gate 1)

`.githooks/pre-push` runs `dotnet build -c Release` + `dotnet test` before each push, so you catch Gate-1 failures before they hit CI. It prints a timing line on success. To bypass in a pinch: `SKIP_PREPUSH=1 git push` (see `CLAUDE.md` → *Pre-push hook* for all bypass options). Enable it once with `git config core.hooksPath .githooks`.

---

## 9. How test results become visible to people

- **Locally:** the terminal shows pass/fail. Playwright additionally writes an **HTML report** (`playwright-report/`) you can open in a browser — it shows each test, its trace, and for screenshot failures the *expected / actual / diff* images side by side.
- **In CI:** each run shows green/red per job on the GitHub Actions tab. On a **Playwright failure**, the job uploads the `playwright-report` as a downloadable artifact so you can inspect the diff images without re-running anything.
- **In the codebase:** each `_features/<slug>.md` behavioral spec has a **Test Coverage** table mapping each scenario to the exact spec file and test name (see §10). That's the human-readable "what is proven to work" index — useful for anyone who wants to see what's verified without reading the test code.

### Reading a red CI run

`CLAUDE.md` → *Diagnosing a red CI run* is the full playbook, but the three questions in order are: **which gate failed → which job → was it already red before my commit?** A failure that was red on the previous `master` run is pre-existing and structural (file it, don't bundle it into your PR); a failure new with your push is yours. The recipes for known failures live in **`docs/ci-failure-recipes.md`** — check there first before diagnosing from scratch.

---

## 10. How the rest of the system references tests

Tests aren't isolated — several parts of the workflow point at them:

- **Feature docs (`_features/*.md`)** — the living "what the site does" specs. Each ends with a **Test Coverage** table linking every Given/When/Then scenario to the spec file + test name that proves it. When you change behavior, you update both the scenarios *and* this table. This is the bridge between "what product wants" and "what's actually verified."

- **The `/block` command/skill** — the guided workflow for building a new Block List component follows **TDD (Test-Driven Development)**: write the failing Playwright test first (RED), then build the component until it passes (GREEN). It scaffolds the spec for you.

- **The `/spec` → `/plan` → `/implement-step` → `/feature` flow** — `/spec` drafts the behavioral scenarios, `/plan` produces TDD steps, and the final step of every `/plan` is to verify/update the feature doc's scenarios. So tests are baked into the planning layers, not bolted on after.

- **The `/retrofit` command** — the "easy button" for a change that skipped the formal flow (a quick fix, a design tweak). Run it *before you commit*: it reconciles your change against the diff, runs the code-review agents, surfaces edge cases, and **proposes the tests and doc updates the change would otherwise skip**. This is how ad-hoc changes still end up covered.

- **The `/code-review` command and review agents** — review the diff (including test quality) before merge.

---

## 11. When should *you* write a test?

A practical rubric for someone new to the codebase:

| You're changing… | Write / update… |
|---|---|
| Server logic (a service, middleware, handler, startup wiring) | An **xUnit** test in `tests/UmbracoProject.Tests/` |
| A new block component | A Playwright **behavior spec** (via `/block`, TDD) **and** a **screenshot spec** + baseline |
| The look of an existing block/page | Re-generate the affected **screenshot baseline** (`update-snapshots.yml`) after confirming the change is intentional |
| A user-facing feature (nav, search, forms, SEO) | A Playwright **behavior spec** in `tests/e2e/`, and update the feature doc's Test Coverage table |
| A CLI tool (image/guide generator) | A **Node unit test** |
| Adding a block to an editor's palette | Nothing extra — the **render-coverage guardrail** already enforces a view exists; just make sure the view exists |
| A quick fix that skipped the flow | Run **`/retrofit`** — it proposes the tests for you |

**Guiding principle:** prefer the cheapest test that proves the thing. A pure-logic rule belongs in a fast xUnit test, not a slow browser spec. Only reach for Playwright when the thing you're protecting is genuinely "what the visitor sees in a browser." And prefer asserting *behavior* (a visitor sees results) over *implementation details* (a specific CSS class name) — the latter breaks on harmless refactors.

---

## 12. Quick reference

```bash
# C# unit tests (fast, no site)
dotnet test umbraco-17-demo-site.sln -c Release

# Node unit tests
npm run test:unit

# E2E: start site first, then run Playwright
cd src/UmbracoProject && dotnet run          # terminal 1
npm run test:e2e                             # terminal 2 (prefix PATH if node not found)
npm run test:e2e:ui                          # interactive
npx playwright test tests/e2e/<file>.spec.ts # one file

# Regenerate screenshot baselines (Linux, via GitHub — never on your Mac)
gh workflow run update-snapshots.yml --ref <branch>

# Clean up local reports
npm run clean:reports
```

**Related docs:** `docs/ci-failure-recipes.md` (fixing known CI failures) · `CLAUDE.md` (CI/CD & Build hygiene, E2E Test Resilience Rules, Screenshot baselines) · `_features/*.md` (per-feature Test Coverage tables) · `tests/e2e/_helpers.ts` (screenshot helper scope notes).

---

## 13. Glossary

Plain-language definitions for the jargon used above. Terms are grouped roughly by theme.

**Testing terms**

- **Test suite** — the whole collection of automated tests. "The suite is green" means everything passed.
- **Spec** — a single test file (short for "specification"). In this project, Playwright test files end in `.spec.ts`.
- **Unit test** — a test that checks one small piece of logic in isolation, with nothing else running. Fast and cheap. Our C# unit tests use a framework called **xUnit**.
- **E2E (end-to-end) test** — a test that drives the *real, running* site the way a visitor would (open a page, click, read what's shown). Slower, but proves the whole system works together. We use **Playwright** for these.
- **Behavior spec** — an E2E test that checks *what happens* (e.g. "typing a search returns results"), as opposed to what it looks like.
- **Visual-regression / screenshot test** — a test that compares a fresh screenshot against a saved reference to catch *visual* changes. See §6.
- **Baseline** — the saved "known-good" screenshot a visual test compares against. A "diff" is the highlighted set of pixels that changed.
- **Fixture** — test data a test sets up before it runs (e.g. a temporary page). Our E2E fixtures are created via the API and deleted afterward — see §4.
- **Mock / masking** — *mock* means a stand-in for something real so a test can run in isolation; *masking* (in screenshots) means blacking out a constantly-changing region so it doesn't cause false failures.
- **TDD (Test-Driven Development)** — write the failing test *first*, then write code until it passes. "RED → GREEN" is the failing-then-passing cycle.
- **Flaky test** — a test that sometimes passes and sometimes fails without the code changing (often due to timing or environment). Flakiness erodes trust in the suite.
- **Assertion** — the check inside a test that decides pass/fail (e.g. "assert the page shows 10 results").

**Pipeline / deployment terms**

- **CI/CD** — *Continuous Integration / Continuous Delivery*: the automation that builds, tests, and deploys code automatically whenever it's pushed. Ours runs on **GitHub Actions**.
- **GitHub Actions** — GitHub's automation system; it runs our pipeline (defined in `.github/workflows/`).
- **Pipeline** — the ordered series of automated steps a code change goes through (build → test → deploy → verify).
- **Gate** — a checkpoint the code must pass to continue. A **build gate** is one that fails the whole run if a condition isn't met (e.g. a warning, or a block with no view). "Gate 1 / Gate 2" are the two stages of our pipeline (§8).
- **Job** — one unit of work inside the pipeline (e.g. "deploy to Dev"). A gate is made of one or more jobs.
- **Deploy** — publishing code to an environment so it actually runs there.
- **Environment** — a running copy of the site. We have **Dev** (a testing copy CI deploys to automatically) and **Live** (what real visitors see; promoted to manually by a person).
- **Dev / Live promotion** — the manual human step of copying a verified change from Dev up to Live.
- **Pre-push hook** — a script that runs automatically on your machine just before `git push`, catching failures before they reach CI.
- **Artifact** — a file produced by a pipeline run that you can download afterward — e.g. the Playwright report with the diff images, or the deploy package.

**Umbraco / codebase terms**

- **Umbraco** — the CMS (content management system) this site is built on. The **backoffice** is its admin interface where editors manage content.
- **Block** — a reusable content component an editor can add to a page (alert banner, image row, etc.).
- **Palette** — the set of blocks an editor is allowed to add to a given page area.
- **Schema files (`.uda`)** — files that describe the *structure* of content (which document types, blocks, and fields exist) rather than the content itself. They live under `umbraco/Deploy/Revision/` and flow through git. Some tests read these directly.
- **View / Razor / `.cshtml`** — the template files that turn content into HTML for the browser. Razor is the templating language; `.cshtml` is the file extension.
- **CLI (command-line interface)** — a tool you run by typing a command in a terminal (no graphical UI). The image generator and guide generator are CLIs.
- **API (Application Programming Interface)** — a way for code to talk to the site programmatically instead of through the UI. Our E2E tests create test content by calling Umbraco's **Management API**.
- **OAuth / token / client credentials** — the login mechanism the tests use: they exchange an ID + secret for a short-lived access **token** that proves they're allowed in, instead of typing a password into a form. See §4.
- **`master` / branch / merge** — `master` is the main line of code that gets deployed. A *branch* is a separate line of work; *merging* folds a branch's changes into `master`.
