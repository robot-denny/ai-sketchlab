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

    [Fact]
    public void BlocksCss_ContainsTheSixReusableBlocksBaseRules()
    {
        string css = File.ReadAllText(BlocksCssPath);
        // Strip comments so a section-header comment mentioning a class name can't
        // satisfy an assertion (parity with the experiments.css test below).
        string stripped = Regex.Replace(css, @"/\*.*?\*/", string.Empty, RegexOptions.Singleline);

        // Each reusable block's BASE rule now lives in the global stylesheet, so the
        // block lays out and skins on ANY page — not only inside main.experiments.
        Assert.Matches(new Regex(@"\.exp-card\s*\{", RegexOptions.Singleline), stripped);
        Assert.Matches(new Regex(@"\.exp-cmd\s*\{", RegexOptions.Singleline), stripped);
        Assert.Matches(new Regex(@"\.exp-stat\s*\{", RegexOptions.Singleline), stripped);
        Assert.Matches(new Regex(@"\.exp-pullquote\s*\{", RegexOptions.Singleline), stripped);
        Assert.Matches(new Regex(@"\.exp-timeline__row\s*\{", RegexOptions.Singleline), stripped);
        Assert.Matches(new Regex(@"\.exp-sketch\s*\{", RegexOptions.Singleline), stripped);

        // A representative __child rule per block — proves the child rules moved too,
        // not just the block roots.
        Assert.Contains(".exp-card__title", stripped);
        Assert.Contains(".exp-cmd__name", stripped);
        Assert.Contains(".exp-stat__figure", stripped);
        Assert.Contains(".exp-pullquote__quote", stripped);
        Assert.Contains(".exp-timeline__feature", stripped);
        Assert.Contains(".exp-sketch__caption", stripped);

        // pullQuoteBlock's block-OWNED tone modifiers (pillar-INDEPENDENT) ship globally
        // with the block — both the border AND the text-color recolor — so a dark/accent
        // pullquote renders correctly off-Experiments (the review Major fix). The
        // `.exp-pillar--* .exp-pullquote__*` context form stays page-scoped in experiments.css.
        Assert.Matches(new Regex(@"\.exp-pullquote--dark\s*\{", RegexOptions.Singleline), stripped);
        Assert.Matches(new Regex(@"\.exp-pullquote--accent\s*\{", RegexOptions.Singleline), stripped);
        Assert.Contains(".exp-pullquote--dark .exp-pullquote__quote", stripped);
        Assert.Contains(".exp-pullquote--accent .exp-pullquote__quote", stripped);

        // ...and the whole file stays GLOBAL — never re-scoped under main.experiments.
        Assert.DoesNotContain("main.experiments", stripped);
    }

    [Fact]
    public void ExperimentsCss_RetainsPageCompositionAndPillarToneContext()
    {
        string css = File.ReadAllText(ExperimentsCssPath);

        // Ignore comments so a pointer comment can't satisfy an assertion.
        string stripped = Regex.Replace(css, @"/\*.*?\*/", string.Empty, RegexOptions.Singleline);

        // Page-composition blocks stay put (out of scope for portability).
        Assert.Contains(".exp-hero", stripped);
        Assert.Contains(".exp-pillar", stripped);

        // Pillar-tone context that recolors a moved block stays behind — a block off a
        // pillar renders in its default tone (correct). These reference a moved block
        // but are Experiments pillar composition, not the block's own base CSS.
        Assert.Contains(".exp-pillar--dark .exp-stat__figure", stripped);
        Assert.Contains(".exp-pillar--light:nth-of-type(even) .exp-card", stripped);
        // The pullquote PILLAR-context form stays; its block-modifier twin (pillar-
        // independent) moved to blocks.css. This locks the review Major split from both
        // sides (blocks.css test asserts the block-modifier form is now global).
        Assert.Contains(".exp-pillar--dark .exp-pullquote__quote", stripped);
        Assert.DoesNotContain(".exp-pullquote--dark .exp-pullquote__quote", stripped);

        // The Experiments page reset + richtext / CTA overrides stay.
        Assert.Contains("main.experiments", stripped);
        Assert.Contains(".exp-cta", stripped);

        // Stronger guard: the six blocks' BASE rules are no longer in the page
        // stylesheet. The pillar-tone rules legitimately still contain
        // `.exp-card` / `.exp-stat` / `.exp-timeline__row` substrings, so match the
        // *base selector form* — a bare `.exp-<block> {` preceded by a rule boundary
        // (`}`, `,`, `;`), never a descendant combinator off a pillar selector.
        // NOTE: the `{`-exclusion in the boundary class is deliberate — it lets the
        // retained `@media (...) { .exp-cta { … } }` carve-out pass. It leaves a narrow
        // blind spot (a base rule reintroduced as the first selector right after a `{`),
        // accepted as a trade-off; do not add `{` to the class or the media carve-out fails.
        Assert.DoesNotMatch(new Regex(@"[};,]\s*\.exp-card\s*\{", RegexOptions.Singleline), stripped);
        Assert.DoesNotMatch(new Regex(@"[};,]\s*\.exp-cmd\s*\{", RegexOptions.Singleline), stripped);
        Assert.DoesNotMatch(new Regex(@"[};,]\s*\.exp-stat\s*\{", RegexOptions.Singleline), stripped);
        Assert.DoesNotMatch(new Regex(@"[};,]\s*\.exp-pullquote\s*\{", RegexOptions.Singleline), stripped);
        Assert.DoesNotMatch(new Regex(@"[};,]\s*\.exp-timeline__row\s*\{", RegexOptions.Singleline), stripped);
        Assert.DoesNotMatch(new Regex(@"[};,]\s*\.exp-sketch\s*\{", RegexOptions.Singleline), stripped);
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
