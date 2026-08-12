# Spec for Editor How-To Guides

> This spec captures initial requirements and design rationale. For **current system behavior**, see `_features/editor-how-to-guides.md`.

branch: claude/feature/editor-how-to-guides
figma_component (if used): n/a

## Summary

Site editors need self-serve documentation for every feature they touch — block components, site settings, and global elements. Today there is no central reference: the existing Style Guide is brand/tokens, the Components page (`/styleguide/components`) is a visual showcase, and nobody has a place to learn how a specific block or setting actually works.

This feature introduces a new **Guides** section under Home, hidden from the main top navigation, where each documentable feature gets one page. A page combines a live instance of the block being documented (when applicable), an editable AI-generated explanation of how to use it and what configuration options exist, and an editor-uploaded screenshot for features that cannot be embedded as a block (settings, header/footer, etc.).

A new `/guide` slash command creates and maintains these pages. The AI is invoked through the Umbraco backoffice AI Agent — not through a direct call to a third-party model — so that brand voice, tone, and editorial guidelines stay editable in the backoffice rather than baked into code. All generated content lands in normal editable properties, so an editor can take over a guide at any time. Crucially, the command never blindly overwrites editor work: when a guide already exists and its underlying source has not changed, the command skips it silently; when the source has changed, the command asks the agent to **amend** the existing description rather than rewrite it from scratch, presents the proposed changes for confirmation, and never touches editor-uploaded fields like the screenshot.

## Functional Requirements

- A new **Guides** parent page exists under Home, hidden from the main top navigation, where editors can organize how-to guides freely (subfolders allowed via the standard Content doc type).
- A new **How-To Guide Page** doc type provides the structured shape for individual guides:
  - Title (from the document name).
  - A live-example slot that lets editors embed the documented block on the page itself, when the feature is a block.
  - An editable rich-text description that the AI populates and editors can amend.
  - An optional screenshot field that editors fill in for features which cannot be embedded as a block (site settings, header/footer config, etc.).
  - A read-only generation-metadata field that records the source signature and last-generated timestamp, so the slash command can detect drift on subsequent runs.
- Both the Guides parent page and every How-To Guide Page default to **hidden from the main top navigation** so they do not pollute the global nav.
- The existing `/styleguide` and `/styleguide/components` pages stay where they are. The Guides section links to them; it does not move them.
- A `/guide <feature-alias>` slash command creates a new how-to guide page for the named feature, generating the description through the Umbraco backoffice AI Agent and writing the result to the Management API.
- A `/guide --audit` mode lists every documentable feature on the site that does not yet have a guide page (the gap list).
- The slash command is **change-aware**:
  - If no guide page exists for a feature → generate a fresh page and record the source signature.
  - If a guide page exists and the underlying source has not changed since the last generation → skip silently with no AI call and no prompt.
  - If a guide page exists and the underlying source has changed → ask the AI agent to **amend** (not rewrite) the existing description, present the proposed change to the operator for explicit approval, and only write the result if approved.
- Editor-uploaded fields (screenshot, manual edits to the live-example block, manual prose additions to the description) are **never silently overwritten** by the command in any branch.
- AI generation is invoked through the Umbraco backoffice AI Agent so brand voice, tone, and editorial guidelines remain editable in **Settings → AI** (Contexts attached to the agent) rather than embedded in code.
- All generated content lives in standard editable properties; an editor can hand-edit any guide page in the backoffice exactly like any other content.
- The Guides section is reachable by direct URL (`/guides/`) but absent from the main site navigation.

## Figma Design Reference (only if referenced)

n/a — this feature has no Figma deliverable. Visual treatment of guide pages reuses existing block partials and the Living Style Guide's typography rules.

## Possible Edge Cases

