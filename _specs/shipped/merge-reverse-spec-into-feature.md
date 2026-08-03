# Spec for merge-reverse-spec-into-feature

> This spec captures initial requirements and design rationale. For **current system behavior**, see the doc named on the **Work type** line below. This is tooling/scaffolding cleanup — its durable residue lands in CLAUDE.md (Workflow layers) and the `/feature` command file itself, not in `_features/`.

branch: claude/fix/merge-reverse-spec-into-feature
**Work type**: fix-infra  — see CLAUDE.md → Workflow layers → "Work types"; this changes developer tooling (a Claude Code command), not a site capability, so it earns no `_features/` doc
figma_component (if used): none

## Summary

Consolidate two overlapping Claude Code commands into one. The newly-added `reverse-spec` command (`.claude/commands/reverse-spec SKILL.md`) and the existing `/feature` command (`.claude/commands/feature.md`) both produce the **same artifact** — a `_features/<slug>.md` file in the `_features/_template.md` BDD shape — making them ~80% redundant. `reverse-spec`'s only distinct value is a **cold-start path**: seeding a draft feature doc directly from code (`.uda` doc-type files, generated C# models, `.cshtml` templates) when a feature has *no* upstream spec, plan, or tests to feed `/feature`.

The correct split line for commands is **artifact + pipeline stage, not situation**: two paths that write the same artifact should be *modes of one command*. So this work folds `reverse-spec`'s cold-start capability into `/feature` as an explicit **from-code input mode**, then deletes the `reverse-spec` command file.

A secondary driver: as delivered, `reverse-spec` is unusable in this repo regardless of the redundancy. It was copied from another project and never adapted — it hard-codes `src/CCASyndicationEnvironment.Web/.Features` paths and foreign vocabulary (`placeholderRichContent`, `syndicatedLanding`, "CSA/Subscriber/Publisher site"), references a `/gen-e2e` command that does not exist here, and calls its output a "spec," which inverts this project's load-bearing distinction between `_specs/` (incremental-change docs) and `_features/` (evergreen behavior docs).

