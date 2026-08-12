# Plan: Arch — ModelsBuilder Source Mode (+ build-time Razor obsolete-API gate)

**Spec**: `_specs/arch-modelsbuilder-source-mode.md`
**Branch**: `claude/feature/arch-modelsbuilder-source-mode`
**Work type**: fix-infra — no `_features/` doc. Durable residue lands in a new CLAUDE.md `## ModelsBuilder` section, updates the [[project_inmemoryauto_blocks_buildtime_razor]] memory, and the spec/plan archive to `shipped/`.

## Context

Switch Umbraco ModelsBuilder from the default **`InMemoryAuto`** (PublishedModels generated at runtime into gitignored `umbraco/Data/TEMP/InMemoryAuto/`) to **`SourceCodeManual`** with the generated models committed into the **`UmbracoProject.Features` RCL**. This was specced as the "gate" for migrating model-coupled code into the RCL, but planning surfaced that **no model-coupled C# exists yet** and the near-term migration slices are model-free — so the gate framing alone delivers little now. The decision (2026-06-26) is therefore to **reframe**: pair the mode switch with **turning on build-time Razor compilation**, which delivers a concrete payoff immediately — `dotnet build` compiles Razor and surfaces obsolete-API (`CS0618`) usage at build time instead of only on Cloud's first-request runtime compile. That retires the `.githooks/lint-obsolete-razor-api.sh` stopgap and de-risks the future `arch-obsolete-api-migration`.

This builds directly on the shipped feature-folder RCL split: the host (`src/UmbracoProject`) already references the RCL (`src/UmbracoProject.Features`), and the RCL taxonomy already reserves a `Models/` bucket. The whole change is intended to be **behavior-preserving** for visitors and editors — same models, same `Umbraco.Cms.Web.Common.PublishedModels` namespace, same rendered pages.

---

## Key Decisions

- **`SourceCodeManual`, not `SourceCodeAuto`** (resolves spec OQ1). Manual = committed source is the single source of truth; models change only when a developer explicitly regenerates (via the ModelsBuilder dashboard from `Umbraco.Cms.DevelopmentMode.Backoffice`). `SourceCodeAuto` regenerates on app start, which would reintroduce the same per-environment auto-commit drift we already fight with `.uda` files (resolves OQ4: with Manual, **Cloud never regenerates on boot** — the committed models are authoritative everywhere).
- **Models live in the RCL, not the host** (resolves OQ3). This is *forced by dependency direction*: the RCL cannot reference the host, so for any future model-coupled RCL code to compile against `PublishedModels.*`, the models must live **in the RCL** (or lower). The host sees them via its existing `ProjectReference`. Output goes to `src/UmbracoProject.Features/Models/Generated/`, matching the RCL's documented `Models/` taxonomy bucket. Config: `ModelsDirectory` = `../UmbracoProject.Features/Models/Generated` (relative to the host content root) + `AcceptUnsafeModelsDirectory: true` (required because the dir is outside the web project).
- **Namespace preserved** = `Umbraco.Cms.Web.Common.PublishedModels` (the default; resolves OQ5). No existing view or `.cs` needs a `using`/namespace edit. Do **not** set a custom `ModelsNamespace`.
- **Reframe: enable build-time Razor compilation** (resolves OQ2 — chosen 2026-06-26). Remove the host csproj's `RazorCompileOnBuild=false`/`RazorCompileOnPublish=false` (the csproj comment already says to remove them "when not using ModelsMode InMemoryAuto"). With real committed models, Razor now compiles at build (`CS0234` no longer kills it). A side benefit: precompiled Razor in the published artifact also sidesteps the Cloud *runtime* Razor-compile traps ([[project_cloud_razor_honors_twae]], [[project_cloud_razor_ignores_nowarn]]) — verify this in Step 4.
- **Grandfather existing obsolete usages with scoped `#pragma`, then drop the blanket `CS0618` suppression** — this is how detection actually turns on. Today CS0618 is blanket-suppressed project-wide (`<NoWarn>…;CS0618</NoWarn>`). Keeping it suppressed = no detection gain. Removing it outright = every existing obsolete-API view becomes a hard build error (TWAE). The middle path (matches the established project idiom per [[project_cloud_razor_ignores_nowarn]]): wrap each *known existing* call site in a scoped `#pragma warning disable CS0618` (~11 candidate view files use bare `.Parent`/`.Children`; the build is the authority on the exact set), then remove `CS0618` from the project-wide `<NoWarn>`. New obsolete usage anywhere else now fails the build. **Migrating those grandfathered usages off the obsolete APIs stays out of scope** — that is `arch-obsolete-api-migration`.
- **Retire `.githooks/lint-obsolete-razor-api.sh`** once the compiler gates obsolete APIs at build. The hook was the InMemoryAuto-era stopgap; the build now does its job. Verify the build gate covers the hook's `.Parent`/`.Children` heuristic before deleting it.
- **No new automated tests.** Behavior-preserving infra; the existing `dotnet build`/`dotnet test`/Playwright-against-Dev suites are the safety net. The one *new* gate (build-time obsolete detection) gets a deliberate red/green proof in Step 3, not a committed test.
- **Bootstrapping dance**: the first generation requires the app running with the new config; front-end views that consume models won't render until the first generation completes, but the backoffice (and its ModelsBuilder dashboard) loads regardless. Sequence inside Step 1: configure → boot → generate via dashboard → verify files → stop → build.

