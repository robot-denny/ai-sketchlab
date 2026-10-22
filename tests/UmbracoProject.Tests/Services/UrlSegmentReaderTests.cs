using NSubstitute;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Web;
using UmbracoProject.Features.Services.Content;
using Xunit;

namespace UmbracoProject.Tests.Services;

public class UrlSegmentReaderTests
{
    private static readonly Guid ContentKey = Guid.Parse("6f1c2a52-6f0e-4d47-9a7e-3f3f0b0f8c11");

    private readonly IDocumentUrlService _documentUrlService = Substitute.For<IDocumentUrlService>();
    private readonly IVariationContextAccessor _variationContextAccessor = Substitute.For<IVariationContextAccessor>();
    private readonly IUmbracoContextAccessor _umbracoContextAccessor = Substitute.For<IUmbracoContextAccessor>();
    private readonly IPublishedContent _content = Substitute.For<IPublishedContent>();
    private readonly UrlSegmentReader _sut;

    public UrlSegmentReaderTests()
    {
        _content.Key.Returns(ContentKey);
        _sut = new UrlSegmentReader(_documentUrlService, _variationContextAccessor, _umbracoContextAccessor);
    }

    private void InPreview(bool preview)
    {
        var umbracoContext = Substitute.For<IUmbracoContext>();
        umbracoContext.InPreviewMode.Returns(preview);
        _umbracoContextAccessor.TryGetUmbracoContext(out Arg.Any<IUmbracoContext?>()!)
            .Returns(call =>
            {
                call[0] = umbracoContext;
                return true;
            });
    }

    [Fact]
    public void ReturnsThePublishedSegmentForTheAmbientCulture()
    {
        _variationContextAccessor.VariationContext.Returns(new VariationContext("en-US"));
        InPreview(false);
        _documentUrlService.GetUrlSegment(ContentKey, "en-US", false).Returns("mage-hand");

        Assert.Equal("mage-hand", _sut.GetUrlSegment(_content));
    }

    [Fact]
    public void ReturnsTheDraftSegmentInPreview()
    {
        _variationContextAccessor.VariationContext.Returns(new VariationContext("en-US"));
        InPreview(true);
        _documentUrlService.GetUrlSegment(ContentKey, "en-US", false).Returns("mage-hand");
        _documentUrlService.GetUrlSegment(ContentKey, "en-US", true).Returns("mage-hand-draft");

        Assert.Equal("mage-hand-draft", _sut.GetUrlSegment(_content));
    }

    [Fact]
    public void FallsBackToTheInvariantCultureWhenThereIsNoVariationContext()
    {
        _variationContextAccessor.VariationContext.Returns((VariationContext?)null);
        InPreview(false);
        _documentUrlService.GetUrlSegment(ContentKey, string.Empty, false).Returns("spec");

        Assert.Equal("spec", _sut.GetUrlSegment(_content));
    }

    [Fact]
    public void TreatsNoUmbracoContextAsPublished()
    {
        _variationContextAccessor.VariationContext.Returns(new VariationContext("en-US"));
        _umbracoContextAccessor.TryGetUmbracoContext(out Arg.Any<IUmbracoContext?>()!).Returns(false);
        _documentUrlService.GetUrlSegment(ContentKey, "en-US", false).Returns("mage-hand");

        Assert.Equal("mage-hand", _sut.GetUrlSegment(_content));
    }

    [Fact]
    public void ReturnsEmptyStringWhenTheContentHasNoSegment()
    {
        _variationContextAccessor.VariationContext.Returns(new VariationContext("en-US"));
        InPreview(false);
        _documentUrlService.GetUrlSegment(ContentKey, "en-US", false).Returns((string?)null);

        Assert.Equal(string.Empty, _sut.GetUrlSegment(_content));
    }
}
