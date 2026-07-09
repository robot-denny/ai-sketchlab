---
description: The "easy button" for a quick change or fix that skipped the spec→plan→feature→build flow. Run it before you commit (or before you push, if already committed) — it reconciles your intent against the diff, code-reviews, surfaces edge cases, then proposes tests + docs for your confirmation.
argument-hint: ["<what you changed — optional>"] [optional git range/ref, e.g. HEAD~3..HEAD]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git diff:*), Bash(git status:*), Bash(git merge-base:*), Bash(git branch:*), Bash(git log:*), Bash(git rev-parse:*), Bash(dotnet build:*), Bash(dotnet test:*), Bash(npx playwright:*), Agent(*)
---

A change already landed in the codebase without going through `/spec → /plan → /feature → build`. That's a legitimate, lean way to work — a small front-end or backoffice tweak verified by eye, or an edit an AI assistant made directly. But each bypass quietly skips the things that keep this codebase documented, testable, and safe to refactor: TDD, code review, and doc updates. `retrofit` closes that gap so the codebase improves regardless of how the change got made.

Your job is to act as a senior architect and codebase expert who arrives *after* the fact: understand what changed, hold it to the same bar the flow would have, and propose the missing tests, docs, and cleanup — then apply only what the developer confirms.

**Two principles that govern everything below:**

- **Description gives intent; the diff gives truth.** The developer's written description (the argument) tells you *why* and *what they think they did*. The diff is ground truth. When they disagree, that gap is itself a finding — surface it, don't paper over it.
- **Propose, then confirm. Never write first.** Like `/code-review`, `retrofit` presents a reviewable plan and waits for explicit approval before touching a single file. This keeps it consistent with the plan-before-execute workflow the rest of the flow enforces.

**When to run it.** Reach for `/retrofit` the moment a change is done but *before it leaves your machine* — ideally before `git commit` (so the tests, docs, and cleanup it proposes land in the same commit as the change), or before you push / open the PR if you already committed. Treat it as the reflex for any change that skipped the flow: a quick front-end tweak, a backoffice field, an AI-assistant edit. It's the low-friction stand-in for remembering to hand-run review + tests + docs every single time — that's the whole point, so run it even when the change feels too small to bother.

**The description is optional.** A bare `/retrofit` works: it auto-detects the change (Step 1), and if you didn't say what you did, it infers your intent from the commit message(s) and the diff itself, then tells you it ran description-free. Adding even one sentence sharpens the reconciliation in Step 2 — it's how retrofit catches "you said X but the diff does Y" — so it's worth a line when a mismatch would matter, but never required. Do **not** block waiting for a description; proceed and note which source you used for intent.

---

## Step 1 — Detect scope (compute the retrofit diff)

"Already landed" usually means the work is *already committed* on the branch, so a plain `git diff` would come up empty and miss everything. Compute the **full change set** on this branch, from all three sources:

- **Base branch**: prefer the **upstream tracking branch** over local `master`. Local `master` is frequently stale (behind the real remote), which inflates the diff with everything your local is missing and mis-scopes the retrofit. Resolve it as `git rev-parse --abbrev-ref @{u}` (e.g. `github/master`), `git fetch` that remote first, then find the fork point against it: `git merge-base HEAD @{u}`. Fall back to `master` only if there's no upstream.
- **Committed on the branch**: `git diff <merge-base>...HEAD` — everything committed since branching.
- **Uncommitted**: `git diff HEAD` — staged + unstaged working-tree edits.
- **Untracked**: `git status --porcelain` — new files not yet added (e.g. a new `.cshtml` or `.spec.ts`).

If the developer passed an explicit range or ref as the second argument (e.g. `HEAD~3..HEAD`, or a single commit SHA), use that as the diff scope instead of auto-detecting.

Concatenate these into one **retrofit diff** — this is the single source of truth fed to every later step. If it's empty, say so and stop (there's nothing to retrofit).

