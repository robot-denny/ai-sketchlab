namespace HelloWorld;

public interface IImageGenerator
{
    Task<ImageGenerationResult> GenerateAsync(string documentId, bool force = false);

    Task<ImageGenerationResult> GenerateBatchAsync(bool force = false);
}
