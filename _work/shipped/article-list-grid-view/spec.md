# Spec for Article List Grid View

branch: claude/feature/article-list-grid-view
figma_component (if used): N/A

## Summary

The Article List page currently renders articles in a vertical stack of post-preview rows, each showing the title (linked), subtitle, and metadata. This feature adds a CMS-controlled display mode option: editors can choose between the existing **List** view and a new **Grid** view via a dropdown property on the Article List document type. In Grid view, articles are displayed as equal-height cards arranged in a responsive multi-column layout, with each card also showing a thumbnail image, meta description, and assigned categories.

## Functional Requirements

- Add a "Display Mode" dropdown property to the Article List document type with two options: `List` (default) and `Grid`
- The existing stacked list rendering remains unchanged and is the default when no selection is made
- In Grid view, articles are rendered as cards in a responsive grid layout
- Grid columns adjust based on viewport width (e.g. 1 column on mobile, 2 on tablet, 3+ on desktop)
- All cards in a row stretch to equal heights so rows appear visually even
- Each card in Grid view displays:
  - A thumbnail/smaller version of the article's `mainImage`
  - The article title (linked to the article)
  - The article subtitle
  - The article metadata (author, date, or equivalent)
  - The article meta description
  - The categories assigned to the article
- Cards without a `mainImage` should still render gracefully (no broken layout)
- Articles without categories assigned should still render without errors

## Possible Edge Cases

- Article has no `mainImage` — card must render without an image slot breaking the layout
- Article has no categories — card renders without a categories section
- Article has an unusually long title or meta description — card height should expand but sibling cards in the same row should match
- Zero articles returned — empty state should be handled (same as current list view behaviour)
- Single article in the list — should render as a single card without stretching awkwardly across the full grid

## Acceptance Criteria

- The Article List document type has a "Display Mode" dropdown with `List` and `Grid` options
- Selecting `List` (or leaving blank) renders the existing vertical stack view unchanged
- Selecting `Grid` renders articles as cards in a responsive multi-column grid
- Cards in the same row share equal heights at all viewport widths
- Grid view cards show: thumbnail image, title (linked), subtitle, metadata, meta description, and categories
- The layout is responsive: columns collapse appropriately on smaller screens
- No visual regressions to the existing List view
- Missing `mainImage` or missing categories do not cause errors or broken layouts

## Open Questions

- Should the grid support a configurable number of columns per row, or is a fixed responsive breakpoint sufficient? -fixed for now
- Should the thumbnail image have a fixed aspect ratio (e.g. 16:9) or be free-form? fixed aspect ratio
- Should categories be displayed as badges/tags or plain text links? tags
- Is there a maximum number of articles to display per page in Grid view, or does it follow the same pagination as List view? show up to 12; ideally we later make this configurable in the CMS

## Testing Guidelines

Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:

- The Article List page renders in List view by default (no regression)
- When Display Mode is set to `Grid`, the article list renders cards in a grid layout
- Cards in Grid view contain the article title, subtitle, meta description, and categories
- A card without a `mainImage` renders without errors
- An article with no categories assigned renders the card without a categories section
- The grid layout is responsive (cards stack on small viewports)