---

## Steps

Each step is independently completable in a fresh context window. The step heading contains a paste-ready prompt. Steps 1→2→3 each end on a green `dotnet build` checkpoint so risk is isolated.

---

### Step 1 — Switch to SourceCodeManual and commit generated models into the RCL

> **Prompt**: Implement Step 1 of `_plans/arch-modelsbuilder-source-mode.md`. In `src/UmbracoProject/appsettings.json`, add ModelsBuilder config under `Umbraco:CMS:ModelsBuilder`: `"ModelsMode": "SourceCodeManual"`, `"ModelsDirectory": "../UmbracoProject.Features/Models/Generated"`, `"AcceptUnsafeModelsDirectory": true` (do NOT set ModelsNamespace — keep the default `Umbraco.Cms.Web.Common.PublishedModels`). Then generate the models as committed source: `cd src/UmbracoProject && dotnet run` in the background, wait for startup, then trigger generation via the ModelsBuilder dashboard API (`POST /umbraco/management/api/v1/models-builder/build` with a back-office token — see the `/umbraco-edit` skill for the OAuth client-credentials dance against localhost) OR, if simpler, document that a human clicks Settings → ModelsBuilder → "Generate models". Confirm `*.generated.cs` files appear under `src/UmbracoProject.Features/Models/Generated/`. Run `git status` / `git check-ignore` on one generated file to confirm it is NOT gitignored (if a `*.generated.cs` or `Models/` rule catches them, add an un-ignore exception to `src/UmbracoProject.Features/.gitignore`). Do NOT yet touch RazorCompileOnBuild or the CS0618 suppression. Stop the app, then run `dotnet build -c Release` for the solution and confirm it is clean. The site must still render — models now come from the RCL.

**What to build**:
- Edit `src/UmbracoProject/appsettings.json` — add the `Umbraco:CMS:ModelsBuilder` block (ModelsMode/ModelsDirectory/AcceptUnsafeModelsDirectory).
- Generate models → committed `.cs` under `src/UmbracoProject.Features/Models/Generated/`.
- If needed, `src/UmbracoProject.Features/.gitignore` exception so the generated models are tracked.
- Confirm `umbraco/Data/TEMP/InMemoryAuto/` remains gitignored (it just stops being the source of models).

**Validation**:
- [Automated]: `cd /Users/dkardys/Sites/umbraco-17-demo-site && dotnet build -c Release` — clean; the RCL compiles the committed models and the host resolves `PublishedModels.*` through its existing ProjectReference.
- [Manual]: `git status` shows new tracked files under `src/UmbracoProject.Features/Models/Generated/`; `git check-ignore <one-model>.generated.cs` returns nothing.
- [Manual]: With the app running, browse a model-coupled page (e.g. an article) — renders identically to before.

---

### Step 2 — Enable build-time Razor compilation (CS0618 still blanket-suppressed)

> **Prompt**: Implement Step 2 of `_plans/arch-modelsbuilder-source-mode.md` (Step 1 switched to SourceCodeManual with models committed in the RCL). In `src/UmbracoProject/UmbracoProject.csproj`, remove the `<RazorCompileOnBuild>false</RazorCompileOnBuild>` and `<RazorCompileOnPublish>false</RazorCompileOnPublish>` lines (and their now-stale "Remove … when not using ModelsMode InMemoryAuto" comment), letting Razor compile at build/publish. Leave the project-wide `CS0618` in `<NoWarn>` in place for now (this step proves build-time Razor compile *works* post-source-mode; obsolete detection is turned on in Step 3). Run `dotnet build -c Release` — Razor now compiles at build and must be clean (CS0234 is gone because models are real; CS0618 is still suppressed). Then boot the app (`cd src/UmbracoProject && dotnet run`) and confirm the backoffice loads and the public site renders — the host csproj comment notes "Razor files are needed for the backoffice to work correctly", so verify the backoffice specifically. Report build output and the manual checks.

