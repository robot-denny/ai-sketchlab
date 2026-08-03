---
name: project_rcl_host_schema_publish_collision
description: "RCL + host both emit Umbraco IDE schema files → NETSDK1152 on `dotnet publish` only (build passes); fails Cloud Kudu Portal promotions, not GitHub-Actions Dev deploys"
metadata: 
  node_type: memory
  type: project
  originSessionId: f8c34237-1e78-47f2-ad92-42015c7c1a73
---

Umbraco's `Umbraco.Cms.Targets` runs a `CopyUmbracoJsonSchemaFiles` target **unconditionally** (`BeforeTargets="Build"`, no opt-out property) in **every** project that references `Umbraco.Cms`. So once the `UmbracoProject.Features` RCL gained Umbraco package refs (the feature-folder split), **both** the RCL and the host emit the same IDE-assist schema files: `appsettings-schema.json`, `appsettings-schema.Umbraco.Cms.json`, `umbraco-package-schema.json`.

**The trap:** these build fine (each lands in its own project dir — we gitignore them in the RCL), so `dotnet build`, Gate 1, and the pre-push hook all stay green. But on **`dotnet publish`** the host pulls in the RCL's copies and they collide at the same relative path → **`error NETSDK1152: Found multiple publish output files with the same relative path`**. `dotnet build` never surfaces it.

**Why it only bit Live, not Dev** (the load-bearing nuance): Dev deploys via the **GitHub-Actions CI/CD-Flow artifact path**, which doesn't `dotnet publish` the combined output the same way. A **Portal Dev→Live promotion** runs Cloud's Kudu `deploy.cmd` → `dotnet publish "...UmbracoProject.csproj" --no-build` server-side, which hits NETSDK1152 and fails the deploy (build step logs `Build succeeded`, then publish fails). Confirmed 2026-06-29 on Run 50 (deployment cf18d80e): Live stayed on the prior build; Live app never restarted; schema + git were fully in sync (ruled out via `/check-uda` + comparing `origin`/`dev-cloud` Cloud git remotes).

**Fix applied:** `<ErrorOnDuplicatePublishOutputFiles>false</ErrorOnDuplicatePublishOutputFiles>` in the host `UmbracoProject.csproj`. The schema files are dev-only IDE assist with zero runtime effect, so letting publish dedupe (host copy wins) is safe. The Umbraco target has no clean per-project disable, and inline csproj target-overrides lose to the NuGet buildTransitive import order, so this is the pragmatic robust fix.

**How to apply / prevent recurrence:**
- When verifying ANY RCL-split or multi-project change, run **`dotnet publish -c Release`**, not just `dotnet build` — publish-only failures (NETSDK1152, publish-time Razor precompile) are invisible to build. This is the single biggest gap that let it reach Cloud.
- A `dotnet publish` gate in CI Gate 1 / the pre-push hook would have caught it pre-Cloud — folded into the `arch-uda-ci-guard` ROADMAP item.
- Symptom signature: Kudu deploy log shows `Build succeeded … 0 Error(s)` then `error NETSDK1152 … multiple publish output files` then `Failed exitCode=1, command=dotnet publish …`. The running app keeps the old `ProcessId` (no swap). See also [[project_cloud_build_no_npm]] (other Kudu-only build traps).
