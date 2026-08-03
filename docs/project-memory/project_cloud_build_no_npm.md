---
name: project-cloud-build-no-npm
description: "Umbraco Cloud's deploy-side build container doesn't have npm installed and runs MSBuild in Debug, so csproj Exec targets that invoke npm must be tolerant of failure or skipped via reliable env-var detection"
metadata: 
  node_type: memory
  type: project
  originSessionId: c9d416f6-42f3-4c6c-b40f-2825b7105f69
---

Umbraco Cloud's CI/CD Flow deploy validator runs `dotnet build` on its own Kudu Lite build container (`/app/work/repository/...`). That container:

1. **Has no npm installed** — any `<Exec Command="npm ..." />` fails with `npm: not found` (exit 127), and MSBuild treats that as build failure.
2. **Uses Debug Configuration** (not Release) — so naive `Condition="'$(Configuration)' != 'Release'"` conditions DON'T skip targets there.
3. **Doesn't set `CI=true`** — so `Condition="... And '$(CI)' == ''"` is also true, target fires.
4. **Doesn't set `WEBSITE_INSTANCE_ID`** (that's the RUNTIME container's App Service env var, not the build container's) — so that's NOT a reliable build-container detector either.

What works in practice: add `ContinueOnError="true"` to the offending `<Exec>` elements. Cloud's build emits a warning but continues; the committed build outputs (e.g., `wwwroot/App_Plugins/HelloWorld/*.js`) ship as-is.

**How to apply:** When adding any csproj `<Exec Command="npm ..." />` or similar tool-invocation target, either (a) commit the build output and add `ContinueOnError="true"` to the Exec, or (b) move the build step out of MSBuild entirely (e.g., into a CI-only `npm run build` step before the artifact zip).

Discovered 2026-05-26 during `arch-safety-net` Step 8 first deploy. The bundled `HelloWorld.csproj` from the Starter Site had a `RestoreClient`/`BuildClient` pair running `npm i` / `npm run build`. The conditions on those targets were designed to skip in Release/CI, but Cloud's build container hits none of those skip conditions. Fixed by adding `ContinueOnError="true"` to both `Exec` elements; built JS assets in `wwwroot/App_Plugins/HelloWorld/` were already committed so the deployed app still works. See [[project-cloud-no-wildcard-versions]] for the adjacent NU1604-style validator quirk encountered just before this one.
