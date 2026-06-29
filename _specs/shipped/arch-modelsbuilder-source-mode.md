# Spec for arch-modelsbuilder-source-mode

> This spec captures initial requirements and design rationale. For **current system behavior**, see the doc named on the **Work type** line below (a new `_features/<feature-name>.md` for a new capability; an existing `_features/*.md` for a change; a `docs/` runbook or CLAUDE.md section for a fix).

branch: claude/feature/arch-modelsbuilder-source-mode
**Work type**: fix-infra — see CLAUDE.md → Workflow layers → "Work types". A ModelsBuilder generation-mode switch with no standing user-facing capability change; durable residue lands in a new CLAUDE.md `## ModelsBuilder` section and retires the [[project_inmemoryauto_blocks_buildtime_razor]] memory. No `_features/` doc.
figma_component (if used): none

## Summary

Switch Umbraco ModelsBuilder from its default **`InMemoryAuto`** mode (PublishedModels generated at runtime into the gitignored `umbraco/Data/TEMP/InMemoryAuto/`) to a **source-code mode** with the generated models committed to the repo under a known directory (`Models/Generated/`, namespace unchanged: `Umbraco.Cms.Web.Common.PublishedModels`).

This is the **gate** the Pillar 2 architecture push identified before any *model-coupled* slice can move into the `UmbracoProject.Features` RCL. Under `InMemoryAuto`, models exist only at runtime, so any C# or Razor that references a `PublishedModels.*` type cannot be compiled at build time in a class library — it fails `CS0234` (type/namespace not found). The Search pilot was deliberately chosen because it was model-free; everything after it (`AssignMembersToPremiumRoleHandler`, page-coupled controllers, any RCL-embedded view) is blocked until models are real compiled source.

The switch is intended to be **behavior-preserving** for site visitors and CMS editors: the same models, the same namespace, the same rendered pages. The change is felt only by the build, by developers, and by the Cloud deploy pipeline.

Two payoffs beyond unblocking the RCL migration:
1. **Build-time detection of obsolete Razor APIs becomes feasible** — once models are compiled source rather than runtime-only, `dotnet build` can compile Razor and surface `CS0618` (and `CS0234`) instead of those errors only appearing on Cloud's first-request runtime Razor compile. This is the path to retiring the `.githooks/lint-obsolete-razor-api.sh` stopgap and de-risking `arch-obsolete-api-migration`.
2. **Editor/developer transparency** — models are reviewable in PRs and diff cleanly when the content schema changes.

## Functional Requirements

- ModelsBuilder `ModelsMode` is set to a source-code mode (decision between `SourceCodeManual` and `SourceCodeAuto` is an Open Question) in committed configuration, applying to local and every Cloud environment.
- Generated model classes are committed to the repository under a single known directory (`Models/Generated/`), no longer living only in the gitignored `umbraco/Data/TEMP/InMemoryAuto/`.
- The generated models keep the existing namespace `Umbraco.Cms.Web.Common.PublishedModels`, so no existing Razor view or C# file needs an edit to keep compiling.
- `dotnet build -c Release` on the whole solution stays clean under `<TreatWarningsAsErrors>` after the switch (the committed models compile; no new warnings-as-errors).
- The existing test suite stays green (`dotnet test`).
- The public site and backoffice render and behave identically before and after the switch — same pages, same content, same editor experience.
- The Umbraco Cloud deploy pipeline (Gate 1 + Gate 2: Cloud sync → artifact → deploy to Dev → Playwright) stays green; the Kudu build compiles the committed models.
- The gitignore stops ignoring the committed models directory but continues to ignore the now-unused `InMemoryAuto/` runtime artifacts.
- Documentation: a CLAUDE.md section records the new mode, where models live, how to regenerate them, and the workflow when the content schema changes; the `project_inmemoryauto_blocks_buildtime_razor` memory is retired or updated to reflect that the build-time gate is now feasible.

## Figma Design Reference (only if referenced)
- Not applicable (infrastructure change, no UI).

## Possible Edge Cases

