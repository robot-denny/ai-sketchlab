using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Web.Common.Authorization;

namespace HelloWorld;

[Route("umbraco/api/image-generator")]
[Authorize(Policy = AuthorizationPolicies.BackOfficeAccess)]
[ApiController]
public class ImageGeneratorController : ControllerBase
{
    private readonly IWebHostEnvironment _env;
    private readonly IContentService _contentService;
    private readonly IContentTypeService _contentTypeService;
    private readonly IConfiguration _configuration;
    private readonly PaletteService _paletteService;

    public ImageGeneratorController(
        IWebHostEnvironment env,
        IContentService contentService,
        IContentTypeService contentTypeService,
        IConfiguration configuration,
        PaletteService paletteService)
    {
        _env = env;
        _contentService = contentService;
        _contentTypeService = contentTypeService;
        _configuration = configuration;
        _paletteService = paletteService;
    }

    private string RepoRoot => Path.GetFullPath(Path.Combine(_env.ContentRootPath, "..", ".."));

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
            .Select(c => new { id = c.Key, name = c.Name })
            .OrderBy(c => c.name)
            .ToList();

        return Ok(categories);
    }

    [HttpPost("generate/batch")]
    public async Task<IActionResult> GenerateBatch([FromQuery] bool force = false)
    {
        var args = "--batch";
        if (force) args += " --force";

        var (exitCode, output) = await RunCli(args);
        return Ok(new { success = exitCode == 0, output });
    }

    [HttpPost("generate/{documentId}")]
    public async Task<IActionResult> Generate(string documentId, [FromQuery] bool force = false)
    {
        var args = $"--id {documentId}";
        if (force) args += " --force";

        var (exitCode, output) = await RunCli(args);
        return Ok(new { success = exitCode == 0, output });
    }

    private async Task<(int exitCode, string output)> RunCli(string args)
    {
        var scriptPath = Path.Combine(RepoRoot, "scripts", "image-generator", "src", "cli.ts");

        // Write CMS palette config to a temp file to avoid shell-escaping issues
        var paletteJson = _paletteService.GetPaletteConfigJson();
        var paletteTmpFile = Path.GetTempFileName();
        await System.IO.File.WriteAllTextAsync(paletteTmpFile, paletteJson);
        args += $" --palette-json-file \"{paletteTmpFile}\"";

        var nodeBinPath = _configuration["ImageGenerator:NodeBinPath"];
        var npxPath = "npx";
        if (!string.IsNullOrEmpty(nodeBinPath))
            npxPath = Path.Combine(nodeBinPath, "npx");

        var psi = new ProcessStartInfo(npxPath)
        {
            Arguments = $"tsx {scriptPath} {args}",
            WorkingDirectory = RepoRoot,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        if (!string.IsNullOrEmpty(nodeBinPath))
        {
            var currentPath = psi.Environment.TryGetValue("PATH", out var p) ? p : "";
            psi.Environment["PATH"] = $"{nodeBinPath}:{currentPath}";
        }

        using var process = Process.Start(psi);
        if (process == null)
        {
            System.IO.File.Delete(paletteTmpFile);
            return (-1, "Failed to start CLI process");
        }

        try
        {
            var stdout = await process.StandardOutput.ReadToEndAsync();
            var stderr = await process.StandardError.ReadToEndAsync();

            await process.WaitForExitAsync();

            var output = stdout;
            if (!string.IsNullOrWhiteSpace(stderr))
                output += "\n" + stderr;

            return (process.ExitCode, output.Trim());
        }
        finally
        {
            System.IO.File.Delete(paletteTmpFile);
        }
    }
}
