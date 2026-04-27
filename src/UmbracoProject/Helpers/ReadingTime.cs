using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Html;
using Microsoft.Extensions.Caching.Memory;
using Umbraco.Cms.Core.Models.Blocks;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Extensions;

namespace UmbracoProject.Helpers;

public static class ReadingTime
{
    private const int WordsPerMinute = 225;
    private static readonly Regex StripHtmlRegex = new("<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex WhitespaceRegex = new(@"\s+", RegexOptions.Compiled);

    public static string? Estimate(IPublishedContent? article, IMemoryCache? cache = null)
    {
        if (article == null) return null;

        if (cache == null) return Compute(article);

        var key = $"reading-time:{article.Id}:{article.UpdateDate.Ticks}";
        return cache.GetOrCreate(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            return Compute(article);
        });
    }

    private static string? Compute(IPublishedContent article)
    {
        var words = CountWords(article.Value<BlockListModel>("contentRows"))
                  + CountWords(article.Value<BlockListModel>("sectionRows"));
        if (words == 0) return null;
        var minutes = (int)Math.Max(1, Math.Ceiling(words / (double)WordsPerMinute));
        return $"{minutes} min read";
    }

    private static int CountWords(BlockListModel? blocks)
    {
        if (blocks == null) return 0;
        var total = 0;
        foreach (var item in blocks)
        {
            if (item?.Content == null) continue;
            foreach (var prop in item.Content.Properties)
            {
                var text = ToText(prop.GetValue());
                if (!string.IsNullOrWhiteSpace(text)) total += CountWords(text);
            }
        }
        return total;
    }

    private static string? ToText(object? value) => value switch
    {
        null => null,
        string s => s,
        IHtmlContent html => HtmlToString(html),
        _ => null
    };

    private static string HtmlToString(IHtmlContent html)
    {
        using var sw = new StringWriter();
        html.WriteTo(sw, HtmlEncoder.Default);
        return sw.ToString();
    }

    private static int CountWords(string content)
    {
        var stripped = StripHtmlRegex.Replace(content, " ");
        var normalized = WhitespaceRegex.Replace(stripped, " ").Trim();
        if (normalized.Length == 0) return 0;
        return normalized.Split(' ').Length;
    }
}
