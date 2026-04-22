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
// AddSearchCore() is idempotent in 1.0.0-beta.3 (per its XML docs), but was temporarily
// non-idempotent in 1.0.0-beta.4; the ordering stays here as a defensive guard for future
// version bumps. Revisit when we move off beta.3.
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