- **Obsolete-API surfacing**: if the switch also flips `RazorCompileOnBuild` back on (the host csproj comment says to remove `RazorCompileOnBuild=false`/`RazorCompileOnPublish=false` "when not using ModelsMode InMemoryAuto"), build-time Razor compilation may newly surface the `CS0618` obsolete-API usages that are currently only caught at Cloud runtime. The project-wide `CS0618` `<NoWarn>` would suppress them at build — but whether to enable build-time Razor compile *in this increment* (and thus actually realize payoff #1) vs. defer it is a scoping decision.
- **Schema drift after the switch**: with committed models, a content-type change made in the backoffice now requires regenerating + committing models, OR they go stale. `SourceCodeAuto` regenerates automatically (dev), `SourceCodeManual` does not. The chosen mode changes the editor/developer ritual.
- **Cloud regeneration behavior**: Cloud environments must not regenerate-and-commit models in a way that conflicts with git (mirrors the existing `.uda` auto-commit drift problem). The committed models must be the source of truth on Cloud, not regenerated per-environment.
- **Namespace/déjà-vu collisions**: if any model is generated with a different namespace or a partial-class extension already exists, the committed output could collide. Need to confirm a clean first generation.
- **First-generation diff size**: the initial commit of all generated models will be large (one class per document type + element type + compositions). This is expected, not a regression.
- **`InMemoryAuto/` leftovers**: stale runtime artifacts in `umbraco/Data/TEMP/InMemoryAuto/` should not be picked up or double-compiled after the switch.

## Acceptance Criteria

- **AC1**: ModelsBuilder runs in a source-code mode (`ModelsMode` ≠ `InMemoryAuto`) via committed configuration that applies to local and all Cloud environments.
- **AC2**: The generated PublishedModels are committed to `Models/Generated/` and are no longer gitignored; the `InMemoryAuto/` runtime path is no longer the source of models and remains gitignored.
- **AC3**: The generated models retain the `Umbraco.Cms.Web.Common.PublishedModels` namespace, so no existing view or C# file requires a namespace/using edit to compile.
- **AC4**: `dotnet build -c Release` for the solution is clean under warnings-as-errors, and `dotnet test` is green, after the switch.
- **AC5**: The deployed site is behavior-preserving — a visitor browsing the site and an editor using the backoffice see identical behavior before and after; the Cloud Gate 1 + Gate 2 pipeline goes green on Dev.
- **AC6**: The durable record is updated — a CLAUDE.md `## ModelsBuilder` section documents the mode, the models' home, and the regenerate-on-schema-change workflow; the `project_inmemoryauto_blocks_buildtime_razor` memory is retired/updated.

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation. Work type is `fix-infra`, so the verified record will live in the CLAUDE.md `## ModelsBuilder` section, not a `_features/` doc.

### Rule: ModelsBuilder runs in a committed source-code mode (AC1)

```scenario
Scenario: Models mode is source-code everywhere
  Given the committed appsettings sets ModelsBuilder ModelsMode to a source-code mode
  When a developer runs the site locally and the site runs on Cloud Dev
  Then both environments use source-code models
  And neither relies on the runtime InMemoryAuto generation
```

### Rule: Generated models are committed source, not runtime-only artifacts (AC2)

```scenario
Scenario: A freshly cloned repo has compilable models without running the app
  Given a developer clones the repo and has never started the app
  When they run "dotnet build -c Release"
  Then the build finds the PublishedModels under Models/Generated/ as committed source
  And the build succeeds without first generating models at runtime
```

```scenario
Scenario: Runtime temp models are not the source of truth
  Given the switch to source-code mode has shipped
  When git status is inspected
  Then Models/Generated/ is tracked in git
  And umbraco/Data/TEMP/InMemoryAuto/ is still gitignored
```

### Rule: Existing views and C# compile unchanged because the namespace is preserved (AC3)

```scenario
Scenario: An existing template needs no edit
  Given article.cshtml references the Article PublishedModel via Umbraco.Cms.Web.Common.PublishedModels
  When models are regenerated as committed source in the same namespace
  Then article.cshtml compiles with no using/namespace change
```

### Rule: Build and tests stay clean under warnings-as-errors (AC4)

```scenario
Scenario: Solution builds clean after the switch
  Given the committed models and updated configuration
  When a developer runs "dotnet build -c Release" then "dotnet test"
  Then the build reports 0 warnings and 0 errors
  And all tests pass
```

### Rule: The change is invisible to visitors and editors (AC5)

```scenario
Scenario: A visitor sees an unchanged article page
  Given an article published before the switch
  When a visitor opens that article after the switch deploys to Dev
  Then the page renders identically to before

Scenario: The Cloud pipeline goes green on Dev
  Given the switch is merged to master
  When the Gate 1 + Gate 2 pipeline runs
  Then Build + xUnit, Cloud sync, artifact, deploy to Dev, and Playwright all pass
```

### Rule: The new mechanism is documented and the stopgap memory retired (AC6)

```scenario
Scenario: A developer changes a content type after the switch
  Given a developer adds a property to a document type in the backoffice
  When they consult CLAUDE.md
  Then a "## ModelsBuilder" section tells them how to regenerate and commit the updated model
  And the project_inmemoryauto_blocks_buildtime_razor memory reflects that build-time detection is now feasible
```

## Open Questions

- **OQ1 — `SourceCodeManual` vs `SourceCodeAuto`?** Manual gives full control (models change only when a developer regenerates), matching the "committed source is the truth" principle and the agency reference; Auto regenerates on app start in dev, which is convenient locally but risks per-environment drift and surprise diffs. Which does the reference (`dev-kittitas-county`) use, and which fits this project's local→Cloud schema flow?
- **OQ2 — Realize payoff #1 in this increment, or defer?** Should this increment also remove `RazorCompileOnBuild=false`/`RazorCompileOnPublish=false` to enable build-time Razor compilation (and thus build-time obsolete-API detection), or is that a separate follow-on so this increment stays a pure mode switch? If enabled now, confirm the project-wide `CS0618` `<NoWarn>` keeps the build green and decide whether to then retire `.githooks/lint-obsolete-razor-api.sh`.
- **OQ3 — Models directory + project placement.** Confirm `Models/Generated/` in the host (`src/UmbracoProject/Models/Generated/`) is the right home, vs. the RCL. The Pillar 2 plan implies the host for now (views/models stay host-side this phase) — confirm models can stay in the host while the RCL references them transitively, and that this doesn't reintroduce the `CS0234` barrier for model-coupled code that later moves to the RCL. (This may reveal that models must ultimately live in, or be referenced by, the RCL — clarify the end-state.)
- **OQ4 — Cloud regeneration guard.** Does any Cloud environment regenerate models on boot under the chosen mode? If so, how do we prevent the per-environment auto-commit drift that already affects `.uda` files (see CLAUDE.md → Schema Management)?
- **OQ5 — Does the switch require an explicit `ModelsNamespace`/`ModelsDirectory` config** to land output in `Models/Generated/` with the preserved namespace, and does the first generation produce a clean, collision-free set?

## Testing Guidelines

This is behavior-preserving infrastructure; the existing safety net is the primary verification — do not over-build new automated tests. Specifically:

- **Lean on existing suites**: `dotnet build -c Release` + `dotnet test` (xUnit) prove the committed models compile and nothing regressed; the existing Playwright suite against Dev (Gate 2) proves visitor/editor behavior is preserved. No new unit test is warranted for a generation-mode switch.
- **Manual/CI verification** (record results in the plan, no new spec files):
  - Fresh-clone build: from a clean checkout (no app run), `dotnet build -c Release` succeeds using only committed models.
  - `git status` after a local app boot shows no unexpected model regeneration/drift (guards OQ4).
  - Spot-render a model-coupled page locally (e.g. an article) and confirm identical output.
- **Only if OQ2 is realized in-increment**: add/adjust the CI gate that now compiles Razor at build time, and confirm it behaves as intended (green on current tree, red on a deliberately-introduced obsolete-API usage) — but treat that as part of the obsolete-API follow-on if it expands scope.
