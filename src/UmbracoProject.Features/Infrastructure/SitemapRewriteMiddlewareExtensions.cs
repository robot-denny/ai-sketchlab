using Microsoft.AspNetCore.Builder;

namespace UmbracoProject.Features.Infrastructure;

public static class SitemapRewriteMiddlewareExtensions
{
    public static IApplicationBuilder UseSitemapRewrite(this IApplicationBuilder app)
        => app.UseMiddleware<SitemapRewriteMiddleware>();
}
