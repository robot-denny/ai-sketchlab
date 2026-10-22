# Pre-release pins

The log of packages this site has pinned to a pre-release, kept so the next one has a home.
(The filename is kept for existing links.)

**No beta pins remain.** The last one, `Umbraco.Cms.Search.Provider.Examine` 1.0.0-beta.9, was
retired by the Umbraco 18 upgrade (2026-10-22): the whole search stack moved to the CMS-aligned
18.x line, where Provider.Examine has a **stable** release.

If a future package has to be pinned to a pre-release, add a row to a table here saying which
version, why, and what retires it.

## Retired pins

| Package | Was pinned at | Retired by |
|---|---|---|
| Umbraco.Cms.Search.Provider.Examine | 1.0.0-beta.9 | **18.2.0** (stable), on the Umbraco 18 upgrade. It was the companion to `Cms.Search.Core` 1.0.0, and no stable Provider.Examine existed on the 1.x or 17.x lines. |

## Current search stack (as of 2026-10-22)

| Package | Installed |
|---|---|
| `Umbraco.Cms.Search.Core` / `.BackOffice` / `.DeliveryApi` | 18.2.0 |
| `Umbraco.Cms.Search.Provider.Examine` | 18.2.0 (stable) |
| `Umbraco.AI.Search` | 18.0.4 (its `AI.Search.Core` requires `Cms.Search.Core [18.0.0, 18.999.999)`) |
| `Umbraco.AI` + the 11 other non-Search AI packages | 18.x, moved as one unit (see the comment in [UmbracoProject.csproj](../src/UmbracoProject/UmbracoProject.csproj)) |

Provider.Examine is the keyword provider the Core façade routes to (`.AddExamineSearchProvider()` in
[SearchComposer.cs](../src/UmbracoProject/SearchComposer.cs)). `Cms.Search.BackOffice`'s direct
`Examine.Lucene` dependency does **not** supersede it.

The move to 18.x compiled with no source changes to
[SearchComposer.cs](../src/UmbracoProject/SearchComposer.cs) or
[SearchService.cs](../src/UmbracoProject.Features/Services/Search/SearchService.cs), and
`SearchComposerTests` passes. Runtime behaviour still needs verifying on the first v18 boot:
`/search` (keyword **and** semantic), backoffice list-view search, and embeddings.

## Still open: the multi-word `NullReferenceException` guard

beta.9 threw a `NullReferenceException` inside Examine on some multi-word keyword queries, so
[SearchService.cs](../src/UmbracoProject.Features/Services/Search/SearchService.cs) guards the
keyword path (try/catch → zero hits), and `/search` shows the empty state instead of a 500.
**The guard stays.** Nobody has yet shown that 18.2.0 fixes the bug. Drop the guard only after a
multi-word keyword query is shown to work on 18.2.0 without it.
