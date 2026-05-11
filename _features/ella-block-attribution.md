# Feature: Ella Block Attribution

When the human site author and the AI persona Ella co-write a single article, readers need to know whose words they're reading at a glance — not just from the masthead byline. The site now renders any prose block attributed to an AI author inside a calm callout treatment ("Written by Ella · inline note") when the rest of the article is human-led. An all-AI article suppresses the per-block treatment entirely — the masthead byline carries the attribution.

**Source spec**: `_specs/ella-block-attribution.md`
**Last verified**: 2026-05-11

---

## Behaviors

### Rule: The AI persona flag is a single property on the Author document type

```scenario
Scenario: Marking an Author as an AI persona via the isAi toggle
  Given an Author content node named "Ella"
  And the editor enables the "Is AI" toggle on the Author's Persona tab
  When the Author is saved and published
  Then any block in any article that picks Ella as its Author becomes eligible for the inline-note treatment
  And no per-block setting needs to be flipped on the article's blocks
```

### Rule: Block-level AI treatment activates only when the article is not entirely by AI authors

```scenario
Scenario: Human-led article with an Ella-attributed rich-text block
  Given an article whose primary author is a human contributor named "EBA Hugh"
  And a rich-text block in that article whose Author is "EBA Ella" (isAi = true)
  When a reader views the article
  Then the rich-text block is wrapped in a container with attribute data-attributed-to="eba-ella"
  And a CSS-generated eyebrow above the block reads "Written by EBA Ella · inline note"
  And the block renders with the warm-stone background and subtle left border of the inline-note treatment
  And the trailing "— EBA Ella" block-author byline is hidden inside the wrapper

Scenario: All-AI article does not render per-block treatment
  Given an article whose only primary author is "EBA Ella" (isAi = true)
  And every block in that article either has no Author set or picks Ella
  When a reader views the article
  Then no block renders inside the .ella-wrap container
  And no "inline note" eyebrow appears anywhere
  And the article masthead byline reads "By EBA Ella"
```

### Rule: Wrapper application is uniform across block types and layout-neutral

```scenario
Scenario: Ella-attributed image block in a human-led article also renders the inline-note treatment
  Given a human-led article that contains an image block whose Author is "EBA Ella" (isAi = true)
  When a reader views the article
  Then the image block is wrapped in the .ella-wrap container with data-attributed-to="eba-ella"
  And a CSS-generated eyebrow above the image reads "Written by EBA Ella · inline note"
  And any trailing block-author byline inside that wrapper is hidden

Scenario: Existing per-component layout is not disturbed for non-AI content
  Given an existing article that has no AI-attributed blocks
  When a reader views the article
  Then no .ella-wrap container is emitted around any block
  And the rendered DOM structure of each block is unchanged from before the feature shipped
  And the existing trailing .block-author byline still renders on richTextRow / imageRow / latestArticlesRow blocks that have an Author picked
```

### Rule: Human↔human attribution differences keep the existing quiet byline

```scenario
Scenario: A block by a guest human contributor in a human-led article
  Given an article whose primary author is "EBA Hugh" (isAi = false)
  And a rich-text block in that article whose Author is also "EBA Hugh" (or any human author, isAi = false)
  When a reader views the article
  Then the block is not wrapped in the .ella-wrap container
  And the existing trailing "— EBA Hugh" block-author byline appears
```

---

## Edge Cases

### Rule: Narrow-viewport eyebrow collapses to a shorter form

```scenario
Scenario: Eyebrow text shortens at narrow widths
  Given a human-led article with an Ella-attributed block visible at desktop width
  And the eyebrow above that block reads "Written by EBA Ella · inline note"
  When the viewport narrows below 760 pixels
  Then the eyebrow collapses to "EBA Ella · inline note"
  And the block remains visible with the inline-note treatment
```

### Rule: Non-article hosts simply do not activate the wrapper

```scenario
Scenario: A block list on a non-article page (e.g. a section home) does not activate the wrapper
  Given a page whose document type does not expose an "author" property
  And a block on that page whose Author is the AI persona Ella
  When a reader views the page
  Then the block renders without the .ella-wrap container
  And the existing trailing "— Ella" byline appears as today
  And no error is raised
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Author doc type carries the `isAi` flag via the AI Persona Properties composition | [tests/e2e/blocks/ellaBlockAttribution.spec.ts:316-323](tests/e2e/blocks/ellaBlockAttribution.spec.ts#L316-L323) | Covered |
| `isAi` is an optional Toggle property | [tests/e2e/blocks/ellaBlockAttribution.spec.ts:325-335](tests/e2e/blocks/ellaBlockAttribution.spec.ts#L325-L335) | Covered |
| The Author doc type composes AI Persona Properties | [tests/e2e/blocks/ellaBlockAttribution.spec.ts:337-344](tests/e2e/blocks/ellaBlockAttribution.spec.ts#L337-L344) | Covered |
| Human-led article + Ella rich-text block ⇒ wrapper + eyebrow + suppressed byline | [tests/e2e/blocks/ellaBlockAttribution.spec.ts:460-486](tests/e2e/blocks/ellaBlockAttribution.spec.ts#L460-L486) | Covered |
| Human-led article + Ella image block ⇒ wrapper applies uniformly to non-rich-text blocks | [tests/e2e/blocks/ellaBlockAttribution.spec.ts:490-509](tests/e2e/blocks/ellaBlockAttribution.spec.ts#L490-L509) | Covered |
| Human-led article + Hugh block ⇒ no wrapper, trailing byline visible | [tests/e2e/blocks/ellaBlockAttribution.spec.ts:512-524](tests/e2e/blocks/ellaBlockAttribution.spec.ts#L512-L524) | Covered |
| All-Ella article ⇒ no wrapper anywhere; masthead byline reads "By Ella" | [tests/e2e/blocks/ellaBlockAttribution.spec.ts:527-534](tests/e2e/blocks/ellaBlockAttribution.spec.ts#L527-L534) | Covered |
| Regression: a pre-existing demo article renders no `.ella-wrap` | [tests/e2e/blocks/ellaBlockAttribution.spec.ts:537-558](tests/e2e/blocks/ellaBlockAttribution.spec.ts#L537-L558) | Covered |
| Narrow-viewport eyebrow collapse | — | Not covered (verified manually; CSS media query at `(max-width: 760px)` in [article-page.css](src/UmbracoProject/wwwroot/assets/css/article-page.css)) |
| Non-article host (no `author` property) does not activate the wrapper | — | Not covered as E2E; design is host-aware because `Umbraco.AssignedContentItem.Value<…>("author")` returns null on hosts without the property, short-circuiting the wrap decision in [Views/Partials/blocklist/default.cshtml](src/UmbracoProject/Views/Partials/blocklist/default.cshtml) |

---

## Revision Notes

- 2026-05-11: Initial feature doc from spec + implementation. Composition `AI Persona Properties` (id `043faa69-e11f-4604-bdfe-d0e76334e24d`) added to the Author doc type with a single `isAi` boolean. Wrapper added in `Views/Partials/blocklist/default.cshtml`; styling in `wwwroot/assets/css/article-page.css`.
- 2026-05-11: Verified against the implementation and test suite. Promoted the "Ella-attributed image block" example into a first-class scenario under the uniform-application rule (a dedicated test exists for it). Corrected all test-file line ranges to match the current spec file.
