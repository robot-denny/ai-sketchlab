using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services.Navigation;
using Umbraco.Cms.Core.Web;

namespace UmbracoProject;

/// <summary>
///     Routes unresolved URLs to the published <c>Error</c> doc-type node and returns HTTP 404.
/// </summary>
/// <remarks>
///     <para>
///         Registered via <see cref="NotFoundComposer" /> as the project's
///         <see cref="IContentLastChanceFinder" />. Umbraco invokes it after every other
///         <see cref="IContentFinder" /> in the pipeline has returned <c>false</c> — i.e. only
///         when no published content matches the requested URL. ASP.NET Core's static-file
///         middleware runs <em>before</em> Umbraco's content routing, so 404s for
///         <c>/media/...</c>, <c>/assets/...</c>, etc. never reach this finder.
///     </para>
///     <para>
///         A defensive path-prefix guard skips <c>/umbraco</c> and <c>/api/</c> requests as
///         well — the middleware order normally prevents them from reaching this finder, but
///         the guarantee is operational not structural. A future route registration that
///         bypasses the standard order would otherwise get an HTML error page on what
///         should be a JSON/API 404.
///     </para>
///     <para>
///         The Error node is expected to live as a direct child of the root Home node
///         (doc-type alias <c>home</c>, with a child of doc-type alias <c>error</c>). The
///         finder resolves Home by alias rather than "first root node" so a future
///         multi-root setup or reordering of root nodes doesn't silently break the 404
///         page. If Home or its Error child is unpublished/missing, the finder returns
///         <c>false</c> and Umbraco falls back to its stock Page Not Found template.
///     </para>
///     <para>
///         Uses <see cref="IDocumentNavigationQueryService" /> (the v18-forward navigation API)
///         to walk the tree by key, then resolves each key via
///         <c>IUmbracoContext.Content.GetById</c>. Avoids the obsolete
///         <c>IPublishedContent.Children</c> property — the project-wide <c>CS0618</c>
///         suppression covers that, but the modern API is just as terse here.
///     </para>
/// </remarks>
public class NotFoundContentFinder : IContentLastChanceFinder
{
    private readonly IUmbracoContextAccessor _umbracoContextAccessor;
    private readonly IDocumentNavigationQueryService _documentNavigation;

    public NotFoundContentFinder(
        IUmbracoContextAccessor umbracoContextAccessor,
        IDocumentNavigationQueryService documentNavigation)
    {
        _umbracoContextAccessor = umbracoContextAccessor;
        _documentNavigation = documentNavigation;
    }

    public Task<bool> TryFindContent(IPublishedRequestBuilder request)
    {
        // Defensive early-exit: skip Umbraco-internal and API paths. See the
        // class remarks for the rationale.
        string absolutePath = request.Uri.AbsolutePath;
        if (absolutePath.StartsWith("/umbraco", StringComparison.OrdinalIgnoreCase)
            || absolutePath.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(false);
        }

        if (!_umbracoContextAccessor.TryGetUmbracoContext(out IUmbracoContext? umbracoContext)
            || umbracoContext?.Content is null)
        {
            return Task.FromResult(false);
        }

        // Resolve Home explicitly by doc-type alias rather than "first root node" —
        // tolerates multi-root setups and root-node reordering.
        if (!_documentNavigation.TryGetRootKeysOfType("home", out IEnumerable<Guid> homeKeys))
        {
            return Task.FromResult(false);
        }

        Guid homeKey = homeKeys.FirstOrDefault();
        if (homeKey == Guid.Empty)
        {
            return Task.FromResult(false);
        }

        if (!_documentNavigation.TryGetChildrenKeysOfType(homeKey, "error", out IEnumerable<Guid> errorKeys))
        {
            return Task.FromResult(false);
        }

        Guid errorKey = errorKeys.FirstOrDefault();
        if (errorKey == Guid.Empty)
        {
            return Task.FromResult(false);
        }

        IPublishedContent? errorNode = umbracoContext.Content.GetById(errorKey);
        if (errorNode is null)
        {
            return Task.FromResult(false);
        }

        request.SetPublishedContent(errorNode);
        request.SetResponseStatus(404);
        return Task.FromResult(true);
    }
}
