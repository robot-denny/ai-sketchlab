# Pinned betas — do not float

One pin remains. Don't let NuGet float it, and don't bump it on its own — it can only move as part of
the whole-stack migration described below.

| Package | Pinned version | Why pinned |
|---|---|---|
| Umbraco.Cms.Search.Provider.Examine | 1.0.0-beta.9 | It is the correct companion to the **1.0.0** `Cms.Search.Core` this project still runs: beta.9 declares `Umbraco.Cms.Search.Core [1.0.0, )`, and no stable Provider.Examine exists on *any* line (the 17.x line's head is `17.1.0-beta.1`, which pins `Cms.Search.Core` **17.1.0** exactly — so taking it requires moving the entire search stack at once, not bumping this one package). It's the keyword provider the Core façade routes to (`.AddExamineSearchProvider()` in [SearchComposer.cs](../src/UmbracoProject/SearchComposer.cs)) — `Cms.Search.BackOffice`'s direct `Examine.Lucene` dependency does **not** supersede it. **Known beta.9 bug:** some multi-word keyword queries throw `NullReferenceException` inside Examine, so [SearchService.cs](../src/UmbracoProject.Features/Services/Search/SearchService.cs) guards the keyword path (try/catch → zero hits) and `/search` degrades to the empty state instead of a 500. Whether `17.1.0-beta.1` fixes this is **unverified** — check it during the migration, and drop the guard only once proven. |

## Current stack (as of 2026-08-27)

The AI and Search families realigned their major version to the CMS major, and this project sits
across the two lines:

| | Installed | 17-line head |
|---|---|---|
| `Umbraco.AI` + the 11 other non-Search AI packages | **17.x heads** | current |
| `Umbraco.AI.Search` | 17.0.0 *(held)* | 17.0.3 |
| `Umbraco.Cms.Search.Core` / `.BackOffice` / `.DeliveryApi` | 1.0.0 | **17.1.0** (stable) |
| `Umbraco.Cms.Search.Provider.Examine` | 1.0.0-beta.9 | 17.1.0-beta.1 (pre-release) |

`AddBackOfficeSearch()` is **enabled** in [SearchComposer.cs](../src/UmbracoProject/SearchComposer.cs):
the beta.3 list-view-search crash (`'field name' cannot be null or empty`) and the old
`MissingMethodException` on **Settings → Search** were both fixed by the stable 1.0.0 migration.

## Forward path: the search-stack migration

`Umbraco.AI.Search` is held at 17.0.0 because **17.0.1 is the first release that widens
`Cms.Search.Core` to `[17.0.0, 17.999.999)`** — which drags the whole `Cms.Search.*` stack off the
1.x line. That is a deliberate migration, tracked as `deps-ai-search-version-realignment` in
[ROADMAP.md](../ROADMAP.md).

Dependency resolution is already **verified**: a test-restore of `AI.Search` 17.0.3 +
`Cms.Search.*` 17.1.0 + `Provider.Examine` 17.1.0-beta.1 against `Umbraco.Cms` 17.6.2 restores
clean (no NU1605/NU1608) with **zero vulnerable packages**. It is also the only thing that clears the
last remaining advisory suppression in the repo — `NU1902` in
[UmbracoProject.Features.csproj](../src/UmbracoProject.Features/UmbracoProject.Features.csproj),
for AngleSharp 1.4.0 reaching that project's standalone graph via
`AI.Search 17.0.0 → AI.Core 17.0.0 → SmartReader 0.11.0`. (The deployed host already resolves
AngleSharp 1.5.2, so this is graph-local to the RCL, not a runtime exposure.)

What resolution being clean does **not** cover, and what the migration therefore still needs:

- Runtime verification of `/search` — keyword **and** semantic — plus backoffice list-view search,
  embeddings, and AI Copilot/agents.
- Composer registration in [SearchComposer.cs](../src/UmbracoProject/SearchComposer.cs) and the
  searcher calls in [SearchService.cs](../src/UmbracoProject.Features/Services/Search/SearchService.cs)
  may need API changes.
- Whether the beta.9 multi-word `NullReferenceException` guard can be dropped.
- Whether the `search-cold-serving-health` cold-searcher behaviour persists on the 17.x stack.

## v18 upgrade path

Both `Cms.Search.*` and `AI.Search` are the v18-forward replacement for the legacy Examine-backed
`IPublishedContentQuery.Search()` API. Expect further API changes at v18 — revisit composer
registration, the searcher calls, and this file as part of the v18 upgrade PR. Note the `18.x` line
of every package above already exists; it is the Umbraco 18 target and out of scope until then.
