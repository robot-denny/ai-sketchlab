---
name: project-cloud-razor-ignores-nowarn
description: "Cloud's runtime Razor compiler honors the project's TWAE setting but ignores csproj-level `<NoWarn>`; suppress per-file with `#pragma warning disable` directives"
metadata: 
  node_type: memory
  type: project
  originSessionId: c9d416f6-42f3-4c6c-b40f-2825b7105f69
---

When `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` is set on `UmbracoProject.csproj`, Cloud's runtime Razor compile DOES inherit that setting and turn warnings into hard errors. **But** Cloud's runtime Razor compiler does NOT read `<NoWarn>` from the csproj, so warning suppressions added there work for `dotnet build` and never reach `.cshtml` runtime compilation.

This was discovered (2026-05-27) when Dev returned 500 after a successful deploy: the csproj had `<NoWarn>$(NoWarn);NU1903;CS0618</NoWarn>` but runtime Razor compile still failed `_SiteHead.cshtml` with "PublishedContentWrapped.Children is obsolete" (CS0618). Verified by reading Dev's deployed csproj via `git show dev-cloud/master:src/UmbracoProject/UmbracoProject.csproj` — the NoWarn was present and CS0618 was in it.

**Workaround**: scope the suppression inside the offending `.cshtml` via `#pragma warning disable <CODE>` … `#pragma warning restore <CODE>`. Pragmas ARE compiler-level directives and Roslyn honors them at runtime Razor compile. Best practice: move the offending call into a `@{ … }` code block, wrap with pragmas, then iterate over a pre-computed list in markup. Example pattern:

```cshtml
@{
    // TODO(<tracker>): proper API migration
#pragma warning disable CS0618
    var items = homePage.Children.Where(...).ToList();
#pragma warning restore CS0618
}
<nav>@foreach (var item in items) { ... }</nav>
```

**How to apply**: when adding `<NoWarn>X</NoWarn>` to the csproj and any of the suppressed warnings can be triggered by code in a `.cshtml` file, also add an in-file pragma at the call site. Or migrate off the deprecated API entirely (tracked as `arch-obsolete-api-migration`). See [[project-cloud-razor-honors-twae]] for the upstream issue (TWAE-inheritance into runtime Razor compile) that this memory builds on.
