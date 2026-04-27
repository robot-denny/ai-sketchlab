using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Extensions;

namespace UmbracoProject.Helpers;

public static class PageHeadPatternExtensions
{
    public static string? PageHeadPattern(this IPublishedContent? page)
    {
        if (page == null) return null;
        if (!page.HasProperty("pageHeadPattern")) return null;

        var raw = page.Value<string>("pageHeadPattern");
        if (string.IsNullOrWhiteSpace(raw) || string.Equals(raw, "none", StringComparison.OrdinalIgnoreCase))
            return null;

        return raw;
    }
}
