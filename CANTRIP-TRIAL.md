# Cantrip toolkit — canary trial (this branch only)

**Branch:** `cantrip-trial` · **Started:** 2026-08-03 · **Baseline:** master @ `b00e350`

This repo is the **canary consumer** for the `cantrip` agentic toolkit
(`robot-denny/cantrip`). Goal: install the toolkit into a real repo, fill L2
slots from real facts, and **cast the full spell chain on one small real
increment** — surfacing the naive-consumer friction the toolkit author can't
see, and producing an executable spec for the Phase-6 setup skill. Feed
friction back to cantrip as ADRs/notes.

This is the **cheap, additive half** of adoption. The expensive half (delete old
commands, migrate `_specs/_plans/_features/_audits` → `_work/<slug>/`, split the
663-line CLAUDE.md) is **deferred to after cantrip Phase 5**, as its own work.

---

## Ground rules (verified findings — do not relearn the hard way)

- **Branch-contained on purpose.** A same-named skill **shadows** a
  `.claude/commands/*.md` command (Claude Code: "if a skill and a command share
  the same name, the skill takes precedence"). So installing cantrip core makes
  `/spec /plan /implement-step /feature /retrofit /explore /code-review
  /commit-message` resolve to the **cantrip** versions immediately, and the old
  commands become present-but-unreachable. Keeping the install on this branch
  contains that shadowing — `git checkout master` restores the old commands.
- **Install core ONLY.** cantrip's `umbraco-17` pack has only `reference/` so
  far (no spellbook yet — Phase 5). So **keep the existing umbraco commands**
  (`check-uda`, `umbraco-edit`, `block`, `cms-image`, `guide`) — nothing
  shadows them, and they're our schema/safety net until the pack replaces them.
- **Always `DISABLE_TELEMETRY=1`** — the skills CLI uploads skill file contents
  by default, and this repo draws on client-derived knowledge.
- **Never run bare `skills update`** — verified to silently clobber local edits
  *and report success*. Update only via the `/update-toolkit` git-guarded wrapper.
- Expect a stray top-level `agent/skills/` dir (known CLI wart) — harmless, ignore.

## Install (run when ready — not yet executed)

```bash
# core only, telemetry off
DISABLE_TELEMETRY=1 npx skills add robot-denny/cantrip/skills/core --all

# register the 3 reviewer agents (the one step the CLI can't do; layout-independent)
mkdir -p .claude/agents
for f in .claude/skills/reviewer-discipline/agents/*.md; do
  n=$(basename "$f"); ln -sf "../skills/reviewer-discipline/agents/$n" ".claude/agents/$n"
done
```

## Rollback

```bash
rm -rf .agents .claude/skills   # remove installed toolkit scaffolding
git checkout master             # old commands + agents restored
git branch -D cantrip-trial     # discard the trial entirely
```

Backstops already in place: pre-flight tarball at
`~/Sites/cantrip-preflight-backup/…tar.gz`; cross-session memory mirrored to
`docs/project-memory/` on master (`907f9ee`).

---

## The trial increment — placeholder graphics for imageless article cards

**Capability (fresh, small, real):** when an Article has no `mainImage`, its card
in the article grid renders a **branded placeholder** instead of an empty
thumbnail box.

**Today:** [`v2/_ArticleCard.cshtml`](src/UmbracoProject/Views/Partials/v2/_ArticleCard.cshtml)
lines 64–69 render `<div class="card-thumb">` with an `<img>` only when
`mainImage != null`; otherwise the thumb is an **empty div**. Cards appear on
Blog landing, Author detail, Topic/Tag, Search results, and related-article widgets.

**Constraints to respect (let `/spec` engage these — don't pre-decide):**
- The thumbnail is **decorative** (empty `alt`, out of the a11y tree per the
  inclusive-components card pattern). Any placeholder must stay decorative —
  `aria-hidden` / CSS-only, no accessible-name pollution, exactly one focusable
  link per card preserved.
- Fits the site's **Dark Constructivism × Human Signal** design language
  (`docs/design-system.md`) — sharp corners, warm/near-black palette, signal red.
  Open design question for `/spec`: deterministic CSS placeholder derived from
  the title (zero runtime cost) vs. reusing the flow-field image generator.
- No schema change; editor-agnostic; must not regress the existing card layout
  or the Playwright card-grid baselines.

**Why this increment:** small enough to cast the whole chain quickly; real enough
to exercise `/spec` (design decision), `/plan` (TDD steps, screenshot baseline),
the **accessibility-reviewer** (decorative-graphic correctness), and `/feature`
(a genuine new capability doc) — a broad, honest slice of the toolkit.

---

## Friction log (fill while casting — this is the payload back to cantrip)

Record every point where a spell was unclear, asked for a slot it should have
inferred, produced generic-when-it-should-be-stack-aware output, or where an
empty-slot fallback misfired. Date each entry.

- **2026-08-03 · install · CLI scatters skills into 4 locations (worse than ADR 0004).**
  `DISABLE_TELEMETRY=1 npx skills add robot-denny/cantrip/skills/core --all` (skills@1.5.x)
  wrote the skills into **four** places: the canonical `.agents/skills/` (real) +
  `.claude/skills/` (symlinks) — correct — **plus** a full redundant copy inside the
  repo's pre-existing top-level `skills/` folder, **plus** the top-level `agent/` wart.
  ADR 0004 documented only the `agent/skills/` wart; the `skills/`-folder pollution is
  undocumented and only bites repos that already use a top-level `skills/` dir. A blanket
  `rm -rf skills/` would have destroyed tracked `algorithmic-art`/`canvas-design`; correct
  cleanup was surgical `git clean -fd agent skills`. **Suggest:** CLI should not write into
  a pre-existing `skills/` dir, and/or `check-install.sh` should detect+flag the scatter.
- **2026-08-03 · install · `check-install.sh` worked well (positive finding).** Correctly
  reported 13/13 core + 2 pack, 0 broken; detected the 2 reviewer name-collisions
  (`accessibility-reviewer`, `perf-reviewer`) and gave exactly-right guidance including the
  "do NOT force-link" warning; the 0/14-slots message clearly conveyed graceful degradation
  ("working configuration — infers and asks"). **Caveat:** this run cannot confirm whether
  check-install *detects the 4-location scatter*, because cleanup ran before the checker —
  worth a fresh-install test of that path.
- **2026-08-03 · /spec · `_work/` vs existing `_specs/` divergence (biggest finding).** With
  `paths.md → ## Workspace` empty, the `workflow` skill's default put the spec at
  `_work/<slug>/spec.md` — but this repo already uses `_specs/` (3 files). A naive consumer ends
  up with a new `_work/` dir *alongside* their existing `_specs/`, an easy-to-miss split.
  Graceful degradation "worked" (it wrote somewhere sensible) but the fallback can't know the
  repo's real convention. **Suggest:** the setup skill should detect an existing `_specs/`/`_plans/`
  and either seed `paths.md → ## Workspace` or ask; and `/spec`'s fallback could note when it's
  creating a *new* workspace dir next to an existing one.
- **2026-08-03 · /spec · work-type model has no bucket for "enhancement to an undocumented
  existing component."** The placeholder enhances the existing (but undocumented) article card.
  `change-to <slug>` assumes an existing capability doc to fold into — there was none — and
  `fix-infra` is wrong (standing visitor behavior). Forced to `new-capability` + a narrow
  `article-card-placeholders` doc. This is the direction doc's open "brownfield adoption story"
  showing up concretely. **Suggest:** guidance (or a 4th path) for "new behavior on an existing,
  yet-undocumented capability → new-capability now, flag for later merge via `/feature` from-code."
- **2026-08-03 · /spec · branch inference good; nesting is context-dependent.** Branch-naming
  fallback correctly inferred `claude/feature/<slug>` from git history (worked well). It then
  created that branch off the current `cantrip-trial`, nesting a branch under the trial branch —
  fine here, but a `conventions.md → ## Unit of work`/branch-strategy signal would let a
  trial-on-a-branch stay put. Minor.
- **2026-08-03 · /spec · work-type classification is coverage-dependent (design finding, ADR-worthy).**
  The SAME work classifies differently based only on whether the surrounding capability is already
  documented: undocumented → `new-capability` (spawns a doc); documented → `change-to` (appends a
  Rule). The deciding factor is doc debt, not the nature of the change. Two proposed additions to
  the `workflow` skill: **(1)** an "area-noun vs behavior" naming tell for amend-vs-create — if the
  doc name you'd create reads as a *behavior* (`article-card-placeholders`) rather than an *area* a
  stakeholder names (`article-card`), it should be a Rule inside the area doc, not a new file
  (parallels the existing "transition vs standing" tell). **(2)** When `new-capability` is chosen
  but the nearest area is undocumented, NAME THE DOC AT AREA LEVEL so the `new-capability` path
  converges with what `change-to` would have produced — the debt shows as an under-populated doc,
  flagged for from-code backfill. Also: "when to split one capability doc into several" is an
  **editorial/readability** decision, not a per-increment classification output — the classifier
  should bias toward *amend*. Applied here: renamed the sliver `article-card-placeholders` doc →
  area-level `_features/article-card.md`.
- **2026-08-03 · /plan · ADR 0003 pack routing works (positive).** `/plan` consulted the installed
  `umbraco-17-planning` reference skill, which correctly **self-scoped out** for a view+CSS change
  (it says skip for "Razor/.NET patterns clearly visible in the codebase"), so no schema/model step
  was forced onto a change that has none. The filled L2 slots were all consumed — build/test
  commands (`stack.md`), the `## Unit of work` slice, `## Code layout`, and `## Planning gotchas`
  (Linux-only screenshot baselines) all shaped the plan. Clean "filled-path" signal.
- **2026-08-03 · /plan · Step 1 "path or description" doesn't cover a bare slug.** `/spec` ends with
  `Next: /plan <slug>`, but `/plan` Step 1 branches only on "looks like a path" vs "is a
  description" — a bare slug is neither. Resolving `<slug>` → `_work/<slug>/spec.md` relied on
  knowing the `workflow` layout. **Suggest:** `/plan` Step 1 should explicitly resolve a bare slug
  via the workspace layout. Minor.
- **2026-08-03 · /plan · feature-doc identity ≠ increment slug (consequence of area-level naming).**
  The `new-capability` final step is templated as `/feature update <feature_slug>`, but the
  area-level rename means the capability doc is `article-card` while the increment slug is
  `placeholder-graphics-imageless-cards`. The `/feature` step must target the **capability doc**,
  not the slug. The spells assume `slug == doc-name`; that breaks (correctly) whenever a doc is
  named at area level. **Suggest:** carry an explicit `feature-doc:` field from `/spec` so `/plan`
  and `/feature` target the doc by name, not by re-deriving it from the slug.
- **2026-08-04 · /update-toolkit · clean pull; L2 discipline validated (positive).** `skills update -y`
  (telemetry off) refreshed 15 skills from robot-denny/cantrip with **0 tailorings reverted** — because
  all tailoring lives in L2 slots, the "never edit vendored" contract held and there was nothing to
  reconcile. No re-scatter on `update` (the 4-location scatter is an `add`-only behavior, so
  check-install's new scatter detection couldn't be exercised on this path). Both `/plan` fixes verified
  present in the pulled spell (bare-slug resolution + `**Feature doc**:` threading).
- **2026-08-04 · /plan (re-cast) · both prior `/plan` findings fixed.** With the fixed spell + the spec
  backfilled with `**Feature doc**: article-card`: the bare slug `placeholder-graphics-imageless-cards`
  now resolves to `_work/<slug>/spec.md` (no re-derivation), and the Feature-doc line threads
  spec → plan header → final step, which targets the area-level `article-card` doc rather than the
  increment slug. The manual workaround the first cast needed is now automated. Both closed.
- **2026-08-04 · /implement-step · fresh-context dispatch works (validates the untested mechanism).**
  Step 1 dispatched to a general-purpose worker with a self-contained prompt (Context + Key Decisions +
  Step block + envelope + the `## Implementation rules` slot + E2E-resilience conventions). The worker
  stayed strictly in scope (test only — no partial/CSS/commit), resolved the fixture prerequisite the
  right way (no imageless article existed, so it self-authored + cleaned up `[E2E]` fixtures per the
  repo's resilient E2E pattern rather than hardcoding), and produced the intended RED (missing
  `.card-thumb__placeholder`), with (b)/(c) passing as regression guards. Isolation kept the main
  context clean; the `## Step N — DONE` report relayed cleanly. This is the mechanism cantrip ran inline
  and could never validate — it works. Bonus: self-authored fixtures mean the RED reproduces in CI with
  no pre-seeded content, closing the fixture-prerequisite risk the plan flagged.
- **2026-08-04 · /implement-step · headless dispatch vs "verify by eye" steps.** Step 3's validation is
  visual, which a headless worker cannot self-judge. Mitigation that worked well: instruct the worker to
  capture a screenshot (create a temp fixture → screenshot → clean up → save PNG) so the orchestrator
  eyeballs it. Grounding the worker in the design-system tokens + the constructivist design language
  produced genuinely on-brand output (not generic AI aesthetics). **Suggest:** `/implement-step`'s
  envelope could note that for by-eye validation steps the worker should produce visual evidence
  (a screenshot) rather than self-attesting "looks good" — otherwise the automated dispatch silently
  skips the one check that step defines.
- **2026-08-04 · /code-review · parallel dispatch works; tailored-reviewer memory paid off (positive).**
  All three reviewers ran concurrently (the last untested surface — validated). Using the project's KEPT
  tailored reviewers (not cantrip's unregistered generics) produced project-aware findings a generic
  reviewer would miss — `umbraco-code-reviewer` flagged that the new test duplicates the site-wide
  one-link contract already owned by `cardLinks.spec.ts`, and cited `playwright.config` `workers:1` and the
  Location-header convention across sibling specs. Strong validation of "keep your tailored reviewers" +
  parallel dispatch. Two friction notes: **(a)** the spell names `code-reviewer` but this project kept
  `umbraco-code-reviewer`; **(b)** `/code-review` scopes to UNCOMMITTED changes, which misses most of an
  increment built via `/implement-step`'s per-step commits — I reviewed the full branch-vs-base diff
  instead. Suggest `/code-review` accept a scope (uncommitted | branch-vs-base), since the `/implement-step`
  flow commits per step.
- **2026-08-04 · /feature update · works well; "test = truth" caught a real spec↔impl conflict (positive).**
  Update mode verified the draft scenarios against the implementation + E2E and, per the skill's precedence
  rule (test assertions are the strongest signal), caught that the spec's "warm… stone palette" visual
  scenario didn't match the shipped dark constructivist mark — corrected the doc to reality. Coverage table
  filled with real test line numbers; the deferred visual row honestly reads "Manual". Mild friction: the
  plan's final "Step 5" is *cast /feature update* — a spell, not a code-implementation step — so
  `/implement-step step 5` is a slight category blur (the workflow's own chain treats /feature update as a
  separate entry point after the /implement-step loop). Ran /feature directly. Suggest the plan's final step
  not be numbered as an /implement-step step, or that /implement-step recognize a "cast <spell>" step.
- **2026-08-04 · MILESTONE · full toolkit surface exercised end-to-end.** One real increment has now driven
  `/spec → /plan → /implement-step (×3, fresh-context) → /code-review (3 reviewers in parallel) →
  /commit-message → /feature update`, plus `/update-toolkit` mid-stream to pull fixes. Every spell cantrip
  could not validate inline is now validated on a real Umbraco repo with .uda schema, Playwright tests, and
  BDD feature docs.
- **2026-08-04 · /feature from-code · brownfield backfill works + surfaces real issues (last surface validated).**
  Cast `/feature article-card` to complete the pre-existing card's behavior (only the placeholder had been
  documented). Update-mode on the existing doc + from-code technique (read schema/model/view, one Rule per
  field/branch) backfilled the full card — featured image, date + estimated reading time, teaser
  (meta-over-subtitle), author byline, title→name fallback, and the omit-when-absent rules. Beyond
  documentation it surfaced two genuine findings a hand-written doc would miss: an **orphaned
  `.article-grid-card__no-image` CSS rule** (no view emits it after the placeholder increment) and a **stale
  view comment** claiming reading time isn't rendered. This is the direction doc's open "brownfield adoption
  story" — the last unexercised surface — and it works: from-code is a real onboarding/backfill tool, not
  just a cold-start fallback. The coverage table honestly separates test-verified rules from
  code-derived-untested ones.