**What to build**:
- Edit `src/UmbracoProject/UmbracoProject.csproj` — delete the two `RazorCompile*OnBuild/OnPublish = false` lines + stale comment. Keep `CopyRazorGenerateFilesToPublishDirectory=true`.

**Validation**:
- [Automated]: `dotnet build -c Release` — clean. Crucially, Razor is now compiled at build (build time will rise; that's expected). If it surfaces non-CS0618 Razor errors, that's a real finding — report it, do not blanket-suppress.
- [Manual]: Backoffice (`/umbraco`) loads and is usable; public site pages render identically.

---

### Step 3 — Turn on the obsolete-API gate: scoped pragmas + drop the blanket CS0618 suppression + retire the lint hook

> **Prompt**: Implement Step 3 of `_plans/arch-modelsbuilder-source-mode.md` (Steps 1–2: source-mode models in the RCL + build-time Razor compile, with CS0618 still blanket-suppressed). Now turn on build-time obsolete-API detection. (1) Temporarily remove `CS0618` from the `<NoWarn>` in `src/UmbracoProject/UmbracoProject.csproj` and run `dotnet build -c Release` to let the compiler enumerate the *exact* set of CS0618 sites in Razor (the ~11 files using bare `.Parent`/`.Children` are candidates, but the build is authoritative). (2) For each flagged call site, wrap it in a scoped `#pragma warning disable CS0618 … #pragma warning restore CS0618` — prefer refactoring the call into an `@{ }` block scoped with the pragma per the project idiom (see [[project_cloud_razor_ignores_nowarn]]). These grandfather the *known existing* usages; migrating them off the obsolete APIs is explicitly out of scope (that's `arch-obsolete-api-migration`). (3) With `CS0618` now removed from the project-wide `<NoWarn>` and every existing site pragma'd, `dotnet build -c Release` must be clean again. (4) Prove the gate works: temporarily add a new bare obsolete usage (e.g. `Model.Parent` without a pragma) in a scratch view, confirm `dotnet build` now FAILS with CS0618, then remove it. (5) Retire the stopgap: delete `.githooks/lint-obsolete-razor-api.sh` and remove its invocation from the pre-push/pre-commit hook wiring — but first confirm the build gate covers what the hook flagged. Report the list of pragma'd files and the red/green proof result.

**What to build**:
- Edit `src/UmbracoProject/UmbracoProject.csproj` — remove `CS0618` from `<NoWarn>` (keep `NU1903`).
- Add scoped `#pragma warning disable/restore CS0618` around each existing obsolete call site in the flagged views (~11 candidates; build-confirmed set).
- Delete `.githooks/lint-obsolete-razor-api.sh` and de-wire it from the hook script(s) that call it.

**Test first** *(detection-gate proof, not a committed test)*:
- After wiring, introduce a deliberate un-pragma'd obsolete usage → `dotnet build -c Release` must go RED with CS0618 → remove it → build GREEN. This confirms the gate before retiring the hook.

**Validation**:
- [Automated]: `dotnet build -c Release` clean with `CS0618` no longer in `<NoWarn>` and all existing sites pragma'd.
- [Automated]: deliberate-obsolete-usage build goes red (proof), then green after removal.
- [Manual]: `grep -rn "CS0618" src/UmbracoProject/UmbracoProject.csproj` shows it gone from `<NoWarn>`; `ls .githooks/lint-obsolete-razor-api.sh` is absent and no hook references it.

---

### Step 4 — Verify behavior preserved end-to-end (fresh-clone build, render, no drift)

> **Prompt**: Implement Step 4 of `_plans/arch-modelsbuilder-source-mode.md`. This is observation-only — make NO source changes. Verify the source-mode switch + build-time Razor compile changed no behavior. (1) Fresh-build proof: from a clean checkout state (`git stash` any junk; do not run the app first), `dotnet build -c Release` succeeds using only the committed RCL models — proves a teammate cloning the repo can build without generating models at runtime. (2) Boot `cd src/UmbracoProject && dotnet run`; confirm clean startup, then `git status` shows NO model regeneration/drift (SourceCodeManual must not rewrite models on boot — guards OQ4). (3) Spot-render: browse `/` and a model-coupled page (an article) and the backoffice — all behave identically to pre-change. (4) Run the test suite: `dotnet test -c Release --no-build`. (5) Run the functional search Playwright spec locally as a smoke (`PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/search.spec.ts`). Do NOT regenerate screenshot baselines. Report all results.

**What to verify**:
- Fresh `dotnet build -c Release` is green using only committed models (no runtime generation needed).
- App boots clean; `git status` clean after boot (no SourceCodeManual drift).
- `/`, an article page, and the backoffice render/behave identically.
- `dotnet test` green; `search.spec.ts` green.

**Validation**:
- [Automated]: `dotnet build -c Release` and `dotnet test -c Release --no-build` both green.
- [Automated]: `tests/e2e/search.spec.ts` passes against localhost.
- [Manual]: `git status` shows no regenerated `*.generated.cs` after a boot; pages render identically; no `*-linux.png` baseline changes.

---

### Step 5 — Record the durable architecture (fix-infra) and archive

> **Prompt**: Implement Step 5 of `_plans/arch-modelsbuilder-source-mode.md`. This is `fix-infra`, so there is NO `_features/` doc. (1) Add a `## ModelsBuilder` section to CLAUDE.md documenting: the mode is now `SourceCodeManual`; models are committed under `src/UmbracoProject.Features/Models/Generated/` in the RCL (and WHY there — RCL can't reference the host, so models must live in/below the RCL to be referenceable by future model-coupled RCL code); the namespace stays `Umbraco.Cms.Web.Common.PublishedModels`; the regenerate-on-schema-change workflow (change a doc type in the backoffice → Settings → ModelsBuilder → Generate → commit the updated `*.generated.cs`); that Cloud never auto-regenerates (SourceCodeManual) so committed models are authoritative everywhere; and that build-time Razor compilation is now ON, so `dotnet build` gates obsolete-API (`CS0618`) usage — existing usages are grandfathered with scoped pragmas and their migration is tracked as `arch-obsolete-api-migration`, and the `lint-obsolete-razor-api.sh` stopgap was retired. (2) Update the [[project_inmemoryauto_blocks_buildtime_razor]] memory to reflect that source-mode shipped and the build-time gate is now live (or mark it retired). (3) Confirm `_specs/arch-modelsbuilder-source-mode.md` carries the acceptance criteria (it does). (4) `git mv` the spec → `_specs/shipped/` and this plan → `_plans/shipped/`. (5) Update ROADMAP.md: move `arch-modelsbuilder-source-mode` to "Recently shipped" with date 2026-06-26 and a one-line summary; leave `arch-feature-folder-migration` (and `workflow-explore`) in Now. Note in the migration entry that source-mode is no longer a blocker — model-coupled RCL code can now build-time-compile.

**What to build**:
- New `## ModelsBuilder` section in CLAUDE.md (place near the existing `## Solution architecture` / `## Schema Management` sections).
- Update/retire the `project_inmemoryauto_blocks_buildtime_razor` memory.
- Archive spec + plan to `shipped/`.
- ROADMAP "Recently shipped" entry + migration-entry note.

**Validation**:
- [Manual]: CLAUDE.md `## ModelsBuilder` names the mode, the RCL models home + why, the regen workflow, the no-Cloud-regen guarantee, and the build-time obsolete-API gate + grandfathering.
- [Manual]: `_specs/shipped/arch-modelsbuilder-source-mode.md` and `_plans/shipped/arch-modelsbuilder-source-mode.md` exist; un-shipped copies gone.
- [Automated]: `dotnet build -c Release` still clean (doc/archive step shouldn't affect it; confirm nothing drifted).

---

## File Summary

| Action | File |
|--------|------|
| Modify | `src/UmbracoProject/appsettings.json` (ModelsBuilder block) |
| Create (generated, committed) | `src/UmbracoProject.Features/Models/Generated/*.generated.cs` |
| Modify *(if needed)* | `src/UmbracoProject.Features/.gitignore` (un-ignore generated models) |
| Modify | `src/UmbracoProject/UmbracoProject.csproj` (remove RazorCompileOnBuild/OnPublish=false; remove CS0618 from NoWarn) |
| Modify | ~11 Razor views in `src/UmbracoProject/Views/` (scoped `#pragma warning disable/restore CS0618`) |
| Delete | `.githooks/lint-obsolete-razor-api.sh` (+ de-wire from hook script) |
| Modify *(fix-infra)* | `CLAUDE.md` (new `## ModelsBuilder` section) |
| Modify | `~/.claude/.../memory/project_inmemoryauto_blocks_buildtime_razor.md` (update/retire) |
| Modify | `ROADMAP.md` (mark `arch-modelsbuilder-source-mode` shipped; note migration unblocked) |
| Move | `_specs/arch-modelsbuilder-source-mode.md` → `_specs/shipped/` |
| Move | `_plans/arch-modelsbuilder-source-mode.md` → `_plans/shipped/` |