**Explicitly out of scope**: a test-backfill command (the other project's `/gen-e2e`). Generating E2E tests produces a *different* artifact (test files) at a *different* stage, so by the same artifact/stage rule it would be its own command — not part of this merge. If ever wanted, it is a separate future effort.

## Functional Requirements

- **FR1 — `/feature` gains a from-code mode.** `/feature` accepts an argument that names a code entity with no upstream artifacts — a `.uda` file path, a document-type alias (e.g. `codeSnippet`), or a partial/block name (e.g. `blocks/Components/richText`) — and reverse-engineers a draft feature doc from code alone.
- **FR2 — Mode detection is automatic and disambiguated by argument shape.** `/feature` decides between its existing artifact-driven path and the new from-code path without a separate flag, by resolving what the argument points at: an existing `_specs/` path, a `_features/` slug, or an `update` directive → existing behavior; a `.uda` path / doc-type alias / partial name that resolves to code but has no locatable spec/plan/tests → from-code mode.
- **FR3 — From-code mode reads the right sources for *this* repo.** It searches this project's real paths: `.cshtml` under `src/UmbracoProject/Views/`, generated models under `src/UmbracoProject.Features/Models/Generated/`, and `.uda` under `src/UmbracoProject/umbraco/Deploy/Revision/`. No `CCASyndicationEnvironment` paths or foreign doc-type vocabulary survive.
- **FR4 — From-code mode marks unverifiable scenarios for human review.** When the exact observable proof (element/selector/text) cannot be determined from code alone, the scenario is flagged for human input rather than invented. Every from-code scenario starts in the coverage table as "Not covered."
- **FR5 — The existing Guard is preserved and applied to from-code mode too.** `/feature`'s work-type classification (new-capability / change-to-existing / fix-infra) still runs; from-code generation does not bypass it. A code entity that is genuinely a change to an existing capability updates that capability's doc rather than creating a new one.
- **FR6 — Conflict-resolution behavior is preserved.** `/feature`'s existing precedence (test assertions > plan > spec) is untouched for the artifact-driven path. From-code mode, having no competing artifacts, simply treats code as the sole source of truth and says so in the doc's provenance line.
- **FR7 — Terminology is corrected to "feature doc" throughout.** The merged command never calls its output a "spec." The word "spec" is reserved for `_specs/` incremental-change docs, consistent with the rest of the project.
- **FR8 — The `reverse-spec` command file is deleted.** `.claude/commands/reverse-spec SKILL.md` is removed. No dangling references to it remain in CLAUDE.md, other commands, or docs.
- **FR9 — No reference to a nonexistent command remains.** The `/gen-e2e` next-step pointer from the old `reverse-spec` is dropped (not re-created). Any "next step" guidance in from-code mode points only at commands that exist in this repo.
- **FR10 — Provenance is recorded on generated docs.** A feature doc produced by from-code mode is self-identifying as reverse-engineered and not-yet-human-verified (via its Source/provenance line and revision note), so a reader knows its scenarios came from code inference, not a verified spec+test lineage.

## Figma Design Reference (only if referenced)
- none

## Possible Edge Cases

- **Argument is ambiguous** — a token that could be either a `_features/` slug *or* a doc-type alias (e.g. a feature named `code-snippet` and a doc type `codeSnippet` both exist). The command must have a deterministic precedence so it doesn't silently pick the wrong mode.
- **From-code argument resolves to nothing** — a `.uda` path / alias that matches no file in this repo. Must fail clearly ("no code found for X") rather than emit an empty or hallucinated doc.
- **From-code argument DOES have upstream artifacts** — the user passes a doc-type alias, but a spec/plan/test actually exists for it. The richer artifact-driven path should win (or at least be offered), not the thinner code-only path.
- **A feature doc already exists** for the target — from-code mode must not silently overwrite; it should offer update-vs-overwrite, consistent with `/feature`'s existing update mode.
- **The `.uda` uses a data type the mapping doesn't recognize** — the generated Properties prose / scenarios must degrade gracefully (flag "unrecognized type, needs review") rather than assert a wrong type.
- **From-code target is actually a change to an existing capability, not new** — the Guard must catch this and route to the existing doc, exactly as the artifact-driven path would.
- **The delete leaves a dangling reference** — CLAUDE.md, another command, or a doc still mentions `reverse-spec` or `/gen-e2e` after removal.

## Acceptance Criteria

- **AC1**: Given a doc-type alias with no spec/plan/tests, when `/feature <alias>` is run, then `/feature` enters from-code mode and drafts a `_features/<slug>.md` from the `.uda` + generated model + `.cshtml`, with every scenario's coverage marked "Not covered."
- **AC2**: Given the same alias, when the draft is produced, then any scenario whose observable proof can't be derived from code is explicitly flagged for human review rather than asserted.
- **AC3**: Given an argument that resolves to an existing `_specs/` path or `_features/` slug (or an `update` directive), when `/feature` runs, then it uses its existing artifact-driven behavior unchanged — from-code mode is not triggered.
- **AC4**: Given a from-code target that is actually a change to an already-documented capability, when `/feature` runs, then the Guard routes it to update the existing capability's doc instead of creating a new file.
- **AC5**: Given the merged `/feature` command file, when it is read end to end, then it references only this repo's real paths (`src/UmbracoProject`, `src/UmbracoProject.Features`) and never the `CCASyndicationEnvironment` paths or foreign doc-type vocabulary.
- **AC6**: Given the merged `/feature` command file, when it is read, then its output is called a "feature doc" everywhere and never a "spec."
- **AC7**: Given the repository after this work, when `.claude/commands/` is listed, then no `reverse-spec` command file exists.
- **AC8**: Given the repository after this work, when the tree is grepped for `reverse-spec` and `gen-e2e`, then no dangling references remain (CLAUDE.md, commands, docs) except intentional historical mentions in this spec / shipped records.
- **AC9**: Given a from-code target that resolves to no code in this repo, when `/feature` runs, then it reports that no code was found and does not write a doc.
- **AC10**: Given a feature doc generated by from-code mode, when it is opened, then its provenance line and revision note identify it as reverse-engineered from code and not yet human-verified.

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Actors here are the **developer** running the command and the **command** itself (this is tooling, so the "ubiquitous language" is the toolkit's own).

### Rule: A code entity with no upstream artifacts drafts a feature doc from code (AC1, AC2)

```scenario
Scenario: Draft a feature doc for an undocumented block from its code
  Given the doc type "codeSnippet" has a .uda, a generated model, and a codeSnippet.cshtml view
  And no _specs, _plans, or tests reference codeSnippet
  When the developer runs /feature codeSnippet
  Then /feature enters from-code mode
  And it writes _features/code-snippet.md drafted from the .uda properties and the view's conditional logic
  And every scenario in the coverage table is marked "Not covered"
```

```scenario
Scenario: Flag a scenario whose proof can't be derived from code
  Given from-code mode is drafting a doc for a block
  And the view renders a value whose exact on-page selector cannot be determined from the markup alone
  When the draft is written
  Then that scenario carries an explicit "needs human input: exact element/selector" flag
  And the value is not invented
```

### Rule: Arguments with upstream artifacts keep /feature's existing behavior (AC3)

```scenario
Scenario: A spec path uses the artifact-driven path, not from-code
  Given a spec exists at _specs/shipped/section-navigation.md
  When the developer runs /feature _specs/shipped/section-navigation.md
  Then /feature uses its existing spec+plan+test behavior
  And from-code mode is not triggered
```

```scenario
Scenario: An update directive is unaffected by the merge
  Given a feature doc exists at _features/site-header.md
  When the developer runs /feature update _features/site-header.md
  Then /feature updates that doc using its existing behavior
```

### Rule: The Guard still governs whether a new doc is created (AC4)

```scenario
Scenario: A from-code target that is a change routes to the existing doc
  Given the developer runs /feature on a doc-type alias
  And that alias is a field added to an already-documented capability, not a new capability
  When /feature classifies the work type
  Then it updates the existing capability's _features doc
  And it does not create a new transition-style feature doc
```

### Rule: The merged command speaks this repo's language and paths (AC5, AC6)

```scenario
Scenario: No foreign project paths survive the merge
  Given the merged /feature command file
  When it is read end to end
  Then it references src/UmbracoProject and src/UmbracoProject.Features
  And it contains no CCASyndicationEnvironment path or foreign doc-type alias
```

```scenario
Scenario: Output is always called a feature doc
  Given the merged /feature command file
  When it is read
  Then its generated artifact is called a "feature doc" everywhere
  And the word "spec" refers only to _specs/ documents
```

### Rule: The reverse-spec command and its dead references are gone (AC7, AC8)

```scenario
Scenario: The reverse-spec command file is removed
  Given the repository after this work
  When .claude/commands/ is listed
  Then no reverse-spec command file exists
```

```scenario
Scenario: No dangling reverse-spec or gen-e2e references remain
  Given the repository after this work
  When the tree is grepped for "reverse-spec" and "gen-e2e"
  Then the only matches are intentional historical mentions in this spec or shipped records
  And no command, CLAUDE.md section, or doc points at a live /reverse-spec or /gen-e2e command
```

### Rule: From-code mode fails safe and self-identifies (AC9, AC10)

```scenario
Scenario: An unresolvable target writes nothing
  Given the developer runs /feature on a doc-type alias that matches no file in this repo
  When /feature tries to resolve code for it
  Then it reports "no code found" for that target
  And no _features file is written
```

```scenario
Scenario: A reverse-engineered doc announces its provenance
  Given from-code mode wrote _features/code-snippet.md
  When the doc is opened
  Then its provenance line marks it derived from implementation with no originating spec
  And its revision note says it is a not-yet-human-verified draft
```

## Open Questions

- **Detection precedence when a slug is ambiguous.** If a `_features/` slug and a doc-type alias could both match the same token, what wins? Proposed default: existing-artifact resolution first (spec/plan/feature/tests), fall to from-code only when none resolve — but confirm this is the desired bias.
- **Should from-code mode be implicit or explicit?** FR2 assumes implicit detection by argument shape. Alternative: a visible sub-mode (e.g. `/feature from-code <alias>`) for predictability at the cost of one more thing to remember. Which does the team prefer?
- **`.uda` data-type → readable-label mapping.** The old `reverse-spec` carried a mapping table (TinyMCE→Rich Text, etc.). Keep an explicit table in the merged command, or infer from the generated model's C# property types (which this repo now commits under `Models/Generated/`)? The committed models may be the more reliable, repo-native source.
- **Where does the from-code "how-to" live** — inline in `feature.md`, or is `feature.md` already long enough that the mode warrants a short linked reference? (Length/routing tradeoff for agent reliability.)
- **Does deleting `reverse-spec` need a note in CLAUDE.md's command inventory / Workflow layers section**, or is the command list not enumerated there? Confirm no doc claims `reverse-spec` exists.

## Testing Guidelines

This is tooling (a Claude Code command), so "tests" are verification checks, not xUnit/Playwright specs. Verify the following without over-engineering:

- **Grep checks** (cheap, decisive): after implementation, `grep -ri "reverse-spec"` and `grep -ri "gen-e2e"` and `grep -ri "CCASyndicationEnvironment"` across `.claude/` and `docs/` and `CLAUDE.md` return no live references. `.claude/commands/reverse-spec*` no longer exists.
- **Terminology check**: the merged `feature.md` contains no instance of calling its output a "spec" (spot-check that "spec" only appears in reference to `_specs/`).
- **Path check**: `feature.md`'s from-code section names only `src/UmbracoProject` / `src/UmbracoProject.Features` paths that actually exist.
- **Behavioral dry-run** (manual, one happy path + one guard path): run the merged `/feature` against a real undocumented doc-type alias in this repo and confirm it (a) enters from-code mode, (b) drafts a doc with "Not covered" coverage and review flags, and (c) does NOT trigger from-code mode when handed an existing `_specs/` path.