Note what's in scope by file kind — it drives the rest: Razor views (`.cshtml`), C# (controllers/services/handlers/composers), TypeScript/JS (`HelloWorld` backoffice), CSS, `.uda` schema artifacts, tests (`.spec.ts` / xUnit), config (`appsettings*.json`), docs.

## Step 2 — Reconcile intent against the diff

Classify what actually changed, then reconcile it against the stated intent. When the developer gave a description, that is the intent; when they didn't, fall back to the commit message(s) on the range as the "claimed intent" — and state which source you used. Common change classes in this project:

- **New/changed backoffice property** — a doc-type or composition field (often paired with a `.uda` change and regenerated `*.generated.cs` ModelsBuilder models under `src/UmbracoProject.Features/Models/Generated/`).
- **Template/view edit** — Razor rendering logic, a new block component, a partial.
- **C# logic** — a service, handler, content finder, middleware, controller.
- **Front-end** — CSS, TypeScript, a backoffice module.
- **Config / schema** — `appsettings*.json`, `.uda` artifacts.

Then produce a short **reconciliation table** and flag every discrepancy — these are the cheapest, highest-value findings retrofit produces:

| Claimed in description | Present in diff? | Notes |
|---|---|---|
| "made the section-nav label editable" | ✅ `hideFromSectionNavigation` added to `visibilityControls.uda` | matches |
| — | ⚠️ diff also regenerates 40 `*.generated.cs` files | not mentioned; expected side-effect of a schema change — confirm intentional |
| "added a fallback when the label is empty" | ❌ not found in diff | described but absent — did it get lost, or is it still needed? |

A change in the diff that the description didn't mention, or a described change that isn't in the diff, both get raised for the developer to resolve.

## Step 3 — Code review (reuse the three reviewers)

Run the same three reviewers `/code-review` orchestrates — but feed them the **Step 1 retrofit diff**, not a freshly recomputed staged+unstaged diff (which would be empty for already-committed work). Launch all three in one turn so they run in parallel (`Agent` tool):

- **accessibility-reviewer** — WCAG 2.2, semantic HTML, ARIA, focus, keyboard, alt text. Especially relevant for the front-end/backoffice UI tweaks retrofit is built for.
- **umbraco-code-reviewer** — secrets, validation, clarity, naming, duplication, Umbraco-17 API correctness, E2E resilience rules.
- **perf-reviewer** — render cost, caching (`Html.CachedPartialAsync`), N+1, async correctness.

Give each the retrofit diff and brief repo context; tell them to be evidence-based (file:line, no guessing) and to review only what's in the diff. Collect their findings by severity — you'll fold them into the single consolidated proposal in Step 7, de-duplicating overlap but never silently dropping a unique finding.

## Step 4 — Edge cases

Beyond what the reviewers flag, think like the author's most careful colleague: what does this change likely *not* handle? Ground every case in a specific line of the diff — don't invent generic risks. The recurring ones in this codebase:

- **Empty / missing values** — a new author-editable field with no value entered; does the template fall back gracefully or render a blank/broken element?
- **Migration of existing content** — content authored *before* this change: does a new boolean default correctly? does hardcoded text that moved into a field still appear on already-published nodes?
- **Nulls** — Umbraco content access that assumes a picker/relation is set (this project grandfathers view nullability, so new code should be explicit).
- **Multi-type / composition reach** — a field added to a shared composition surfaces on *every* composing doc type; is that intended everywhere? Conversely, a "parallel" composition (e.g. a guide-specific twin) may *not* get the field, leaving a gap.
- **Culture / variants, caching** — cached partials that won't reflect the change until expiry; culture-specific rendering.
- **Schema actually imported on each environment (`.uda` changes)** — a committed `.uda` file is **not** the same as the schema being present in an environment's *database*. Umbraco Cloud extraction can fail or be skipped (it diffs commit-to-commit, not file-to-DB), leaving a property in git but absent from Dev/Live's DB — which silently breaks rendering *and* blocks content transfers with a schema mismatch, and normal deploys/promotions/`POST /schema/item` imports may not unstick it (Cloud re-serializes the entity from its own DB and reverts the file). So for any `.uda` / doc-type / composition / data-type change, the proposal must include **verifying the change actually landed in the target environment's database** — query the Management API (`GET /document-type/{id}` → check the property is present) or the Deploy comparison endpoint, not just confirm the `.uda` exists — and note that a deploy reporting "completed" does **not** prove extraction ran. (Learned 2026-07-08 the hard way: a guide-composition toggle sat in git but never imported into any Cloud DB; see ROADMAP `guides-rework`.)

