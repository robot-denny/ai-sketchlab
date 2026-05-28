# Feature: Image Generator Service Extraction

A CMS editor generates featured images for articles from the backoffice image-generator dashboard, exactly as before. Nothing the editor sees changes. Behind the scenes, the way images are produced now sits behind a defined service boundary instead of being wired directly into the request handler — so the behavior can be tested in isolation and, later, swapped for an implementation that needs no external tooling.

**Source spec**: `_specs/arch-image-generator-extraction.md`
**Last verified**: 2026-05-28

---

## Increments

The per-feature mini-roadmap: shipped increments + planned increments + parking-lot ideas. Newest planned items first.

- [x] 2026-05-28 — v1: Introduce `IImageGenerator` + `CliImageGenerator`, register via composer, slim the controller (spec: `_specs/arch-image-generator-extraction.md`, plan: `_plans/arch-image-generator-extraction.md`)
- [ ] Parking lot — `InProcessImageGenerator`: render flow-field PNGs in C# with no Node dependency (no spec yet)
- [ ] Parking lot — de-duplicate palette/metadata logic shared between `PaletteService.cs` and `palette.ts` (no spec yet)

---

## Behaviors

Scenarios are grouped by Rule. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

### Rule: The backoffice generate endpoints behave identically after the refactor

```scenario
Scenario: CMS editor generates one article's image from the dashboard
  Given the image-generator dashboard lists at least one published article
  When the editor clicks Generate for that article with force on
  Then the generate endpoint returns HTTP 200 with success true
  And the output contains a CLI completion marker (matches /Done:|generated/i)
```

```scenario
Scenario: CMS editor runs a batch generate with force on
  Given the dashboard's "Force regenerate" toggle is on
  When the editor clicks "Generate Missing / Regenerate All"
  Then the controller calls IImageGenerator.GenerateBatchAsync with force true
  And CliImageGenerator invokes the CLI with "--batch --force"
  And the dashboard shows the same batch output it showed before the refactor
```

```scenario
Scenario: Generation fails and the editor still sees the error text
  Given the CLI will exit non-zero for the chosen article (e.g. a non-existent document id)
  When the editor clicks Generate
  Then the request still returns HTTP 200
  And the body is { success: false, output: "<error text>" }
  And the dashboard shows the failure output
```

### Rule: The controller holds no subprocess mechanism

```scenario
Scenario: Code review of ImageGeneratorController after the refactor
  Given the refactor is complete
  When a reviewer reads ImageGeneratorController.cs
  Then they see no Process or ProcessStartInfo usage
  And they see no npx or tsx argument strings
  And they see no RepoRoot property or GetTempFileName temp-file handling
  And the Generate and GenerateBatch actions call IImageGenerator and return its result
```

### Rule: CliImageGenerator reproduces the current mechanism exactly

```scenario
Scenario: The CLI is invoked with the same arguments as before
  Given an editor generates the article with document id "1a2b3c" with force on
  When CliImageGenerator runs
  Then it invokes the same cli.ts script under scripts/image-generator/src/
  And it passes "--id 1a2b3c --force" plus a "--palette-json-file" pointing at a temp file
  And the temp file contains the CMS palette config JSON (PaletteService.GetPaletteConfigJson)
```

```scenario
Scenario: The palette temp file is always cleaned up
  Given any generate request completes, fails to launch (Win32Exception), or returns a null process
  When CliImageGenerator finishes
  Then the palette temp file it created no longer exists on disk
```

### Rule: The generator is registered via a composer and the dashboard works

```scenario
Scenario: Site boots cleanly and the dashboard generates end-to-end
  Given the refactor is complete and ImageGeneratorComposer registers IImageGenerator and IProcessRunner as Transient
  When the site is built and started locally
  Then the image-generator dashboard loads its article list
  And clicking Generate for an article produces an image as before
```

### Rule: The controller is unit-testable with a fake generator

```scenario
Scenario: Unit test drives the controller with a fake IImageGenerator
  Given a test provides a substitute IImageGenerator that records its calls
  When the test calls Generate with document id "xyz" and force true
  Then the fake records a single-article generation for "xyz" with force true
  And the controller returns the fake's result as { success, output }
  And no subprocess is spawned (the controller no longer depends on Process or IWebHostEnvironment)
```

---

## Edge Cases

### Rule: Launch failure produces the same diagnostic as today

