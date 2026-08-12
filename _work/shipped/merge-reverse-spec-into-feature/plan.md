# Plan: Merge reverse-spec into /feature

**Spec**: `_specs/merge-reverse-spec-into-feature.md`
**Branch**: `claude/fix/merge-reverse-spec-into-feature`
**Work type**: fix-infra — carried from the spec; the final step records durable residue (no `_features/` doc), archives spec+plan, and confirms the shipped spec carries the ACs.

## Context

Two Claude Code commands produce the **same artifact** — a `_features/<slug>.md` in the `_features/_template.md` BDD shape — so they are ~80% redundant. `reverse-spec`'s only distinct value is a cold-start path: drafting a feature doc from code (`.uda` + generated model + `.cshtml`) when a feature has no upstream spec/plan/tests. Per the artifact/stage split rule (same artifact ⇒ modes of one command), this work folds that cold-start capability into `/feature` as a **from-code mode** and deletes `reverse-spec`.

The subject files are tooling, not site code: [.claude/commands/feature.md](.claude/commands/feature.md) (the keeper) and `.claude/commands/reverse-spec SKILL.md` (the file to delete). A grep confirms **the only live reference to `reverse-spec`/`gen-e2e` anywhere in the tree is the reverse-spec file itself** — nothing in CLAUDE.md or other commands points at either, so the delete needs no scattered cleanup. The `_features/_template.md` uses `**Source spec**:` + `**Last verified**:` provenance lines; from-code mode populates those to self-identify as reverse-engineered.

Because this is tooling, classic TDD does not map — there is no unit/Playwright test to fail RED first. Verification is instead **grep/terminology checks** (decisive and cheap) plus a **one-path behavioral dry-run** of the merged command, exactly as the spec's Testing Guidelines specify.

---

## Key Decisions

These resolve the spec's five Open Questions so implementers don't re-decide them:

- **Mode detection is implicit, disambiguated by argument shape, with existing-artifact precedence (resolves OQ1 + OQ2).** `/feature` resolves the argument in this order and stops at the first hit: (1) an `update` directive → update mode; (2) a `_specs/` path or a token matching an existing `_features/<slug>.md` or a locatable spec/plan/test → existing artifact-driven path; (3) only if none of those resolve, and the token resolves to code (a `.uda` path, doc-type alias, or partial/block name) → **from-code mode**. Rationale: the richer artifact-driven path always wins when artifacts exist (a doc-type alias that *does* have a spec should not fall to the thinner code-only path); from-code is strictly the fallback for the zero-artifact case. Chosen over an explicit `/feature from-code <x>` sub-mode because argument shape is already unambiguous and one fewer thing to remember improves both human and agent UX — but a one-line "you can force this by …" note is *not* added to avoid inventing surface the spec didn't ask for.
- **Type labels come from the committed generated models first, `.uda` UDI mapping as fallback (resolves OQ3).** This repo now commits ModelsBuilder output under `src/UmbracoProject.Features/Models/Generated/` (SourceCodeManual mode). A generated C# property's type is a more reliable, repo-native signal than reverse-mapping a `umb://data-type/...` UDI. From-code mode reads the generated model for the doc type first; it keeps a **compact** UDI→label fallback table only for cases where the model is absent or the type is ambiguous. The old `reverse-spec` mega-table is trimmed, not copied wholesale.
- **The from-code how-to lives inline in `feature.md` as one new mode section (resolves OQ4).** `feature.md` is ~120 lines; adding a self-contained "from-code mode" section keeps the command a single paste-able unit (better agent reliability than a cross-file reference). No separate file.
- **No CLAUDE.md edit is required for the delete (resolves OQ5).** Grep confirms no doc/command/CLAUDE.md section claims `reverse-spec` exists, so removing it leaves nothing dangling. The final step still greps to prove this rather than assuming it.
- **`gen-e2e` stays out of scope.** Generating tests is a different artifact at a different stage; by the same split rule it would be its own command. From-code mode's "next step" pointer names only commands that exist here (e.g. `/block` for TDD, `/code-review`), never `/gen-e2e`.
- **Branch stays `claude/fix/…`.** Work type is fix-infra and the repo convention is `claude/fix/` for non-capability changes; the spec already cut this branch from master.

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Add from-code mode to `/feature` and correct terminology

