using UmbracoProject.Features.Services.Guides;
using Xunit;

namespace UmbracoProject.Tests;

public class GuideTocTests
{
    [Theory]
    [InlineData("Buttons & Forms!", "buttons-forms")]
    [InlineData("Colour Palette", "colour-palette")]
    [InlineData("  Spaced  Out  ", "spaced-out")]
    [InlineData("Typography — Scale (2x)", "typography-scale-2x")]
    [InlineData("", "")]
    public void Slugify_ProducesStableSlug(string input, string expected)
    {
        Assert.Equal(expected, GuideToc.Slugify(input));
    }

    [Fact]
    public void BuildSlugs_DedupesTwoIdenticalTitles()
    {
        var slugs = GuideToc.BuildSlugs(new[] { "Examples", "Examples" });

        Assert.Equal(new[] { "examples", "examples-2" }, slugs);
    }

    [Fact]
    public void BuildSlugs_DedupesThreeIdenticalTitles()
    {
        var slugs = GuideToc.BuildSlugs(new[] { "Examples", "Examples", "Examples" });

        Assert.Equal(new[] { "examples", "examples-2", "examples-3" }, slugs);
    }

    [Fact]
    public void BuildSlugs_PreservesDistinctTitlesInOrder()
    {
        var slugs = GuideToc.BuildSlugs(new[] { "Colors", "Typography", "Buttons & Forms!" });

        Assert.Equal(new[] { "colors", "typography", "buttons-forms" }, slugs);
    }

    [Fact]
    public void BuildSlugs_BlankTitlesGetStableSyntheticSlugs()
    {
        var slugs = GuideToc.BuildSlugs(new[] { "", "   " });

        Assert.Equal(new[] { "section", "section-2" }, slugs);
    }

    [Fact]
    public void BuildSlugs_BlankTitleDoesNotProduceEmptyOrDegenerateId()
    {
        var slugs = GuideToc.BuildSlugs(new[] { "Intro", "" });

        Assert.Equal(new[] { "intro", "section" }, slugs);
        Assert.DoesNotContain(slugs, s => s.Length == 0 || s.StartsWith('-'));
    }
}
