using System.ComponentModel;
using System.Diagnostics;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HelloWorld;

// Anti-corruption boundary around the image-generator CLI subprocess. Everything bug-prone —
// exit-code→success mapping, stderr-append, null-process handling, the Win32Exception diagnostic,
// temp-file cleanup, and byte-for-byte argument composition — lives here and is unit-testable by
// substituting IProcessRunner. The literal Process.Start plumbing lives in DefaultProcessRunner.
public sealed class CliImageGenerator : IImageGenerator
{
    private readonly IConfiguration _configuration;
    private readonly PaletteService _paletteService;
    private readonly IProcessRunner _processRunner;
    private readonly ILogger<CliImageGenerator> _logger;
    private readonly string _repoRoot;

    public CliImageGenerator(
        IWebHostEnvironment env,
        IConfiguration configuration,
        PaletteService paletteService,
        IProcessRunner processRunner,
        ILogger<CliImageGenerator> logger)
    {
        _configuration = configuration;
        _paletteService = paletteService;
        _processRunner = processRunner;
        _logger = logger;
        // ContentRootPath is process-lifetime stable, so resolve once.
        _repoRoot = Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", ".."));
    }

    // Synchronous passthrough — the real async body is RunCliAsync. Returning the Task
    // directly avoids an unnecessary async state machine; argument composition cannot throw.
    public Task<ImageGenerationResult> GenerateAsync(string documentId, bool force = false)
    {
        var args = $"--id {documentId}";
        if (force) args += " --force";

        return RunCliAsync(args);
    }

    // Synchronous passthrough — the real async body is RunCliAsync.
    public Task<ImageGenerationResult> GenerateBatchAsync(bool force = false)
    {
        var args = "--batch";
        if (force) args += " --force";

        return RunCliAsync(args);
    }

    private async Task<ImageGenerationResult> RunCliAsync(string args)
    {
        var scriptPath = Path.Combine(_repoRoot, "scripts", "image-generator", "src", "cli.ts");

        // Write CMS palette config to a temp file to avoid shell-escaping issues.
        var paletteTmpFile = Path.GetTempFileName();
        try
        {
            var paletteJson = _paletteService.GetPaletteConfigJson();
            await File.WriteAllTextAsync(paletteTmpFile, paletteJson);
            args += $" --palette-json-file \"{paletteTmpFile}\"";

            var configuredNodeBinPath = _configuration["ImageGenerator:NodeBinPath"];
            var nodeBinPath = configuredNodeBinPath;
            var npxPath = "npx";

            if (!string.IsNullOrEmpty(nodeBinPath))
            {
                var candidate = Path.Combine(nodeBinPath, "npx");
                if (File.Exists(candidate))
                {
                    npxPath = candidate;
                }
                else
                {
                    _logger.LogWarning(
                        "ImageGenerator:NodeBinPath '{NodeBinPath}' does not contain an 'npx' binary; falling back to 'npx' on PATH.",
                        nodeBinPath);
                    nodeBinPath = null;
                }
            }

            var psi = new ProcessStartInfo(npxPath)
            {
                Arguments = $"tsx {scriptPath} {args}",
                WorkingDirectory = _repoRoot,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            if (!string.IsNullOrEmpty(nodeBinPath))
            {
                var currentPath = psi.Environment.TryGetValue("PATH", out var p) ? p : "";
                psi.Environment["PATH"] = $"{nodeBinPath}{Path.PathSeparator}{currentPath}";
            }

            ProcessRunResult? result;
            try
            {
                result = await _processRunner.RunAsync(psi);
            }
            catch (Win32Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to launch image generator CLI using '{NpxPath}' (NodeBinPath='{ConfiguredNodeBinPath}')",
                    npxPath, configuredNodeBinPath ?? "(unset)");
                return new ImageGenerationResult(false,
                    $"Failed to launch image generator: {ex.Message}. " +
                    $"Check ImageGenerator:NodeBinPath in appsettings.Development.json " +
                    $"(configured: '{configuredNodeBinPath ?? "(unset — using PATH)"}').");
            }

            if (result is null)
                return new ImageGenerationResult(false, "Failed to start CLI process");

            var output = result.StandardOutput;
            if (!string.IsNullOrWhiteSpace(result.StandardError))
                output += "\n" + result.StandardError;

            return new ImageGenerationResult(result.ExitCode == 0, output.Trim());
        }
        finally
        {
            // Path.GetTempFileName always creates the file, so deletion is unconditional.
            // Suppress IOException to avoid masking a real exception in flight.
            try { File.Delete(paletteTmpFile); }
            catch (IOException) { }
        }
    }
}
