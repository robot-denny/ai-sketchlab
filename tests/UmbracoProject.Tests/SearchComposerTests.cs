using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Umbraco.AI.Search.Core.Configuration;
using Xunit;

namespace UmbracoProject.Tests;

// Mirrors the exact options-binding wiring SearchComposer.Compose performs:
//   builder.Services.Configure<AIVectorSearchOptions>(builder.Config.GetSection("Umbraco:AI:Search"))
// Constructing a real IUmbracoBuilder for a full Compose() test needs an Umbraco host harness,
// so this verifies the high-value, host-free contract: the Umbraco:AI:Search section binds to
// AIVectorSearchOptions with the tuning values from appsettings.json.
public class SearchComposerTests
{
    [Fact]
    public void AIVectorSearchOptions_BindsFrom_UmbracoAISearchSection_WithAppsettingsTuningValues()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Umbraco:AI:Search:ChunkSize"] = "512",
                ["Umbraco:AI:Search:ChunkOverlap"] = "50",
                ["Umbraco:AI:Search:DefaultTopK"] = "50",
                ["Umbraco:AI:Search:MinScore"] = "0.3",
            })
            .Build();

        var services = new ServiceCollection();
        services.Configure<AIVectorSearchOptions>(config.GetSection("Umbraco:AI:Search"));

        using var provider = services.BuildServiceProvider();
        var options = provider.GetRequiredService<IOptions<AIVectorSearchOptions>>().Value;

        Assert.Equal(512, options.ChunkSize);
        Assert.Equal(50, options.ChunkOverlap);
        Assert.Equal(50, options.DefaultTopK);
        Assert.Equal(0.3, options.MinScore, 3);
    }
}
