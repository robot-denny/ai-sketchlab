using Microsoft.Extensions.DependencyInjection;
using Umbraco.AI.Search.Core.Configuration;
using Umbraco.AI.Search.Startup;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
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
            // .AddBackOfficeSearch() is intentionally NOT registered: in 1.0.0-beta.3 it
            // routes the backoffice content/media list-view search through the new
            // Cms.Search Examine provider, whose query builder hands Examine an empty field
            // name and throws "'field name' cannot be null or empty" the moment you type in
            // the Media (and Content) search box. Leaving it off reverts those list-view
            // searches to Umbraco 17's built-in Examine search, which works. Re-enable once
            // an AI.Search build compatible with Cms.Search.* beta.4+ exists (the beta.3 pin
            // blocks the upstream fix — see "Pinned betas" in CLAUDE.md). Tracked as
            // fix-backoffice-search-beta3-fieldname-crash on the roadmap.
            .AddDeliveryApiSearch();

        // Bind Umbraco:AI:Search → AIVectorSearchOptions explicitly so the view can inject
        // IOptions<AIVectorSearchOptions> and stay in sync with whatever the AI.Search
        // provider reads at query time.
        builder.Services.Configure<AIVectorSearchOptions>(
            builder.Config.GetSection("Umbraco:AI:Search"));
    }
}
