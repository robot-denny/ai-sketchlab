# Search

The site search at [src/UmbracoProject/Views/search.cshtml](../src/UmbracoProject/Views/search.cshtml) uses the new **Umbraco.Cms.Search** framework (the v18-forward replacement for legacy Examine search — see the *v18 upgrade path* note in [Pinned betas](pinned-betas.md)) with **Umbraco.AI.Search** layered on top for semantic/vector search.

## Architecture

Three packages cooperate at runtime, registered via [src/UmbracoProject/SearchComposer.cs](../src/UmbracoProject/SearchComposer.cs):

- **`Umbraco.Cms.Search.Core`** — provides the `ISearcher` / `ISearcherResolver` abstractions used by the Razor view. Doesn't do indexing itself; it's the façade that routes queries to a registered provider.
- **`Umbraco.Cms.Search.Provider.Examine`** — Lucene/keyword provider. Used as a safety net for short, exact-match queries (author names, "contact", etc.) where pure-vector search underperforms.
- **`Umbraco.AI.Search`** — vector/semantic search on top of Core. Calls the configured embedding model to chunk + embed documents on publish and to embed the query at search time.

The public `/search` page is wired to the AI searcher; the Examine provider stays registered for hybrid fallback and for the backoffice search UI. **`AddBackOfficeSearch()` is now enabled** — the beta.3 crash that previously forced it off (`'field name' cannot be null or empty` in the backoffice Media/Content list-view search box) is fixed in 1.0.0.

## Configuration

- **Embedding profile**: `default-embedding` (alias `openai-embeddings`) — OpenAI `text-embedding-3-small`, 512-dim. Set as the **default embedding profile** under `Settings → AI → Settings` in the backoffice. Without a default embedding profile, the AI index rebuild silently completes with 0 documents.
- **Searcher alias**: `UmbAI_Search` — pass this to `ISearcherResolver.GetSearcher(...)` and `ISearcher.SearchAsync(indexAlias: ...)`.
- **OpenAI API key**: stored in `appsettings.Development.json` under `OpenAI:ApiKey` (gitignored); the backoffice AI connection references it as `$OpenAI:ApiKey`. (Same placeholder-not-raw-key rule as every AI secret — see *AI schema deployment to Umbraco Cloud* under AI & Copilot.)
- **Tuning values**: `Umbraco:AI:Search` block in [appsettings.json](../src/UmbracoProject/appsettings.json) — `ChunkSize: 512`, `ChunkOverlap: 50`, `DefaultTopK: 50`, `MinScore: 0.3`.

## Rebuilding the index

Trigger a full rebuild from the backoffice: **`Settings → Search`** → click the rebuild icon on the `UmbAI_Search` row. On the demo site this finishes in < 1 minute and produces ~3–4 vector chunks per published document (~115 chunks total across 33 documents).

**Always verify the document count is non-zero after a rebuild** — the rebuild API returns 200 even when misconfigured (e.g., no default embedding profile).

## Umbraco Cloud deploys

Every AI entity auto-deploys as schema via the `Umbraco.AI.Deploy` package family (see **AI schema deployment** in [AI & Copilot](ai-copilot.md)). **The vector index is the one exception** — it's local to each environment and must be rebuilt manually after a deploy.

After deploying to Cloud:

1. Set `OpenAI__ApiKey` (and `Anthropic__ApiKey` if using Anthropic connections) in that environment's app settings via the Cloud portal — note the double-underscore form, the portal rejects colons.
2. Log into that environment's backoffice and verify **Settings → AI** shows the deployed connections, profiles, contexts, and agents.
3. Rebuild the `UmbAI_Search` index once via `Settings → Search`.
4. Verify the document count > 0 before promoting further.

Deploys do not replicate the vector index; skipping the rebuild leaves `/search` returning empty results on that environment.

## Pinned versions

Version constraints for `Cms.Search.*` and `AI.Search` live in [Pinned betas](pinned-betas.md), alongside the other beta-package pinning rules.
