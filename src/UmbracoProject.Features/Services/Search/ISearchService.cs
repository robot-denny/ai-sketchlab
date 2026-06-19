namespace UmbracoProject.Features.Services.Search;

public interface ISearchService
{
    Task<SearchResult> SearchAsync(string query, CancellationToken cancellationToken = default);
}
