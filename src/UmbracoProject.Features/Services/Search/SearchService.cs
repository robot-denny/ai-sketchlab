using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Umbraco.AI.Search.Core;
using Umbraco.AI.Search.Core.Configuration;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Search.Core.Services;

using SearchCoreConstants = Umbraco.Cms.Search.Core.Constants;
using ProviderDocument = Umbraco.Cms.Search.Core.Models.Searching.Document;
using ProviderSearchResult = Umbraco.Cms.Search.Core.Models.Searching.SearchResult;

namespace UmbracoProject.Features.Services.Search;

/// <summary>
/// Routes search queries to either keyword (Examine) or AI semantic (vector) search,
/// caches results for 5 minutes, filters out system doc types, and falls back from
/// AI to keyword search when the vector index returns zero raw hits.
/// </summary>
/// <remarks>
/// Behavior ported verbatim from <c>Views/search.cshtml</c> (audit P0.2):
/// - Short queries (1–2 tokens) route directly to the keyword searcher; longer
///   natural-language queries try the AI semantic searcher first.
/// - System doc types (category, categoryList, error, search, xMLSitemap) are filtered
///   from the displayed results.
/// - The display cap of 20 is hardcoded; the searcher cap is <c>max(20, DefaultTopK)</c>
///   so post-filter trimming leaves the user with a full page.
///
/// The auto-generated <c>Umbraco.Cms.Web.Common.PublishedModels.*</c> types
/// (Category, CategoryList, Error, Search, XMlsitemap) used by the original view
/// are only available at runtime (ModelsMode InMemoryAuto). We use the equivalent
/// alias literals here so the service can be compiled at build time. If the
/// project ever switches to a compile-time models mode, these should be swapped
/// for the strongly-typed <c>ModelTypeAlias</c> constants.
/// </remarks>
public sealed class SearchService : ISearchService
{
    private static readonly string[] DocTypesToIgnore =
    {
        "category",
        "categoryList",
        "error",
        "search",
        "xMLSitemap",
    };

    private static readonly char[] TokenSeparators = { ' ', '\t', '\n' };
    private const int DisplayLimit = 20;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    private readonly IPublishedContentQuery _publishedContentQuery;
    private readonly ISearcherResolver _searcherResolver;
    private readonly IMemoryCache _memoryCache;
    private readonly IOptions<AIVectorSearchOptions> _searchOptions;
    private readonly ILogger<SearchService> _logger;

    public SearchService(
        IPublishedContentQuery publishedContentQuery,
        ISearcherResolver searcherResolver,
        IMemoryCache memoryCache,
        IOptions<AIVectorSearchOptions> searchOptions,
        ILogger<SearchService> logger)
    {
        _publishedContentQuery = publishedContentQuery;
        _searcherResolver = searcherResolver;
        _memoryCache = memoryCache;
        _searchOptions = searchOptions;
        _logger = logger;
    }

    public async Task<SearchResult> SearchAsync(string query, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return new SearchResult(Array.Empty<IPublishedContent>(), SearchMode.Keyword, 0);
        }

        // Honor cancellation before touching the cache. The cache-fill factory below does
        // NOT capture the request's cancellation token — once a factory run starts, it
        // completes (or throws on its own merits) so a cancelled first caller doesn't
        // poison the entry for the second concurrent caller.
        cancellationToken.ThrowIfCancellationRequested();

        // Short, keyword-style queries (1–2 tokens, e.g. author names, "contact", "sitemap")
        // are poor semantic candidates and pure-vector search underperforms on them.
        var tokenCount = query.Split(TokenSeparators, StringSplitOptions.RemoveEmptyEntries).Length;
        var isShortQuery = tokenCount <= 2;
        var mode = isShortQuery ? SearchMode.Keyword : SearchMode.AiSemantic;

        // Cache key is the normalized (trimmed, lower-cased) query. 5-minute TTL collapses
        // repeat-traffic bursts onto a single embedding call while staying fresh enough for
        // a demo/content site with low publish frequency.
        //
        // NOTE (cache stampede): IMemoryCache.GetOrCreateAsync does NOT serialize concurrent
        // factory runs for the same key. Under a burst of N simultaneous cold-miss requests
        // for the same query, N OpenAI embedding calls will fire. This is acceptable for the
        // current demo-site traffic profile. Before this service backs a high-traffic surface
        // (v2 Delivery API endpoint, v3 typeahead), add per-key locking (Lazy<Task<T>> +
        // ConcurrentDictionary) or switch to IHybridCache (.NET 9+).
        //
        // NOTE (cache footprint): SearchResult.Items holds up to 20 IPublishedContent
        // instances per entry — each carries the full property graph. With unbounded query
        // cardinality and no MemoryCacheOptions.SizeLimit configured, this can grow without
        // an explicit eviction signal. Acceptable today (33 published docs). The v4 increment
        // in _features/extract-search-service.md (DTO mapping) is the long-term fix.
        var cacheKey = $"search:results:{(isShortQuery ? "kw" : "ai")}:{query.ToLowerInvariant().Trim()}";

        var cached = await _memoryCache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheTtl;

            _logger.LogDebug(
                "Search cache miss for {Mode} mode, query length {QueryLength}",
                mode,
                query.Length);

