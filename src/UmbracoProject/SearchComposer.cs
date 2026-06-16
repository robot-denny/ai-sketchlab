using Microsoft.Extensions.DependencyInjection;
using Umbraco.AI.Search.Core.Configuration;
using Umbraco.AI.Search.Startup;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Search.BackOffice.DependencyInjection;
using Umbraco.Cms.Search.Core.DependencyInjection;
using Umbraco.Cms.Search.DeliveryApi.DependencyInjection;
using Umbraco.Cms.Search.Provider.Examine.DependencyInjection;

namespace UmbracoProject;

// ComposeBefore(UmbracoAISearchComposer) ensures our registrations run first.
// AddSearchCore() is idempotent in Cms.Search.Core 1.0.0 (per its XML docs); the ordering
// stays here as a cheap defensive guard against re-registration order changes in future
// version bumps.
// AddBackOfficeSearch() is called here deliberately: the beta.3 list-view-search crash
// ('field name' cannot be null or empty) is fixed in 1.0.0 (verified on the stable migration).
[ComposeBefore(typeof(UmbracoAISearchComposer))]
public class SearchComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder
            .AddSearchCore()
            .AddExamineSearchProvider()
            .AddBackOfficeSearch()
            .AddDeliveryApiSearch();

        // Bind Umbraco:AI:Search → AIVectorSearchOptions explicitly so the view can inject
        // IOptions<AIVectorSearchOptions> and stay in sync with whatever the AI.Search
        // provider reads at query time.
        builder.Services.Configure<AIVectorSearchOptions>(
            builder.Config.GetSection("Umbraco:AI:Search"));
    }
}
