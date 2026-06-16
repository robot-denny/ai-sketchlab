# Spec for arch-image-generator-extraction

> This spec captures initial requirements and design rationale. This was a behind-the-scenes refactor of an existing capability, not a new one — its operator-facing behavior was folded into `_features/image-generator.md` on 2026-06-16. The refactor's architecture acceptance criteria (`IImageGenerator`/`CliImageGenerator` boundary, controller holds no subprocess, composer registration, unit-testability, CLI-argument and temp-file-cleanup contracts) remain below as the historical record.

branch: claude/feature/arch-image-generator-extraction

## Summary

Put an `IImageGenerator` interface between `ImageGeneratorController` and the way images are actually produced. Today the controller reaches straight for `Process.Start`, shelling out to `npx tsx scripts/image-generator/src/cli.ts` with hand-built argument strings. That couples the backoffice API to a sibling repo path, the host file system, a Node binary on `PATH`, and shell-quoting concerns — and it makes the controller impossible to unit-test, because exercising it spawns a real subprocess.

This is the second of the two Pillar 2 (Architectural separation) weaknesses the 2026-05 architecture audit named (P1.3). The first — business logic trapped in `Views/search.cshtml` — already shipped as `SearchService`. This feature follows the same recipe: define an interface, move the existing mechanism behind one implementation that satisfies it, register it through an `IComposer`, and leave the controller as a thin HTTP adapter that depends only on the abstraction.

The **observable behavior of the backoffice image generator is unchanged**: the same `GET /palettes`, `GET /articles`, `GET /categories`, `POST /generate/{documentId}`, and `POST /generate/batch` endpoints respond identically, the dashboard works exactly as before, and the CLI subprocess still does the actual rendering and upload. The win is internal — a clean test seam, an anti-corruption boundary around the subprocess, and a defined migration path toward an in-process generator that doesn't need Node at all.

