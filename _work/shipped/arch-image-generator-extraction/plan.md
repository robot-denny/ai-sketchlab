# Plan: Image Generator Service Extraction

**Spec**: `_specs/arch-image-generator-extraction.md`
**Branch**: `claude/feature/arch-image-generator-extraction`

## Context

Audit P1.3 (Pillar 2, Architectural separation): the backoffice [ImageGeneratorController](src/HelloWorld/ImageGeneratorController.cs) reaches straight for `Process.Start`, shelling out to `npx tsx scripts/image-generator/src/cli.ts` from its private `RunCli` method. That couples the HTTP adapter to a sibling repo path, the host file system, a Node binary, and shell-quoting — and makes the controller impossible to unit-test without spawning a real subprocess.

This is the second of the two P1.3 weaknesses; the first (`SearchService`) already shipped and is the template here. The recipe: define an `IImageGenerator` interface, move the existing subprocess mechanism behind one `CliImageGenerator` implementation, register it via an `IComposer`, and leave the controller as a thin HTTP adapter that depends only on the abstraction. **Observable behavior is unchanged** — the same five endpoints respond identically, the dashboard works as before, and the CLI subprocess still does the actual rendering and upload. The win is internal: a clean test seam and an anti-corruption boundary around the subprocess. The existing [dashboard.spec.ts](tests/e2e/imageGenerator/dashboard.spec.ts) is the end-to-end regression net (it already exercises controller → CLI → Umbraco, including the success and structured-error paths that would have caught the historical Win32Exception regression).

---

## Key Decisions

