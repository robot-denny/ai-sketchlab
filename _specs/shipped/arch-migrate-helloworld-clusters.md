# Spec for arch-migrate-helloworld-clusters

> This spec captures initial requirements and design rationale. This is a `fix-infra` slice — its durable record is the CLAUDE.md *Solution architecture* section. The Image Generator capability behavior is unchanged, so [_features/image-generator.md](../_features/image-generator.md) is not modified.

branch: claude/feature/arch-migrate-helloworld-clusters
**Work type**: fix-infra — architectural relocation/tidy decision, no standing behavior change; see CLAUDE.md → Workflow layers → "Work types"

## Summary

Step (4) of `arch-feature-folder-migration`: resolve the **end-state** of `HelloWorld`'s ImageGenerator + Palettes C# clusters relative to the `UmbracoProject.Features` RCL. The ROADMAP explicitly marks this end-state **TBD** — unlike steps (2)/(3), which were clear host→RCL moves, this slice's central deliverable is a *decision*, then only the scoped work that decision implies.

**This spec's primary output is the (a)-vs-(b) decision below.** **DECIDED (2026-06-30): (b)-decline** — keep HelloWorld's C# in HelloWorld, move no code, and record the rationale so step (4) closes and isn't reopened. The implementation is therefore documentation-only (CLAUDE.md + ROADMAP); see the Recommendation and Acceptance Criteria for the (b)-decline scope.

### What's actually there (investigated)

`HelloWorld` is a **distinct backoffice-extension project** (`Microsoft.NET.Sdk.Razor`, its own `PackageId`/`Product`/`Title` for NuGet packaging, a TypeScript + Vite `Client/` frontend, and an auto-generated OpenAPI client). Its C# surface is 11 flat files at the project root, in two clusters plus shared plumbing:

