---
name: project-cloud-razor-honors-twae
description: "Cloud's runtime Razor compiler picks up the project's `<TreatWarningsAsErrors>` setting, so `[Obsolete]` API calls in .cshtml files fail first-request compilation on Cloud even though local dev tolerates them"
metadata: 
  node_type: memory
  type: project
  originSessionId: c9d416f6-42f3-4c6c-b40f-2825b7105f69
  modified: 2026-07-30T15:25:45.603Z
---

The project's `csproj` settings include `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` (added 2026-05-22, Step 2 of arch-safety-net). `RazorCompileOnBuild=false` and `RazorCompileOnPublish=false` are explicitly set, so Razor views aren't compiled at build time locally — they compile at runtime on first request via Roslyn.

**The catch:** Umbraco Cloud's deploy clears its compiled-Razor cache on every deploy. The first request after a fresh deploy triggers a fresh runtime Razor compile, and Roslyn at runtime honors the project's TWAE setting. Any `[Obsolete]` API used by a Razor view fails as a `CS0618` error rather than a warning. Local dev escapes this because compiled-Razor outputs persist across `dotnet run` sessions.

**Concrete example (discovered 2026-05-27):** After arch-safety-net deployed to Dev for the first time, the first request to Dev's homepage failed Razor compilation with:
```
'PublishedContentWrapped.Children' is obsolete: 'Please use TryGetChildrenKeys() on IDocumentNavigationQueryService...'
```
That's a `CS0618` warning Umbraco emits to nudge callers off the legacy API before v18. TWAE turned it into a hard error. Live had been running the same code fine because Live's source doesn't (currently) have TWAE.

**Pragmatic fix:** grandfather each existing call site with a scoped `#pragma warning disable/restore CS0618` at the point of use. Do **NOT** add `CS0618` to a project-wide `<NoWarn>` — Cloud's runtime Razor compile ignores csproj `<NoWarn>` even though it honors TWAE, so a `<NoWarn>` entry silences local `dotnet build` but the Razor still fails on Cloud's first request. See [[project_cloud_razor_ignores_nowarn]] for that mechanism. (Current state: the csproj comment records this explicitly — CS0618 is out of `<NoWarn>` and grandfathered per-call-site.)

**Proper fix:** migrate the Razor views (and any C# helpers) off the obsolete APIs. Tracked on ROADMAP as `arch-obsolete-api-migration`. Removing the per-call-site pragmas after that ticket ships re-enables the deprecation safety net.

**How to apply:** When enabling TWAE on a Umbraco project, expect Razor runtime compilation to start enforcing it on Cloud. Test by deploying to a fresh Cloud env (or by clearing local cached Razor outputs) BEFORE assuming local-passes-therefore-Cloud-passes. See [[project-cloud-no-wildcard-versions]] and [[project-cloud-build-no-npm]] for adjacent Cloud-side-vs-local-build mismatches surfaced during the same Step 8 push.
