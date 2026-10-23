using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Web;

namespace UmbracoProject.Features.Services.Content;

/// <summary>
/// Mirrors Umbraco 18.2.1's own <c>PublishedContentUrlSegmentResolver</c>, which backs the
/// obsolete property: ambient variation-context culture (empty for invariant, which
/// <see cref="IDocumentUrlService"/> resolves via its invariant lookup), and draft in preview.
/// <see cref="IDocumentUrlService.GetUrlSegment"/> is an in-memory cache lookup.
/// </summary>
public sealed class UrlSegmentReader : IUrlSegmentReader
{
    private readonly IDocumentUrlService _documentUrlService;
    private readonly IVariationContextAccessor _variationContextAccessor;
    private readonly IUmbracoContextAccessor _umbracoContextAccessor;

    public UrlSegmentReader(
        IDocumentUrlService documentUrlService,
        IVariationContextAccessor variationContextAccessor,
        IUmbracoContextAccessor umbracoContextAccessor)
    {
        _documentUrlService = documentUrlService;
        _variationContextAccessor = variationContextAccessor;
        _umbracoContextAccessor = umbracoContextAccessor;
    }

    public string GetUrlSegment(IPublishedContent content)
    {
        var culture = _variationContextAccessor.VariationContext?.Culture ?? string.Empty;
        var isDraft = _umbracoContextAccessor.TryGetUmbracoContext(out var umbracoContext)
            && umbracoContext.InPreviewMode;
        return _documentUrlService.GetUrlSegment(content.Key, culture, isDraft) ?? string.Empty;
    }
}
