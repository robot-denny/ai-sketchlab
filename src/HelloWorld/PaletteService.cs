using System.Text.Json;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models.Blocks;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Extensions;

namespace HelloWorld;

public class PaletteService
{
    private readonly IPublishedContentQuery _contentQuery;
    private readonly ILogger<PaletteService> _logger;

    private static readonly int[][] DefaultPalette =
    [
        [181, 174, 166], // #b5aea6
        [217, 197, 180], // #d9c5b4
        [156, 115, 115], // #9c7373
    ];

    public PaletteService(IPublishedContentQuery contentQuery, ILogger<PaletteService> logger)
    {
        _contentQuery = contentQuery;
        _logger = logger;
    }

    public string GetPaletteConfigJson()
    {
        var config = BuildPaletteConfig();
        return JsonSerializer.Serialize(config);
    }

    private PaletteConfigDto BuildPaletteConfig()
    {
        var settingsDoc = FindImageGeneratorSettings();
        if (settingsDoc == null)
            return new PaletteConfigDto { Entries = new(), Default = DefaultPalette };

        // Read default palette colors
        var defaultPrimary = settingsDoc.Value<string>("defaultPrimary");
        var defaultMid = settingsDoc.Value<string>("defaultMid");
        var defaultDeep = settingsDoc.Value<string>("defaultDeep");

        int[][] defaultColors;
        try
        {
            defaultColors = !string.IsNullOrEmpty(defaultPrimary)
                             && !string.IsNullOrEmpty(defaultMid)
                             && !string.IsNullOrEmpty(defaultDeep)
                ? [HexToRgb(defaultPrimary), HexToRgb(defaultMid), HexToRgb(defaultDeep)]
                : DefaultPalette;
        }
        catch (FormatException ex)
        {
            _logger.LogWarning(ex, "Invalid hex in default palette colors, using fallback");
            defaultColors = DefaultPalette;
        }

        // Read category palette entries from Block List
        var entries = new Dictionary<string, PaletteEntryDto>();
        var blockList = settingsDoc.Value<BlockListModel>("categoryPalettes");

        if (blockList != null)
        {
            foreach (var block in blockList)
            {
                var category = block.Content.Value<IPublishedContent>("paletteCategory");
                if (category == null) continue;

                var primary = block.Content.Value<string>("palettePrimary");
                var mid = block.Content.Value<string>("paletteMid");
                var deep = block.Content.Value<string>("paletteDeep");

                if (string.IsNullOrEmpty(primary) || string.IsNullOrEmpty(mid) || string.IsNullOrEmpty(deep))
                    continue;

                try
                {
                    entries[category.Key.ToString()] = new PaletteEntryDto
                    {
                        Name = category.Name ?? "",
                        Colors = [HexToRgb(primary), HexToRgb(mid), HexToRgb(deep)],
                    };
                }
                catch (FormatException ex)
                {
                    _logger.LogWarning(ex, "Invalid hex in palette for category '{Category}', skipping", category.Name);
                }
            }
        }

        return new PaletteConfigDto { Entries = entries, Default = defaultColors };
    }

    /// <summary>
    /// Locates the single "imageGeneratorSettings" document in the content tree.
    /// Assumes structure: [root] home → siteSettings → imageGeneratorSettings.
    /// Returns null (callers fall back to defaults) if any node is missing or unpublished.
    /// </summary>
    private IPublishedContent? FindImageGeneratorSettings()
    {
        var home = _contentQuery.ContentAtRoot().FirstOrDefault(c => c.ContentType.Alias == "home");
        if (home == null) return null;

        // Look for Site Settings → Image Generator Settings
        var siteSettings = home.Children()?.FirstOrDefault(c => c.ContentType.Alias == "siteSettings");
        if (siteSettings == null) return null;

        return siteSettings.Children()?.FirstOrDefault(c => c.ContentType.Alias == "imageGeneratorSettings");
    }

    private static int[] HexToRgb(string hex)
    {
        var h = hex.TrimStart('#');
        var n = Convert.ToInt32(h, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    // DTOs for JSON serialization
    private class PaletteConfigDto
    {
        [System.Text.Json.Serialization.JsonPropertyName("entries")]
        public Dictionary<string, PaletteEntryDto> Entries { get; set; } = new();

        [System.Text.Json.Serialization.JsonPropertyName("default")]
        public int[][] Default { get; set; } = [];
    }

    private class PaletteEntryDto
    {
        [System.Text.Json.Serialization.JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [System.Text.Json.Serialization.JsonPropertyName("colors")]
        public int[][] Colors { get; set; } = [];
    }
}
