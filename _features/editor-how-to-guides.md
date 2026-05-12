# Feature: Editor How-To Guides

A new **Guides** section under Home gives CMS editors a single place to learn how each feature on the site works — block components, site settings, and global elements. Each guide is one page combining a live example of the feature (when it is a block), an editable AI-written description, and an optional editor-uploaded screenshot for features that cannot be embedded as a block. Generation runs through the Umbraco backoffice AI Agent so brand voice stays editable in the CMS, and a `/guide` slash command keeps guides in sync with the site without ever silently overwriting editor work.

**Source spec**: `_specs/editor-how-to-guides.md`
**Last verified**: 2026-05-04

---

## Increments

- [x] 2026-05-04 — `/guide` command, Guides section, How-To Guide Page doc type, audit mode, `--auto-apply` (spec: `_specs/editor-how-to-guides.md`)
- [ ] Structure the generated description output (sections, headings, screenshot placement) — no spec yet
- [ ] Add new fields / options to the How-To Guide Page type to support richer guides — no spec yet

---

## Behaviors

Scenarios are grouped by Rule — the business rule or acceptance criterion that the scenarios prove. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

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
Scenario: An editor opens a How-To Guide Page for a block in the backoffice
  Given a How-To Guide Page exists for the Alert Banner block
  When the editor opens it for editing
  Then they see a live-example slot that contains an Alert Banner block
  And they see an editable rich-text description
  And they see an optional screenshot field
  And they see a generation-metadata field labelled "Auto-managed by /guide command — do not edit manually"
```

```scenario
Scenario: A new How-To Guide Page defaults to hidden from the main top navigation
  Given the editor creates a new How-To Guide Page through the backoffice
  When they save it for the first time without changing the visibility toggle
  Then "hide from top navigation" is already set to true
```

### Rule: The first run of /guide for a block creates and populates the guide page from scratch

```scenario
Scenario: Sam runs /guide alertBanner for the first time
  Given no How-To Guide Page exists for the Alert Banner block
  When Sam runs "/guide alertBanner"
  Then a new How-To Guide Page is created under /guides/
  And the page name reads "How to use the Alert Banner"
  And the page URL is /guides/how-to-use-the-alert-banner/
  And the live-example slot contains one Alert Banner block
  And the description is HTML produced by the Umbraco backoffice AI Agent
  And the generation-metadata records the current source signature, ISO timestamp, and feature alias
  And the page is published with "hide from top navigation" set to true
  And the command prints "created /guides/how-to-use-the-alert-banner/"
```

### Rule: When the underlying source has not changed, /guide skips the feature silently

```scenario
Scenario: Sam re-runs /guide alertBanner the next morning with no source changes
  Given a How-To Guide Page exists for the Alert Banner block
  And the recorded source signature matches the current source
  When Sam runs "/guide alertBanner"
  Then no AI call is made
  And the description and generation-metadata are unchanged
  And the command prints "no changes — alertBanner guide is up to date"
  And the command exits with status 0
```

### Rule: When the underlying source has changed, /guide proposes an amend and waits for approval

```scenario
Scenario: A developer adds a new "dismissible" property to the Alert Banner element type
  Given a How-To Guide Page exists for the Alert Banner block
  And the recorded source signature does not match the current source
  When Sam runs "/guide alertBanner" in an interactive terminal
  Then the agent is called in amend mode with the existing description and the new source payload
  And the command prints a unified diff of the proposed description change to the terminal
  And the command waits for "y" or "N" before writing
  When Sam types "y"
  Then the description is updated with the amended HTML
  And the generation-metadata is updated with the new source signature and a fresh timestamp
  And the page is re-published
  And the command prints "amended /guides/ guide for \"alertBanner\""
```

```scenario
Scenario: Sam declines a proposed amend
  Given /guide alertBanner has detected a source change and printed a diff
  When Sam types anything other than "y" (for example, "n" or just Enter)
  Then the description is not modified
  And the generation-metadata is not modified
  And the command prints "no changes written"
  And the command exits with status 0
```

```scenario
Scenario: --auto-apply skips the prompt and writes the amend
  Given a How-To Guide Page exists for the Alert Banner block
  And the recorded source signature does not match the current source
  When Sam runs "/guide alertBanner --auto-apply"
  Then the agent is called in amend mode
  And the command writes the amend without prompting
  And the generation-metadata reflects the new source signature
```

### Rule: /guide never silently overwrites editor work

```scenario
Scenario: An editor uploaded a screenshot before a /guide re-run
  Given a How-To Guide Page exists for the Site Header global feature
  And the editor previously uploaded a screenshot of the Site Header settings panel
  When Sam runs "/guide siteHeader" and the source has changed, and approves the amend
  Then the description is updated
  And the screenshot field is unchanged
