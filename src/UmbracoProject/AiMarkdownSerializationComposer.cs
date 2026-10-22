using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using jcdcdev.Umbraco.ExtendedMarkdownEditor.Models;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;
using Umbraco.AI.Core.Chat;
using Umbraco.AI.Core.Chat.Middleware;
using Umbraco.AI.Extensions;
using Umbraco.AI.Startup.Configuration;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace UmbracoProject;

// Workaround for an Umbraco.AI defect (first observed on Umbraco.AI 1.14.0; still present on 18.6.0).
//
// When the AI reads page content, Umbraco.AI.Core's internal PropertyValueFormatter walks each
// property value. It special-cases a handful of editor aliases (RichText/TinyMCE -> plain text,
// media/content pickers -> small projections) but returns EVERY other editor's value object as-is.
//
// The Extended Markdown Editor's value converter returns a MarkdownValue whose .Markdown property is
// a Markdig MarkdownDocument. Every node in that AST holds a .Parent back-reference to its container,
// so System.Text.Json recurses .Parent -> .Parent -> ... and throws:
//   "A possible object cycle was detected ... Path: $.Content.Properties.Value.Markdown.Parent.Parent..."
//
// Three serialization paths reach a MarkdownValue, so this composer installs three hooks:
//
// 1. Umbraco.AI's own static Umbraco.AI.Core.Constants.DefaultJsonSerializerOptions (used e.g. by the
//    AI Context content resource). DI-registered JSON options are NOT consulted there, so we append a
//    converter to that static instance. Compose() runs at host-build time, before any AI serialization,
//    so the options are not yet frozen (JsonSerializerOptions become read-only after first use).
//
// On the v18 suite (Umbraco.AI 18.6.0, Umbraco.AI.AGUI 18.4.0, Anthropic SDK 12.29.1) tools such as
// get_umbraco_content return their raw result object, which two read-only serializers then meet:
//
// 2. The provider client serializes tool results sent back to the model with Microsoft.Extensions.AI's
//    AIJsonUtilities.DefaultOptions. ToolResultProviderMiddleware is the innermost wrapper around the
//    provider client and rewrites each result to a JsonElement first. This covers the non-streaming
//    agent /run path, where FunctionInvokingChatClient loops internally.
//
// 3. The copilot's streaming AG-UI path (/agents/{alias}/stream-agui): AGUIEventEmitter.EmitToolResult
//    calls JsonSerializer.Serialize(result) with DEFAULT options on each tool-result update, before the
//    next provider call, so hook 2 is too late. ToolResultStreamMiddleware wraps
//    FunctionInvokingChatClient directly and rewrites tool-result updates as they stream out.
//
// Both rewrites use a copy of the static options from hook 1 (so they carry the converter) that keeps
// dictionary keys verbatim, so property aliases reach the model exactly as stored. The converter emits
// just the raw markdown string, which is also the most useful representation for the LLM to read.
//
// REVISIT on any Umbraco.AI upgrade: all three hooks lean on third-party internals (a public static, the
// middleware order, and where tool results get serialized). If upstream adds a MarkdownValue case to
// the formatter or a cycle-safe serializer, drop this composer. Re-test recipe (both the /run and the
// stream-agui paths): docs/project-memory/project_ai_markdown_serialization_cycle.md.
[ComposeAfter(typeof(UmbracoAIComposer))]
public sealed class AiMarkdownSerializationComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        JsonSerializerOptions options = Umbraco.AI.Core.Constants.DefaultJsonSerializerOptions;

        if (!options.Converters.Any(converter => converter is MarkdownValueJsonConverter))
        {
            options.Converters.Add(new MarkdownValueJsonConverter());
        }

        builder.Services.AddSingleton<ToolResultSerializer>();

        // Umbraco.AI applies middleware in collection order, each wrapping the last. Index 0 is therefore
        // the innermost wrapper around the provider client (hook 2); anything else later inserted at
        // index 0 would sit below it, so keep this the only index-0 insert. Directly after
        // AIFunctionInvokingChatMiddleware is the first wrapper outside FunctionInvokingChatClient, which
        // sees each tool-result update before the AG-UI emitter does (hook 3). ComposeAfter guarantees
        // Umbraco.AI has registered that middleware before we position against it.
        builder.AIChatMiddleware()
            .Insert<ToolResultProviderMiddleware>()
            .InsertAfter<AIFunctionInvokingChatMiddleware, ToolResultStreamMiddleware>();
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

    // Rewrites object-typed FunctionResultContent.Result values to JsonElement.
    //
    // DELIBERATE SIDE EFFECT: results are rewritten IN PLACE on the FunctionResultContent objects, which
    // FunctionInvokingChatClient shares with the conversation history it keeps and returns. Once
    // rewritten, a result is a JsonElement, so later passes skip it (idempotent), and the history the
    // caller keeps or persists is cycle-safe too. Swapping in new content objects instead would change
    // what FunctionInvokingChatClient sees in its own history.
    private sealed class ToolResultSerializer(ILogger<ToolResultSerializer> logger)
    {
        // A copy of Umbraco.AI's static options (so it carries MarkdownValueJsonConverter), with
        // dictionary keys left verbatim instead of camel-cased. Built lazily: by first use, hook 1 has
        // already added the converter, and copying frozen options yields an unfrozen copy.
        private static readonly Lazy<JsonSerializerOptions> Options = new(() =>
            new JsonSerializerOptions(Umbraco.AI.Core.Constants.DefaultJsonSerializerOptions)
            {
                DictionaryKeyPolicy = null,
            });

        public void Rewrite(IEnumerable<AIContent> contents)
        {
            foreach (AIContent content in contents)
            {
                if (content is FunctionResultContent { Result: { } result } functionResult && NeedsSerializing(result))
                {
                    functionResult.Result = Serialize(result, functionResult.CallId);
                }
            }
        }

        // A tool's value that still can't be serialized (e.g. another editor's cyclic object) becomes a
        // short note for the model instead of aborting the whole AI turn after the tool already ran.
        private object Serialize(object result, string callId)
        {
            try
            {
                return JsonSerializer.SerializeToElement(result, result.GetType(), Options.Value);
            }
            catch (Exception ex) when (ex is JsonException or NotSupportedException)
            {
                logger.LogWarning(
                    ex,
                    "AI tool result {ResultType} for call {CallId} could not be serialized; sending a placeholder to the model",
                    result.GetType().FullName,
                    callId);
                return $"[tool result could not be serialized: {result.GetType().Name}]";
            }
        }

        // Leave alone anything already sent verbatim: text, JSON, AI content, and value types
        // (primitives, decimal, Guid, DateTime, enums).
        private static bool NeedsSerializing(object result) =>
            result is not (string or JsonElement or JsonNode or JsonDocument or AIContent or IEnumerable<AIContent>)
            && !result.GetType().IsValueType;
    }

    // Hook 2: innermost, so tool results in the outgoing history are JSON before the provider sees them.
    private sealed class ToolResultProviderMiddleware(ToolResultSerializer serializer) : IAIChatMiddleware
    {
        public IChatClient Apply(IChatClient client) => new ProviderClient(client, serializer);

        private sealed class ProviderClient(IChatClient innerClient, ToolResultSerializer serializer)
            : DelegatingChatClient(innerClient)
        {
            public override Task<ChatResponse> GetResponseAsync(
                IEnumerable<ChatMessage> messages,
                ChatOptions? options = null,
                CancellationToken cancellationToken = default) =>
                base.GetResponseAsync(RewriteHistory(messages), options, cancellationToken);

            public override IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
                IEnumerable<ChatMessage> messages,
                ChatOptions? options = null,
                CancellationToken cancellationToken = default) =>
                base.GetStreamingResponseAsync(RewriteHistory(messages), options, cancellationToken);

            private IEnumerable<ChatMessage> RewriteHistory(IEnumerable<ChatMessage> messages)
            {
                // Materialized so the sequence is enumerated once, here; this does NOT isolate the
                // caller's message or content objects (see ToolResultSerializer).
                List<ChatMessage> list = messages as List<ChatMessage> ?? messages.ToList();
                foreach (ChatMessage message in list)
                {
                    serializer.Rewrite(message.Contents);
                }

                return list;
            }
        }
    }

    // Hook 3: just outside FunctionInvokingChatClient, so each tool result is JSON before a stream
    // consumer (the AG-UI emitter) serializes it with default options.
    private sealed class ToolResultStreamMiddleware(ToolResultSerializer serializer) : IAIChatMiddleware
    {
        public IChatClient Apply(IChatClient client) => new StreamClient(client, serializer);

        private sealed class StreamClient(IChatClient innerClient, ToolResultSerializer serializer)
            : DelegatingChatClient(innerClient)
        {
            public override async Task<ChatResponse> GetResponseAsync(
                IEnumerable<ChatMessage> messages,
                ChatOptions? options = null,
                CancellationToken cancellationToken = default)
            {
                ChatResponse response = await base.GetResponseAsync(messages, options, cancellationToken);
                foreach (ChatMessage message in response.Messages)
                {
                    serializer.Rewrite(message.Contents);
                }

                return response;
            }

            public override async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
                IEnumerable<ChatMessage> messages,
                ChatOptions? options = null,
                [EnumeratorCancellation] CancellationToken cancellationToken = default)
            {
                await foreach (ChatResponseUpdate update in base.GetStreamingResponseAsync(messages, options, cancellationToken))
                {
                    serializer.Rewrite(update.Contents);
                    yield return update;
                }
            }
        }
    }
}
