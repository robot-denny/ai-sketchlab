using System.Text.RegularExpressions;

namespace UmbracoProject.Helpers;

public record Swatch(string Name, string Value, string Role);

public static class SwatchTokenParser
{
    private static readonly Regex SwatchRegex = new(
        @"/\*\*umb_swatch:(?<role>[^*]+)\*+/\s*(?<name>--[\w-]+)\s*:\s*(?<value>[^;]+);",
        RegexOptions.Compiled);

    public static IReadOnlyList<Swatch> Parse(string? css)
    {
        if (string.IsNullOrWhiteSpace(css)) return Array.Empty<Swatch>();

        var results = new List<Swatch>();
        foreach (Match match in SwatchRegex.Matches(css))
        {
            var role = match.Groups["role"].Value.Trim();
            var name = match.Groups["name"].Value.Trim();
            var value = match.Groups["value"].Value.Trim();
            if (role.Length == 0 || name.Length == 0 || value.Length == 0) continue;
            results.Add(new Swatch(name, value, role));
        }
        return results;
    }

    public static bool IsRenderableColor(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var v = value.Trim();
        if (v.StartsWith("#")) return true;
        if (v.StartsWith("rgb", StringComparison.OrdinalIgnoreCase)) return true;
        if (v.StartsWith("hsl", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }
}
