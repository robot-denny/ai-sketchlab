using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Web.Common.Authorization;

namespace HelloWorld;

[Route("umbraco/api/image-generator")]
[Authorize(Policy = AuthorizationPolicies.BackOfficeAccess)]
[ApiController]
public class ImageGeneratorController : ControllerBase
{
    private readonly IContentService _contentService;
    private readonly IContentTypeService _contentTypeService;
    private readonly PaletteService _paletteService;
    private readonly IImageGenerator _imageGenerator;

    public ImageGeneratorController(
        IContentService contentService,
        IContentTypeService contentTypeService,
        PaletteService paletteService,
        IImageGenerator imageGenerator)
    {
        _contentService = contentService;
        _contentTypeService = contentTypeService;
        _paletteService = paletteService;
        _imageGenerator = imageGenerator;
    }

    [HttpGet("palettes")]
    public IActionResult GetPalettes()
    {
        var json = _paletteService.GetPaletteConfigJson();
        return Content(json, "application/json");
    }

    [HttpGet("articles")]
    public IActionResult GetArticles()
    {
        var contentType = _contentTypeService.Get("article");
        if (contentType == null)
            return NotFound(new { error = "Article content type not found" });

        var articles = _contentService.GetPagedOfType(
                contentType.Id, 0, int.MaxValue, out _, null!, Ordering.By("Name"))
            .Where(c => !c.Trashed)
            .Select(c => new { id = c.Key, name = c.Name })
            .OrderBy(a => a.name)
            .ToList();

        return Ok(articles);
    }

    [HttpGet("categories")]
    public IActionResult GetCategories()
    {
        var contentType = _contentTypeService.Get("category");
        if (contentType == null)
            return NotFound(new { error = "Category content type not found" });

        var categories = _contentService.GetPagedOfType(
                contentType.Id, 0, int.MaxValue, out _, null!, Ordering.By("Name"))
            .Where(c => !c.Trashed)
            .Select(c => new { id = c.Key, name = c.Name })
            .OrderBy(c => c.name)
            .ToList();

        return Ok(categories);
    }

    [HttpPost("generate/batch")]
    public async Task<IActionResult> GenerateBatch([FromQuery] bool force = false)
    {
        var result = await _imageGenerator.GenerateBatchAsync(force);
        return Ok(new { success = result.Success, output = result.Output });
    }

    [HttpPost("generate/{documentId}")]
    public async Task<IActionResult> Generate(string documentId, [FromQuery] bool force = false)
    {
        var result = await _imageGenerator.GenerateAsync(documentId, force);
        return Ok(new { success = result.Success, output = result.Output });
    }
}
