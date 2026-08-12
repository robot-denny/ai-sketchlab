# Plan: Cantrip Toolkit Adoption

**Spec**: `_work/cantrip-toolkit-adoption/spec.md`
**Branch**: claude/feature/cantrip-toolkit-adoption
**Work type**: fix-infra
**Feature doc**: none

## Context

Make the cantrip toolkit `master`'s real developer tooling — the "expensive half" the trial deferred.
The validated state lives on `cantrip-trial` (toolkit at Phases 0–7, 12 filled L2 slots, all fixes
proven). This lands it on `master` by **porting** (not merging the trial): install the toolkit +
slots, add two pack references, rename the reviewers, retire the eight shadowed commands, split the
663-line `CLAUDE.md`, and migrate the workspace to `_work/`. No visitor/editor-facing behavior
changes. The unit of work is a **sequence of independently-green, PR-able migration steps** — master
is never left half-migrated.

---

## Key Decisions

- **Land as per-step PRs to `master`, not a wholesale `cantrip-trial` merge.** Each step branches off
  `master` and ports the needed state via `git checkout cantrip-trial -- <paths>` (the pattern the
  placeholder ship proved) or authors fresh. This excludes trial-only artifacts (`CANTRIP-TRIAL.md`,
  the placeholder `_work/` increment already shipped via #49).
- **Bootstrap note.** This spec+plan are authored on the `cantrip-trial`-based branch (where the
  toolkit + `_work/` layout exist). They are themselves ported into `master`'s `_work/shipped/` during
  Step 6 — the plan migrates the convention it was written under.
- **Hold the pack spellbook (RESOLVED).** Do not install cantrip's `check-uda`/`umbraco-edit`/`block`
  spells; the tailored versions stay. Only the two pack **references** are added (Step 2).
- **Workspace: full move (RESOLVED).** All shipped `_specs/`/`_plans/` → `_work/shipped/<slug>/`.
- **Audits (RESOLVED).** Existing `_audits/` stays gitignored/untouched; going forward
  `docs/audits/` (committed) + `_scratch/` (gitignored) per cantrip. Add `_scratch/` to `.gitignore`.
- **Reviewers (RESOLVED).** Rename to `code-reviewer`/`accessibility-reviewer`/`perf-reviewer`; remap
  `.claude/agent-memory/umbraco-code-reviewer/` → `code-reviewer/` (only that one changes).
- **Verification signal for this fix-infra:** `dotnet build -c Release` zero-warning + `dotnet test
  --no-build` (the pre-push gate), `check-install.sh`, and grep-based link checks — plus casting one
  real spell per relevant step. Each step ends green before the next.
- **Ordering:** install+slots → pack references → reviewer rename → retire commands → CLAUDE.md split
  → workspace migration. Retiring a command (Step 4) only after its skill is present (Step 1) leaves
  the cantrip skill as the resolver.

---

## Steps

Each step is an independent PR off `master`.

---

### Step 1 — Install the toolkit core + L2 slots on master

> **Prompt**: Implement Step 1 of `_work/cantrip-toolkit-adoption/plan.md`. Branch off `master`
> (`claude/chore/adopt-toolkit-core`). Port the validated toolkit state from `cantrip-trial`:
> `git checkout cantrip-trial -- .agents/skills .claude/skills .agents/config skills-lock.json`.
> This brings the 13 core skills + the 2 existing pack references (`umbraco-17-feature-backfill`,
> `umbraco-17-planning`) as real bodies under `.agents/skills/` with `.claude/skills/` symlinks, plus
> the 12 filled `.agents/config/` slots and the lockfile. Do **not** bring `CANTRIP-TRIAL.md` or
> `_work/`. Discard any `.uda` startup churn. Run `bash /Users/dkardys/Sites/cantrip/scripts/check-install.sh`
> and confirm skills whole, 12 slots filled, no pack spellbook, reviewers flagged by identity. Build
> with `cd src/UmbracoProject && dotnet build -c Release` (must stay 0/0). Commit and open a PR to master.

**What to build**: ported `.agents/skills/`, `.claude/skills/` (symlinks), `.agents/config/` (4 slot files), `skills-lock.json` on a master-based branch.

**Validation**:
- [Automated]: `check-install.sh` reports core skills whole + 12 slots filled + no scatter; `dotnet build -c Release` 0/0; Gate 1 green on the PR.
- [Manual]: `git status` shows no trial artifacts and no `.uda` churn staged.

---

### Step 2 — Add the two optional pack references

> **Prompt**: Implement Step 2 of `_work/cantrip-toolkit-adoption/plan.md` (branch off the current
> master state, `claude/chore/adopt-pack-references`). Install the two pack **references** that shadow
> nothing: `DISABLE_TELEMETRY=1 npx skills add robot-denny/cantrip/skills/umbraco-17 --skill umbraco-17-starter-facts --skill umbraco-17-review-rules --all` (confirm the exact selective-install flags against the CLI; the goal is *only* those two references, NOT the pack spellbook). Clean any install scatter (`git clean -fd agent skills` after confirming with `-n`). Run `check-install.sh`. Cast `/plan` on a throwaway idea and confirm it consults `umbraco-17-starter-facts`; note `umbraco-17-review-rules` will feed `/code-review`. Commit + PR.

**What to build**: `umbraco-17-starter-facts` + `umbraco-17-review-rules` under `.agents/skills/` (+ symlinks + lockfile update).

**Validation**:
- [Automated]: `check-install.sh` shows 4 pack references, 0 pack spells, 0 broken.
- [Manual]: a `/plan` cast references the starter facts; no `check-uda`/`umbraco-edit`/`block` skill was installed.

---

### Step 3 — Rename reviewers to cantrip role names + remap memory

> **Prompt**: Implement Step 3 of `_work/cantrip-toolkit-adoption/plan.md` (branch `claude/chore/adopt-reviewer-rename`).
> Rename the tailored `.claude/agents/umbraco-code-reviewer.md` → `.claude/agents/code-reviewer.md`
> (keep its tailored Umbraco rules + memory-discipline content; update any self-name references inside).
> Leave `accessibility-reviewer.md` / `perf-reviewer.md` unchanged. Remap the gitignored reviewer
> memory: `git mv`-equivalent (it's gitignored, so `mv`) `.claude/agent-memory/umbraco-code-reviewer/`
> → `.claude/agent-memory/code-reviewer/` (7 notes + MEMORY.md). Update any in-repo reference to the
> old reviewer name (grep `umbraco-code-reviewer`). Cast `/code-review` on a trivial diff and confirm
> it discovers `code-reviewer` by identity and loads its memory. Commit + PR (the memory move is local/gitignored — note it in the PR, it won't appear in the diff).

**What to build**: renamed `code-reviewer.md`; remapped `.claude/agent-memory/code-reviewer/`; updated references.

**Validation**:
- [Automated]: `grep -rn "umbraco-code-reviewer"` returns nothing in tracked files (or only historical shipped docs); build/Gate 1 green.
- [Manual]: `/code-review` runs all three reviewers by identity; `code-reviewer` reports its calibrated findings (memory intact).

---

### Step 4 — Retire the eight shadowed commands

> **Prompt**: Implement Step 4 of `_work/cantrip-toolkit-adoption/plan.md` (branch `claude/chore/adopt-retire-commands`).
> Now that the cantrip skills are installed (Step 1), delete the eight old `.claude/commands/*.md`
> that the spells replace: `spec, plan, implement-step, feature, retrofit, explore, code-review,
> commit-message`. KEEP the seven others: `check-uda, umbraco-edit, block, cms-image, guide,
> algorithmic-art, canvas-design`. Confirm each retired name now resolves to its cantrip skill (skill
> is the sole `/name` provider) and each kept command still exists. Update any CLAUDE.md/doc reference
> that points at a retired command file. Build + Gate 1 green. Commit + PR.

**What to build**: deletion of 8 `.claude/commands/*.md`; reference updates.

**Validation**:
- [Automated]: `ls .claude/commands` shows exactly the 7 kept; `grep -rn ".claude/commands/\(spec\|plan\|...\)"` finds no live pointer; Gate 1 green.
- [Manual]: casting `/spec` resolves to the cantrip skill; `/check-uda` still resolves to the tailored command.

---

### Step 5 — Split CLAUDE.md → AGENTS.md + docs/ + the workflow skill

> **Prompt**: Implement Step 5 of `_work/cantrip-toolkit-adoption/plan.md` (branch `claude/chore/adopt-claudemd-split`).
> Decompose the 663-line `CLAUDE.md`: create `AGENTS.md` as the neutral entry point (project context +
> pointers); move operational runbook sections (CI recipes, media, deployment, schema management, etc.)
> into `docs/` files; the workflow spine + work-types table are already owned by the installed
> `workflow` skill, so remove them from CLAUDE.md and point at the skill. Reduce `CLAUDE.md` to a thin
> shim (< 200 lines) that points to `AGENTS.md` + Claude-specific notes. Fix every deep-link (the ~10
> in-file anchors + cross-file references) so none dangle. Build + Gate 1 green; run a grep link-check.
> Commit + PR.

**What to build**: `AGENTS.md`; new/updated `docs/*.md` runbooks; slimmed `CLAUDE.md`; link fixes.

**Validation**:
- [Automated]: a link-check script (grep every `](...)` and `](#...)` target, assert each resolves) passes; Gate 1 green.
- [Manual]: `CLAUDE.md` < 200 lines and reads as a pointer; `AGENTS.md` orients a newcomer; no broken anchors.

---

### Step 6 — Migrate the workspace to _work/ (+ gitignore _scratch)

> **Prompt**: Implement Step 6 of `_work/cantrip-toolkit-adoption/plan.md` (branch `claude/chore/adopt-workspace-migration`).
> Move **all** shipped specs/plans into the increment-bundle layout: for each shipped slug, create
> `_work/shipped/<slug>/` and move `_specs/shipped/<slug>.md` → `spec.md` and the matching
> `_plans/shipped/<slug>.md` → `plan.md` (pair by slug; where only one exists, move what exists). Move
> the active (non-shipped) `_specs/`/`_plans/` into `_work/<slug>/` similarly. Keep `_features/` where it
> is (already the toolkit convention). Leave `_audits/` gitignored/untouched. Add `_scratch/` to
> `.gitignore`. Also port this increment's own `_work/cantrip-toolkit-adoption/{spec,plan}.md` onto
> master here. Write a small migration script (delete it after) to do the moves + rewrite in-repo
> references to moved paths; accept stale self-references inside shipped docs as historical drift.
> Discard `.uda` churn. Build + Gate 1 green; grep for dangling references to `_specs/`/`_plans/`. Commit + PR.

**What to build**: `_work/shipped/<slug>/` + `_work/<slug>/` bundles; `.gitignore` `_scratch/`; reference rewrites; throwaway migration script (deleted).

**Validation**:
- [Automated]: `grep -rn "_specs/\|_plans/"` in live docs finds no dangling pointer (shipped-doc self-refs excepted); Gate 1 green.
- [Manual]: new `/spec` writes to `_work/<slug>/`; shipped history is present under `_work/shipped/`.

---

### Final — Record the durable behavior *(a spell you cast, not an implement-step)*

> **Prompt**: Do **not** create or touch any feature doc (this is `fix-infra`). Author a migration
> runbook at `docs/toolkit-adoption.md`: what the cantrip toolkit is, how the layout works now
> (`_work/`, `.agents/config/` slots, spells vs kept commands, the held pack spellbook, the reviewer
> names + memory), how to update it safely (`/update-toolkit`, never bare `skills update`), and how a
> new increment flows. Add a short pointer from `AGENTS.md`/`CLAUDE.md`. Commit the runbook.
>
> **Validation**: A `docs/toolkit-adoption.md` runbook exists and orients a contributor to the adopted
> layout; no feature doc was touched.

---

## File Summary

| Action | File |
|--------|------|
| Create (port) | `.agents/skills/*` (core + 4 pack references), `.claude/skills/*` (symlinks), `.agents/config/*` (4 slots), `skills-lock.json` |
| Rename | `.claude/agents/umbraco-code-reviewer.md` → `code-reviewer.md`; `.claude/agent-memory/umbraco-code-reviewer/` → `code-reviewer/` |
| Delete | 8 `.claude/commands/{spec,plan,implement-step,feature,retrofit,explore,code-review,commit-message}.md` |
| Create | `AGENTS.md`; `docs/*` runbooks (from CLAUDE.md sections); `docs/toolkit-adoption.md` |
| Modify | `CLAUDE.md` (→ thin shim); `.gitignore` (+ `_scratch/`); deep-link fixes across docs |
| Move | shipped/active `_specs/`+`_plans/` → `_work/shipped/<slug>/` and `_work/<slug>/` bundles |
| Create (delete after running) | workspace-migration script |
| _(work type: `fix-infra`)_ Create | `docs/toolkit-adoption.md` runbook (**no feature doc**) |