```

```scenario
Scenario: The live-example slot is editor territory after creation
  Given a How-To Guide Page exists for the Image Carousel Row block
  And the editor has rearranged or modified the live-example slot since the page was created
  When Sam runs "/guide imageCarouselRow" and the source has changed, and approves the amend
  Then the description is updated
  And the live-example slot (sectionRows) is unchanged — the command writes only description and generation-metadata
```

```scenario
Scenario: An editor added their own prose to the description
  Given a How-To Guide Page exists for the Image Carousel Row block
  And the editor appended a "Common pitfalls" paragraph to the description
  When Sam runs "/guide imageCarouselRow" and the source has changed
  Then the agent is asked to amend the description while preserving editor-added prose
  And the proposed diff aims to keep the "Common pitfalls" paragraph intact
```

### Rule: /guide --audit reports gaps as Missing Blocks, Missing Globals, and Orphans

```scenario
Scenario: Sam runs /guide --audit on a site with several undocumented blocks
  Given a How-To Guide Page exists for the Alert Banner block
  And no How-To Guide Page exists for the Code Snippet Row, Image Row, or other block components
  When Sam runs "/guide --audit"
  Then the report contains a section headed "Missing guides — Blocks (N):" listing each undocumented block by alias and display name
  And the report contains a section headed "Missing guides — Global (M):" listing curated global features (siteHeader, siteFooter, siteSettings, search, articleList) that lack guides
  And the report does not list "alertBanner" under either Missing section
  And the command exits with status 1 because gaps exist
```

```scenario
Scenario: Sam runs /guide --audit with everything in sync
  Given every block partial and curated global feature has a How-To Guide Page
  And no guide page references a feature alias that no longer exists
  When Sam runs "/guide --audit"
  Then the report shows "Missing guides — Blocks (0):"
  And the report shows "Missing guides — Global (0):"
  And the report shows "Orphaned guides (0):"
  And the command exits with status 0
```

```scenario
Scenario: Sam runs /guide --audit after a block has been removed from the site
  Given a How-To Guide Page exists with generation-metadata.lastFeatureAlias = "legacyBanner"
  And no partial named legacyBanner exists in the codebase, and no curated feature uses that alias
  When Sam runs "/guide --audit"
  Then the report contains "Orphaned guides (1):"
  And the orphan section lists "legacyBanner" with the page name in quotes
  And the command exits with status 1
```

### Rule: AI generation routes through the Umbraco backoffice AI Agent so editors own brand voice

```scenario
Scenario: A content lead changes the brand-voice context attached to the How-To Guide Writer agent
  Given the How-To Guide Writer agent in Settings → AI references the "Site Content Guidelines" and "How-To Guide Style" contexts
  When the content lead edits the "Site Content Guidelines" context to require a more formal tone
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
  And any subsequent /guide run with no source change leaves the description alone
```

### Rule: The existing Style Guide and Components page URLs are unchanged

```scenario
Scenario: This feature does not move or rename the Style Guide
  Given the existing Style Guide is published at /styleguide/
  And the existing Components page is published at /styleguide/components
  When the Guides section is added under Home
  Then /styleguide/ continues to load with a 200 response
  And /styleguide/components continues to load with a 200 response
  And neither URL has changed
```

---

## Edge Cases

### Rule: The agent or backoffice may be unavailable when the command runs

```scenario
Scenario: The How-To Guide Writer agent has not been created in the local environment
  Given no agent named "How-To Guide Writer" exists in Settings → AI
  When Sam runs "/guide alertBanner"
  Then the agent invocation fails with an error from the Management API
  And no guide page is created
```

```scenario
Scenario: The agent SSE stream drops mid-generation
  Given the How-To Guide Writer agent has been called for /guide alertBanner
  When the SSE connection drops before TEXT_MESSAGE_END is received
  Then the command exits with an error and no partial description is written
  And no source signature is recorded
```

### Rule: Ambiguous or invalid feature aliases

```scenario
Scenario: Sam runs /guide with an alias that has no matching block partial
  Given no file named "fooBar.cshtml" exists under Views/Partials/blocklist/Components/
  And "fooBar" is not in the curated global-feature registry
  When Sam runs "/guide fooBar"
  Then the command exits with an error mentioning the missing partial
  And no guide page is created or modified