- **File location — flat in `src/HelloWorld/`** (not a new `Services/` subfolder). The spec's open question is resolved by the user's steer: "consider ease of migration to the `Features/` convention." The future `arch-feature-folder-migration` groups files *by feature* (`Features/ImageGenerator/`), not by layer. The controller and `PaletteService` are already flat in `src/HelloWorld/`; adding the new types flat keeps the entire image-generator cluster co-located so the eventual move into `Features/ImageGenerator/` is one clean sweep. A `Services/` subfolder would split the feature across two locations and fight that migration. Namespace stays `HelloWorld` (matching the controller and `PaletteService`). Do **not** create `Features/` here.
- **Interface shape — two explicit methods**: `Task<ImageGenerationResult> GenerateAsync(string documentId, bool force = false)` and `Task<ImageGenerationResult> GenerateBatchAsync(bool force = false)`. Mirrors the two controller actions and reads clearly (spec recommendation confirmed).
- **No `CancellationToken` on the interface.** The current controller threads none, and behavior must be byte-for-byte identical. Adding one would subtly change subprocess-abort behavior. Omitting it also keeps the NSubstitute `.Received()` assertions clean. (Revisit if a future `InProcessImageGenerator` wants cooperative cancellation.)
- **Result type — `public sealed record ImageGenerationResult(bool Success, string Output)`**, its own file (matches the `SearchResult.cs` precedent). Mockable, self-documenting; replaces the raw `(int exitCode, string output)` tuple `RunCli` returns today. The `exitCode == 0 → Success` mapping moves *into* `CliImageGenerator` (it was in the controller).
- **Subprocess-seam depth — a small `IProcessRunner` abstraction** (chosen over leaving `CliImageGenerator` E2E-only, and over a bare delegate). `IProcessRunner.RunAsync(ProcessStartInfo) → Task<ProcessRunResult?>` isolates the only un-unit-testable part (the literal `Process.Start` + stream read + wait) into a thin `DefaultProcessRunner`. Everything bug-prone — exit-code→success, stderr-append, null-process handling, the `Win32Exception` diagnostic, temp-file cleanup, and byte-for-byte argument composition — lives in `CliImageGenerator` and becomes unit-testable by substituting `IProcessRunner` (NSubstitute, matching the project's existing test style). This is "simple enough" per the spec's open question and gives strong AC4/AC7 coverage at the unit level. `DefaultProcessRunner` (pure plumbing) is covered by the E2E generate path.
- **Visibility**: `IImageGenerator`, `ImageGenerationResult`, `IProcessRunner`, `ProcessRunResult`, `CliImageGenerator` are **public** (the test project constructs/substitutes them via a direct project reference — no `InternalsVisibleTo` needed). `DefaultProcessRunner` is **internal** (only the in-assembly composer references it).
- **DI — a dedicated `ImageGeneratorComposer`** registering `IImageGenerator → CliImageGenerator` and `IProcessRunner → DefaultProcessRunner`, both `AddTransient` (matching `PaletteServiceComposer`'s transient `PaletteService`). One composer per concern — do **not** fold into `PaletteServiceComposer`.
- **Controller after refactor** depends on `IContentService`, `IContentTypeService`, `PaletteService` (still needed by `GetArticles`/`GetCategories`/`GetPalettes`), and the new `IImageGenerator`. It **drops** `IWebHostEnvironment`, `IConfiguration`, `ILogger`, the `RepoRoot` property, the entire `RunCli` method, and the `System.Diagnostics`/`System.ComponentModel` usings. `Generate`/`GenerateBatch` call the interface and shape the response.
- **Response shape stays an anonymous `new { success, output }`** in the controller (not the record returned raw). The current JSON keys are lowercase literals; keeping the anonymous projection guarantees byte-identical JSON regardless of any global `JsonSerializerOptions` casing policy. Unit tests assert the projection by serializing `OkObjectResult.Value` with `System.Text.Json` and reading `success`/`output` from the parsed `JsonDocument` (robust across the assembly boundary — avoids `dynamic`-on-internal-anonymous-type binder errors).
- **PaletteService needs no change to be testable.** `CliImageGenerator` tests construct a *real* `PaletteService` with a substituted `IPublishedContentQuery` returning an empty root — `FindImageGeneratorSettings()` returns null and `GetPaletteConfigJson()` yields the known default-palette JSON. No need to make its method `virtual`.
- **Test project reference — add an explicit `ProjectReference` to `HelloWorld.csproj`** (spec recommendation confirmed). HelloWorld types are already available transitively (test → UmbracoProject → HelloWorld), so this is for intent/clarity, not strictly required. Low risk; MSBuild dedups.
- **No new E2E spec.** [dashboard.spec.ts](tests/e2e/imageGenerator/dashboard.spec.ts) already covers the bundle structure, the `articles`/`palettes` endpoints, the end-to-end generate-success path, and the structured-error path — all of which traverse the refactored controller → `IImageGenerator` → `CliImageGenerator` → Node chain. AC8 is satisfied by confirming it stays green.

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Generator contracts, `IProcessRunner` seam, and `CliImageGenerator` (TDD)

> **Prompt**: Implement Step 1 of `_plans/arch-image-generator-extraction.md`. Work only in `src/HelloWorld/` and `tests/UmbracoProject.Tests/` — do **not** touch `ImageGeneratorController.cs` yet (the old `RunCli` path stays live and the app keeps booting on it through this step). All new types use `namespace HelloWorld`. First add a `<ProjectReference Include="../../src/HelloWorld/HelloWorld.csproj" />` to `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj`. Then create the public contracts: `IImageGenerator` (`Task<ImageGenerationResult> GenerateAsync(string documentId, bool force = false)` and `Task<ImageGenerationResult> GenerateBatchAsync(bool force = false)`), `ImageGenerationResult` (`public sealed record ImageGenerationResult(bool Success, string Output)` in its own file), `IProcessRunner` (`Task<ProcessRunResult?> RunAsync(ProcessStartInfo startInfo)`) plus `public sealed record ProcessRunResult(int ExitCode, string StandardOutput, string StandardError)` in the same file, and an **internal** `DefaultProcessRunner : IProcessRunner` that does the real `Process.Start(startInfo)` → returns null if null → reads stdout+stderr → `WaitForExitAsync()` → returns `ProcessRunResult` (dispose the process in a finally). Then write the failing unit tests in `tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs` (namespace `UmbracoProject.Tests.ImageGenerator`) per the cases below — they reference `CliImageGenerator`, which does not exist yet, so the build fails (RED). Finally implement `public sealed class CliImageGenerator : IImageGenerator` to make them pass (GREEN), porting the mechanism verbatim from the controller's current `RunCli`. Run `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj`.

**What to build** (all in `src/HelloWorld/`, namespace `HelloWorld`):
- `IImageGenerator.cs` — the two-method interface above.
- `ImageGenerationResult.cs` — `public sealed record ImageGenerationResult(bool Success, string Output);`
- `IProcessRunner.cs` — `public interface IProcessRunner { Task<ProcessRunResult?> RunAsync(ProcessStartInfo startInfo); }` and `public sealed record ProcessRunResult(int ExitCode, string StandardOutput, string StandardError);`
- `DefaultProcessRunner.cs` — `internal sealed class DefaultProcessRunner : IProcessRunner`. Body = the literal process plumbing lifted from `RunCli` lines 151–191: `Process.Start(startInfo)`; if null return null; else read `StandardOutput`/`StandardError` to end, `await WaitForExitAsync()`, return `new ProcessRunResult(process.ExitCode, stdout, stderr)`; dispose the process in a `finally`. **Let `Win32Exception` propagate** (do not catch it here — `CliImageGenerator` owns that).
- `CliImageGenerator.cs` — `public sealed class CliImageGenerator : IImageGenerator`. Constructor: `(IWebHostEnvironment env, IConfiguration configuration, PaletteService paletteService, IProcessRunner processRunner, ILogger<CliImageGenerator> logger)`. Reproduce `RunCli` exactly:
  - `RepoRoot => Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", ".."))`; `scriptPath = Path.Combine(RepoRoot, "scripts", "image-generator", "src", "cli.ts")`.
  - `GenerateAsync(id, force)` builds `args = $"--id {id}"`, appends `" --force"` if force, then calls the shared `RunCliAsync(args)`. `GenerateBatchAsync(force)` builds `args = "--batch"`, appends `" --force"` if force, then `RunCliAsync(args)`.
  - `RunCliAsync(string args)`: `var paletteTmpFile = Path.GetTempFileName();` then **a `try/finally` whose `finally` deletes the temp file if it still exists** (this single cleanup site replaces the current code's three scattered `File.Delete` calls and guarantees deletion on the normal, null-process, and launch-failure paths). Inside the `try`: write `paletteService.GetPaletteConfigJson()` to the temp file; append `$" --palette-json-file \"{paletteTmpFile}\""` to `args`; resolve `npxPath` honoring `configuration["ImageGenerator:NodeBinPath"]` with the existing `LogWarning` PATH-fallback when the dir has no `npx`; build the `ProcessStartInfo(npxPath) { Arguments = $"tsx {scriptPath} {args}", WorkingDirectory = RepoRoot, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true }`, prepending `nodeBinPath` to `psi.Environment["PATH"]` when set; then `try { result = await processRunner.RunAsync(psi); } catch (Win32Exception ex)` → `LogError` and `return new ImageGenerationResult(false, <the exact diagnostic string below>)`; if `result is null` → `return new ImageGenerationResult(false, "Failed to start CLI process")`; otherwise `output = result.StandardOutput; if (!string.IsNullOrWhiteSpace(result.StandardError)) output += "\n" + result.StandardError;` and `return new ImageGenerationResult(result.ExitCode == 0, output.Trim())`.
  - **Win32 diagnostic — preserve byte-for-byte (AC7)**: `$"Failed to launch image generator: {ex.Message}. Check ImageGenerator:NodeBinPath in appsettings.Development.json (configured: '{configuredNodeBinPath ?? "(unset — using PATH)"}')."`

**Test first** (`tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs`, namespace `UmbracoProject.Tests.ImageGenerator`):
- Setup: `Substitute.For<IWebHostEnvironment>()` with `ContentRootPath` returning a temp dir; `Substitute.For<IConfiguration>()` with `config["ImageGenerator:NodeBinPath"]` returning `null`; a **real** `PaletteService(pcq, NullLogger<PaletteService>.Instance)` where `pcq = Substitute.For<IPublishedContentQuery>()` and `pcq.ContentAtRoot()` returns an empty array (→ default-palette JSON); `Substitute.For<IProcessRunner>()`; `NullLogger<CliImageGenerator>.Instance`.
- `[Fact]` cases:
  - **ExitZero_Success_OutputIsStdout** — runner returns `ProcessRunResult(0, "rendered", "")` → result `Success == true`, `Output == "rendered"`.
  - **NonZeroExit_Failure** — runner returns `ProcessRunResult(1, "partial", "boom")` → `Success == false`, `Output == "partial\nboom"`.
  - **StderrAppendedOnSuccess** — runner returns `ProcessRunResult(0, "ok", "warning")` → `Success == true`, `Output == "ok\nwarning"`.
  - **NullProcess_Failure** — runner returns `(ProcessRunResult?)null` → `Success == false`, `Output == "Failed to start CLI process"`.
  - **Win32OnLaunch_FailsWithNodeBinPathDiagnostic** — `runner.RunAsync(Arg.Any<ProcessStartInfo>()).ThrowsAsync(new Win32Exception("no such file"))` → `Success == false`, `Output` contains `"ImageGenerator:NodeBinPath"` and `"(unset — using PATH)"`.
  - **SingleArticle_ComposesExpectedArguments** — call `GenerateAsync("1a2b3c", force: true)`; capture the `ProcessStartInfo` the runner received and assert `Arguments` starts with `"tsx "`, contains the `cli.ts` script path, contains `"--id 1a2b3c --force"`, and contains `"--palette-json-file"`. (Assert key substrings, not a brittle full-string match on the temp path — per CLAUDE.md test-resilience guidance.)
  - **PaletteTempFile_ContainsConfigJson** — inside the runner stub, parse the temp path from the psi `Arguments` (regex `--palette-json-file "(.+?)"`) and read the file **while it still exists** (the runner runs before the cleanup `finally`); assert its content equals `paletteService.GetPaletteConfigJson()`.
  - **TempFileCleanedUp_OnAllPaths** — three sub-assertions (or `[Theory]`): after a normal completion, after a null-process result, and after a `Win32Exception`, the temp path captured by the runner stub no longer exists on disk. (For the Win32 case the stub captures the path then throws.)
  - **Batch_PassesBatchFlag** — `GenerateBatchAsync(force: false)` → captured `Arguments` contains `"--batch"` and does **not** contain `"--force"`; `GenerateBatchAsync(force: true)` → contains `"--batch --force"`.
- Run: `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` — **before** `CliImageGenerator` exists this fails to compile (RED). Implement `CliImageGenerator`, re-run → all pass (GREEN).

**Validation**:
- [Automated]: `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` — all `CliImageGeneratorTests` pass (plus the pre-existing `SmokeTests`/`SearchServiceTests`).
- [Automated]: `dotnet build` — solution-wide build clean (TreatWarningsAsErrors). The new public types are referenced by the tests; `DefaultProcessRunner` is internal and referenced only by the (not-yet-created) composer, so it's fine that nothing else uses it yet.
- [Manual]: `ImageGeneratorController.cs` is **unchanged** in this step; the site still boots on the old `RunCli` path.

---

### Step 2 — Slim the controller, register via composer (TDD)

> **Prompt**: Implement Step 2 of `_plans/arch-image-generator-extraction.md`. Step 1 created `IImageGenerator`, `ImageGenerationResult`, `IProcessRunner`, `ProcessRunResult`, `DefaultProcessRunner`, and `CliImageGenerator` in `src/HelloWorld/`, all unit-tested. Now: (1) write failing controller unit tests in `tests/UmbracoProject.Tests/ImageGenerator/ImageGeneratorControllerTests.cs` that construct `new ImageGeneratorController(...)` with a substituted `IImageGenerator` — these won't compile against the current constructor (RED); (2) refactor `src/HelloWorld/ImageGeneratorController.cs` to inject `IImageGenerator` and remove all subprocess mechanism (GREEN); (3) create `src/HelloWorld/ImageGeneratorComposer.cs` registering `IImageGenerator → CliImageGenerator` and `IProcessRunner → DefaultProcessRunner`. Run `dotnet test`, then `dotnet build`, then boot the site and confirm DI resolves the controller.

**Test first** (`tests/UmbracoProject.Tests/ImageGenerator/ImageGeneratorControllerTests.cs`, namespace `UmbracoProject.Tests.ImageGenerator`):
- Construct the controller with `null!` for the three deps the generate actions never touch (`IContentService`, `IContentTypeService`, `PaletteService`) and a `Substitute.For<IImageGenerator>()` for the one they do. (Focused unit test — the nulls are stored, never dereferenced by `Generate`/`GenerateBatch`.) Use the controller's final constructor order from the refactor below.
- Helper to read the response: `var ok = Assert.IsType<OkObjectResult>(actionResult); using var doc = JsonDocument.Parse(JsonSerializer.Serialize(ok.Value));` then `doc.RootElement.GetProperty("success").GetBoolean()` / `.GetProperty("output").GetString()`.
- `[Fact]` cases:
  - **Generate_DefaultForceFalse_CallsGeneratorWithFalse** — `fake.GenerateAsync("some-id", false).Returns(new ImageGenerationResult(true, "ok"))`; `await controller.Generate("some-id")`; assert `await fake.Received(1).GenerateAsync("some-id", false)` and the response is `{ success = true, output = "ok" }`.
  - **Generate_ForceTrue_PassesForceThrough** — `await controller.Generate("xyz", force: true)`; assert `await fake.Received(1).GenerateAsync("xyz", true)`.
  - **GenerateBatch_DefaultForceFalse** — `await controller.GenerateBatch()`; assert `await fake.Received(1).GenerateBatchAsync(false)`.
  - **GenerateBatch_ForceTrue** — `await controller.GenerateBatch(force: true)`; assert `await fake.Received(1).GenerateBatchAsync(true)`.
  - **FailureResult_StillReturns200Body** — `fake.GenerateAsync(Arg.Any<string>(), Arg.Any<bool>()).Returns(new ImageGenerationResult(false, "error text"))`; `await controller.Generate("any")` → `OkObjectResult` (HTTP 200) with `success = false`, `output = "error text"`. (Failure is still a 200 body, per AC1.)
  - **NoSubprocessSpawned** — implicit/asserted by substituting the interface: the controller's only interaction is the fake; document this in a comment.
- Run: `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` — fails to compile against the current controller constructor (RED).

**What to build / modify**:
- **Modify** `src/HelloWorld/ImageGeneratorController.cs`:
  - Constructor → `(IContentService contentService, IContentTypeService contentTypeService, PaletteService paletteService, IImageGenerator imageGenerator)`. Drop `IWebHostEnvironment`, `IConfiguration`, `ILogger<ImageGeneratorController>` and their fields.
  - Delete the `RepoRoot` property and the entire `RunCli` method.
  - Remove `using System.ComponentModel;`, `using System.Diagnostics;`, `using Microsoft.AspNetCore.Hosting;`, `using Microsoft.Extensions.Configuration;`, `using Microsoft.Extensions.Logging;` (keep `Microsoft.Extensions.Configuration` **only if** still referenced — it is not after the refactor, so remove it).
  - `Generate`: `var result = await _imageGenerator.GenerateAsync(documentId, force); return Ok(new { success = result.Success, output = result.Output });`
  - `GenerateBatch`: `var result = await _imageGenerator.GenerateBatchAsync(force); return Ok(new { success = result.Success, output = result.Output });`
  - `GetPalettes`/`GetArticles`/`GetCategories` are **unchanged** (still use `PaletteService`, `IContentService`, `IContentTypeService`).
- **Create** `src/HelloWorld/ImageGeneratorComposer.cs` (namespace `HelloWorld`):
  ```csharp
  public class ImageGeneratorComposer : IComposer
  {
      public void Compose(IUmbracoBuilder builder)
      {
          builder.Services.AddTransient<IProcessRunner, DefaultProcessRunner>();
          builder.Services.AddTransient<IImageGenerator, CliImageGenerator>();
      }
  }
  ```

**Validation**:
- [Automated]: `dotnet test tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` — all controller + generator tests pass (GREEN).
- [Automated]: `dotnet build` — clean. Grep `ImageGeneratorController.cs` for `Process`, `ProcessStartInfo`, `npx`, `tsx`, `RepoRoot`, `GetTempFileName` → **zero matches** (AC2).
- [Manual]: `cd src/UmbracoProject && dotnet run` — the site boots with no DI resolution error for `ImageGeneratorController` (confirms `IImageGenerator` and `IProcessRunner` are registered).

---

### Step 3 — Confirm the dashboard regression net is green (AC5, AC8)

> **Prompt**: Implement Step 3 of `_plans/arch-image-generator-extraction.md`. The refactor is complete and the site boots. Confirm the existing Playwright regression net `tests/e2e/imageGenerator/dashboard.spec.ts` still passes against the locally-running site — this is the AC8 gate; no new spec is needed. The generate-end-to-end test spawns the real CLI and uploads a generated image, so the local environment must have Node on PATH (or `ImageGenerator:NodeBinPath` set) and a valid `OpenAI:ApiKey` in `appsettings.Development.json`. Start the site (`cd src/UmbracoProject && dotnet run`), then in another shell run the spec. Also manually exercise the dashboard in the backoffice.

**What to do** (no code deliverable — verification only):
- Start the site: `cd src/UmbracoProject && dotnet run`.
- Run the spec: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/imageGenerator/dashboard.spec.ts`.
- The spec asserts (unchanged): the compiled dashboard bundle structure, the `articles`/`palettes` endpoints return data, **`generate/{id}?force=true` returns `{ success: true, output }`** end-to-end, and **`generate/{bogus-guid}` returns `{ success: false, output }`** (HTTP 200, structured error). These traverse the refactored controller → `IImageGenerator` → `CliImageGenerator` → `DefaultProcessRunner` → Node chain, so a passing run proves the seam is wired correctly and behavior is preserved.

**Validation**:
- [Automated]: `npx playwright test tests/e2e/imageGenerator/dashboard.spec.ts` — all tests pass against a correctly-configured environment. If the generate-success test fails for lack of an OpenAI key locally, note it and rely on Gate 2 (CI against Dev) for that assertion; the structured-error and endpoint tests must still pass locally.
- [Manual]: In the backoffice **Settings → Image Generator** dashboard, pick an article, click **Generate Image** → success output appears exactly as before. Toggle **Force regenerate** and run the batch (**Generate Missing / Regenerate All**) → batch output appears.

---

### Step 4 — Verify feature behavioral spec

> **Prompt**: Run `/feature update _features/arch-image-generator-extraction.md` to verify the living behavioral spec reflects the actual implementation. Review each scenario against the code and test results. Update any scenarios where the implementation diverged from the draft. Fill in the Test Coverage table with actual test file paths and line numbers — point the controller scenarios at `tests/UmbracoProject.Tests/ImageGenerator/ImageGeneratorControllerTests.cs:Lnn`, the `CliImageGenerator` scenarios at `tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs:Lnn`, and the end-to-end/dashboard scenarios at `tests/e2e/imageGenerator/dashboard.spec.ts:Lnn`. Remove the "Draft" banner. Commit the verified feature doc.

**Validation**:
- [Manual]: Every scenario in `_features/arch-image-generator-extraction.md` maps to observable behavior or a passing test.
- [Manual]: The Test Coverage table has no unexpected "Not covered" gaps (the `InProcessImageGenerator` and palette-dedup parking-lot items remain out of scope).

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/HelloWorld/IImageGenerator.cs` |
| Create | `src/HelloWorld/ImageGenerationResult.cs` |
| Create | `src/HelloWorld/IProcessRunner.cs` (interface + `ProcessRunResult`) |
| Create | `src/HelloWorld/DefaultProcessRunner.cs` (internal) |
| Create | `src/HelloWorld/CliImageGenerator.cs` |
| Create | `src/HelloWorld/ImageGeneratorComposer.cs` |
| Modify | `src/HelloWorld/ImageGeneratorController.cs` |
| Modify | `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj` (add HelloWorld `ProjectReference`) |
| Create | `tests/UmbracoProject.Tests/ImageGenerator/CliImageGeneratorTests.cs` |
| Create | `tests/UmbracoProject.Tests/ImageGenerator/ImageGeneratorControllerTests.cs` |
| Create/Update | `_features/arch-image-generator-extraction.md` |
