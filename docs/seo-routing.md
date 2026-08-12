# SEO Routing

Three URLs power the site's SEO surface: `/sitemap.xml`, `/robots.txt`, and the branded 404 page. Each is wired up in-tree with C# / static files that flow through the normal `master → Dev → Live` pipeline — no per-environment backoffice configuration. We deliberately removed the `SeoToolkit.Umbraco` package because it had no Umbraco Deploy integration and would have permanently parked its config in each environment's DB; see [_work/shipped/remove-seotoolkit/spec.md](../_work/shipped/remove-seotoolkit/spec.md) for the full rationale.

The existing custom SEO surface stays untouched: [Views/Partials/metaData.cshtml](../src/UmbracoProject/Views/Partials/metaData.cshtml) renders ~25 meta/link tags from the `SEO Controls` doc-type composition (field aliases `metaName` / `metaDescription` / `metaKeywords` / `isIndexable` / `isFollowable`), and the `SEO Assistant` AI agent's system prompt hard-codes those aliases.

## `/sitemap.xml` — URL rewrite middleware

The rewrite now lives in `SitemapRewriteMiddleware` (in the `UmbracoProject.Features` RCL under `Infrastructure/`), registered via `app.UseSitemapRewrite()` in [src/UmbracoProject/Program.cs](../src/UmbracoProject/Program.cs) (still before `app.UseUmbraco()`, after `UseHttpsRedirection()`). It rewrites `/sitemap.xml` → `/xmlsitemap` internally. The existing `xMLSitemap` doc-type's template at [Views/xMLSitemap.cshtml](../src/UmbracoProject/Views/xMLSitemap.cshtml) then renders the response via [Views/Partials/xmlSitemap.cshtml](../src/UmbracoProject/Views/Partials/xmlSitemap.cshtml), wrapped in `Html.CachedPartialAsync(..., TimeSpan.FromMinutes(60))` and served with `Cache-Control: public, max-age=3600` for CDN/crawler edge-caching. The rewrite is internal — client-visible URL stays `/sitemap.xml`. Both `/sitemap.xml` and `/xmlsitemap` reach the same content node and serve identical bodies.

Why a rewrite and not a `SurfaceController` or `IContentFinder`? Both alternatives were tried and rejected:

- **SurfaceController**: the controller action can render the partial, but `IUmbracoContext` is disposed before the partial actually renders. The canonical workaround — `using UmbracoContextReference contextRef = _umbracoContextFactory.EnsureUmbracoContext()` — releases the context at the `using` block's end, which is when the action returns; the `PartialView` result executes *later* in MVC's pipeline, so `IPublishedContent.Url(mode:UrlMode.Absolute)` (and anything else that requires an active context) throws at render time.
- **IContentFinder**: Umbraco's content routing treats URLs with file extensions (`.xml`, `.txt`, etc.) as static-asset requests and filters them out before any `IContentFinder` runs. The finder never gets a chance to claim `/sitemap.xml`.

The rewrite sidesteps both: by the time Umbraco's routing sees the request, the path is `/xmlsitemap` (no extension) and resolves to the doc-type node through the normal pipeline, with `IUmbracoContext` active throughout. The comment in `Program.cs` documents the same.

## `/robots.txt` — static file

Served by ASP.NET Core's static-file middleware from [src/UmbracoProject/wwwroot/robots.txt](../src/UmbracoProject/wwwroot/robots.txt). Edit it in-repo, deploy via the normal pipeline. The `Sitemap:` directive references Live's URL by convention (absolute URLs are required by the robots.txt spec) — Dev and local environments intentionally name Live's host too, since crawlers discover `/sitemap.xml` by convention regardless of which host the directive points at.

## 404s — `IContentLastChanceFinder`

[NotFoundContentFinder.cs](../src/UmbracoProject.Features/Infrastructure/ContentFinder/NotFoundContentFinder.cs) (in the `UmbracoProject.Features` RCL under `Infrastructure/ContentFinder/`, registered via [NotFoundComposer.cs](../src/UmbracoProject.Features/Composer/NotFoundComposer.cs) under `Composer/`) resolves unmatched URLs to the published `Error` doc-type node (alias `error`, expected as a direct child of `Home` alias `home`) and sets HTTP 404. Uses `IDocumentNavigationQueryService` (the v18-forward navigation API) to walk by doc-type alias rather than "first root node", so multi-root or reordered setups don't silently break.

**Static-asset 404s are NOT intercepted.** The `IContentLastChanceFinder` interface only fires when Umbraco's content routing has exhausted every `IContentFinder` without a match — which happens *after* ASP.NET's static-file middleware has already given up on `/media/...`, `/assets/...`, etc. Those still get the framework's plain 404.

The finder also has an explicit path-prefix guard that skips `/umbraco` and `/api/` requests — defense in depth so a future route registration that bypasses standard middleware order doesn't get an HTML error response on what should be a JSON 404.

## Rename-redirects — built-in URL Tracker

Umbraco's built-in URL Tracker is active (default; `Umbraco:CMS:WebRouting:DisableRedirectUrlTracking` is unset) and handles rename-redirects automatically without code — when a content node's URL changes, the old URL 301s to the new one for as long as the redirect entry exists in `umbracoRedirectUrl`.
