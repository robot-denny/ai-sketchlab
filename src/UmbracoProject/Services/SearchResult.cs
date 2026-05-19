using Umbraco.Cms.Core.Models.PublishedContent;

namespace UmbracoProject.Services;

public sealed record SearchResult(IReadOnlyList<IPublishedContent> Items, SearchMode Mode, int TotalCount);
