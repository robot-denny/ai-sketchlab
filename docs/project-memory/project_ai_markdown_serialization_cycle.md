---
name: project_ai_markdown_serialization_cycle
description: "AI copilot \"review content\" throws object-cycle on pages using the Extended Markdown Editor; fixed via a JsonConverter on Umbraco.AI's static options."
metadata: 
  node_type: memory
  type: project
  originSessionId: e846bb80-0910-4db8-9cc5-b386670c7eba
---

Asking the Umbraco AI copilot to review a page that uses the **Extended Markdown Editor** (jcdcdev.Umbraco.ExtendedMarkdownEditor) threw:
`A possible object cycle was detected ... Path: $.Content.Properties.Value.Markdown.Parent.Parent.Parent...`

**Root cause (confirmed by decompiling Umbraco.AI.Core 1.14.0):** it's an Umbraco.AI bug, not the editor. `Umbraco.AI.Core`'s internal `PropertyValueFormatter.FormatValue` special-cases only a few editor aliases (RichText/TinyMCE → plain text, media/content pickers → small projections) and returns EVERY other editor's value object **as-is**. The markdown editor's value is a `MarkdownValue` (namespace `jcdcdev.Umbraco.ExtendedMarkdownEditor.Models`) whose `.Markdown` property is a Markdig `MarkdownDocument` — an AST where every node has a `.Parent` back-pointer. That DTO is serialized with `Umbraco.AI.Core.Constants.DefaultJsonSerializerOptions`, which sets **no `ReferenceHandler` and leaves `MaxDepth` at 64** → System.Text.Json follows `.Parent` until it aborts.

**Why updating the editor is NOT the fix:** 17.0.5 is the highest 17.x release; the only newer version is 18.0.0, which hard-requires `Umbraco.Cms.* [18.0.0, 19.0.0)` and would break restore on this 17.5.1 solution (full v18 migration or nothing). And 18.0.0 still returns the same `MarkdownValue` shape, so it wouldn't fix the crash anyway — the bug is on the serialization side.

**Fix shipped:** [src/UmbracoProject/AiMarkdownSerializationComposer.cs](src/UmbracoProject/AiMarkdownSerializationComposer.cs) — an `IComposer` that appends a `JsonConverter<MarkdownValue>` (writes `value.Raw`, the markdown source) to `Umbraco.AI.Core.Constants.DefaultJsonSerializerOptions.Converters`. **Key gotcha:** those options are a **public static singleton, NOT DI-resolved** — a converter registered via DI / `Configure<JsonSerializerOptions>` is never consulted on this path. Appending to the static `.Converters` list is the only hook, and it must happen before first AI serialization (JsonSerializerOptions freeze after first use); `Compose()` at host-build time is safely early. Verified: clean boot + copilot review works.

**Caveats / revisit signals:** mutates a third-party public static — fragile across Umbraco.AI upgrades; only shields `MarkdownValue` (any other rich-object editor hits the same upstream bug). Worth reporting upstream (fix = `ReferenceHandler.IgnoreCycles` on their options, or a markdown case in the formatter). Drop the composer if a fixed Umbraco.AI ships. Related: [[project_ai_1_14_allowed_config_key_prefixes]].
