using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Core.Cache;
using Umbraco.Cms.Core.Logging;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Services.Navigation;
using Umbraco.Cms.Core.Web;
using Umbraco.Cms.Infrastructure.Persistence;
using Umbraco.Cms.Web.Website.Controllers;

namespace UmbracoProject.Controllers;

/// <summary>
///     Serves the XML sitemap at <c>/sitemap.xml</c> by re-using the existing recursion
///     in <c>Views/Partials/xmlSitemap.cshtml</c>.
/// </summary>
/// <remarks>
///     <para>
///         Umbraco templates derive their URL from the document-type alias as a slug, so a
///         template-backed page can only ever render at <c>/sitemap</c> — never
///         <c>/sitemap.xml</c>. A <see cref="SurfaceController" /> with an explicit
///         <c>[Route]</c> is the canonical way to serve an extension-bearing URL while
///         still resolving Home through the published content cache.
///     </para>
///     <para>
///         The legacy <c>/xmlsitemap</c> template-backed URL is preserved and 301-redirected
///         here from <c>Views/xMLSitemap.cshtml</c> — see that file for the redirect.
///     </para>
/// </remarks>
public class SitemapController : SurfaceController
{
    private readonly IDocumentNavigationQueryService _documentNavigation;

    public SitemapController(
        IUmbracoContextAccessor umbracoContextAccessor,
        IUmbracoDatabaseFactory databaseFactory,
        ServiceContext services,
        AppCaches appCaches,
        IProfilingLogger profilingLogger,
        IPublishedUrlProvider publishedUrlProvider,
        IDocumentNavigationQueryService documentNavigation)
        : base(umbracoContextAccessor, databaseFactory, services, appCaches, profilingLogger, publishedUrlProvider)
    {
        _documentNavigation = documentNavigation;
    }

    [HttpGet]
    [Route("/sitemap.xml")]
    // 1-hour Cache-Control header restores effective parity with the prior
    // Html.CachedPartialAsync(TimeSpan.FromMinutes(60)) behavior — at the HTTP
    // layer (honored by CDNs and crawlers) rather than in-process. The render
    // is bounded for the current ~30-node tree; revisit with [OutputCache] +
    // app.UseOutputCache() if the site grows or perf becomes a concern.
    [ResponseCache(Duration = 3600, Location = ResponseCacheLocation.Any)]
    public IActionResult Index()
    {
        // Resolve Home explicitly by doc-type alias rather than "first root node" —
        // matches the NotFoundContentFinder pattern and tolerates multi-root setups.
        if (!_documentNavigation.TryGetRootKeysOfType("home", out IEnumerable<Guid> homeKeys))
        {
            return NotFound();
        }

        Guid homeKey = homeKeys.FirstOrDefault();
        if (homeKey == Guid.Empty)
        {
            return NotFound();
        }

        IPublishedContent? home = UmbracoContext.Content?.GetById(homeKey);
        if (home is null)
        {
            return NotFound();
        }

        Response.ContentType = "application/xml";
        return PartialView("~/Views/Partials/xmlSitemap.cshtml", home);
    }
}
