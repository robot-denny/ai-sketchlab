using Microsoft.AspNetCore.Builder;

namespace UmbracoProject.Features.Infrastructure;

public static class GuideRedirectMiddlewareExtensions
{
    public static IApplicationBuilder UseGuideRedirects(this IApplicationBuilder app)
        => app.UseMiddleware<GuideRedirectMiddleware>();
}
