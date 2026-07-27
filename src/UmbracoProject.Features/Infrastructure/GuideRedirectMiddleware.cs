using Microsoft.AspNetCore.Http;

namespace UmbracoProject.Features.Infrastructure;

// Legacy-URL 301 redirects for the consolidated guide pages. The Styleguide and
// Component Guide moved onto one `guidePage` doc type under /guides/, but because
// the new pages are brand-new nodes (not renamed ones), Umbraco's built-in URL
// Tracker won't auto-create redirects from the old URLs. This middleware issues
// explicit permanent redirects so the legacy URLs don't 404 for visitors/crawlers:
//   /styleguide            → /guides/styleguide
//   /styleguide/components → /guides/component-guide
// Matches are exact (case-insensitive, trailing-slash tolerant) — only these two
// paths redirect; anything else falls through untouched. Runs before Umbraco's
// content routing (see Program.cs) so the redirect fires ahead of content/static
// handling. A DB `umbracoRedirectUrl` seed would be per-environment and
// non-deployable; this middleware is deployable and environment-agnostic.
public class GuideRedirectMiddleware
{
    private readonly RequestDelegate _next;

    public GuideRedirectMiddleware(RequestDelegate next)
        => _next = next;

    // Longest-first so /styleguide/components is matched before /styleguide. These are the ONLY two
    // legacy URLs that ever existed — deeper legacy sub-paths (none exist) intentionally fall through
    // to a normal 404 rather than redirect. The trailing-slash variant is precomputed here (not
    // per-request) so nothing allocates on the hot path: this middleware runs ahead of static-file
    // handling, so it sees every request including assets.
    private static readonly (string LegacyPath, string LegacyPathWithSlash, string TargetPath)[] Redirects =
    {
        ("/styleguide/components", "/styleguide/components/", "/guides/component-guide"),
        ("/styleguide", "/styleguide/", "/guides/styleguide"),
    };

    public async Task InvokeAsync(HttpContext context)
    {
        PathString path = context.Request.Path;

        foreach ((string legacyPath, string legacyPathWithSlash, string targetPath) in Redirects)
        {
            if (path.Equals(legacyPath, StringComparison.OrdinalIgnoreCase)
                || path.Equals(legacyPathWithSlash, StringComparison.OrdinalIgnoreCase))
            {
                // Method-agnostic (matches SitemapRewriteMiddleware): content URLs are GET-only in
                // practice, so a POST/HEAD hitting a legacy path and being redirected is harmless.
                // 301 (not 302/308) because these moves are permanent — but note a 301 is cached hard
                // by clients, so if a /guides/* target is ever renamed again the re-migration must
                // re-point the target here (cached clients won't re-consult a stale legacy URL).
                string location = targetPath + context.Request.QueryString;
                context.Response.StatusCode = StatusCodes.Status301MovedPermanently;
                context.Response.Headers.Location = location;
                return;
            }
        }

        await _next(context);
    }
}