- A feature alias is passed to `/guide` that does not match any block component or settings doc type.
- A feature alias matches multiple things (e.g. an element type and a doc type with overlapping aliases).
- The Umbraco backoffice agent has not been created yet in the local environment.
- The Umbraco backoffice agent times out or returns an error mid-stream (SSE connection drops).
- A guide page exists but its source-signature property is empty (manually created by an editor before the command was first run against it).
- An editor has deleted the AI-generated description and replaced it entirely with their own prose; the command should not undo their work.
- An editor has appended their own paragraphs to the AI description; the command should preserve those paragraphs when amending.
- A block partial is renamed or removed; the audit should flag the orphaned guide page.
- Two operators run `/guide` against the same feature concurrently.
- The slash command is run on a Cloud environment where the agent has not been recreated (per the Agent.Deploy caveat).
- A feature has no element type to introspect (e.g. a global setting that lives on Home rather than as its own doc type).
- The brand-voice context attached to the agent is updated in the backoffice; should every existing guide be re-amended?
- The terminal running the slash command is non-interactive (CI, automation), so an "approve y/n" prompt cannot be answered.
- The proposed amend differs only in whitespace or wording, not substance — the operator should still see it before it lands.

## Acceptance Criteria

1. A **Guides** parent page exists under Home, with a URL of `/guides/`, and is absent from the main top navigation while remaining reachable by direct URL.
2. A **How-To Guide Page** doc type exists with the fields named above (live example, editable description, optional screenshot, read-only generation metadata) and defaults to hidden from the main top navigation.
3. Running `/guide <feature-alias>` for a feature that has no existing guide creates a new How-To Guide Page under `/guides/`, populates the description via the Umbraco backoffice AI Agent, embeds the documented block in the live-example slot when the feature is a block, and records a source signature on the page.
4. Running `/guide <feature-alias>` for a feature whose source has not changed since the last generation completes silently, performs no AI call, and reports "no changes" to the operator.
5. Running `/guide <feature-alias>` for a feature whose source has changed since the last generation calls the agent in **amend** mode, presents the proposed description change to the operator for approval, and only writes the result when the operator approves.
6. The slash command never modifies the screenshot field, the live-example block configuration, or any property other than the description and the generation-metadata fields.
7. Running `/guide --audit` lists every documentable feature on the site that does not yet have a guide page, and flags any guide pages whose underlying feature has been removed.
8. AI generation routes through the Umbraco backoffice AI Agent (configured in **Settings → AI**), so changing the brand-voice context in the backoffice changes the tone of subsequently generated guides without a code change.
9. An editor can open any guide page in the backoffice and hand-edit the description and other fields like any other piece of content; their edits survive subsequent `/guide` runs as long as the underlying source has not changed.
10. The existing `/styleguide` and `/styleguide/components` pages remain at their current URLs; the Guides section links to them rather than replacing or duplicating them.

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples ("alertBanner", "Site Header", a fictional editor named "Sam"). These will be verified and refined after implementation. See `_features/editor-how-to-guides.md` for the verified version.

### Rule: The Guides section is reachable by direct URL but hidden from the main top navigation

```scenario
Scenario: A visitor navigates the site and does not see Guides in the top nav
  Given the Guides parent page exists under Home
  And the Guides parent page has "hide from top navigation" set to true
  When a visitor loads the home page
  Then the main top navigation does not contain a "Guides" link
```

```scenario
Scenario: A CMS editor reaches the Guides section by typing the URL
  Given the Guides parent page is published at /guides/
  When the editor visits /guides/ directly in their browser
  Then the page loads with a 200 response
  And the page renders the Guides landing content
```

### Rule: A How-To Guide Page provides the canonical shape for documenting a feature

```scenario
Scenario: An editor opens a How-To Guide Page in the backoffice
  Given a How-To Guide Page exists for the Alert Banner block
  When the editor opens it for editing
  Then they see a live-example slot containing an Alert Banner block
  And they see an editable rich-text description
  And they see an optional screenshot field
  And they see a read-only generation-metadata panel with the last-generated date
```

```scenario
Scenario: A new How-To Guide Page defaults to hidden from the main top navigation
  Given the editor creates a new How-To Guide Page through the backoffice
  When they save it for the first time without changing the visibility toggle
  Then "hide from top navigation" is already set to true
```

### Rule: The first run of /guide for a feature creates and populates the guide page from scratch

