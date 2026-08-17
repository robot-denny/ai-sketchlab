# Spec for cantrip-toolkit-adoption

> This spec captures initial requirements and design rationale. For **current system
> behavior**, see the doc named on the **Work type** line below — a new feature doc for a new
> capability, an existing feature doc for a change, or a `docs/` runbook for a fix.

branch: claude/feature/cantrip-toolkit-adoption
design reference (if any): none

**Feature doc**: none
**Work type**: fix-infra
<!--
  Dev-tooling + docs restructuring. No visitor- or editor-facing behavior changes — the running
  site is byte-identical. Its durable record is the restructured AGENTS.md/CLAUDE.md + a migration
  runbook under docs/, not a feature doc. The acceptance criteria read as transitions ("old commands
  retired", "CLAUDE.md split", "leaves the site unchanged"), which is the tell for fix-infra.
-->

## Summary

Adopt the **cantrip** agentic toolkit as this site's real developer tooling on `master` — the
"expensive half" the canary trial (on `cantrip-trial`) deliberately deferred. The trial proved the
toolkit works here and fed nine fixes back upstream (now at Phases 0–7). This increment makes it the
site's actual setup: installs the toolkit on `master`, ports the validated L2 config slots, retires
the eight old `.claude/commands` the cantrip spells replace, migrates the workspace from
`_specs`/`_plans`/`_features`/`_audits` to the `_work/` layout, and splits the 663-line `CLAUDE.md`
into a thin entry point plus the toolkit's own workflow spine and `docs/` runbooks. **No site
behavior changes.**

**Two hard constraints carried from the trial:**
- **Hold the pack spellbook.** Do NOT install cantrip's generic `check-uda`/`umbraco-edit`/`block`
  spells — they would shadow this repo's stronger tailored versions (Cloud drift detection, Live-API
  checks). Keep the tailored commands.
- **Land cleanly on master by porting, not merging.** `cantrip-trial` carries trial-only artifacts
  (`CANTRIP-TRIAL.md`, the already-shipped placeholder `_work/` increment). Bring the *adopted state*
  to `master`, not the trial's history.

## Functional Requirements

- On `master`, the eight workflow spells — `spec`, `plan`, `implement-step`, `feature`, `retrofit`,
  `explore`, `code-review`, `commit-message` — resolve to the cantrip toolkit, and the old
  same-named `.claude/commands/*.md` are retired.
- The tailored `check-uda`, `umbraco-edit`, and `block` commands (plus `cms-image`, `guide`, and the
  design skills) survive **unshadowed** — the pack spellbook is not installed.
- The 12 filled L2 slots (`.agents/config/`) are present on `master`, so the spells run against real
  project facts, not fallbacks.
- The **optional** two pack references — `umbraco-17-starter-facts` and `umbraco-17-review-rules` —
  are installed (they shadow nothing) and are consulted by `/plan` and `/code-review`.
- New increments write to `_work/<slug>/`; the existing `_specs/`, `_plans/`, `_features/`, and
  `_audits/` are migrated into the `_work/` layout (shipped work archived, `_features/` retained,
  audits to `docs/audits/`), leaving no dangling in-repo references.
- The 663-line `CLAUDE.md` is decomposed: the workflow spine lives in the `workflow` skill; project
  architecture facts move to `AGENTS.md` + config slots; operational runbooks move to `docs/`;
  `CLAUDE.md` becomes a thin pointer well under 200 lines.
- The tailored reviewers (`umbraco-code-reviewer`/`accessibility-reviewer`/`perf-reviewer`) remain
  registered and are discovered by identity (not name) by the updated `/code-review`.
- Reviewer working-memory and the cross-session project-memory mirror are preserved through the
  restructure; the `umbraco-code-reviewer → code-reviewer` memory remap is handled if reviewer
  identities change.
- `dotnet build` stays zero-warning and CI Gate 1 + Gate 2 pass; `check-install.sh` reports the
  adopted state clean on `master`.

## Design Reference (only if one exists)

- Source: none (dev-tooling adoption). The shape is defined by the cantrip toolkit's own contract
  (`docs/contract.md` in the cantrip repo) and the trial's validated `cantrip-trial` state.

## Possible Edge Cases

- **Command shadowing during the cutover** — a same-named skill silently shadows a command; retiring
  the eight old commands must be deliberate so a half-migrated `.claude/commands` doesn't leave dead,
  unreachable files.
- **Workspace migration cardinality** — `_specs/` (79 files) and `_plans/` (41) are mostly *shipped*
  work; a naive move could bury history or break the many deep-links from shipped specs/plans/CLAUDE.md.
- **CLAUDE.md deep-links** — ~10 in-file anchors plus cross-file references; the split must not leave
  broken pointers (the design-system move earlier showed this cost).
- **`.uda` startup churn** — the running site rewrites `.uda` on boot; the migration must not sweep
  that churn into commits (discard it, per the schema-management rule).
- **The bootstrap paradox** — this increment is authored in the `_work/` layout it is migrating the
  project *to*; its own spec/plan live on this branch, and the migration of legacy dirs is part of the
  work, not a precondition.
