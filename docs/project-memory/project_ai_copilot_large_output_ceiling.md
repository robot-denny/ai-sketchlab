---
name: project_ai_copilot_large_output_ceiling
description: AI copilot silently aborts when a single set_value must emit a large value; keep RichText blocks section-sized
metadata: 
  node_type: memory
  type: project
  originSessionId: fba1fba6-5ff7-4cc6-9e14-1c262fc8fdc5
---

The backoffice AI copilot's content-edit tool (`set_value`) **replaces the whole property value**, so ANY edit of a long RichText block (even one word) forces the model to re-emit the ENTIRE markup as the tool-call argument. Large single-value outputs (~8 KB+) make the AG-UI SSE stream **abort silently** (~22 s, HTTP 200, ~0.8 kB delivered, no error in chat/console/server log). Small outputs (summarize-to-short, per-block edits) work fine. So "summarize works but a one-word edit hangs" is the *predicted* pattern, not randomness.

**Verified content-shaped, NOT a version regression or the RCL refactor** (2026-07-02, doc `115aa553`). Splitting a long block into section-sized blocks fixes it (each `set_value` stays small). Confirmed: consolidating many blocks into one (forcing a huge single output) reproduces the hang.

**Mechanism:** `AIToolReorderingChatClient` buffers the large tool-call server-side while it generates; nothing streams to the browser during that window, then the stream is cut — points to a timeout during buffering, not a token truncation.

**Levers:** the only exposed knob is the chat profile's `MaxTokens` (`AIChatProfileSettings.MaxTokens` → `ChatOptions.MaxOutputTokens`, currently null → provider default) set in Settings → AI → Profiles. Umbraco.AI exposes **no chat request-timeout config** (only an unrelated 30 s WebFetchTool timeout). If raising MaxTokens doesn't help, it's a streaming timeout with no config knob → vendor/v18 item. Durable answer: keep RichText blocks section-sized. See [[project_ai_suite_17_version_alignment]].
