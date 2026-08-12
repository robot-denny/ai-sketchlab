# Pinned betas — do not float

The search stack went stable 1.0.0, so this table collapsed to a single remaining pin. Don't let NuGet float it.

| Package | Pinned version | Why pinned |
|---|---|---|
| Umbraco.Cms.Search.Provider.Examine | 1.0.0-beta.9 | No stable release exists yet — beta.9 is the head pre-release and declares `Umbraco.Cms.Search.Core [1.0.0, )`, so it's the correct companion to the stable Core. It's the keyword provider the Core façade routes to (`.AddExamineSearchProvider()` in [SearchComposer.cs](../src/UmbracoProject/SearchComposer.cs)) — `Cms.Search.BackOffice`'s direct `Examine.Lucene` dependency does **not** supersede it. **Known beta.9 bug:** some multi-word keyword queries throw `NullReferenceException` inside Examine, so [SearchService.cs](../src/UmbracoProject.Features/Services/Search/SearchService.cs) guards the keyword path (try/catch → zero hits) and `/search` degrades to the empty state instead of a 500. Drop the guard and bump when a fixed/stable Provider.Examine ships. |

The four previously-pinned packages are off beta: `Cms.Search.Core`/`.BackOffice`/`.DeliveryApi` on stable 1.0.0, and `AI.Search` on the CMS-17-aligned 17.0.0 — the old `MissingMethodException`-on-`Settings → Search` and the `AddBackOfficeSearch()` list-view crash are both fixed, so `AddBackOfficeSearch()` is now enabled in [SearchComposer.cs](../src/UmbracoProject/SearchComposer.cs).

**v18 upgrade path**: Both `Cms.Search.*` and `AI.Search` are the v18-forward replacement for the legacy Examine-backed `IPublishedContentQuery.Search()` API. Expect further API changes at v18 — revisit composer registration in [SearchComposer.cs](../src/UmbracoProject/SearchComposer.cs), the searcher calls in [SearchService.cs](../src/UmbracoProject.Features/Services/Search/SearchService.cs), and this table as part of the v18 upgrade PR.
