using Microsoft.AspNetCore.Http;
using UmbracoProject.Features.Infrastructure;
using Xunit;

namespace UmbracoProject.Tests.Infrastructure;

// Pins GuideRedirectMiddleware's behavior: the two legacy guide URLs 301-redirect to their
// /guides/* homes (case-insensitive, trailing-slash tolerant, query string preserved, longest-
// first), and every other path falls through untouched. Mirrors SitemapRewriteMiddlewareTests.
public class GuideRedirectMiddlewareTests
{
    private static GuideRedirectMiddleware Build(out Func<bool> nextWasCalled)
    {
        var called = false;
        nextWasCalled = () => called;
        return new GuideRedirectMiddleware(_ =>
        {
            called = true;
            return Task.CompletedTask;
        });
    }

    // Casing + trailing-slash variants all resolve to the same target — a future switch to a
    // case-sensitive or exact-only comparison must turn these red rather than silently 404.
    [Theory]
    [InlineData("/styleguide", "/guides/styleguide")]
    [InlineData("/styleguide/", "/guides/styleguide")]
    [InlineData("/StyleGuide", "/guides/styleguide")]
    [InlineData("/styleguide/components", "/guides/component-guide")]
    [InlineData("/styleguide/components/", "/guides/component-guide")]
    [InlineData("/STYLEGUIDE/COMPONENTS", "/guides/component-guide")]
    public async Task InvokeAsync_LegacyPath_301sToTargetAndDoesNotCallNext(string path, string expectedLocation)
    {
        var middleware = Build(out var nextWasCalled);
        var context = new DefaultHttpContext();
        context.Request.Path = path;

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status301MovedPermanently, context.Response.StatusCode);
        Assert.Equal(expectedLocation, context.Response.Headers.Location);
        Assert.False(nextWasCalled(), "a matched legacy path must short-circuit the pipeline");
    }

    // Longest-first ordering: /styleguide/components must NOT be captured by the /styleguide rule.
    [Fact]
    public async Task InvokeAsync_ComponentsPath_PrefersTheLongerMatch()
    {
        var middleware = Build(out _);
        var context = new DefaultHttpContext();
        context.Request.Path = "/styleguide/components";

        await middleware.InvokeAsync(context);

        Assert.Equal("/guides/component-guide", context.Response.Headers.Location);
    }

    [Fact]
    public async Task InvokeAsync_LegacyPathWithQueryString_PreservesTheQuery()
    {
        var middleware = Build(out _);
        var context = new DefaultHttpContext();
        context.Request.Path = "/styleguide";
        context.Request.QueryString = new QueryString("?ref=nav&x=1");

        await middleware.InvokeAsync(context);

        Assert.Equal("/guides/styleguide?ref=nav&x=1", context.Response.Headers.Location);
    }

    // Exact match only — an unrelated path, and a deeper legacy sub-path that never existed as a
    // node, both fall through to the next middleware with no redirect.
    [Theory]
    [InlineData("/about")]
    [InlineData("/guides/styleguide")]
    [InlineData("/styleguide/components/extra")]
    [InlineData("/styleguideish")]
    public async Task InvokeAsync_NonLegacyPath_CallsNextAndDoesNotRedirect(string path)
    {
        var middleware = Build(out var nextWasCalled);
        var context = new DefaultHttpContext();
        context.Request.Path = path;

        await middleware.InvokeAsync(context);

        Assert.True(nextWasCalled(), "a non-legacy path must continue the pipeline");
        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        Assert.True(string.IsNullOrEmpty(context.Response.Headers.Location));
    }
}
