using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using UmbracoProject.Features.Services.Search;

namespace UmbracoProject.Features.Composer;

public class SearchServiceComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
        => builder.Services.AddScoped<ISearchService, SearchService>();
}
