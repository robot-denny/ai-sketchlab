using Umbraco.Cms.Core.Models.PublishedContent;

namespace UmbracoProject.Features.Services.Content;

/// <summary>
/// Reads a published item's URL segment the way the obsolete
/// <c>IPublishedContent.UrlSegment</c> did (removed in Umbraco 20): for the ambient
/// culture, and the draft segment while previewing.
/// </summary>
public interface IUrlSegmentReader
{
    /// <summary>
    /// The URL segment of <paramref name="content"/>, or <see cref="string.Empty"/> when it has
    /// none. Never null, so Razor callers need no <c>string?</c> (CS8669 under runtime compilation).
    /// </summary>
    string GetUrlSegment(IPublishedContent content);
}