```scenario
Scenario: Sam runs /guide alertBanner for the first time
  Given no How-To Guide Page exists for the Alert Banner block
  When Sam runs "/guide alertBanner"
  Then a new How-To Guide Page is created under /guides/
  And the page name reads "How to use the Alert Banner"
  And the live-example slot contains an Alert Banner block
  And the description is populated by the Umbraco backoffice AI Agent
  And the generation-metadata records the current source signature and timestamp
  And the page is published with "hide from top navigation" set to true
```

### Rule: When the underlying source has not changed, /guide skips the feature silently

```scenario
Scenario: Sam re-runs /guide alertBanner the next morning with no source changes
  Given a How-To Guide Page exists for the Alert Banner block
  And the recorded source signature matches the current source
  When Sam runs "/guide alertBanner"
  Then no AI call is made
  And the guide page is not modified
  And the command reports "no changes — alertBanner guide is up to date"
```

### Rule: When the underlying source has changed, /guide proposes an amend and waits for approval

```scenario
Scenario: A developer adds a new "severity" property to the Alert Banner element type
  Given a How-To Guide Page exists for the Alert Banner block
  And the recorded source signature does not match the current source
  When Sam runs "/guide alertBanner"
  Then the agent is called in amend mode with the existing description and the new source
  And the command prints a diff of the proposed description change to the terminal
  And the command waits for explicit approval before writing
  When Sam approves the change
  Then the description is updated with the amended text
  And the generation-metadata is updated with the new source signature and timestamp
```

```scenario
Scenario: Sam declines a proposed amend
  Given /guide alertBanner has detected a source change and proposed a diff
  When Sam declines the change
  Then the description is not modified
  And the generation-metadata is not modified
  And the command exits cleanly with "no changes written"
```

### Rule: /guide never silently overwrites editor work

```scenario
Scenario: An editor uploaded a screenshot before a /guide re-run
  Given a How-To Guide Page exists for the Site Header settings
  And the editor previously uploaded a screenshot of the Site Header settings panel
  When Sam runs "/guide siteHeader" and the source has changed
  And Sam approves the proposed amend
  Then the description is updated
  And the screenshot is unchanged
```

```scenario
Scenario: An editor added their own prose to the description
  Given a How-To Guide Page exists for the Image Carousel Row block
  And the editor appended a "Common pitfalls" paragraph to the description
  When Sam runs "/guide imageCarouselRow" and the source has changed
  Then the agent is asked to amend the description while preserving editor-added prose
  And the proposed diff still contains the "Common pitfalls" paragraph
```

### Rule: /guide --audit lists features without guides and flags orphaned guides

```scenario
Scenario: Sam runs /guide --audit on a site with two undocumented blocks
  Given a How-To Guide Page exists for the Alert Banner block
  And no How-To Guide Page exists for the Code Snippet Row or Image Row blocks
  When Sam runs "/guide --audit"
  Then the report lists "codeSnippetRow" and "imageRow" as missing guides
  And the report does not list "alertBanner"
```

```scenario
Scenario: Sam runs /guide --audit after a block has been removed from the site
  Given a How-To Guide Page exists for an old "legacyBanner" block
  And the legacyBanner partial has been deleted from the site code
  When Sam runs "/guide --audit"
  Then the report flags the legacyBanner guide as orphaned
```

### Rule: AI generation routes through the Umbraco backoffice AI Agent so editors own brand voice

```scenario
Scenario: A content lead changes the brand-voice context attached to the How-To Guide Writer agent
  Given the How-To Guide Writer agent in Settings → AI references the "Site Content Guidelines" context
  When the content lead edits that context to require a more formal tone
  And Sam runs "/guide videoRow" against a previously undocumented block
  Then the generated description reflects the more formal tone
  And no code change was required to alter the tone
```

### Rule: Generated content stays editable; editors can take over any guide page

```scenario
Scenario: An editor rewrites a generated guide entirely
  Given a How-To Guide Page exists for the Code Snippet Row block with an AI-generated description
  When the editor opens the page in the backoffice
  And replaces the description with their own prose
  And saves and publishes the page
  Then the new description is what visitors see at the guide URL
  And the page still works exactly like any other content page in the CMS
```