- **ImageGenerator cluster**: `ImageGeneratorController` (a **Management API controller** — `[Route("umbraco/api/image-generator")]`, `[ApiController]`, `Umbraco.Cms.Web.Common.Authorization`; this is the backend the TS frontend's OpenAPI client calls), `CliImageGenerator` + `IImageGenerator` (the seam shipped in `arch-image-generator-extraction`), `IProcessRunner`/`DefaultProcessRunner`, `ImageGenerationResult`/`ProcessRunResult`, `ImageGeneratorComposer`.
- **Palettes cluster**: `PaletteService` (reads palette config from published content/blocks — `Umbraco.Cms.Core.Models.Blocks`), `PaletteServiceComposer`.
- **Shared**: `Constants`.

Key coupling facts: the controller is intrinsically backoffice-extension-specific (Management API surface + OpenAPI-client contract); the generator/palette logic exists **only** to serve that one backoffice feature; and **`HelloWorld` currently has no `ProjectReference` to `UmbracoProject.Features`**.

## Functional Requirements

- Investigate and document the HelloWorld C# surface (done above) so the end-state decision is evidence-based, not assumed.
- Decide between:
  - **(a) Relocate** the ImageGenerator/Palettes C# (or the non-controller business logic) into the `UmbracoProject.Features` RCL.
  - **(b) Keep in HelloWorld**, optionally with a light internal by-kind tidy (group the 11 flat root files into `ImageGenerator/`, `Palettes/`, `Composer/` folders within HelloWorld), or formally **decline** any move and close step (4) as "no relocation warranted."
- Whatever is chosen: **behavior is preserved** — the image generator and palette features keep working, and the existing unit tests (`CliImageGeneratorTests`, `ImageGeneratorControllerTests`, plus any palette tests) stay green.
- Record the decision and its rationale in CLAUDE.md so step (4) is closed and not re-litigated.

### Recommendation: (b) — keep the C# in HelloWorld; do NOT relocate into the RCL

Rationale (to be confirmed by the user before planning):

1. **HelloWorld is a self-contained backoffice-extension package, not site business logic.** The agency-standard reference (`Kittitas.Features`) RCL holds the *site's* business logic; a backoffice extension with its own frontend, OpenAPI client, and NuGet packaging metadata is a different kind of artifact. CLAUDE.md already says "HelloWorld remains a distinct backoffice-extension project; it is not merged into the Features RCL."
2. **Relocating would *reduce* cohesion.** The image-generator feature is currently cohesive in one project (controller + generator + palette + frontend). Splitting the logic into the RCL while the controller/frontend stay in HelloWorld scatters one feature across two projects and forces a new `HelloWorld → UmbracoProject.Features` dependency — the opposite of the resilience the Pillar 2 push rewards.
3. **The compile-enforced-boundary goal is already met.** HelloWorld is its own compiled project (a boundary from the host), and the image-generation logic already sits behind the `IImageGenerator` seam (shipped in `arch-image-generator-extraction`), making the controller unit-testable. There is no untested-business-logic-in-the-host problem here for the RCL to solve.
4. **Lowest marginal churn.** Option (b) is either zero code movement (decline) or a HelloWorld-internal folder tidy that touches no project boundaries.

If the user wants taxonomy consistency, the **light internal tidy** variant of (b) is the middle ground: mirror the by-kind folders *inside* HelloWorld without introducing any cross-project reference.

## Possible Edge Cases

- **Controller cannot cleanly move regardless**: `ImageGeneratorController` is a Management API controller wired to the OpenAPI client the TS frontend depends on; moving it out of HelloWorld would break the extension's frontend contract. So even under option (a), the controller stays — meaning (a) necessarily splits the feature.
- **New cross-project dependency under (a)**: relocating logic into the RCL adds `HelloWorld → UmbracoProject.Features`. That must be validated against Cloud's CI/CD Flow (no wildcard versions — see `[[project_cloud_no_wildcard_versions]]`) and must not create a reference cycle (the RCL must not reference HelloWorld).
- **`dotnet publish` collision surface** (`[[project_rcl_host_schema_publish_collision]]`): any project-reference change in this graph must be verified with `dotnet publish -c Release`, not just `dotnet build`.
- **Internal-tidy churn vs git history**: a HelloWorld folder reorg is pure `git mv` + namespace adjustments; namespaces today are flat `HelloWorld` — folder-mirrored namespaces (`HelloWorld.ImageGenerator`, etc.) would touch every `using`/reference, a larger diff than its value may justify. The decline variant avoids this entirely.
- **Tests must stay green**: `tests/UmbracoProject.Tests/` references HelloWorld; any namespace change ripples into `CliImageGeneratorTests` / `ImageGeneratorControllerTests`.

## Acceptance Criteria

- The (a)-vs-(b) end-state decision is made, recorded in CLAUDE.md (*Solution architecture*), and the ROADMAP `arch-feature-folder-migration` step (4) is closed/updated to reflect it.
- Whatever scope the decision implies is implemented with **behavior preserved**: the image generator still produces images and the palette features still work; `dotnet build -c Release` is clean (warnings-as-errors) and `dotnet test` stays green (incl. `CliImageGeneratorTests`, `ImageGeneratorControllerTests`).
- If **(b)-decline**: no code moves; CLAUDE.md records *why* HelloWorld's C# stays put (cohesion + it's a packaged extension, not site logic), so the question isn't reopened.
- If **(b)-tidy**: files are grouped into by-kind folders *within* HelloWorld with namespaces/`using`s updated consistently; no new cross-project reference; no `.uda` change.
- If **(a)**: only the agreed non-controller logic moves to the RCL; the `HelloWorld → UmbracoProject.Features` reference is added and validated with `dotnet publish -c Release`; the controller stays in HelloWorld.
- No `.uda` schema files change (C#-only slice).
- No new `_features/` doc; `_features/image-generator.md` is untouched (behavior unchanged).

## Scenarios (Draft)

Draft BDD scenarios. As a `fix-infra` slice there is no `_features/` doc; the Image Generator behavior contract already lives in `_features/image-generator.md` and the existing unit tests.

### Rule: The end-state decision is made and recorded so step (4) closes

```scenario
Scenario: A developer reads CLAUDE.md after this slice
  Given the HelloWorld clusters' end-state has been decided
  When a developer reads the Solution architecture section
  Then it states whether HelloWorld's C# stays in HelloWorld or moved to the RCL
  And it gives the rationale, so the decision is not re-litigated
```

### Rule: The image generator and palettes keep working regardless of decision

```scenario
Scenario: Generating a featured image still works
  Given the agreed relocation/tidy (or decline) has shipped
  When an editor triggers the image generator from the backoffice
  Then a featured image is produced as before

Scenario: The unit-test safety net stays green
  Given the change has been applied
  When dotnet build -c Release and dotnet test run
  Then both succeed, including CliImageGeneratorTests and ImageGeneratorControllerTests
```

### Rule: No cohesion-reducing split is introduced unintentionally

```scenario
Scenario: The Management API controller stays with its frontend contract
  Given the image-generator feature includes a Management API controller the OpenAPI client targets
  When the end-state is applied
  Then ImageGeneratorController remains in HelloWorld
  And the extension's frontend continues to call it unchanged
```

## Open Questions

- ~~**THE decision (blocking /plan): (a) relocate logic into the RCL, (b)-tidy within HelloWorld, or (b)-decline?**~~ **RESOLVED 2026-06-30: (b)-decline** (user-confirmed). No code moves; the deliverable is the recorded rationale in CLAUDE.md + the closed ROADMAP step (4).
- If (b)-tidy: is the by-kind folder grouping inside HelloWorld worth the namespace-churn diff (every `HelloWorld.*` reference + test), or is flat-root acceptable for a small 11-file extension?
- Does closing step (4) as "decline" also let us close/clarify the related deferral note on `arch-image-generator-extraction` (which mentions a "Features/-convention relocation remains tracked under arch-feature-folder-migration")?

## Testing Guidelines

This slice is decision-led; testing is about *not regressing* the image-generator/palette features, not adding new coverage:

- Rely on the existing `tests/UmbracoProject.Tests/` suite (`CliImageGeneratorTests`, `ImageGeneratorControllerTests`, palette tests if present) as the regression net — it must stay green after any move/tidy.
- If option (a) or (b)-tidy changes namespaces, update the test `using`s only; do not rewrite test logic.
- No new test project. If the decision is (b)-decline, there is no code change to test — the deliverable is the recorded rationale.
