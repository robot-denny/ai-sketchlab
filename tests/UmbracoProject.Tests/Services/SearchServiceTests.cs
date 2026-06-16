using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NSubstitute;
using Umbraco.AI.Search.Core;
using Umbraco.AI.Search.Core.Configuration;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Search.Core.Models.Searching;
using Umbraco.Cms.Search.Core.Models.Searching.Faceting;
using Umbraco.Cms.Search.Core.Services;
using UmbracoProject.Services;
using Xunit;

using SearchCoreConstants = Umbraco.Cms.Search.Core.Constants;
using ProviderSearchResult = Umbraco.Cms.Search.Core.Models.Searching.SearchResult;
using Filter = Umbraco.Cms.Search.Core.Models.Searching.Filtering.Filter;
using Sorter = Umbraco.Cms.Search.Core.Models.Searching.Sorting.Sorter;

namespace UmbracoProject.Tests.Services;

public class SearchServiceTests
{
    private readonly IPublishedContentQuery _publishedContentQuery;
    private readonly ISearcherResolver _searcherResolver;
    private readonly ISearcher _keywordSearcher;
    private readonly ISearcher _aiSearcher;
    private readonly MemoryCache _memoryCache;
    private readonly SearchService _sut;

    public SearchServiceTests()
    {
        _publishedContentQuery = Substitute.For<IPublishedContentQuery>();
        _searcherResolver = Substitute.For<ISearcherResolver>();
        _keywordSearcher = Substitute.For<ISearcher>();
        _aiSearcher = Substitute.For<ISearcher>();
        _memoryCache = new MemoryCache(new MemoryCacheOptions());

        _searcherResolver.GetSearcher(SearchCoreConstants.IndexAliases.PublishedContent).Returns(_keywordSearcher);
        _searcherResolver.GetSearcher(AISearchConstants.IndexAliases.Search).Returns(_aiSearcher);

        var options = Options.Create(new AIVectorSearchOptions { DefaultTopK = 50 });
        var logger = NullLogger<SearchService>.Instance;

        _sut = new SearchService(_publishedContentQuery, _searcherResolver, _memoryCache, options, logger);
    }

    [Fact]
    public async Task EmptyQuery_ReturnsEmptyResult_DoesNotInvokeSearcher()
    {
        var result = await _sut.SearchAsync("");

        Assert.Empty(result.Items);
        _searcherResolver.DidNotReceiveWithAnyArgs().GetSearcher(default!);
    }

    [Fact]
    public async Task WhitespaceQuery_ReturnsEmptyResult_DoesNotInvokeSearcher()
    {
        var result = await _sut.SearchAsync("   ");

        Assert.Empty(result.Items);
        _searcherResolver.DidNotReceiveWithAnyArgs().GetSearcher(default!);
    }

    [Fact]
    public async Task NullQuery_ReturnsEmptyResult_DoesNotInvokeSearcher()
    {
        var result = await _sut.SearchAsync(null!);

        Assert.Empty(result.Items);
        _searcherResolver.DidNotReceiveWithAnyArgs().GetSearcher(default!);
    }

    [Fact]
    public async Task OneTokenQuery_RoutesToKeywordSearcher()
    {
        SetupSearcherWithArticles(_keywordSearcher, count: 3);

        var result = await _sut.SearchAsync("contact");

        await _keywordSearcher.Received(1).SearchAsync(
            indexAlias: SearchCoreConstants.IndexAliases.PublishedContent,
            query: "contact",
            filters: Arg.Any<IEnumerable<Filter>?>(),
            facets: Arg.Any<IEnumerable<Facet>?>(),
            sorters: Arg.Any<IEnumerable<Sorter>?>(),
            culture: Arg.Any<string?>(),
            segment: Arg.Any<string?>(),
            accessContext: Arg.Any<AccessContext?>(),
            skip: 0,
            take: Arg.Any<int>(),
            maxSuggestions: Arg.Any<int>());

        await _aiSearcher.DidNotReceiveWithAnyArgs().SearchAsync(default!);
        Assert.Equal(SearchMode.Keyword, result.Mode);
        Assert.Equal(3, result.Items.Count);
    }

