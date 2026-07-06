using System.Text.Json;
using System.Text.Json.Serialization;
using jcdcdev.Umbraco.ExtendedMarkdownEditor.Models;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace UmbracoProject;

// Workaround for an Umbraco.AI defect (observed on Umbraco.AI 1.14.0).
//
// When the AI copilot reviews page content, Umbraco.AI.Core's internal PropertyValueFormatter
// walks each property value. It special-cases a handful of editor aliases (RichText/TinyMCE ->
// plain text, media/content pickers -> small projections) but returns EVERY other editor's value
// object as-is, then serializes the whole DTO with the static Umbraco.AI.Core.Constants.
// DefaultJsonSerializerOptions — which sets no ReferenceHandler and leaves the default MaxDepth of 64.
//
// The Extended Markdown Editor's value converter returns a MarkdownValue whose .Markdown property is
// a Markdig MarkdownDocument. Every node in that AST holds a .Parent back-reference to its container,
// so System.Text.Json recurses .Parent -> .Parent -> ... and throws:
//   "A possible object cycle was detected ... Path: $.Content.Properties.Value.Markdown.Parent.Parent..."
//
// Registering a converter that emits just the raw markdown string keeps the AST out of the payload
// (raw markdown is also the most useful representation for the LLM to review). We append it to the
// same static options instance the formatter uses; DI-registered JSON options are NOT consulted by
// this code path, so this is the only hook. Compose() runs at host-build time — well before any AI
// serialization — so the options are not yet frozen (JsonSerializerOptions become read-only after
// first use).
//
// REVISIT on any Umbraco.AI upgrade: DefaultJsonSerializerOptions is a third-party public static and
// the underlying bug may be fixed upstream (a cycle-safe serializer or a MarkdownValue case in the
// formatter would make this redundant). If they harden it, drop this composer.
public sealed class AiMarkdownSerializationComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        JsonSerializerOptions options = Umbraco.AI.Core.Constants.DefaultJsonSerializerOptions;

        foreach (JsonConverter converter in options.Converters)
        {
            if (converter is MarkdownValueJsonConverter)
            {
                return;
            }
        }

        options.Converters.Add(new MarkdownValueJsonConverter());
    }

    // Write-only: this path only serializes content out to the model. MarkdownValue has no public
    // constructor (only static factories), so deserialization is neither needed nor supported here.
    private sealed class MarkdownValueJsonConverter : JsonConverter<MarkdownValue>
    {
        public override MarkdownValue Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            throw new NotSupportedException("MarkdownValue is serialized for AI review only and cannot be deserialized.");

        public override void Write(Utf8JsonWriter writer, MarkdownValue value, JsonSerializerOptions options) =>
            writer.WriteStringValue(value.Raw ?? string.Empty);
    }
}