> **Prompt**: Implement Step 1 of `_plans/merge-reverse-spec-into-feature.md`. Edit `.claude/commands/feature.md` (only this file). (a) Add a new **from-code input mode** to the command so that when the argument names a code entity with no upstream artifacts — a `.uda` path under `src/UmbracoProject/umbraco/Deploy/Revision/`, a document-type alias, or a partial/block name under `src/UmbracoProject/Views/` — `/feature` reverse-engineers a draft feature doc from the `.uda` + the committed generated model under `src/UmbracoProject.Features/Models/Generated/` + the `.cshtml` view. (b) Wire mode detection into the existing "Step 1 — Parse the argument" with the precedence in Key Decisions: `update` directive → existing artifact-driven path (spec/plan/feature/tests) → from-code only as the fallback when nothing else resolves. (c) The from-code path must: read the generated model first for property types (compact `.uda` UDI→label table only as fallback); mark any scenario whose observable proof can't be derived from code with an explicit "needs human input: exact element/selector" flag rather than inventing it; start every scenario "Not covered" in the coverage table; set the doc's `**Source spec**:` line to note it is derived from implementation with no originating spec, and add a not-yet-human-verified revision note. (d) Preserve the existing Guard (work-type classification) and the existing conflict-resolution precedence (tests > plan > spec) unchanged — from-code mode still runs the Guard and, having no competing artifacts, treats code as the sole source. (e) Fix terminology: the command's output is called a "feature doc" everywhere; the word "spec" refers only to `_specs/` documents. Use only real repo paths — no `CCASyndicationEnvironment` paths or foreign doc-type vocabulary, and no reference to `/gen-e2e` (its "next step" names only commands that exist here). Do NOT delete the reverse-spec file in this step — that is Step 2.

**What to build**: Modifications to [.claude/commands/feature.md](.claude/commands/feature.md):
- Extend **Step 1 — Parse the argument** with a fourth branch: **from-code** (argument resolves to code but no `_specs`/`_plans`/tests/existing `_features` doc). Document the precedence explicitly (update → artifact-driven → from-code fallback).
- Add a new section (e.g. **"From-code mode (cold start — no upstream artifacts)"**) covering: which files it reads (real paths above), reading the generated model first for types with a compact UDI→label fallback table, per-property Rule derivation (mandatory → renders/validation; optional text → renders/blank; toggle → shows/hides; media → image/placeholder; block list → children/empty), reading the `.cshtml` for conditional branches, the "needs human input" flag for underivable proof, and the provenance/`Source spec`/revision-note treatment.
- Keep the Guard section and Step 3 conflict-resolution wording intact; add a sentence that from-code mode also honors the Guard.
- Sweep the whole file for the word "spec" applied to `/feature`'s own output and change to "feature doc."

**Test first**: N/A — this is a prompt/command file; no RED test applies. Verification is in Step 3 (dry-run) and Step 2 (grep). This is expected for fix-infra tooling work.

**Validation**:
- [Automated]: `grep -ni "CCASyndicationEnvironment\|gen-e2e" ".claude/commands/feature.md"` → **no matches**.
- [Automated]: `grep -ni "UmbracoProject" ".claude/commands/feature.md"` → shows the real paths are present in the from-code section.
- [Manual]: Read `feature.md` end to end — the from-code mode is self-contained and paste-usable; nowhere does it call `/feature`'s output a "spec"; the mode-detection precedence is unambiguous.

---

### Step 2 — Delete the `reverse-spec` command and prove no dangling references

> **Prompt**: Implement Step 2 of `_plans/merge-reverse-spec-into-feature.md`. Delete the file `.claude/commands/reverse-spec SKILL.md` (note the space in the filename — quote it). Then grep the whole tree to prove nothing else references the removed command or the nonexistent `/gen-e2e`, excluding the historical mentions in `_specs/merge-reverse-spec-into-feature.md` and `_plans/merge-reverse-spec-into-feature.md`. If any live reference remains in a command, CLAUDE.md, or a `docs/` runbook, fix it (remove the pointer). Report the grep results.

**What to build**:
- `git rm "./.claude/commands/reverse-spec SKILL.md"` (the file is currently untracked on this branch, so a plain `rm` is fine — use whichever removes it from the working tree).
- Tree-wide grep verification; fix any real dangling pointer found (none expected per the planning grep).

**Test first**: N/A (deletion + grep verification).