    [Fact]
    public async Task TwoTokenQuery_RoutesToKeywordSearcher_Boundary()
    {
        SetupSearcherWithArticles(_keywordSearcher, count: 2);

        var result = await _sut.SearchAsync("John Doe");

        await _keywordSearcher.Received(1).SearchAsync(
            indexAlias: SearchCoreConstants.IndexAliases.PublishedContent,
            query: "John Doe",
            filters: Arg.Any<IEnumerable<Filter>?>(),
            facets: Arg.Any<IEnumerable<Facet>?>(),
            sorters: Arg.Any<IEnumerable<Sorter>?>(),
            culture: Arg.Any<string?>(),
            segment: Arg.Any<string?>(),
            accessContext: Arg.Any<AccessContext?>(),
            skip: 0,
            take: Arg.Any<int>(),
            maxSuggestions: Arg.Any<int>());

        await _aiSearcher.DidNotReceiveWithAnyArgs().SearchAsync(default!);
        Assert.Equal(SearchMode.Keyword, result.Mode);
    }

    [Fact]
    public async Task ThreeTokenQuery_RoutesToAiSearcher_First()
    {
        SetupSearcherWithArticles(_aiSearcher, count: 4);

        var result = await _sut.SearchAsync("stories about resilience");

        await _aiSearcher.Received(1).SearchAsync(
            indexAlias: AISearchConstants.IndexAliases.Search,
            query: "stories about resilience",
            filters: Arg.Any<IEnumerable<Filter>?>(),
            facets: Arg.Any<IEnumerable<Facet>?>(),
            sorters: Arg.Any<IEnumerable<Sorter>?>(),
            culture: Arg.Any<string?>(),
            segment: Arg.Any<string?>(),
            accessContext: Arg.Any<AccessContext?>(),
            skip: 0,
            take: Arg.Any<int>(),
            maxSuggestions: Arg.Any<int>());

        Assert.Equal(SearchMode.AiSemantic, result.Mode);
        Assert.Equal(4, result.Items.Count);
    }

    [Fact]
    public async Task AiReturnsZeroRawHits_FallsBackToKeyword()
    {
        SetupSearcher(_aiSearcher, Array.Empty<Document>());
        SetupSearcherWithArticles(_keywordSearcher, count: 2);

        var result = await _sut.SearchAsync("a long natural language query");

        await _aiSearcher.Received(1).SearchAsync(
            indexAlias: AISearchConstants.IndexAliases.Search,
            query: Arg.Any<string?>(),
            filters: Arg.Any<IEnumerable<Filter>?>(),
            facets: Arg.Any<IEnumerable<Facet>?>(),
            sorters: Arg.Any<IEnumerable<Sorter>?>(),
            culture: Arg.Any<string?>(),
            segment: Arg.Any<string?>(),
            accessContext: Arg.Any<AccessContext?>(),
            skip: 0,
            take: Arg.Any<int>(),
            maxSuggestions: Arg.Any<int>());

        await _keywordSearcher.Received(1).SearchAsync(
            indexAlias: SearchCoreConstants.IndexAliases.PublishedContent,
            query: Arg.Any<string?>(),
            filters: Arg.Any<IEnumerable<Filter>?>(),
            facets: Arg.Any<IEnumerable<Facet>?>(),
            sorters: Arg.Any<IEnumerable<Sorter>?>(),
            culture: Arg.Any<string?>(),
            segment: Arg.Any<string?>(),
            accessContext: Arg.Any<AccessContext?>(),
            skip: 0,
            take: Arg.Any<int>(),
            maxSuggestions: Arg.Any<int>());

        Assert.Equal(2, result.Items.Count);
        // Mode reflects the original routing decision (long query → AI semantic),
        // not which searcher actually produced the results in the fallback.
        Assert.Equal(SearchMode.AiSemantic, result.Mode);
    }