```

### Rule: Non-interactive shells cannot answer approval prompts

```scenario
Scenario: /guide is invoked from a non-interactive shell with a source change pending
  Given a How-To Guide Page exists for the Alert Banner block
  And the recorded source signature does not match the current source
  And the shell is non-interactive (no TTY)
  When "/guide alertBanner" runs without --auto-apply
  Then the command refuses to apply the amend
  And it prints "amend pending — re-run interactively or pass --auto-apply"
  And it exits with a non-zero status
  And the description and generation-metadata are unchanged
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Visitor does not see Guides in top nav | `tests/e2e/guides.spec.ts:284` | Covered |
| /guides/ returns 200 by direct URL | `tests/e2e/guides.spec.ts:277` | Covered |
| Editor opens a How-To Guide Page (description / screenshot / generation-metadata properties exist) | `tests/e2e/guides.spec.ts:193` | Covered |
| New How-To Guide Page defaults to hidden from top nav (default-true data type + composition wiring) | `tests/e2e/guides.spec.ts:90`, `tests/e2e/guides.spec.ts:107` | Covered |
| Guides parent doc type has the expected shape (compositions, allowedChildren, no own properties) | `tests/e2e/guides.spec.ts:147` | Covered |
| Home allows Guides as a child | `tests/e2e/guides.spec.ts:259` | Covered |
| First run of /guide creates a published page with description, signature, and `hideFromTopNavigation = true` | `tests/e2e/guides-cli.spec.ts:119` | Covered |
| Re-run with no source change is a silent no-op with the exact "no changes" message | `tests/e2e/guides-cli.spec.ts:297` | Covered |
| Source change + --auto-apply rewrites description and refreshes generation-metadata | `tests/e2e/guides-cli.spec.ts:324` | Covered |
| Decline ("n" + Enter) leaves the guide page untouched and prints "no changes written" | `tests/e2e/guides-cli.spec.ts:360` | Covered |
| Non-interactive shell refuses to amend without --auto-apply | `tests/e2e/guides-cli.spec.ts:399` | Covered |
| /guide --audit lists missing block features under "Missing guides — Blocks" | `tests/e2e/guides-cli.spec.ts:461` | Covered |
| /guide --audit lists missing global features under "Missing guides — Global" | `tests/e2e/guides-cli.spec.ts:481` | Covered |
| /guide --audit flags orphaned guides whose lastFeatureAlias is unknown | `tests/e2e/guides-cli.spec.ts:499` | Covered |
| Editor screenshot is preserved across /guide re-runs | — | Not covered (implementation-guaranteed: CLI writes only `description` + `generationMetadata`) |
| Live-example slot is preserved across /guide re-runs | — | Not covered (same guarantee as screenshot) |
| Editor prose additions are preserved when the agent amends | — | Not covered (depends on agent behavior; amend prompt instructs preservation) |
| Brand-voice context change flows into next generation | — | Not covered (manual verification only) |
| Generated content remains editable in the backoffice | — | Not covered (Umbraco-native behavior — no regression risk) |
| /styleguide and /styleguide/components URLs are unchanged | — | Not covered (this feature does not touch them) |
| Missing agent emits an error and writes nothing | — | Not covered (relies on Umbraco AI runtime errors) |
| SSE stream drop aborts cleanly | — | Not covered (covered by `agentClient.ts` unit tests in `scripts/guide-generator/test/agentClient.test.ts`) |
| Unknown alias exits with a partial-not-found error | — | Not covered (thrown by `computeSourceSignature`) |

---

## Revision Notes

- 2026-05-01: Draft scenarios from initial spec
- 2026-05-04: Verified against implementation. Removed Draft banner. Replaced single-section audit output with the three-bucket reality (`Missing guides — Blocks`, `Missing guides — Global`, `Orphaned guides`), each with explicit `(N)` count headers and an exit-code-1-when-gaps-exist convention. Tightened all CLI message strings to the verified literals (`created /guides/how-to-use-the-alert-banner/`, `no changes — alertBanner guide is up to date`, `no changes written`, `amend pending — re-run interactively or pass --auto-apply`, `amended /guides/ guide for "alertBanner"`). Added the `--auto-apply` scenario, the live-example-slot preservation rule (the CLI never touches `sectionRows` after creation), and the everything-in-sync audit scenario. Replaced the "Guides landing links to Style Guide and Components" rule (not enforced by the Razor view — landing content is editor-driven via `sectionRows`) with the narrower URL-stability rule. Reframed the unknown-alias edge case to match the real `Partial not found for feature "..."` error from `computeSourceSignature`. Filled in the test coverage table with `tests/e2e/guides.spec.ts` and `tests/e2e/guides-cli.spec.ts` paths and line numbers.
