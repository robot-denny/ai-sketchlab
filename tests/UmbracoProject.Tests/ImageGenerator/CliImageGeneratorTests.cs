using System.ComponentModel;
using System.Diagnostics;
using System.Text.RegularExpressions;
using HelloWorld;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models.PublishedContent;
using Xunit;

namespace UmbracoProject.Tests.ImageGenerator;

public class CliImageGeneratorTests
{
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _configuration;
    private readonly IPublishedContentQuery _publishedContentQuery;
    private readonly PaletteService _paletteService;
    private readonly IProcessRunner _processRunner;
    private readonly CliImageGenerator _sut;

    public CliImageGeneratorTests()
    {
        _env = Substitute.For<IWebHostEnvironment>();
        _env.ContentRootPath.Returns(Path.GetTempPath());

        _configuration = Substitute.For<IConfiguration>();
        _configuration["ImageGenerator:NodeBinPath"].Returns((string?)null);

        _publishedContentQuery = Substitute.For<IPublishedContentQuery>();
        _publishedContentQuery.ContentAtRoot().Returns(Array.Empty<IPublishedContent>());
        _paletteService = new PaletteService(_publishedContentQuery, NullLogger<PaletteService>.Instance);

        _processRunner = Substitute.For<IProcessRunner>();

        _sut = new CliImageGenerator(
            _env,
            _configuration,
            _paletteService,
            _processRunner,
            NullLogger<CliImageGenerator>.Instance);
    }

    private void RunnerReturns(ProcessRunResult? result)
    {
        _processRunner.RunAsync(Arg.Any<ProcessStartInfo>()).Returns(Task.FromResult(result));
    }

    private ProcessStartInfo CapturedStartInfo()
    {
        var call = _processRunner.ReceivedCalls()
            .FirstOrDefault(c => c.GetMethodInfo().Name == nameof(IProcessRunner.RunAsync));
        Assert.NotNull(call);
        return (ProcessStartInfo)call.GetArguments()[0]!;
    }

    [Fact]
    public async Task ExitZero_Success_OutputIsStdout()
    {
        RunnerReturns(new ProcessRunResult(0, "rendered", ""));

        var result = await _sut.GenerateAsync("doc1");

        Assert.True(result.Success);
        Assert.Equal("rendered", result.Output);
    }

    [Fact]
    public async Task NonZeroExit_Failure()
    {
        RunnerReturns(new ProcessRunResult(1, "partial", "boom"));

        var result = await _sut.GenerateAsync("doc1");

        Assert.False(result.Success);
        Assert.Equal("partial\nboom", result.Output);
    }

    [Fact]
    public async Task StderrAppendedOnSuccess()
    {
        RunnerReturns(new ProcessRunResult(0, "ok", "warning"));

        var result = await _sut.GenerateAsync("doc1");

        Assert.True(result.Success);
        Assert.Equal("ok\nwarning", result.Output);
    }

    [Fact]
    public async Task NullProcess_Failure()
    {
        RunnerReturns(null);

        var result = await _sut.GenerateAsync("doc1");

        Assert.False(result.Success);
        Assert.Equal("Failed to start CLI process", result.Output);
    }

    [Fact]
    public async Task Win32OnLaunch_FailsWithNodeBinPathDiagnostic()
    {
        _processRunner.RunAsync(Arg.Any<ProcessStartInfo>()).ThrowsAsync(new Win32Exception("no such file"));

        var result = await _sut.GenerateAsync("doc1");

        Assert.False(result.Success);
        Assert.Contains("ImageGenerator:NodeBinPath", result.Output);
        Assert.Contains("(unset — using PATH)", result.Output);
    }

    [Fact]
    public async Task SingleArticle_ComposesExpectedArguments()
    {
        RunnerReturns(new ProcessRunResult(0, "rendered", ""));

        await _sut.GenerateAsync("1a2b3c", force: true);

        var psi = CapturedStartInfo();
        Assert.StartsWith("tsx ", psi.Arguments);
        Assert.Contains(Path.Combine("scripts", "image-generator", "src", "cli.ts"), psi.Arguments);
        Assert.Contains("--id 1a2b3c --force", psi.Arguments);
        Assert.Contains("--palette-json-file", psi.Arguments);
    }

    [Fact]
    public async Task PaletteTempFile_ContainsConfigJson()
    {
        string? capturedTempPath = null;
        string? capturedTempContent = null;

        _processRunner.RunAsync(Arg.Any<ProcessStartInfo>()).Returns(call =>
        {
            var psi = (ProcessStartInfo)call[0]!;
            var match = Regex.Match(psi.Arguments, "--palette-json-file \"(.+?)\"");
            capturedTempPath = match.Groups[1].Value;
            // Read while the file still exists — the runner runs before the cleanup finally.
            capturedTempContent = File.ReadAllText(capturedTempPath);
            return Task.FromResult<ProcessRunResult?>(new ProcessRunResult(0, "ok", ""));
        });

        await _sut.GenerateAsync("doc1");

        Assert.NotNull(capturedTempPath);
        Assert.Equal(_paletteService.GetPaletteConfigJson(), capturedTempContent);
    }

    [Fact]
    public async Task TempFileCleanedUp_OnNormalCompletion()
    {
        string? tempPath = null;
        _processRunner.RunAsync(Arg.Any<ProcessStartInfo>()).Returns(call =>
        {
            tempPath = ExtractTempPath((ProcessStartInfo)call[0]!);
            return Task.FromResult<ProcessRunResult?>(new ProcessRunResult(0, "ok", ""));
        });

        await _sut.GenerateAsync("doc1");

        Assert.NotNull(tempPath);
        Assert.False(File.Exists(tempPath));
    }

    [Fact]
    public async Task TempFileCleanedUp_OnNullProcess()
    {
        string? tempPath = null;
        _processRunner.RunAsync(Arg.Any<ProcessStartInfo>()).Returns(call =>
        {
            tempPath = ExtractTempPath((ProcessStartInfo)call[0]!);
            return Task.FromResult<ProcessRunResult?>(null);
        });

        await _sut.GenerateAsync("doc1");

        Assert.NotNull(tempPath);
        Assert.False(File.Exists(tempPath));
    }

    [Fact]
    public async Task TempFileCleanedUp_OnWin32Exception()
    {
        string? tempPath = null;
        _processRunner.RunAsync(Arg.Any<ProcessStartInfo>()).Returns<Task<ProcessRunResult?>>(call =>
        {
            tempPath = ExtractTempPath((ProcessStartInfo)call[0]!);
            throw new Win32Exception("no such file");
        });

        await _sut.GenerateAsync("doc1");

        Assert.NotNull(tempPath);
        Assert.False(File.Exists(tempPath));
    }

    [Fact]
    public async Task Batch_PassesBatchFlag_WithoutForce()
    {
        RunnerReturns(new ProcessRunResult(0, "ok", ""));

        await _sut.GenerateBatchAsync(force: false);

        var psi = CapturedStartInfo();
        Assert.Contains("--batch", psi.Arguments);
        Assert.DoesNotContain("--force", psi.Arguments);
    }

    [Fact]
    public async Task Batch_PassesBatchFlag_WithForce()
    {
        RunnerReturns(new ProcessRunResult(0, "ok", ""));

        await _sut.GenerateBatchAsync(force: true);

        var psi = CapturedStartInfo();
        Assert.Contains("--batch --force", psi.Arguments);
    }

    private static string ExtractTempPath(ProcessStartInfo psi)
    {
        var match = Regex.Match(psi.Arguments, "--palette-json-file \"(.+?)\"");
        return match.Groups[1].Value;
    }
}