    [Fact]
    public async Task AiReturnsHitsAllSystemDocTypes_DoesNotFallBack()
    {
        // AI returns 1 raw hit, but it's a Category doc that gets filtered out.
        // Because the raw count > 0, the fallback to keyword is NOT triggered.
        var categoryId = Guid.NewGuid();
        SetupSearcher(_aiSearcher, new[] { new Document(categoryId, UmbracoObjectTypes.Document) });
        var category = MakePublishedContent("category");
        _publishedContentQuery.Content(categoryId).Returns(category);

        var result = await _sut.SearchAsync("stories about category things");

        await _aiSearcher.Received(1).SearchAsync(
            indexAlias: AISearchConstants.IndexAliases.Search,
            query: Arg.Any<string?>(),
            filters: Arg.Any<IEnumerable<Filter>?>(),
            facets: Arg.Any<IEnumerable<Facet>?>(),
            sorters: Arg.Any<IEnumerable<Sorter>?>(),
            culture: Arg.Any<string?>(),
            segment: Arg.Any<string?>(),
            accessContext: Arg.Any<AccessContext?>(),
            skip: 0,
            take: Arg.Any<int>(),
            maxSuggestions: Arg.Any<int>());

        await _keywordSearcher.DidNotReceiveWithAnyArgs().SearchAsync(default!);
        Assert.Empty(result.Items);
        Assert.Equal(SearchMode.AiSemantic, result.Mode);
    }

    [Fact]
    public async Task SystemDocTypes_FilteredFromResults()
    {
        var articleId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var errorId = Guid.NewGuid();

        SetupSearcher(_keywordSearcher, new[]
        {
            new Document(articleId, UmbracoObjectTypes.Document),
            new Document(categoryId, UmbracoObjectTypes.Document),
            new Document(errorId, UmbracoObjectTypes.Document),
        });
        var article = MakePublishedContent("article");
        var category = MakePublishedContent("category");
        var error = MakePublishedContent("error");
        _publishedContentQuery.Content(articleId).Returns(article);
        _publishedContentQuery.Content(categoryId).Returns(category);
        _publishedContentQuery.Content(errorId).Returns(error);

        var result = await _sut.SearchAsync("contact");

        Assert.Single(result.Items);
        Assert.Equal("article", result.Items[0].ContentType.Alias);
    }

    [Fact]
    public async Task ResultLimit_Capped_At_20()
    {
        SetupSearcherWithArticles(_keywordSearcher, count: 30);

        var result = await _sut.SearchAsync("contact");

        Assert.Equal(20, result.Items.Count);
        // TotalCount carries the pre-cap, post-filter count so a future view can render
        // "Showing 20 of 30 results" without needing a separate count call.
        Assert.Equal(30, result.TotalCount);
    }

    [Fact]
    public async Task RepeatQuery_WithinCacheWindow_ReturnsCachedResult_SearcherInvokedOnce()
    {
        SetupSearcherWithArticles(_keywordSearcher, count: 2);

        var first = await _sut.SearchAsync("contact");
        var second = await _sut.SearchAsync("contact");

        await _keywordSearcher.Received(1).SearchAsync(
            indexAlias: Arg.Any<string>(),
            query: Arg.Any<string?>(),
            filters: Arg.Any<IEnumerable<Filter>?>(),
            facets: Arg.Any<IEnumerable<Facet>?>(),
            sorters: Arg.Any<IEnumerable<Sorter>?>(),
            culture: Arg.Any<string?>(),
            segment: Arg.Any<string?>(),
            accessContext: Arg.Any<AccessContext?>(),
            skip: Arg.Any<int>(),
            take: Arg.Any<int>(),
            maxSuggestions: Arg.Any<int>());

        Assert.Equal(first.Items.Count, second.Items.Count);
    }

    [Fact]
    public async Task KeywordAndAi_CacheKeysDistinct()
    {
        SetupSearcherWithArticles(_keywordSearcher, count: 1);
        SetupSearcherWithArticles(_aiSearcher, count: 1);

        await _sut.SearchAsync("contact");
        await _sut.SearchAsync("contact stories of resilience");

        await _keywordSearcher.Received(1).SearchAsync(
            indexAlias: Arg.Any<string>(),
            query: Arg.Any<string?>(),
            filters: Arg.Any<IEnumerable<Filter>?>(),
            facets: Arg.Any<IEnumerable<Facet>?>(),
            sorters: Arg.Any<IEnumerable<Sorter>?>(),
            culture: Arg.Any<string?>(),
            segment: Arg.Any<string?>(),
            accessContext: Arg.Any<AccessContext?>(),
            skip: Arg.Any<int>(),
            take: Arg.Any<int>(),
            maxSuggestions: Arg.Any<int>());

        await _aiSearcher.Received(1).SearchAsync(
            indexAlias: Arg.Any<string>(),
            query: Arg.Any<string?>(),
            filters: Arg.Any<IEnumerable<Filter>?>(),
            facets: Arg.Any<IEnumerable<Facet>?>(),
            sorters: Arg.Any<IEnumerable<Sorter>?>(),
            culture: Arg.Any<string?>(),
            segment: Arg.Any<string?>(),
            accessContext: Arg.Any<AccessContext?>(),
            skip: Arg.Any<int>(),
            take: Arg.Any<int>(),
            maxSuggestions: Arg.Any<int>());
    }

