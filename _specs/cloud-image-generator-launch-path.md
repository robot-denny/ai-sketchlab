# Spec for cloud-image-generator-launch-path

> This spec captures initial requirements and design rationale. For **current system behavior**, see `_features/image-generator.md` (the existing image-generator feature doc).

branch: _(not yet)_

## Summary

Make the [image generator](_features/image-generator.md) actually work on Umbraco Cloud — currently it fails the moment `CliImageGenerator` tries to spawn `npx tsx scripts/image-generator/src/cli.ts`, **before any OpenAI call**. This was discovered during `fix-e2e-dev-only-failures` Step 1 (2026-05-29): the original hypothesis "Dev's `OPENAI__APIKEY` Cloud Secret is unset/invalid" was wrong. The real failure is a Cloud-runtime Node-launch-path gap that the original feature shipped without ever covering, masked by the test only running locally before Gate 2 was wired up.

Concretely the Cloud Dev container returns:

```
"Failed to launch image generator: An error occurred trying to start process 'npx'
 with working directory 'C:\home'. The system cannot find the file specified..
 Check ImageGenerator:NodeBinPath in appsettings.Development.json (configured: '(unset — using PATH)')."
```

There are three+ layered blockers in front of the OpenAI key, all of which must be resolved before `dashboard.spec.ts:141` can pass on Dev:

