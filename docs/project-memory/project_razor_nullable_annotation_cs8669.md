---
name: project-razor-nullable-annotation-cs8669
description: Nullable annotations (string?) in .cshtml build clean but fail CS8669 under runtime Razor compilation; invisible to dotnet build and to a site that has not touched the view since building.
metadata: 
  node_type: memory
  type: project
  originSessionId: 5f56dd50-ed72-4e9b-ac5f-ace555ad2e04
  modified: 2026-09-02T04:34:56.476Z
---

An explicit nullable annotation in a Razor view — a `string?` local-function return type, or a
`(string?)` cast — compiles clean at build time but fails **runtime** Razor compilation with:

> `CS8669: The annotation for nullable reference types should only be used in code within a
> '#nullable' annotations context. Auto-generated code requires an explicit '#nullable' directive
> in source.`

Razor's generated class is marked auto-generated and carries no `#nullable` context, and the
csproj's `<Nullable>enable</Nullable>` does not reach it — the same one-way gap as
[[project-cloud-razor-ignores-nowarn]], where `<NoWarn>` fails to reach runtime Razor while TWAE
does ([[project-cloud-razor-honors-twae]]).

`Microsoft.AspNetCore.Mvc.Razor.RuntimeCompilation` is present **transitively** via Umbraco — it
appears in no csproj and no `Program.cs`, so grepping for it says "not enabled" and is wrong.
Confirm with `dotnet list <proj> package --include-transitive | grep RuntimeCompilation`.

**Why it hides:** runtime compilation only kicks in when the `.cshtml` is newer than the compiled
views assembly. A view built and then left alone serves the build-time version and returns 200
indefinitely. Editing so much as a *comment* in it flips it to the runtime path and 500s the page.
Found exactly that way: repointing an archived `_work/` path inside a comment took `/spellbook/`
from 200 to 500 with no behavioral edit at all.

**Not every annotation trips it.** A plain local variable (`string? slug = null;` in
`guideSection.cshtml`) recompiles fine. Local-function return types and casts do not. Do not infer
from one working instance that the file is safe.

**How to apply:** avoid nullable annotations in `.cshtml` entirely — prefer an empty-string
sentinel (`return ... ?? ""`) with `string.IsNullOrEmpty` at the consumer, rather than `null` with
a `!= null` check. To verify a view change, `touch` the `.cshtml` and re-request the page; a green
`dotnet build` and a live 200 both prove nothing until the file's mtime has moved.

**Why it matters:** Cloud runtime-compiles Razor on first request after a deploy — the confirmed
mechanism behind [[project-cloud-razor-honors-twae]] — so this reaches production as a 500 on the
affected page while every local gate stays green.