    [Fact]
    public async Task SearcherThrows_DegradesToEmptyResult_DoesNotPropagate()
    {
        // Guards the Umbraco.Cms.Search.Provider.Examine 1.0.0-beta.9 multi-word-query NRE:
        // when the searcher throws, RunSearchAsync logs and returns zero hits so /search
        // degrades to the empty state instead of surfacing a 500.
        SetupThrowingSearcher(_keywordSearcher, new NullReferenceException("CreateAggregatedTextQuery"));

        var result = await _sut.SearchAsync("contact");

        Assert.Empty(result.Items);
        Assert.Equal(0, result.TotalCount);
        Assert.Equal(SearchMode.Keyword, result.Mode);
    }

    [Fact]
    public async Task SearcherThrows_OperationCanceled_IsNotSwallowed()
    {
        // The guard intentionally excludes OperationCanceledException (catch ... when
        // (ex is not OperationCanceledException)) so cancellation propagates rather than
        // being logged as a benign zero-hit result.
        SetupThrowingSearcher(_keywordSearcher, new OperationCanceledException());

        await Assert.ThrowsAsync<OperationCanceledException>(() => _sut.SearchAsync("contact"));
    }

    // --- Helpers ---

    private void SetupSearcherWithArticles(ISearcher searcher, int count)
    {
        var docs = new List<Document>();
        for (var i = 0; i < count; i++)
        {
            var id = Guid.NewGuid();
            docs.Add(new Document(id, UmbracoObjectTypes.Document));
            // Build the substitute OUTSIDE the Returns(...) call — creating a substitute
            // inside Returns() resets NSubstitute's "last call" tracking and breaks setup.
            var article = MakePublishedContent("article");
            _publishedContentQuery.Content(id).Returns(article);
        }
        SetupSearcher(searcher, docs);
    }

    private static void SetupThrowingSearcher(ISearcher searcher, Exception exception)
    {
        searcher.SearchAsync(
            indexAlias: Arg.Any<string>(),
            query: Arg.Any<string?>(),
            filters: Arg.Any<IEnumerable<Filter>?>(),
            facets: Arg.Any<IEnumerable<Facet>?>(),
            sorters: Arg.Any<IEnumerable<Sorter>?>(),
            culture: Arg.Any<string?>(),
            segment: Arg.Any<string?>(),
            accessContext: Arg.Any<AccessContext?>(),
            skip: Arg.Any<int>(),
            take: Arg.Any<int>(),
            maxSuggestions: Arg.Any<int>()).Returns(Task.FromException<ProviderSearchResult>(exception));
    }

    private static void SetupSearcher(ISearcher searcher, IReadOnlyCollection<Document> docs)
    {
        var providerResult = new ProviderSearchResult(
            Total: docs.Count,
            Documents: docs,
            Facets: Array.Empty<FacetResult>(),
            Suggestions: null);

        searcher.SearchAsync(
            indexAlias: Arg.Any<string>(),
            query: Arg.Any<string?>(),
            filters: Arg.Any<IEnumerable<Filter>?>(),
            facets: Arg.Any<IEnumerable<Facet>?>(),
            sorters: Arg.Any<IEnumerable<Sorter>?>(),
            culture: Arg.Any<string?>(),
            segment: Arg.Any<string?>(),
            accessContext: Arg.Any<AccessContext?>(),
            skip: Arg.Any<int>(),
            take: Arg.Any<int>(),
            maxSuggestions: Arg.Any<int>()).Returns(Task.FromResult(providerResult));
    }

    private static IPublishedContent MakePublishedContent(string alias)
    {
        var content = Substitute.For<IPublishedContent>();
        var contentType = Substitute.For<IPublishedContentType>();
        contentType.Alias.Returns(alias);
        content.ContentType.Returns(contentType);
        return content;
    }
}
