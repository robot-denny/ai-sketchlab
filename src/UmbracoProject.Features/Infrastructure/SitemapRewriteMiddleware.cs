using Microsoft.AspNetCore.Http;

namespace UmbracoProject.Features.Infrastructure;

// Internal rewrite: /sitemap.xml → /xmlsitemap. The xMLSitemap doc-type's
// natural template URL is /xmlsitemap (derived from the alias), but
// /sitemap.xml is the canonical industry-standard URL. Rewriting before
// Umbraco's content routing lets the existing template render under its
// normal request pipeline (with IUmbracoContext active throughout view
// execution); a SurfaceController or IContentFinder approach can't
// because the `.xml` extension is filtered out of Umbraco's content
// routing (treated as a static-asset URL). Client-visible URL stays
// /sitemap.xml — this is an internal rewrite, not a redirect.
public class SitemapRewriteMiddleware
{
    private readonly RequestDelegate _next;

    public SitemapRewriteMiddleware(RequestDelegate next)
        => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.Equals("/sitemap.xml", StringComparison.OrdinalIgnoreCase))
        {
            context.Request.Path = "/xmlsitemap";
        }

        await _next(context);
    }
}
