using Microsoft.AspNetCore.Http;
using UmbracoProject.Features.Infrastructure;
using Xunit;

namespace UmbracoProject.Tests.Infrastructure;

// Pins the SitemapRewriteMiddleware's path-rewrite behavior, extracted from the inline
// app.Use(...) lambda that previously lived in Program.cs (arch-feature-folder-migration Step 1).
// The middleware must match the lambda byte-for-byte: rewrite /sitemap.xml → /xmlsitemap
// (case-insensitive), pass everything else through unchanged. Both facts assert next is invoked,
// since the middleware always continues the pipeline.
public class SitemapRewriteMiddlewareTests
{
    // Covers casing variants explicitly: the rewrite uses StringComparison.OrdinalIgnoreCase,
    // so a future change to a case-sensitive comparison must turn these red rather than slip
    // through (it would otherwise 404 /Sitemap.xml in production silently).
    [Theory]
    [InlineData("/sitemap.xml")]
    [InlineData("/Sitemap.xml")]
    [InlineData("/SITEMAP.XML")]
    public async Task InvokeAsync_WhenPathIsSitemapXmlAnyCase_RewritesToXmlSitemapAndCallsNext(string path)
    {
        var nextCalled = false;
        var middleware = new SitemapRewriteMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });
        var context = new DefaultHttpContext();
        context.Request.Path = path;

        await middleware.InvokeAsync(context);

        Assert.Equal("/xmlsitemap", context.Request.Path.Value);
        Assert.True(nextCalled);
    }

    [Fact]
    public async Task InvokeAsync_WhenPathIsNotSitemapXml_LeavesPathUnchangedAndCallsNext()
    {
        var nextCalled = false;
        var middleware = new SitemapRewriteMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });
        var context = new DefaultHttpContext();
        context.Request.Path = "/about";

        await middleware.InvokeAsync(context);

        Assert.Equal("/about", context.Request.Path.Value);
        Assert.True(nextCalled);
    }
}
