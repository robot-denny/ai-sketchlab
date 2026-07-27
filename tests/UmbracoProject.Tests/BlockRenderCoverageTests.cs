using System.Text.Json;

using Xunit;

namespace UmbracoProject.Tests;

/// <summary>
/// Render-coverage guardrail (Step 3 of block-editor-parity-and-reuse-readiness).
///
/// Every block offered by a page-body palette (<c>[BlockList] Main Content</c>,
/// <c>[BlockGrid] Experiments Body</c>, <c>[BlockGrid] Guide Body</c>) must resolve a
/// Razor view so an admin can never 500 the site by adding a block to a palette:
///   - List-palette membership requires a shared view at
///     <c>Views/Partials/blocks/Components/{alias}.cshtml</c>.
///   - Grid-palette membership requires the shared view OR the grid-only view at
///     <c>Views/Partials/blockgrid/Components/{alias}.cshtml</c> (for area-based blocks).
///
/// The only sanctioned gaps are <see cref="DocumentedExceptions"/> — blocks that are
/// deliberately editor-specific and have no shared view:
///   - <c>pillarSection</c> (grid-only; renders Block Grid areas the shared model can't expose).
///   - <c>guideSection</c> (grid-only; the Guide Body's titled-section wrapper — renders its
///     Block Grid area and drives the auto-derived TOC; view at
///     <c>blockgrid/Components/guideSection.cshtml</c>).
///
/// This test parses the <c>.uda</c> schema directly with <see cref="System.Text.Json"/> —
/// it needs no Umbraco types or a running site.
/// </summary>
public class BlockRenderCoverageTests
{
    /// <summary>
    /// Blocks exempt from the shared-view requirement (genuinely editor-specific).
    /// See the class summary for the rationale; keep this list minimal and documented.
    /// </summary>
    private static readonly HashSet<string> DocumentedExceptions = new(StringComparer.OrdinalIgnoreCase)
    {
        "pillarSection", // grid-only: renders Block Grid areas; view lives at blockgrid/Components/pillarSection.cshtml
        "guideSection", // grid-only: Guide Body section wrapper; view lives at blockgrid/Components/guideSection.cshtml
    };

    private const string MainContentPalette = "[BlockList] Main Content";
    private const string ExperimentsBodyPalette = "[BlockGrid] Experiments Body";
    private const string GuideBodyPalette = "[BlockGrid] Guide Body";

    [Fact]
    public void EveryOfferedBlockResolvesAView()
    {
        string repoRoot = FindRepoRoot();
        string revisionDir = Path.Combine(repoRoot, "src", "UmbracoProject", "umbraco", "Deploy", "Revision");
        string sharedDir = Path.Combine(repoRoot, "src", "UmbracoProject", "Views", "Partials", "blocks", "Components");
        string gridDir = Path.Combine(repoRoot, "src", "UmbracoProject", "Views", "Partials", "blockgrid", "Components");

        Assert.True(Directory.Exists(revisionDir), $"Revision dir not found: {revisionDir}");

        Dictionary<string, string> aliasByKey = BuildAliasMap(revisionDir);

        List<string> listBlocks = OfferedBlockAliases(revisionDir, MainContentPalette, aliasByKey);
        List<string> gridBlocks = OfferedBlockAliases(revisionDir, ExperimentsBodyPalette, aliasByKey);
        List<string> guideBodyBlocks = OfferedBlockAliases(revisionDir, GuideBodyPalette, aliasByKey);

        Assert.NotEmpty(listBlocks);
        Assert.NotEmpty(gridBlocks);
        Assert.NotEmpty(guideBodyBlocks);

        var missing = new List<string>();

        // List palette: only the shared view satisfies coverage.
        foreach (string alias in listBlocks)
        {
            if (DocumentedExceptions.Contains(alias))
            {
                continue;
            }

            if (!File.Exists(Path.Combine(sharedDir, alias + ".cshtml")))
            {
                missing.Add($"[BlockList] Main Content → '{alias}': expected shared view blocks/Components/{alias}.cshtml");
            }
        }

        // Grid palette: shared view OR the grid-only fallback view satisfies coverage.
        foreach (string alias in gridBlocks)
        {
            if (DocumentedExceptions.Contains(alias))
            {
                continue;
            }

            bool shared = File.Exists(Path.Combine(sharedDir, alias + ".cshtml"));
            bool grid = File.Exists(Path.Combine(gridDir, alias + ".cshtml"));
            if (!shared && !grid)
            {
                missing.Add($"[BlockGrid] Experiments Body → '{alias}': expected blocks/Components/{alias}.cshtml or blockgrid/Components/{alias}.cshtml");
            }
        }

        // Guide Body palette: same rule as any grid palette (shared view OR grid-only fallback).
        foreach (string alias in guideBodyBlocks)
        {
            if (DocumentedExceptions.Contains(alias))
            {
                continue;
            }

            bool shared = File.Exists(Path.Combine(sharedDir, alias + ".cshtml"));
            bool grid = File.Exists(Path.Combine(gridDir, alias + ".cshtml"));
            if (!shared && !grid)
            {
                missing.Add($"[BlockGrid] Guide Body → '{alias}': expected blocks/Components/{alias}.cshtml or blockgrid/Components/{alias}.cshtml");
            }
        }

        Assert.True(
            missing.Count == 0,
            "Palette-offered blocks with no resolvable view (an admin adding these would break rendering):"
                + Environment.NewLine
                + string.Join(Environment.NewLine, missing));
    }

