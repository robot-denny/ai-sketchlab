using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace HelloWorld;

// Registers the image-generator subsystem. One composer per concern — kept separate from
// PaletteServiceComposer so each service's lifetime and dependency choice stays obvious.
// DefaultProcessRunner is internal, but AddTransient<TService, TImpl> only requires the
// implementation type be assignable to the service type, not publicly visible.
public class ImageGeneratorComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder) =>
        builder.Services
            .AddTransient<IProcessRunner, DefaultProcessRunner>()
            .AddTransient<IImageGenerator, CliImageGenerator>();
}
