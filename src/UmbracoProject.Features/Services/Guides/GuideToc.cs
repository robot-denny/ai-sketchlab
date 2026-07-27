using System.Text;
using Umbraco.Cms.Core.Models.Blocks;
using Umbraco.Extensions;

namespace UmbracoProject.Features.Services.Guides;

/// <summary>
/// Builds the auto-derived table of contents for a Guide Page: one entry per top-level
/// <c>guideSection</c> block, slugified from its <c>sectionTitle</c>. The slug map is the single
/// source of truth shared by the TOC (<c>_GuideToc.cshtml</c>) and the section anchors
/// (<c>guideSection.cshtml</c>), so anchor hrefs and section <c>id</c>s always agree.
/// </summary>
public static class GuideToc
{
    /// <summary>
    /// Slugifies a title: lowercase, letters/digits kept, every other run of characters collapsed
    /// to a single dash, leading/trailing dashes trimmed. Mirrors the hand-rolled rule in
    /// <c>_StyleGuideSectionRows.cshtml</c> so the two guide surfaces stay consistent.
    /// </summary>
    public static string Slugify(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) { return string.Empty; }

        var sb = new StringBuilder(input.Length);
        var lastWasDash = false;
        foreach (var c in input.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(c)) { sb.Append(c); lastWasDash = false; }
            else if (!lastWasDash) { sb.Append('-'); lastWasDash = true; }
        }

        return sb.ToString().Trim('-');
    }

    /// <summary>
    /// Pure title → slug function with collision de-duplication, preserving input order. The first
    /// occurrence of a base slug is used as-is; subsequent collisions are suffixed <c>-2</c>,
    /// <c>-3</c>, … This is the testable core that <see cref="BuildSlugMap"/> delegates to.
    /// </summary>
    public static IReadOnlyList<string> BuildSlugs(IEnumerable<string> titles)
    {
        var result = new List<string>();
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);

        foreach (var title in titles)
        {
            var baseSlug = Slugify(title);
            // A blank title would slugify to "" (an invalid HTML id). Fall back to a stable,
            // order-independent base so every section still gets a real anchor; the dedup below
            // then yields "section", "section-2", … Titles are mandatory at the content-type
            // level, so this is defence-in-depth for preview/degenerate states.
            if (baseSlug.Length == 0) { baseSlug = "section"; }
            if (!counts.TryGetValue(baseSlug, out var count))
            {
                counts[baseSlug] = 1;
                result.Add(baseSlug);
            }
            else
            {
                count++;
                counts[baseSlug] = count;
                result.Add($"{baseSlug}-{count}");
            }
        }

        return result;
    }

    /// <summary>
    /// Builds the slug map for a Guide Page body: iterates the top-level <c>guideSection</c> blocks,
    /// slugifies each <c>sectionTitle</c> (de-duplicating collisions), and keys the result on the
    /// block's <see cref="Umbraco.Cms.Core.Models.PublishedContent.IPublishedElement.Key"/>.
    /// </summary>
    public static IReadOnlyDictionary<Guid, string> BuildSlugMap(BlockGridModel? body)
    {
        var map = new Dictionary<Guid, string>();
        if (body is null) { return map; }

        var sections = new List<(Guid Key, string Title)>();
        foreach (var item in body)
        {
            var content = item?.Content;
            if (content is null) { continue; }
            if (!string.Equals(content.ContentType.Alias, "guideSection", StringComparison.Ordinal)) { continue; }

            var title = content.Value<string>("sectionTitle") ?? string.Empty;
            sections.Add((content.Key, title));
        }

        var slugs = BuildSlugs(sections.Select(s => s.Title));
        for (var i = 0; i < sections.Count; i++)
        {
            map[sections[i].Key] = slugs[i];
        }

        return map;
    }
}