    /// <summary>
    /// Every documented exception must actually be offered by a palette (otherwise the
    /// exception is stale and should be removed). Guards against the allowlist rotting.
    /// </summary>
    [Fact]
    public void DocumentedExceptionsAreStillOffered()
    {
        string repoRoot = FindRepoRoot();
        string revisionDir = Path.Combine(repoRoot, "src", "UmbracoProject", "umbraco", "Deploy", "Revision");
        Dictionary<string, string> aliasByKey = BuildAliasMap(revisionDir);

        var offered = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        offered.UnionWith(OfferedBlockAliases(revisionDir, MainContentPalette, aliasByKey));
        offered.UnionWith(OfferedBlockAliases(revisionDir, ExperimentsBodyPalette, aliasByKey));
        offered.UnionWith(OfferedBlockAliases(revisionDir, GuideBodyPalette, aliasByKey));

        foreach (string exception in DocumentedExceptions)
        {
            Assert.True(
                offered.Contains(exception),
                $"DocumentedExceptions lists '{exception}', but no body palette offers it — remove the stale exception.");
        }
    }

    // --- helpers -------------------------------------------------------------

    /// <summary>
    /// Maps a normalized (dash-stripped, lowercase) element-type key → element alias,
    /// read from every <c>document-type__*.uda</c> under the revision directory.
    /// </summary>
    private static Dictionary<string, string> BuildAliasMap(string revisionDir)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (string file in Directory.EnumerateFiles(revisionDir, "document-type__*.uda"))
        {
            using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(file));
            JsonElement root = doc.RootElement;

            if (!root.TryGetProperty("Udi", out JsonElement udiEl)
                || !root.TryGetProperty("Alias", out JsonElement aliasEl))
            {
                continue;
            }

            string? udi = udiEl.GetString();
            string? alias = aliasEl.GetString();
            if (udi is null || alias is null)
            {
                continue;
            }

            // Udi form: umb://document-type/<32-hex-no-dashes>
            int slash = udi.LastIndexOf('/');
            if (slash < 0 || slash + 1 >= udi.Length)
            {
                continue;
            }

            string hex = Normalize(udi[(slash + 1)..]);
            map[hex] = alias;
        }

        return map;
    }

    /// <summary>
    /// The top-level palette-offered blocks (<c>Configuration.blocks[].contentElementTypeKey</c>),
    /// resolved to element aliases. Nested area <c>specifiedAllowance</c> entries are NOT palette
    /// membership and are intentionally ignored.
    /// </summary>
    private static List<string> OfferedBlockAliases(string revisionDir, string paletteName, Dictionary<string, string> aliasByKey)
    {
        foreach (string file in Directory.EnumerateFiles(revisionDir, "data-type__*.uda"))
        {
            using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(file));
            JsonElement root = doc.RootElement;

            if (!root.TryGetProperty("Name", out JsonElement nameEl)
                || nameEl.GetString() != paletteName)
            {
                continue;
            }

            if (!root.TryGetProperty("Configuration", out JsonElement config)
                || !config.TryGetProperty("blocks", out JsonElement blocks)
                || blocks.ValueKind != JsonValueKind.Array)
            {
                return new List<string>();
            }

            var aliases = new List<string>();
            foreach (JsonElement block in blocks.EnumerateArray())
            {
                if (!block.TryGetProperty("contentElementTypeKey", out JsonElement keyEl))
                {
                    continue;
                }

                string? key = keyEl.GetString();
                if (key is null)
                {
                    continue;
                }

                if (aliasByKey.TryGetValue(Normalize(key), out string? alias))
                {
                    aliases.Add(alias);
                }
                else
                {
                    throw new Xunit.Sdk.XunitException(
                        $"Palette '{paletteName}' references element key '{key}' with no matching document-type .uda — schema drift.");
                }
            }

            return aliases;
        }

        throw new Xunit.Sdk.XunitException($"Body palette data type '{paletteName}' not found under {revisionDir}.");
    }

    private static string Normalize(string guidish) => guidish.Replace("-", string.Empty).ToLowerInvariant();

    /// <summary>
    /// Walks up from the test-run directory until it finds the marker that identifies
    /// the repo root (the committed revision directory). Avoids hardcoded absolute paths.
    /// </summary>
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
