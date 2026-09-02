---
name: project_csdevkit_removes_project_on_fast_git_rewrite
description: "VS Code C# Dev Kit silently calls removeProjectViaPath, dropping UmbracoProject from the .sln, when git rewrites a csproj twice in one second (checkout + ff-merge after a squash merge)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4b6b3b81-9667-4829-83f4-9a141e9c9947
  modified: 2026-08-27T13:55:42.196Z
---

After a **squash merge**, the local `git checkout master` + `git merge --ff-only github/master`
sequence rewrites `UmbracoProject.csproj` **twice within the same second** (checkout reverts it to
the pre-PR commit, the fast-forward re-applies the squashed version). VS Code's **C# Dev Kit**
file watcher reads that as "the project disappeared" and persists the belief to disk: it calls
`SolutionFileService.RemoveProjectViaPathAsync`, **removing `UmbracoProject` from
`umbraco-17-demo-site.sln`** and stripping the `ProjectReference` to it from
`tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj`. Confirmed 2026-08-27.

**Why:** the damage is invisible to every gate. With the host absent from the solution,
`dotnet build umbraco-17-demo-site.sln` reports **succeeded** and `dotnet test` reports **70/70
passed** — because the public site is no longer in the build to fail. Gate 1 builds the `.sln`, so
this reaches CI as a green run that silently stopped compiling the site. Same false-green family as
[[project_rcl_host_schema_publish_collision]].

**How to apply:** after any local `checkout` + `ff-merge` following a squash merge, run
`dotnet sln umbraco-17-demo-site.sln list` and confirm **all four** projects are present before
trusting a green build. If `UmbracoProject` is missing:
`git checkout -- umbraco-17-demo-site.sln tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj`,
then re-verify that `UmbracoProject ->` actually appears in `dotnet build` output.

Forensics that identify this specific cause (rather than a bad revert or the Cloud sync patch):
- `Microsoft.VisualStudio.SolutionFileService (0.1).svclog` under
  `~/Library/Application Support/Code/logs/<session>/window*/exthost/ms-dotnettools.csdevkit/`
  shows `{"id":0,"method":"removeProjectViaPath"}`. The pattern `Listening started` → request id 0 →
  `RemotePartyTerminated` means programmatic, not a Solution Explorer click.
- `git log --all --find-object=$(git hash-object umbraco-17-demo-site.sln)` returns nothing — the
  content was machine-generated and never committed.
- The `.sln` shares an identical mtime with the csproj files git rewrote, yet no commit in the range
  differs on the `.sln`, so git cannot have written it.
- Not the Cloud sync patch (`patch/git-patch.diff` is a handful of lines and touches only `.uda`)
  and not the `post-merge` hook (it only does `echo > src/UmbracoProject/umbraco/Deploy/deploy`,
  which is what causes the separate `.uda` churn when the site is running under `dotnet run`).