## Step 5 — Tests (draft, for confirmation)

Decide whether existing tests should change or new ones are needed, following the project's TDD and E2E conventions (`.claude/skills/BDD.md`; the **E2E Test Resilience Rules** in CLAUDE.md — dynamic lookups over hardcoded UUIDs/slugs, regex over exact CSS matches, browser assertions over file-content assertions, Linux-only screenshot baselines).

- **Existing tests to modify** — does the change alter behavior a current spec asserts? **Grep the *whole* test suite for assertions about the changed entity — not just the obvious spec.** Search by alias/name/type key (e.g. `grep -rn "guideVisibilityControls\|hideFromSectionNavigation" tests/`): a change often trips a coupled assertion in a *different* file — e.g. adding a property breaks a `toEqual([...])` or a "has N properties" count somewhere you didn't edit. Name every such file + assertion.
- **New tests** — what behavior is now untested? Prefer a Playwright E2E spec that verifies rendered behavior over file-content checks. For a new block, the `/block` TDD workflow is the house pattern.
- **Draft the tests** so the developer can read them — but do **not** write them to disk yet. If a screenshot spec is proposed, note that its Linux baseline must be generated via `update-snapshots.yml` after it lands, or it fails every Gate 2 run.

## Step 6 — Documentation (draft, for confirmation)

Apply the project's tri-modal work-type classification (CLAUDE.md → *Work types*) to decide which docs the change earns — this is the same gate `/spec` and `/feature` use:

- **New capability** → draft a new `_features/<slug>.md` in Given/When/Then form (per `.claude/skills/BDD.md`), named by the capability.
- **Change to an existing capability** → update that capability's existing `_features/<slug>.md`. Do **not** create a new per-work doc.
- **Fix / infra / CI / cleanup** → no feature doc; the durable record is a `docs/` runbook and/or a CLAUDE.md section.

The tell (from CLAUDE.md): if the behavior reads as *standing behavior* ("editors can hide a page from the section nav") it's capability doc material; if it reads as a *transition* ("migrated off the obsolete API") it belongs in a runbook or CLAUDE.md.

Also check whether **CLAUDE.md** itself needs a line — a new author-editable field, a new config key, a new convention. Draft the exact edits (feature doc, CLAUDE.md, runbook) for review — don't apply them yet.

## Step 7 — Proposal (one checklist, then confirm)

Present a single, prioritized, actionable checklist. Separate two buckets clearly — the developer needs to see at a glance what's mechanical vs. what needs their judgment:

**A. retrofit can apply on confirmation** (mechanical, low-ambiguity):
- Cleanup fixes from Step 3 (the reviewers' concrete edits)
- New/updated tests from Step 5
- Doc updates from Step 6

**B. Needs a human decision** (raise, don't resolve):
- Reconciliation discrepancies from Step 2 (described-but-absent / present-but-unmentioned)
- Edge cases from Step 4 that imply a behavior choice (what *should* the empty-label fallback be?)
- Any reviewer finding that changes intended behavior rather than just quality

Order by severity (Blocker/Critical first). Then ask:

> "Which of these should I apply? (all of A, specific items, or none)"

Apply **only** the items the developer confirms, in dependency order (tests before the code they cover if following RED→GREEN; docs last). After writing tests, run them (`dotnet test` / `npx playwright test`) to confirm they're honest — RED if the behavior is missing, GREEN once it's present. Report what you applied and what you deliberately left for the developer.

---

Next: review the applied changes with `git diff`, run `/code-review` for a fresh pass if you applied cleanup, then `/commit-message`.
