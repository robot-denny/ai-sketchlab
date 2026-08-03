---
name: project-cloud-no-wildcard-versions
description: "Umbraco Cloud CI/CD Flow deploy validator rejects `Version=\"*\"` wildcards in csproj PackageReference entries, even though local dev tolerates them"
metadata: 
  node_type: memory
  type: project
  originSessionId: c9d416f6-42f3-4c6c-b40f-2825b7105f69
---

Umbraco Cloud's CI/CD Flow deploy pipeline pre-flight rejects any `<PackageReference ... Version="*" />` in any csproj, with error `Unsupported Version format * for Package X`. The deployment status flips to `Failed` after the "Checking versions" phase.

**Why:** Cloud's deploy validator requires deterministic, reproducible builds — wildcards mean the version resolved at deploy time could differ from local. Local dev's NuGet resolution is permissive; Cloud's deploy validator is strict.

**How to apply:** When adding or auditing PackageReference entries, always use an explicit version. If a project (e.g., `HelloWorld.csproj`) transitively pulls Umbraco.Cms.* packages that are also in the main project, pin them to the SAME version as the metapackage in `UmbracoProject.csproj` (e.g., both at `17.4.0`). On Umbraco upgrades, bump all of them together.

Discovered 2026-05-26 during `arch-safety-net` Step 8 first master deploy. The bundled HelloWorld.csproj from the original Starter Site template had `Version="*"` on four Umbraco.Cms.* packages. Fixed by pinning to `17.4.0` (matching the metapackage). See [[project-cloud-shared-secrets-one-shot]] for adjacent Cloud-side surprises encountered during the same Step 8 push.