- **Landing on master** — porting the adopted state (not merging `cantrip-trial`) must exclude
  `CANTRIP-TRIAL.md` and the placeholder `_work/` increment (already shipped via #49).

## Acceptance Criteria

- **AC1** — On `master`, casting each of the eight workflow spells resolves to the cantrip toolkit,
  and the retired old commands are gone (not merely shadowed).
- **AC2** — The tailored `check-uda`/`umbraco-edit`/`block` commands still work; the pack spellbook is
  absent.
- **AC3** — The 12 L2 slots are present and filled on `master`; `check-install.sh` reports them filled.
- **AC4** — `umbraco-17-starter-facts` and `umbraco-17-review-rules` are installed and demonstrably
  consulted by `/plan` (starter facts) and `/code-review` (review rules).
- **AC5** — New increments land in `_work/<slug>/`; the legacy `_specs`/`_plans`/`_features`/`_audits`
  are migrated with no dangling in-repo references, and shipped history is preserved (archived, not lost).
- **AC6** — `CLAUDE.md` is a thin pointer to `AGENTS.md`; the workflow spine is in the `workflow`
  skill; runbooks are under `docs/`; no broken deep-links remain.
- **AC7** — The running site is unchanged (no visitor/editor-facing difference); CI Gate 1 + Gate 2 are
  green.
- **AC8** — The adoption reaches `master` by porting the adopted state (trial-only artifacts excluded).

## Scenarios (Draft)

Draft scenarios from the acceptance criteria (Example Mapping). The "actor" for a dev-tooling change
is the **developer/agent** using the toolkit. Verified at implementation.

### Rule: The workflow spells resolve to cantrip on master, old commands retired (AC1)

```scenario
Scenario: A developer casts /spec on master
  Given the adoption has landed on master
  When a developer casts /spec on a fresh idea
  Then the cantrip spec spell runs
  And no file remains at .claude/commands/spec.md
```

### Rule: Tailored Umbraco commands survive; the pack spellbook is held (AC2)

```scenario
Scenario: The Cloud-aware check-uda still runs
  Given the adoption has landed on master
  When a developer casts /check-uda before a schema push
  Then this repo's tailored check-uda runs (Cloud drift + Live-API checks)
  And no cantrip pack check-uda is installed to shadow it
```

### Rule: Project facts drive the spells, not fallbacks (AC3, AC4)

```scenario
Scenario: /plan runs against real project facts
  Given the L2 slots and the umbraco-17 pack references are installed on master
  When a developer casts /plan on an Umbraco increment
  Then the plan uses the real build/test commands and the unit-of-work slice
  And it consults the umbraco-17 starter facts and planning guidance
```

### Rule: New work uses _work/; legacy history is migrated intact (AC5)

```scenario
Scenario: A new increment lands in the new layout
  Given the adoption has landed on master
  When a developer casts /spec
  Then the spec is written under _work/<slug>/
  And the previously-shipped specs/plans/features remain reachable in their archived home
```

### Rule: CLAUDE.md is decomposed with no broken links (AC6)

```scenario
Scenario: A contributor opens the entry point
  Given the adoption has landed on master
  When a contributor opens CLAUDE.md
  Then it is a thin pointer to AGENTS.md and Claude-specific notes only
  And every deep-link it and its siblings carried still resolves
```

### Rule: The site is unchanged and CI is green (AC7, AC8)

```scenario
Scenario: Adoption ships without touching the running site
  Given the adoption PR against master
  When CI runs Gate 1 and Gate 2
  Then both are green
  And no visitor- or editor-facing behavior differs from before the adoption
```

## Open Questions

- **RESOLVED — Workspace migration depth:** move **all** shipped `_specs/`/`_plans/` into
  `_work/shipped/<slug>/` bundles (the full move, truest to the layout). Update the in-repo references
  this breaks; shipped-doc self-references that go stale are acceptable historical drift.
- **RESOLVED — `_audits/` disposition:** keep the **existing** `_audits/` gitignored/personal, untouched.
  Adopt cantrip's convention **going forward**: durable audits → `docs/audits/` (committed), personal
  scratch audits → `_scratch/` (git-ignored wholesale). Add `_scratch/` to `.gitignore`.
- **RESOLVED — Reviewer identity:** **rename** the tailored reviewers to cantrip's role names
  (`code-reviewer`, `accessibility-reviewer`, `perf-reviewer`) to match the new model, and **remap**
  the reviewer working-memory — `.claude/agent-memory/umbraco-code-reviewer/` (7 notes) →
  `code-reviewer/` — so calibration isn't orphaned (the other two names are unchanged).
- **Landing mechanics** — port via `git checkout cantrip-trial -- <paths>` onto a clean master branch
  (like the placeholder ship), vs. a curated cherry-pick. `/plan` decides and sequences.
- **AGENTS.md vs CLAUDE.md content split** — exactly which of the 25 CLAUDE.md sections become
  `AGENTS.md`, which become `docs/` runbooks, and which are already covered by the workflow skill.
- **Sequencing safety** — order the steps so master is never left half-migrated (each step independently
  green): likely install+slots → pack references → retire commands → CLAUDE.md split → workspace
  migration, each its own commit/PR-able unit.

## Testing Guidelines

Meaningful checks without over-testing an infra change:

- After each step: `dotnet build -c Release` stays zero-warning and `dotnet test --no-build` passes
  (the pre-push gate).
- `check-install.sh` reports the adopted toolkit clean (skills whole, slots filled, reviewers by
  identity) on the adoption branch.
- A grep-based link check: no in-repo reference points at a moved/retired path (old command files,
  moved CLAUDE.md sections, migrated workspace dirs).
- Cast one real spell end-to-end on the adoption branch (e.g. `/plan` on a trivial idea) to confirm the
  ported slots + pack references drive it.
- The durable record is a **migration runbook under `docs/`** (how the adoption was done, how to
  operate the new layout) — authored as the final step, since this is `fix-infra` (no feature doc).
```
