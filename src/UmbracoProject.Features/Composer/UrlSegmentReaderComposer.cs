using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using UmbracoProject.Features.Services.Content;

namespace UmbracoProject.Features.Composer;

public class UrlSegmentReaderComposer : IComposer
{
    // Scoped, like SearchService: resolved per request from views, and never captures a
    // shorter-lived dependency whatever lifetimes Umbraco gives the accessors.
    public void Compose(IUmbracoBuilder builder)
        => builder.Services.AddScoped<IUrlSegmentReader, UrlSegmentReader>();
}
