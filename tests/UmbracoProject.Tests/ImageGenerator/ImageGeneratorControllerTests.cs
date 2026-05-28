using System.Text.Json;
using HelloWorld;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using Umbraco.Cms.Core.Services;
using Xunit;

namespace UmbracoProject.Tests.ImageGenerator;

// Focused unit tests for the slimmed ImageGeneratorController. The controller is now a thin
// HTTP adapter over IImageGenerator — these tests substitute the generator and assert the
// controller calls it correctly and shapes the JSON response. No subprocess is spawned;
// that's the whole point of the refactor.
//
// The three non-generate dependencies (IContentService, IContentTypeService, PaletteService)
// are passed as null! because Generate / GenerateBatch never touch them — the controller
// only stores the references in fields. CliImageGeneratorTests covers the generator itself.
public class ImageGeneratorControllerTests
{
    private readonly IImageGenerator _generator;
    private readonly ImageGeneratorController _sut;

    public ImageGeneratorControllerTests()
    {
        _generator = Substitute.For<IImageGenerator>();
        _sut = new ImageGeneratorController(null!, null!, null!, _generator);
    }

    private static (bool Success, string Output) ReadBody(IActionResult actionResult)
    {
        var ok = Assert.IsType<OkObjectResult>(actionResult);
        // Serialize then re-parse: the controller returns an anonymous object whose internal
        // visibility would otherwise break a dynamic / reflection path across the assembly
        // boundary. JsonDocument is the robust, casing-aware read path.
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(ok.Value));
        var success = doc.RootElement.GetProperty("success").GetBoolean();
        var output = doc.RootElement.GetProperty("output").GetString() ?? "";
        return (success, output);
    }

    [Fact]
    public async Task Generate_DefaultForceFalse_CallsGeneratorWithFalse()
    {
        _generator.GenerateAsync("some-id", false).Returns(new ImageGenerationResult(true, "ok"));

        var actionResult = await _sut.Generate("some-id");

        await _generator.Received(1).GenerateAsync("some-id", false);
        var body = ReadBody(actionResult);
        Assert.True(body.Success);
        Assert.Equal("ok", body.Output);
    }

    [Fact]
    public async Task Generate_ForceTrue_PassesForceThrough()
    {
        _generator.GenerateAsync("xyz", true).Returns(new ImageGenerationResult(true, "done"));

        await _sut.Generate("xyz", force: true);

        await _generator.Received(1).GenerateAsync("xyz", true);
    }

    [Fact]
    public async Task GenerateBatch_DefaultForceFalse_CallsGeneratorWithFalse()
    {
        _generator.GenerateBatchAsync(false).Returns(new ImageGenerationResult(true, "batched"));

        await _sut.GenerateBatch();

        await _generator.Received(1).GenerateBatchAsync(false);
    }

    [Fact]
    public async Task GenerateBatch_ForceTrue_PassesForceThroughToGenerator()
    {
        _generator.GenerateBatchAsync(true).Returns(new ImageGenerationResult(true, "batched"));

        await _sut.GenerateBatch(force: true);

        await _generator.Received(1).GenerateBatchAsync(true);
    }

    [Fact]
    public async Task GenerateBatch_SuccessResult_Returns200Body()
    {
        // AC1 byte-identical contract: the batch path must shape { success, output } exactly
        // like Generate. The other GenerateBatch tests assert the call was made; this one
        // exercises the response projection.
        _generator.GenerateBatchAsync(false).Returns(new ImageGenerationResult(true, "batched"));

        var actionResult = await _sut.GenerateBatch();

        var body = ReadBody(actionResult);
        Assert.True(body.Success);
        Assert.Equal("batched", body.Output);
    }

    [Fact]
    public async Task FailureResult_StillReturns200Body()
    {
        // Per AC1: a failed generation is still a 200 with { success: false, output: "..." }.
        // The controller does not surface non-2xx status codes; the dashboard reads the body.
        _generator.GenerateAsync(Arg.Any<string>(), Arg.Any<bool>())
            .Returns(new ImageGenerationResult(false, "error text"));

        var actionResult = await _sut.Generate("any");

        var body = ReadBody(actionResult);
        Assert.False(body.Success);
        Assert.Equal("error text", body.Output);
    }

    // NoSubprocessSpawned is implicit: the only dependency the generate actions touch is the
    // substituted IImageGenerator. If the controller still reached for Process.Start or
    // ProcessStartInfo, these tests would either spawn a real subprocess (visible flakiness)
    // or fail to compile against the slimmed constructor — both ways, the refactor is gated.
}
