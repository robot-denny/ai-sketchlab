using System.Text.Json;
using System.Text.RegularExpressions;

using Xunit;

namespace UmbracoProject.Tests;

/// <summary>
/// Seam-guard between the two halves of a spell card's mark, which live in
/// different files and can silently disagree.
///
/// An editor picks a mark from the <c>[Dropdown] Spell Card Mark</c> data type;
/// the deck turns that key into a sprite reference by prefixing <c>sig-</c>
/// (<c>SigilFor</c> in <c>Views/Partials/blocks/Components/spellCardDeck.cshtml</c>).
/// Nothing checks that the referenced <c>&lt;symbol&gt;</c> exists — a key with no
/// matching symbol emits <c>&lt;use href="#sig-missing"&gt;</c>, which renders
/// NOTHING and throws no error. The card just loses its art.
///
/// Reads both files as plain text, like <see cref="BlockCssPortabilityTests"/> —
/// no Umbraco types, no running site.
/// </summary>
public class SpellSigilRosterTests
{
    private static string SpritePath =>
        Path.Combine(FindRepoRoot(), "src", "UmbracoProject", "Views", "Partials", "_SpellSigils.cshtml");

    private static string MarkDataTypePath =>
        Path.Combine(FindRepoRoot(), "src", "UmbracoProject", "umbraco", "Deploy", "Revision",
            "data-type__c1a5d3e04b214f8a9d317e2b6c0a1f01.uda");

    private static string DeckViewPath =>
        Path.Combine(FindRepoRoot(), "src", "UmbracoProject", "Views", "Partials", "blocks", "Components",
            "spellCardDeck.cshtml");

    /// <summary>Every <c>&lt;symbol id="sig-…"&gt;</c> the sprite defines.</summary>
    private static HashSet<string> SpriteSymbolIds()
    {
        Assert.True(File.Exists(SpritePath), $"Sprite partial not found: {SpritePath}");

        return Regex.Matches(File.ReadAllText(SpritePath), @"<symbol\s+id=""(sig-[a-z0-9-]+)""")
            .Select(m => m.Groups[1].Value)
            .ToHashSet(StringComparer.Ordinal);
    }

    /// <summary>The mark keys the dropdown offers an editor.</summary>
    private static List<string> MarkKeys()
    {
        Assert.True(File.Exists(MarkDataTypePath), $"Mark data type not found: {MarkDataTypePath}");

        using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(MarkDataTypePath));
        JsonElement items = doc.RootElement.GetProperty("Configuration").GetProperty("items");

        return items.EnumerateArray().Select(i => i.GetString()!).ToList();
    }

    [Fact]
    public void EveryMarkAnEditorCanPick_HasASymbolInTheSprite()
    {
        HashSet<string> symbols = SpriteSymbolIds();

        // The deck prefixes the stored key with "sig-" and never validates the result,
        // so a key with no symbol is an invisible mark, not an error.
        List<string> orphans = MarkKeys()
            .Where(key => !symbols.Contains("sig-" + key))
            .ToList();

        Assert.True(
            orphans.Count == 0,
            $"The cardMark dropdown offers {orphans.Count} key(s) with no matching <symbol> in "
            + $"_SpellSigils.cshtml, so a card wearing one renders no art: {string.Join(", ", orphans)}. "
            + "Add the <symbol>, or remove the key from the data type.");
    }

    /// <summary>
    /// The sigils the deck names DIRECTLY rather than taking from an editor's choice —
    /// the four pack marks and the shared reference tome (<c>packSigils</c> and
    /// <c>referenceSigil</c> in <c>spellCardDeck.cshtml</c>).
    ///
    /// Listed explicitly rather than scraped out of the view with a regex. A regex for
    /// quoted <c>sig-…</c> strings would also match any future one that is NOT a symbol
    /// id — a CSS class, a JS hook — and a build gate that reddens on unrelated work is
    /// worse than no gate. The cost of a list is that it could drift from the view, so
    /// the test checks the view names each one too: neither side can move alone.
    /// </summary>
    public static TheoryData<string> SigilsTheDeckNamesDirectly() => new()
    {
        "sig-spellbook",  // pack: core
        "sig-umbraco17",  // pack: umbraco-17
        "sig-cloud",      // pack: umbraco-cloud
        "sig-dotnet",     // pack: dotnet
        "sig-tome",       // every reference card, in every pack
    };

    [Theory]
    [MemberData(nameof(SigilsTheDeckNamesDirectly))]
    public void ASigilTheDeckNamesDirectly_IsDefinedBySpriteAndStillNamedByView(string sigilId)
    {
        Assert.True(
            SpriteSymbolIds().Contains(sigilId),
            $"The deck names '{sigilId}' directly, but _SpellSigils.cshtml defines no such "
            + "<symbol> — every card relying on it would render no art.");

        Assert.True(File.Exists(DeckViewPath), $"Deck view not found: {DeckViewPath}");

        // Match the QUOTED literal, not a bare substring: `sig-dotnet` is a substring of
        // `sig-dotnet-v2`, so a rename-with-suffix would slip past a plain Contains and
        // this assertion would be decorative. (It was, until the RED check caught it.)
        Assert.True(
            File.ReadAllText(DeckViewPath).Contains($"\"{sigilId}\"", StringComparison.Ordinal),
            $"spellCardDeck.cshtml no longer names \"{sigilId}\". If a pack mark was renamed or "
            + "dropped, update SigilsTheDeckNamesDirectly to match.");
    }

    private static string FindRepoRoot()
    {
        DirectoryInfo? dir = new(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "src", "UmbracoProject", "umbraco", "Deploy", "Revision")))
            {
                return dir.FullName;
            }

            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException(
            $"Could not locate repo root (walked up from {AppContext.BaseDirectory} looking for src/UmbracoProject/umbraco/Deploy/Revision).");
    }
}
