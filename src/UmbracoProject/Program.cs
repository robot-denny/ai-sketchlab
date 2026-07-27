using UmbracoProject.Features.Infrastructure;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.CreateUmbracoBuilder()
    .AddBackOffice()
    .AddWebsite()
    .AddComposers()
    .Build();

builder.Services.AddControllers()
    .AddApplicationPart(typeof(HelloWorld.ImageGeneratorController).Assembly);

WebApplication app = builder.Build();

await app.BootUmbracoAsync();

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
