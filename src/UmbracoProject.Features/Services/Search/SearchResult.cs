using Umbraco.Cms.Core.Models.PublishedContent;

namespace UmbracoProject.Features.Services.Search;

public sealed record SearchResult(IReadOnlyList<IPublishedContent> Items, SearchMode Mode, int TotalCount);