1. **Worker process PATH lacks modern Node.** The Cloud Dev container's worker PATH contains only the ancient `C:\Program Files (x86)\nodejs\0.10.28\` (no `npx`). Modern Node versions (10.x–24.x) are available on disk at `C:\Program Files\nodejs\<version>\` (verified 2026-05-29 via Kudu console: `22.22.2` exists, matches local dev), but none are on PATH and `WEBSITE_NODE_DEFAULT_VERSION` is unset.
2. **`CliImageGenerator` Windows-incompat.** The candidate probe at [CliImageGenerator.cs:73](src/HelloWorld/CliImageGenerator.cs#L73) is `Path.Combine(nodeBinPath, "npx")` — no `.cmd`/`.exe` extension. On Windows the binary is `npx.cmd`, so even when `ImageGenerator__NodeBinPath` is set to a valid directory, the `File.Exists` check fails and the controller falls back to `npx` on PATH (which doesn't exist on the worker process). The `ProcessStartInfo("npx")` call also doesn't auto-resolve extensions on Windows without `UseShellExecute=true`.
3. **`node_modules` for the CLI likely not deployed.** `scripts/image-generator/node_modules/` is gitignored and Cloud's CI/CD pipeline doesn't run `npm install` ([[project_cloud_build_no_npm]]). Even with Node 22 on PATH, `npx tsx ...` would need `tsx` and the CLI's transitive deps available on the deployed artifact.
4. **`OPENAI__APIKEY` Cloud Secret.** The original suspected gap. Set on Dev 2026-05-29 (per user) but its actual state is unverifiable from the test until 1–3 are resolved.

This spec deliberately **defers** these from the parent `fix-e2e-dev-only-failures` feature because the original spec had AC6 "no code changes in `src/` or `tests/`" and the real fix needs both. Splitting lets the parent feature ship Steps 2 + 3 (guides-cli + imageCarousel) without bundling them with multi-day infra work.

## Functional Requirements

- **The image generator CLI launches on Cloud's Windows runtime container.** Calling `POST /umbraco/api/image-generator/generate/<id>?force=true` on Dev returns HTTP 200 with `{ success: true, output: <text containing "Done:" or "generated"> }`, matching local-dev and Live behavior.
- **`CliImageGenerator` handles Windows binary naming.** When `ImageGenerator:NodeBinPath` is set, the candidate-resolution logic tries `npx.cmd` and `npx.exe` (in that order) on Windows before falling back to bare `npx`. On Unix, behavior is unchanged.
- **The deployed artifact contains the CLI's runtime dependencies.** Either by (a) committing the `node_modules` tree under `scripts/image-generator/`, (b) vendoring `tsx` + minimal deps, or (c) wiring a CI step that runs `npm install` before the artifact zip — decided during `/plan`.
- **A Cloud App Setting points at a modern Node version on disk.** `ImageGenerator__NodeBinPath = C:\Program Files\nodejs\22.22.2` (or whichever modern version matches the repo's local dev pin) is set on Dev (and Live, when promoting), via the Cloud Portal's App Settings UI.
- **Once the launch path works, `dashboard.spec.ts:141` un-skips on Cloud URLs** and passes against Dev. The temporary `test.skip(API_BASE.includes('umbraco.io'), ...)` guard introduced during `fix-e2e-dev-only-failures` Step 1 is removed.

## Possible Edge Cases

- **Local dev is macOS/Linux; Cloud is Windows.** The Windows-compat fix in `CliImageGenerator` must not regress local dev. Unit tests should cover both candidate-resolution paths.
- **`node_modules` size.** Vendoring `tsx` alone pulls a sizable transitive tree. If artifact size becomes a concern, prefer a CI-side `npm install` step over committing `node_modules/`.
- **Node version pinning.** The local dev uses Node 22.22.2 (per `CLAUDE.md`). If Cloud's pre-installed versions get GC'd or the symlink layout changes, the App Setting goes stale silently. Document the version-pinning fragility in the feature doc.
- **Live also needs the App Setting + key.** When promoting this fix to Live, the same `ImageGenerator__NodeBinPath` and `OPENAI__APIKEY` need setting on Live's App Settings — the deploy of code + node_modules alone won't be sufficient.
- **Even after fix, ~6 of 8 dashboard tests already pass on Dev.** The skip only affects `:141`. Make sure the skip predicate doesn't accidentally suppress the other CMS-sourced-config / static-bundle tests that don't touch the CLI.
- **The `npx`-on-PATH path in the existing controller** also fails on Cloud (no modern npx anywhere on PATH). The Windows-compat fix solves this only when `ImageGenerator:NodeBinPath` is set. Document that the App Setting is now mandatory on Cloud, not optional.
- **`process.Start` on Windows with `.cmd` files**: requires either invoking via `cmd.exe /c npx.cmd ...` OR explicit `UseShellExecute=true`. The fix may need both the candidate resolution AND a Windows-specific Process.Start branch — verify during /plan.

## Acceptance Criteria

- **AC1**: `POST https://<dev>/umbraco/api/image-generator/generate/<id>?force=true` returns HTTP 200 with `{ success: true, output: "...Done...|generated..." }` after the fix lands and the deploy completes.
- **AC2**: `dashboard.spec.ts:141` passes against Dev's URL (skip predicate removed in same PR; CI's Gate 2 Playwright-against-Dev shows the test as ran + passed, not skipped).
- **AC3**: The Windows-compat fix in `CliImageGenerator` has a unit test (or set of) covering the candidate-resolution paths for both Windows and Unix.
- **AC4**: The diagnosis-and-fix recipe in `_features/fix-e2e-dev-only-failures.md` is updated to reference this spec as the followup and to remove "OpenAI key" as the sole hypothesis.
- **AC5**: Documentation in `CLAUDE.md` (or the feature doc for image-generator) captures: (a) the `ImageGenerator__NodeBinPath` App Setting is mandatory on Cloud, (b) which Node version path to use, (c) the `node_modules` deployment strategy chosen during /plan.

## Open Questions

- **Bundling vs. CI-side `npm install`** for the CLI's `node_modules`. Vendoring is simpler but bloats the repo and artifact; a CI step is cleaner but adds pipeline complexity. Decide during /plan.
- **Local-dev and Live also affected?** Live likely works only because the image-generator was historically only run locally and via Cloud-deploy-of-pre-generated-images. If Live's `generate` endpoint has never been hit on the Cloud runtime, it has the same bug. Verify before deciding scope.
- **Should `IImageGenerator` get a `CloudUnavailableImageGenerator` no-op for environments where the CLI can't run?** Probably not — the goal is to make it work everywhere, not to gate it. But worth noting as a fallback if the deploy strategy proves unworkable.
- **Spec naming convention**: this is a "fix the platform gap" spec, not a new-feature spec. Plan output may live as an increment under `_features/image-generator.md` rather than a separate feature doc. Decide during /plan.

## Testing Guidelines

- **Unit tests** (`tests/UmbracoProject.Tests/`): exercise `CliImageGenerator`'s `npx`-resolution logic with a fake filesystem (or `IProcessRunner` substitute) covering: NodeBinPath unset, NodeBinPath set with Windows-style `npx.cmd`, NodeBinPath set with Unix-style `npx`, NodeBinPath set but no candidate found.
- **E2E test** (`tests/e2e/imageGenerator/dashboard.spec.ts`): the existing `:141` test becomes the integration verification — remove the `test.skip` guard added by `fix-e2e-dev-only-failures` Step 1.
- **Manual verification on Dev**: curl + Playwright run as documented in the parent feature's diagnosis-and-fix recipe.
- **Regression check**: the local-dev `npm run test:unit` and the local `dotnet run` + manual generate call should still pass with the Windows-compat changes in place.

## References

- Parent feature: `_features/fix-e2e-dev-only-failures.md` (deferral happened during Step 1, 2026-05-29).
- Discovery thread: see the `## Diagnosis & Fix Recipes` section of the parent feature doc for the Kudu console probe transcript and the layered-blocker breakdown.
- Memory: `[[project_cloud_build_no_npm]]` (build container had no npm — this spec extends the same constraint to the runtime container's PATH).
- Existing image-generator feature: `_features/image-generator.md` (3 increments shipped 2026-04-09; this is a Cloud-runtime gap not covered by those increments).
