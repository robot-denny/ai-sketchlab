using System.Text.RegularExpressions;

using Xunit;

namespace UmbracoProject.Tests;

/// <summary>
/// CSS seam-guard for the Block Grid CSS portability work
/// (<c>_plans/block-grid-css-portability.md</c>).
///
/// The Block Grid layout engine (and, in later steps, the reusable blocks' base CSS)
/// must live in the globally-loaded <c>wwwroot/assets/css/blocks.css</c> — NOT trapped
/// behind the <c>main.experiments</c> scope in the page-only <c>experiments.css</c>.
/// This test reads the stylesheets as plain text (via <see cref="File.ReadAllText"/>) —
/// it needs no Umbraco types and no running site, mirroring
/// <see cref="BlockRenderCoverageTests"/>.
/// </summary>
public class BlockCssPortabilityTests
{
    private static string BlocksCssPath =>
        Path.Combine(FindRepoRoot(), "src", "UmbracoProject", "wwwroot", "assets", "css", "blocks.css");

    private static string ExperimentsCssPath =>
        Path.Combine(FindRepoRoot(), "src", "UmbracoProject", "wwwroot", "assets", "css", "experiments.css");

    [Fact]
    public void BlocksCss_ContainsTheFullBlockGridLayoutEngine()
    {
        Assert.True(File.Exists(BlocksCssPath), $"Expected global stylesheet not found: {BlocksCssPath}");

        string css = File.ReadAllText(BlocksCssPath);

        // All five base engine selectors are present (a dropped rule in a later step would break
        // Block Grid layout on some page and must turn this red — the whole point of the guard).
        Assert.Matches(
            new Regex(@"\.umb-block-grid__layout-container\s*\{[^}]*grid-template-columns", RegexOptions.Singleline),
            css);
        Assert.Matches(
            new Regex(@"\.umb-block-grid__layout-item[^{]*\{[^}]*grid-column", RegexOptions.Singleline),
            css);
        Assert.Matches(
            new Regex(@"\.umb-block-grid__area-container\s*\{[^}]*grid-template-columns", RegexOptions.Singleline),
            css);
        // `.umb-block-grid__area` base rule (the trailing space excludes `__area-container`).
        Assert.Contains(".umb-block-grid__area ", css);

        // Both responsive breakpoints exist AND contain block-grid rules (whitespace-tolerant).
        Assert.Matches(
            new Regex(@"@media\s*\(\s*max-width:\s*599px\s*\)\s*\{[^@]*\.umb-block-grid", RegexOptions.Singleline),
            css);
        Assert.Matches(
            new Regex(
                @"@media\s*\(\s*min-width:\s*600px\s*\)\s*and\s*\(\s*max-width:\s*1099px\s*\)\s*\{[^@]*\.umb-block-grid",
                RegexOptions.Singleline),
            css);

        // The per-span overrides that collapse the tablet layout.
        Assert.Contains("[data-col-span=\"4\"]", css);
        Assert.Contains("[data-col-span=\"8\"]", css);
        Assert.Contains("[data-col-span=\"6\"]", css);

        // ...and the whole engine is GLOBAL — never re-scoped under `main.experiments`.
        Assert.DoesNotContain("main.experiments", css);
    }

    [Fact]
    public void ExperimentsCss_NoLongerScopesTheBlockGridEngine()
    {
        string css = File.ReadAllText(ExperimentsCssPath);

        // Ignore comments (the file keeps a pointer comment mentioning `.umb-block-grid*`).
        string stripped = Regex.Replace(css, @"/\*.*?\*/", string.Empty, RegexOptions.Singleline);

        // No engine rule remains in the page stylesheet.
        Assert.DoesNotContain(".umb-block-grid__layout-container", stripped);
        Assert.DoesNotContain(".umb-block-grid__layout-item", stripped);
        Assert.DoesNotContain(".umb-block-grid__area ", stripped);

        // Positive guard (catches ANY re-scoping wording, not just `main.experiments`): the ONLY
        // `.umb-block-grid` reference left in experiments.css is the documented pillar composition
        // rule `.exp-pillar > .umb-block-grid__area-container` (an area container inside a pillar,
        // not the layout engine).
        foreach (Match m in Regex.Matches(stripped, @"\.umb-block-grid[\w-]*"))
        {
            Assert.Equal(".umb-block-grid__area-container", m.Value);
        }

        Assert.Contains(".exp-pillar > .umb-block-grid__area-container", stripped);
    }

    /// <summary>
    /// Walks up from the test-run directory to the repo root (identified by the committed
    /// revision directory). Avoids hardcoded absolute paths. Mirrors
    /// <see cref="BlockRenderCoverageTests"/>.
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
