using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using UmbracoProject.Features.Infrastructure.ContentFinder;

namespace UmbracoProject.Features.Composer;

/// <summary>
///     Registers <see cref="NotFoundContentFinder" /> as the project's
///     <c>IContentLastChanceFinder</c>, so requests that no other finder resolves are
///     served by the branded Error doc-type page with HTTP 404.
/// </summary>
public class NotFoundComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
        => builder.SetContentLastChanceFinder<NotFoundContentFinder>();
}
