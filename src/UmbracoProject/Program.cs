using UmbracoProject.Features.Infrastructure;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.CreateUmbracoBuilder()
    .AddBackOffice()
    .AddWebsite()
    .AddComposers()
    .Build();

builder.Services.AddControllers()
    .AddApplicationPart(typeof(HelloWorld.ImageGeneratorController).Assembly);

// Response compression for static text assets, and DELIBERATELY NOT for text/html.
// Compressing a response that mixes a secret with attacker-influenced content is the
// BREACH attack, and an HTML page carrying an antiforgery token is exactly that shape —
// which is why `EnableForHttps` is off by default in ASP.NET Core. Stylesheets, scripts
// and SVG carry no per-user secret and reflect no request input, so they compress safely,
// and they are where the bytes are: spell-cards.css alone is ~45KB raw against ~13KB
// compressed. Umbraco Cloud's frontend may also compress at the edge; it will not
// double-encode a response that already carries Content-Encoding.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.MimeTypes = new[]
    {
        "text/css",
        "text/javascript",
        "application/javascript",
        "image/svg+xml",
        "application/json",
        "application/manifest+json",
        "text/plain",
    };
});

WebApplication app = builder.Build();

await app.BootUmbracoAsync();

// Must precede every middleware that writes a response body, including Umbraco's own
// static-file handling inside UseUmbraco().
app.UseResponseCompression();

app.UseHttpsRedirection();

// Internal rewrite: /sitemap.xml → /xmlsitemap. Must stay between UseHttpsRedirection()
// and UseUmbraco() — the rewrite has to run before Umbraco's content routing sees the
// request (the `.xml` extension is otherwise filtered out as a static-asset URL). See
// SitemapRewriteMiddleware for the full rationale.
app.UseSitemapRewrite();

// Legacy-URL 301 redirects for the consolidated guide pages (/styleguide → /guides/styleguide,
// /styleguide/components → /guides/component-guide). Must run before UseUmbraco() so the redirect
// fires ahead of Umbraco's content routing/static-file handling. See GuideRedirectMiddleware for
// the full rationale (new nodes, so URL Tracker won't auto-redirect).
app.UseGuideRedirects();

app.UseUmbraco()
    .WithMiddleware(u =>
    {
        u.UseBackOffice();
        u.UseWebsite();
    })
    .WithEndpoints(u =>
    {
        u.UseBackOfficeEndpoints();
        u.UseWebsiteEndpoints();
    });

app.MapControllers();

await app.RunAsync();