Out of scope (deliberate, deferrable to future increments):
- An `InProcessImageGenerator` that renders flow-field PNGs in C# with no Node dependency. This feature only creates the seam that makes that swap cheap later; the actual port of the flow-field/canvas/palette logic from TypeScript to C# is a separate, much larger increment.
- The `Features/` folder migration (`arch-feature-folder-migration` on the roadmap). This feature seeds the service-extraction pattern in `src/HelloWorld/`; the physical relocation of Search → ImageGenerator → Articles into per-feature folders is tracked separately.
- Any change to the CLI tool itself (`scripts/image-generator/`), its rendering pipeline, or its Umbraco Management API upload flow.
- Removing the duplicated palette/metadata logic that lives in both `PaletteService.cs` (C#) and `palette.ts` (TypeScript). Noted by the audit but not part of this seam.

## Functional Requirements

- An `IImageGenerator` interface defines the two generation operations the controller needs today: generate for a single article (by document id, with a `force` flag) and generate for the whole batch (with a `force` flag). Each returns a result carrying at minimum a success flag and the captured output text the dashboard displays.
- A single implementation, `CliImageGenerator`, contains the subprocess mechanism currently inlined in `ImageGeneratorController.RunCli`: resolving the CLI script path under the repo root, writing the CMS palette config to a temp file, resolving the Node/npx binary (honoring the `ImageGenerator:NodeBinPath` config with the existing PATH fallback), starting the process, capturing stdout/stderr, awaiting exit, and cleaning up the temp file.
- `ImageGeneratorController` depends on `IImageGenerator` (constructor-injected). The controller's `Generate` and `GenerateBatch` actions call the interface and shape the HTTP response; they contain no `Process`, `ProcessStartInfo`, `Path.Combine` against the repo root, or temp-file handling.
- The implementation is registered through an `IComposer`, matching the project's DI discipline (`SearchServiceComposer.cs`, `PaletteServiceComposer.cs`).
- All current failure handling is preserved by `CliImageGenerator`, not the controller: a `Win32Exception` when the binary can't be launched returns a failed result with the same diagnostic message (naming `ImageGenerator:NodeBinPath` and whether it was set); a null process returns a failed result; a non-zero exit code returns `success = false` with the combined output; the palette temp file is always deleted, including on the launch-failure and null-process paths.
- The `GetPalettes`, `GetArticles`, and `GetCategories` endpoints are unchanged — they remain in the controller and continue to use `PaletteService`, `IContentService`, and `IContentTypeService` directly. This feature only abstracts the *generation* mechanism.
- `CliImageGenerator` is structured so the controller and the generator are independently testable: the controller can be unit-tested against a fake `IImageGenerator`, and the subprocess-launching seam inside `CliImageGenerator` is isolated enough that a test can assert the result-shaping logic (exit-code → success, stderr appended to output, temp-file cleanup) without depending on a real Node install.
- The site builds, boots, and the backoffice image-generator dashboard behaves identically after the refactor — verified by a build, a boot, and an exercise of the generate endpoints (the existing Playwright `imageGenerator/dashboard.spec.ts` is the regression net).

## Possible Edge Cases

- **Node/npx not installed or not on PATH**: `Process.Start` throws `Win32Exception`. The result is a failed `IImageGenerator` result whose output names `ImageGenerator:NodeBinPath` and reports whether it was configured — identical to today's message.
- **`ImageGenerator:NodeBinPath` configured but the directory has no `npx`**: a warning is logged and the implementation falls back to `npx` on PATH (current behavior preserved).
- **CLI exits non-zero** (e.g. the article id doesn't exist, OpenAI key missing, render error): the result is `success = false` with the combined stdout+stderr text; the controller still returns HTTP 200 with that body, exactly as today.
- **CLI writes to stderr but exits zero** (warnings): stderr is appended to stdout in the output, exit code 0 → `success = true` (current behavior).
- **Temp palette file cleanup on every path**: launch failure, null process, and normal completion all delete the temp file. A leak here is a regression.
- **`force` flag plumbing**: `force = true` appends `--force`; `force` defaults to `false`. Single-article passes `--id {documentId}`; batch passes `--batch`. Argument composition moves into `CliImageGenerator` but the resulting CLI invocation is byte-for-byte what the controller built before.
- **Concurrent generate requests**: out of scope to change. Behavior matches today (each request spawns its own subprocess and its own temp file).

## Acceptance Criteria

- **AC1**: `POST /generate/{documentId}` and `POST /generate/batch` return the same response shape (`{ success, output }`) and the same HTTP status as before the refactor, for the same inputs (success, non-zero exit, and launch-failure cases all preserved).
- **AC2**: `ImageGeneratorController` contains no `Process`, `ProcessStartInfo`, no `npx`/`tsx` argument construction, no repo-root path resolution for the CLI script, and no palette temp-file handling. It calls `IImageGenerator` and shapes the HTTP response.
- **AC3**: An `IImageGenerator` interface exists with operations for single-article generation (document id + force) and batch generation (force), each returning a result carrying a success flag and the captured output.
- **AC4**: `CliImageGenerator` implements `IImageGenerator` and reproduces the current subprocess mechanism exactly: same script path, same palette-temp-file approach, same `NodeBinPath`/PATH resolution, same stdout+stderr capture, same exit-code-to-success mapping, same temp-file cleanup on all paths.
- **AC5**: The generator is registered via an `IComposer`; the site boots cleanly and the backoffice dashboard generates an image end-to-end after the refactor.
- **AC6**: The controller is unit-testable with a fake `IImageGenerator` — a test can assert that `Generate("some-id", force: true)` calls the generator with the right arguments and returns the generator's result as `{ success, output }`, with no subprocess spawned.
- **AC7**: A `Win32Exception` on launch produces a failed result whose output names `ImageGenerator:NodeBinPath` and whether it was configured — same diagnostic as today.
- **AC8**: The existing Playwright `imageGenerator/dashboard.spec.ts` regression coverage still passes against a correctly-configured environment (or its expectations are unchanged), confirming the dashboard behavior is preserved.

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation. The operator-facing behavior is recorded in `_features/image-generator.md`; the architecture criteria stay in this spec.

### Rule: The backoffice generate endpoints behave identically after the refactor (AC1)

```scenario
Scenario: CMS editor generates one article's image from the dashboard
  Given the image-generator dashboard lists an article "The Future of Sustainable Tech"
  When the editor clicks Generate for that article
  Then the dashboard shows the same success output it showed before the refactor
  And a new featured image is produced for that article
```

```scenario
Scenario: CMS editor runs a batch generate with force on
  Given the dashboard's "Force regenerate" toggle is on
  When the editor clicks "Generate Missing / Regenerate All"
  Then every article is regenerated
  And the dashboard shows the same batch output it showed before the refactor
```

```scenario
Scenario: Generation fails and the editor still sees the error text
  Given the CLI will exit non-zero for the chosen article
  When the editor clicks Generate
  Then the dashboard shows the failure output
  And the request still returns successfully with success marked false
```

### Rule: The controller holds no subprocess mechanism (AC2, AC3)

```scenario
Scenario: Code review of ImageGeneratorController after the refactor
  Given the refactor is complete
  When a reviewer reads ImageGeneratorController.cs
  Then they see no Process or ProcessStartInfo usage
  And they see no npx or tsx argument strings
  And they see no temp-file handling for the palette config
  And the Generate and GenerateBatch actions call IImageGenerator and return its result
```

### Rule: CliImageGenerator reproduces the current mechanism exactly (AC4)

```scenario
Scenario: The CLI is invoked with the same arguments as before
  Given an editor generates the article with document id "1a2b3c" with force on
  When CliImageGenerator runs
  Then it invokes the same cli.ts script under the repo root
  And it passes "--id 1a2b3c --force" plus a "--palette-json-file" pointing at a temp file
  And the temp file contains the CMS palette config JSON
```

```scenario
Scenario: The palette temp file is always cleaned up
  Given any generate request completes, fails to launch, or returns no process
  When CliImageGenerator finishes
  Then the palette temp file it created no longer exists on disk
```

### Rule: The generator is registered via a composer and the dashboard works (AC5, AC8)

```scenario
Scenario: Site boots cleanly and the dashboard generates end-to-end
  Given the refactor is complete and IImageGenerator is registered via a composer
  When the site is built and started locally
  Then the image-generator dashboard loads its article list
  And clicking Generate for an article produces an image as before
```

### Rule: The controller is unit-testable with a fake generator (AC6)

```scenario
Scenario: Unit test drives the controller with a fake IImageGenerator
  Given a test provides a fake IImageGenerator that records its calls
  When the test calls Generate with document id "xyz" and force true
  Then the fake records a single-article generation for "xyz" with force true
  And the controller returns the fake's result as success and output
  And no subprocess is spawned
```

### Rule: Launch failure produces the same diagnostic as today (AC7)

```scenario
Scenario: Node binary is missing on the host
  Given no npx binary can be found on PATH and ImageGenerator:NodeBinPath is unset
  When an editor triggers a generate
  Then the result is marked failed
  And the output names ImageGenerator:NodeBinPath and reports it was unset
```

## Open Questions

- **Where do `IImageGenerator` and `CliImageGenerator` live?** The `SearchService` precedent put the abstraction in `src/UmbracoProject/Services/`, but the image-generator controller and `PaletteService` live in `src/HelloWorld/` (flat, no `Services/` subfolder). Recommend co-locating with the controller — either flat in `src/HelloWorld/` like `PaletteService`, or a new `src/HelloWorld/Services/` folder to seed the convention there. The roadmap frames this as "the second native inhabitant of the new `Features/` convention," but that folder doesn't exist yet (`arch-feature-folder-migration` introduces it later) — so don't pre-create `Features/` here. Flag for `/plan` to choose between flat-HelloWorld and `HelloWorld/Services/`. --yes, let's just consider ease of migration to 'Features/' convention in the future when choosing.
- **Test project reference**: `tests/UmbracoProject.Tests` currently references only `UmbracoProject.csproj`. `HelloWorld` is available transitively (UmbracoProject references it), but a direct `ProjectReference` to `HelloWorld` would make intent explicit for the new controller/generator tests. Recommend adding the direct reference. Confirm during `/plan`.
- **Result type shape**: the controller returns `{ success, output }`. Recommend `IImageGenerator` return a small record (e.g. `ImageGenerationResult(bool Success, string Output)`) rather than a raw tuple, so the type is mockable and self-documenting. Decide naming during `/plan`.
- **Interface method shape**: one method with a mode/parameters vs two methods (`GenerateAsync(documentId, force)` and `GenerateBatchAsync(force)`)? Recommend two explicit methods — it mirrors the two controller actions and reads clearly. Confirm during `/plan`.
- **How far to push subprocess-seam testability**: fully extracting an `IProcessRunner` abstraction (so `CliImageGenerator`'s result-shaping is testable without Node) is cleaner but adds a second seam. Recommend keeping `CliImageGenerator` thin and testing the result-shaping logic via an injected process-runner delegate *only if it stays simple*; otherwise leave `CliImageGenerator` covered by the E2E/dashboard path and unit-test the controller against the `IImageGenerator` fake. Decide the depth during `/plan` — the audit's stated win (a fake/stub at the `IImageGenerator` boundary) is satisfied by AC6 alone.
- **xUnit project status**: the test project already exists (`tests/UmbracoProject.Tests`, with `SearchServiceTests`) using xUnit + NSubstitute, so unit tests can be written and run immediately — unlike the `extract-search-service` spec, there's no "tests written but dormant" caveat here.

## Testing Guidelines

Create the following tests in the appropriate folders.

**Unit tests** (`tests/UmbracoProject.Tests`, xUnit + NSubstitute — same project as `SearchServiceTests`):

- `ImageGeneratorController` with a fake/substitute `IImageGenerator`:
  - `Generate("some-id")` calls the single-article generation with that id and `force = false`, returns the fake's result as `{ success, output }`.
  - `Generate("some-id", force: true)` passes `force = true` through.
  - `GenerateBatch()` calls batch generation with `force = false`; `GenerateBatch(force: true)` passes `force = true`.
  - The controller returns HTTP 200 with the generator's `success`/`output` even when `success = false` (failure path is still a 200 body).
  - No subprocess is spawned (guaranteed by substituting the interface — assert the substitute was called, not a process).
- `CliImageGenerator` result-shaping (only to the depth chosen in the open-question resolution):
  - Exit code 0 → `success = true`; non-zero → `success = false`.
  - stderr is appended to stdout in the combined output.
  - The palette temp file is cleaned up on the normal, null-process, and launch-failure paths.
  - A simulated `Win32Exception` on launch yields a failed result whose output names `ImageGenerator:NodeBinPath`.

**E2E tests** (Playwright, `tests/e2e/`):

- The existing `tests/e2e/imageGenerator/dashboard.spec.ts` is the regression net — confirm it still passes (or its assertions are unchanged) after the refactor against a correctly-configured environment. No new E2E spec is required for this seam unless `/plan` finds a coverage gap in the dashboard generate flow.