            // Ask the provider for headroom over the display target so post-filtering
            // (system doc types) can drop a few without leaving the user short.
            var take = Math.Max(DisplayLimit, _searchOptions.Value.DefaultTopK);

            if (isShortQuery)
            {
                var keywordHits = await RunSearchAsync(
                    SearchCoreConstants.IndexAliases.PublishedContent,
                    query,
                    take);
                return BuildResult(keywordHits.Items, SearchMode.Keyword);
            }

            // AI semantic searcher first; fall back to Examine if vector search returns
            // zero RAW Document hits (not zero post-filter hits — see test
            // AiReturnsHitsAllSystemDocTypes_DoesNotFallBack). Counting raw Document hits
            // (rather than the full Documents enumerable) means non-Document object types
            // — Media, Member, etc. — can never accidentally suppress the keyword fallback.
            var aiHits = await RunSearchAsync(
                AISearchConstants.IndexAliases.Search,
                query,
                take);

            if (aiHits.RawDocumentCount > 0)
            {
                return BuildResult(aiHits.Items, SearchMode.AiSemantic);
            }

            _logger.LogDebug("AI semantic returned no results, falling back to keyword search");

            var fallbackHits = await RunSearchAsync(
                SearchCoreConstants.IndexAliases.PublishedContent,
                query,
                take);
            // Mode reflects the ROUTING decision (long query → AI semantic), not which
            // searcher actually produced the results.
            return BuildResult(fallbackHits.Items, SearchMode.AiSemantic);
        });

        return cached ?? new SearchResult(Array.Empty<IPublishedContent>(), mode, 0);
    }

    // Caps Items to the display limit while preserving the pre-cap count as TotalCount so
    // a future view can render "Showing 20 of N". Items in the input list are already
    // post-filter (system doc types and non-Documents removed).
    private static SearchResult BuildResult(IReadOnlyList<IPublishedContent> postFilterItems, SearchMode mode)
    {
        if (postFilterItems.Count <= DisplayLimit)
        {
            return new SearchResult(postFilterItems, mode, postFilterItems.Count);
        }

        var displayed = postFilterItems.Take(DisplayLimit).ToList();
        return new SearchResult(displayed, mode, postFilterItems.Count);
    }

    private async Task<(IReadOnlyList<IPublishedContent> Items, int RawDocumentCount)> RunSearchAsync(
        string indexAlias,
        string query,
        int take)
    {
        var searcher = _searcherResolver.GetSearcher(indexAlias);
        if (searcher == null)
        {
            return (Array.Empty<IPublishedContent>(), 0);
        }

        // ISearcher.SearchAsync does not accept a CancellationToken (framework constraint
        // confirmed still present in Umbraco.Cms.Search.Core 1.0.0). If a CT overload is
        // added in a later version, thread the request CT in here.
        ProviderSearchResult? result;
        try
        {
            result = await searcher.SearchAsync(
                indexAlias: indexAlias,
                query: query,
                skip: 0,
                take: take);
        }
        // `when (ex is not OperationCanceledException)` so a future CancellationToken overload
        // (see comment above) propagates cancellation instead of having it swallowed here. OCE
        // can't arrive today — ISearcher.SearchAsync has no CT parameter — but this self-enforces.
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Defensive guard: Umbraco.Cms.Search.Provider.Examine 1.0.0-beta.9 throws a
            // NullReferenceException from CreateAggregatedTextQuery on some multi-word
            // queries (it wraps the full query in a MultipleCharacterWildcard). Rather than
            // 500 the /search page, log and treat as zero hits so the request degrades to
            // the empty state. Remove when a fixed Provider.Examine ships — tracked in
            // CLAUDE.md "Pinned betas".
            _logger.LogWarning(
                ex,
                "Searcher for {IndexAlias} threw during SearchAsync — treating as zero hits",
                indexAlias);
            return (Array.Empty<IPublishedContent>(), 0);
        }

        // A null result indicates an infrastructure-level failure (provider misconfiguration,
        // transport error) rather than a genuine "no hits" response. Log it explicitly so
        // the silent fallback to keyword search is observable, then treat as zero hits.
        if (result == null)
        {
            _logger.LogWarning(
                "Searcher for {IndexAlias} returned null SearchResult — treating as zero hits",
                indexAlias);
            return (Array.Empty<IPublishedContent>(), 0);
        }

        // Count Document-typed hits specifically — this is the signal we use to gate
        // AI→keyword fallback. Counting the full Documents enumerable would let
        // non-Document hits (Media, Member) suppress the fallback even though they
        // get filtered out below.
        var documentHits = (result.Documents ?? Enumerable.Empty<ProviderDocument>())
            .Where(d => d.ObjectType == UmbracoObjectTypes.Document)
            .ToList();

        // Items is the FULL post-filter list (no display cap applied yet). The caller
        // applies Take(DisplayLimit) via BuildResult so TotalCount can carry the
        // pre-cap count.
        var items = documentHits
            .Select(d => _publishedContentQuery.Content(d.Id))
            .Where(c => c != null && !DocTypesToIgnore.Contains(c.ContentType.Alias))
            .ToList();

        return (items!, documentHits.Count);
    }
}