**Validation**:
- [Automated]: `ls ".claude/commands/" | grep -i "reverse-spec"` → **no output** (file gone).
- [Automated]: `grep -rIn --exclude-dir=.git "reverse-spec\|gen-e2e" . | grep -vE "_(specs|plans)/merge-reverse-spec-into-feature\.md"` → **no output** (only the intentional historical mentions remain, and those are excluded).

---

### Step 3 — Behavioral dry-run of the merged command

> **Prompt**: Implement Step 3 of `_plans/merge-reverse-spec-into-feature.md`. Verify the merged `/feature` behaves correctly on two paths, without shipping the generated artifact. First pick a real document type in this repo that has a block view under `src/UmbracoProject/Views/Partials/blocks/Components/` and NO existing `_features/*.md` doc (candidate: `codeSnippet` — confirm it has no feature doc first with `ls _features/ | grep -i snippet`). (a) FROM-CODE PATH: run `/feature <that-alias>` and confirm it enters from-code mode, reads the `.uda` + generated model + `.cshtml`, and drafts a feature doc whose scenarios are all "Not covered", with review flags on any scenario lacking a derivable selector and a provenance line marking it reverse-engineered. Inspect the draft, confirm it looks right, then DISCARD it (`git checkout`/`rm` the generated `_features/*.md`) — this is a dry-run, not a deliverable. (b) EXISTING-ARTIFACT PATH: run `/feature` against an existing spec path (e.g. a file under `_specs/shipped/`) and confirm it does NOT enter from-code mode — it uses the artifact-driven behavior. Report both outcomes. Do not commit any feature doc produced here.

**What to build**: No files shipped — this is a verification step. Any `_features/*.md` produced by the from-code dry-run is inspected then discarded.

**Validation**:
- [Manual]: From-code path enters from-code mode, produces a template-shaped draft with all-"Not covered" coverage, review flags where proof isn't code-derivable, and a reverse-engineered provenance line.
- [Manual]: Existing-artifact path (a `_specs/` argument) uses the unchanged artifact-driven behavior and does **not** trigger from-code mode.
- [Manual]: Working tree is clean of any dry-run artifact afterward (`git status` shows no stray `_features/*.md`).

---

### Step 4 — Record durable residue and archive (fix-infra final step)

> **Prompt**: Implement Step 4 of `_plans/merge-reverse-spec-into-feature.md`. This is a fix-infra work type, so create NO `_features/` doc. (a) Confirm the shipped spec `_specs/merge-reverse-spec-into-feature.md` carries the acceptance criteria (it does — no edit unless something drifted). (b) OPTIONAL: if CLAUDE.md or any command inventory enumerates commands, add a one-line mention that `/feature` now has a from-code cold-start mode and that `reverse-spec` was retired — but only if such an inventory exists (grep first; per planning, none references reverse-spec, so this may be a no-op). (c) Archive the spec and plan to their shipped folders: `git mv _specs/merge-reverse-spec-into-feature.md _specs/shipped/` and `git mv _plans/merge-reverse-spec-into-feature.md _plans/shipped/`. Report what moved.

**What to build**:
- Optional one-line CLAUDE.md note (only if a command inventory exists — likely a no-op).
- `git mv` spec → `_specs/shipped/`, plan → `_plans/shipped/`.

**Validation**:
- [Manual]: No `_features/*.md` was created for this work (fix-infra correctly earns none).
- [Automated]: `ls _specs/shipped/merge-reverse-spec-into-feature.md _plans/shipped/merge-reverse-spec-into-feature.md` → both exist.
- [Automated]: `grep -rIn --exclude-dir=.git "reverse-spec" . | grep -v shipped` → only this plan/spec's own historical mentions (now under `shipped/`) remain; nothing claims a live `/reverse-spec` command.

---

## File Summary

| Action | File |
|--------|------|
| Modify | `.claude/commands/feature.md` (add from-code mode, fix terminology, correct paths) |
| Delete | `.claude/commands/reverse-spec SKILL.md` |
| Create then discard (dry-run only) | `_features/*.md` (from Step 3 verification — not committed) |
| Modify *(optional, likely no-op)* | `CLAUDE.md` (one-line note only if a command inventory exists) |
| Move | `_specs/merge-reverse-spec-into-feature.md` → `_specs/shipped/` |
| Move | `_plans/merge-reverse-spec-into-feature.md` → `_plans/shipped/` |
| — *(fix-infra: no `_features/` doc created)* | — |