### Rule: The existing Style Guide and Components page are linked to, not moved

```scenario
Scenario: An editor visits the Guides landing page
  Given the Guides parent page is published at /guides/
  And the existing Style Guide remains at /styleguide/
  And the existing Components page remains at /styleguide/components
  When the editor opens /guides/
  Then the page contains a link to the Style Guide
  And the page contains a link to the Components page
  And neither /styleguide/ nor /styleguide/components has changed URL
```

## Open Questions

- **Source signature inputs**: exactly which files / fields contribute to the source-signature hash for a block (partial source, element type properties, agent prompt, associated CSS)? Must be deterministic across machines so the "no change" branch fires reliably.
- **Storage of the source signature**: hidden property on a "Generation Metadata" tab of the doc type, HTML comment in the description body, or a side-channel JSON file in the repo? The user-facing behavior is the same; the resilience tradeoffs are not.
- **Amend prompt template**: what literal system / user prompt does the slash command send to the agent in the amend branch, so that editor-added prose is preserved? Should this template live in the slash command file or in a content asset the agent reads from?
- **Confirmation UX in the amend branch**: terminal diff + y/n prompt is the default; should there also be a `--auto-apply` flag for trusted automated runs, and a backoffice "draft proposal" alternative for editors who want to compare in-context?
- **Naming convention**: should generated pages be named "How to use Alert Banner", "Alert Banner Guide", or "Using Alert Banner"? Pick one and bake into the command. URL slug must be stable across regenerations even if the title changes.
- **Guides landing-page composition**: does the Guides parent page reuse the same `sectionRows` Block List composition as Content pages so editors can build any landing they like, or is it a more constrained shape with an auto-generated child list?
- **Component Guide cross-link placement**: a paragraph link in the Guides body, or a dedicated child node ("Component Guide" → external link to `/styleguide/components`)?
- **Audit coverage scope**: just block partials under `Views/Partials/blocklist/Components/`, or also doc types on Home / Site Settings / global elements? Define the explicit source-of-truth list.
- **Backoffice agent setup**: which chat profile, which contexts (the existing "Site Content Guidelines" alone, or a new "How-To Guide Style" context layered on top), and what system prompt does the **How-To Guide Writer** agent use? Capture the exact setup steps for local + each Cloud environment given the Agent.Deploy caveat that agents stay DB-only.
- **Brand-voice change cascade**: when the brand-voice context is updated in the backoffice, should the next `/guide` run re-amend every existing guide, or only those whose feature source also changed?
- **Non-interactive runs**: if the slash command is invoked from a non-interactive shell (CI, scheduled agent), what is the safe default — refuse to amend, treat the run as audit-only, or require an explicit `--auto-apply`?

## Testing Guidelines

Create test files under `tests/e2e/` that exercise the feature through the Management API and the rendered website. Cover the following without going too heavy:

- A schema test that asserts the Guides parent doc type and the How-To Guide Page doc type exist with the expected aliases, properties, compositions, and default visibility values.
- A creation test that runs `/guide alertBanner` (or invokes the same logic via a helper) against a clean site and asserts a guide page is created, embeds the Alert Banner block, has a populated description, and is hidden from the main nav.
- A no-change test that runs the command twice in a row against a feature whose source has not changed and asserts the second run makes no AI call and reports "no changes".
- An amend test that simulates a source change (e.g. modifies the element type) and asserts the command proposes a diff and only writes when approved; declined runs leave the page untouched.
- A protect-editor-edits test that uploads a screenshot and appends prose to a description, then runs the command in the amend branch and asserts the screenshot is untouched and the editor's prose is preserved in the proposed diff.
- An audit test that asserts `/guide --audit` lists missing guides and flags orphaned ones.
- A nav-visibility test that asserts neither the Guides parent nor any guide page appears in the rendered top navigation, while `/guides/` itself returns 200 by direct URL.
- A URL-stability test that asserts `/styleguide/` and `/styleguide/components` are unchanged by this feature.
