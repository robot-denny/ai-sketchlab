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

// Internal rewrite: /sitemap.xml → /xmlsitemap. The xMLSitemap doc-type's
// natural template URL is /xmlsitemap (derived from the alias), but
// /sitemap.xml is the canonical industry-standard URL. Rewriting before
// Umbraco's content routing lets the existing template render under its
// normal request pipeline (with IUmbracoContext active throughout view
// execution); a SurfaceController or IContentFinder approach can't
// because the `.xml` extension is filtered out of Umbraco's content
// routing (treated as a static-asset URL). Client-visible URL stays
// /sitemap.xml — this is an internal rewrite, not a redirect.
app.Use(async (context, next) =>
{
    if (context.Request.Path.Equals("/sitemap.xml", StringComparison.OrdinalIgnoreCase))
    {
        context.Request.Path = "/xmlsitemap";
    }

    await next();
});

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