```scenario
Scenario: Node binary is missing on the host
  Given no npx binary can be found on PATH and ImageGenerator:NodeBinPath is unset
  When an editor triggers a generate
  Then the result is marked failed
  And the output names "ImageGenerator:NodeBinPath" and reports "(unset — using PATH)"
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| CMS editor generates one article's image from the dashboard | [tests/e2e/imageGenerator/dashboard.spec.ts:141](tests/e2e/imageGenerator/dashboard.spec.ts#L141) | Covered (live end-to-end: controller → CLI → Umbraco) |
| CMS editor runs a batch generate with force on | [tests/UmbracoProject.Tests/ImageGenerator/ImageGeneratorControllerTests.cs:75](tests/UmbracoProject.Tests/ImageGenerator/ImageGeneratorControllerTests.cs#L75), [tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs:213](tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs#L213) | Not covered (e2e gap) — controller unit `:75` (`GenerateBatch_ForceTrue_PassesForceThroughToGenerator`) proves the controller forwards `force`; CLI unit `:213` (`Batch_PassesBatchFlag_WithForce`) proves the generator emits `--batch --force`. No E2E exercises `/generate/batch` end-to-end. Future increment: extend `dashboard.spec.ts` with a batch round-trip. |
| Generation fails and the editor still sees the error text | [tests/e2e/imageGenerator/dashboard.spec.ts:173](tests/e2e/imageGenerator/dashboard.spec.ts#L173), [tests/UmbracoProject.Tests/ImageGenerator/ImageGeneratorControllerTests.cs:100](tests/UmbracoProject.Tests/ImageGenerator/ImageGeneratorControllerTests.cs#L100) | Covered (e2e `generate endpoint returns structured error for a non-existent article` + unit `FailureResult_StillReturns200Body`) |
| Code review of ImageGeneratorController after the refactor | — | Structural — verified manually against [src/HelloWorld/ImageGeneratorController.cs](src/HelloWorld/ImageGeneratorController.cs): no `Process` / `ProcessStartInfo` / `npx` / `tsx` / `RepoRoot` / `GetTempFileName` after refactor; constructor takes `IImageGenerator`; `Generate` and `GenerateBatch` are two-line adapters over `_imageGenerator.GenerateAsync` / `GenerateBatchAsync`. Confirmed via grep during Step 2 validation. |
| The CLI is invoked with the same arguments as before | [tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs:117](tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs#L117), [tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs:131](tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs#L131) | Covered (`SingleArticle_ComposesExpectedArguments` + `PaletteTempFile_ContainsConfigJson`) |
| The palette temp file is always cleaned up | [tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs:153](tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs#L153), [tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs:169](tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs#L169), [tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs:185](tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs#L185) | Covered — three facts: `TempFileCleanedUp_OnNormalCompletion`, `TempFileCleanedUp_OnNullProcess`, `TempFileCleanedUp_OnWin32Exception` |
| Site boots cleanly and the dashboard generates end-to-end | [tests/e2e/imageGenerator/dashboard.spec.ts:141](tests/e2e/imageGenerator/dashboard.spec.ts#L141) | Covered — Playwright 9/9 against the locally-running site in Step 3, including the live `/generate/{id}?force=true` round-trip |
| Unit test drives the controller with a fake IImageGenerator | [tests/UmbracoProject.Tests/ImageGenerator/ImageGeneratorControllerTests.cs:23](tests/UmbracoProject.Tests/ImageGenerator/ImageGeneratorControllerTests.cs#L23) | Covered — constructor and all six facts substitute `IImageGenerator` via NSubstitute; the three other constructor deps are passed as `null!` because the generate actions never touch them |
| Node binary is missing on the host | [tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs:105](tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs#L105) | Covered (`Win32OnLaunch_FailsWithNodeBinPathDiagnostic`) |

---

## Revision Notes

- 2026-05-27: Draft scenarios from initial spec.
- 2026-05-28: Verified against the shipped implementation. Filled in the Test Coverage table with file:line references to `tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs` (12 unit tests), `tests/UmbracoProject.Tests/ImageGenerator/ImageGeneratorControllerTests.cs` (6 unit tests), and `tests/e2e/imageGenerator/dashboard.spec.ts` (8 dashboard tests, including the two added live-pipeline tests). Removed the "Draft" banner; flipped the v1 increment checkbox and linked the plan. Tightened a few scenario steps to match the implementation that shipped: the controller-review scenario now names `RepoRoot` and `GetTempFileName` explicitly (the two specific properties/calls deleted in Step 2); the composer-registration scenario names `ImageGeneratorComposer` and the Transient lifetime decision (Singleton would capture the Scoped `IPublishedContentQuery` chain via `PaletteService`); the temp-file-cleanup scenario reads "fails to launch (Win32Exception), or returns a null process" rather than the looser draft wording, matching the three concrete `TempFileCleanedUp_*` facts; the Node-missing edge case quotes the exact diagnostic substring `(unset — using PATH)` asserted in the unit test. Marked the batch-with-force scenario as **"Not covered (e2e gap)"** — the dashboard spec exercises single-article generate end-to-end but never hits `/generate/batch`. Unit tests prove the controller forwards `force` and the generator emits `--batch --force`, but the full HTTP → controller → generator → CLI chain is not exercised for the batch path. Filed as a future increment (extend `dashboard.spec.ts` with a batch round-trip).
