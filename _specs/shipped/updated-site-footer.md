# Spec for Updated Site Footer

branch: claude/feature/updated-site-footer
figma_component: Footer (node-id=1-6 widescreen, node-id=1-51 narrow)

## Summary
Replace the existing footer partial with a redesigned layout featuring the Diagram logo image, a rich text description block, and a footer navigation menu. All content is managed in the Umbraco CMS. Desktop shows the logo+text on the left and the menu on the right in a single row. On narrow screens the menu stacks above the logo and text block.

## Functional Requirements
- The footer displays a Diagram logo (image uploaded via Umbraco media library), controlled via a Media Picker property on the site root (Home) document type or a dedicated Footer Settings composition/document type.
- Below the logo, a rich text field renders body text (e.g. a short site description). The content is editable in the Umbraco backoffice via an existing or new rich text property on the relevant document type.
- A footer navigation menu is rendered from a Multi-URL Picker or a dedicated footer navigation node/link list property. Each item has a label and a URL (internal or external).
- The footer has a thick solid black top border matching the Figma design (`border-top: 6px solid #000`).
- The background is white.
- Adequate vertical padding is applied so the content has breathing room (approximately 36–40px top and bottom).
- All text and links use existing site fonts: **Oxanium** (navigation labels) and **Source Sans 3** (body text), which are already loaded in `master.cshtml`.
- Menu link labels are uppercase, 14px, black, using the Oxanium font.
- Each menu link has an underline decoration rendered as a thin horizontal rule below the label text (matching the Figma decorative underline style).
- Body text is 14px, color approximately `#565656` (closest match: Bootstrap `text-muted` / `--bs-gray-600: #6c757d`; adjust if a closer match is found in `styles.css`).
- The footer partial is rendered via `Html.CachedPartialAsync` in `master.cshtml` (already in place — do not add a second call).

## Figma Design Reference
- File: Footer (https://www.figma.com/design/xgVzxLFEqY5eTLqN7Kf51l/Footer)
- Component name: Widescreen (node 1:6), Narrow (node 1:51)
- Key visual constraints:
  - **Desktop layout**: Logo (153×21px) top-left with body text below it (327px wide); footer menu horizontally aligned to the far right, items spaced 32px apart
  - **Narrow/mobile layout**: Footer menu centered and wrapping at top; logo centered below menu; body text centered below logo — stacking order is menu → logo → body text
  - Top border: 6px solid black
  - Padding: ~36–40px vertical, ~24px horizontal on narrow
  - Nav items use a decorative thin underline (SVG line in Figma — implement as CSS `border-bottom` or `::after` rule)
  - Logo image: use Bootstrap's `img-fluid` to keep it responsive; max height ~21px

## Possible Edge Cases
- Footer menu may have zero items — the menu block should not render if the link list is empty.
- Logo property may be unset — fall back gracefully (no broken image tag).
- Rich text body may be empty — omit the element rather than rendering an empty `<p>`.
- Footer is wrapped in `CachedPartialAsync` with a 60-minute cache — changes in the backoffice won't reflect immediately in local dev without a cache invalidation or timeout.
- On very narrow viewports (< 400px) the menu items should wrap naturally rather than overflow.

## Acceptance Criteria
- [ ] Footer displays logo image sourced from Umbraco, editable in backoffice.
- [ ] Footer displays a rich text body block sourced from Umbraco, editable in backoffice.
- [ ] Footer navigation items are sourced from Umbraco (e.g. Multi-URL Picker or dedicated links property), editable in backoffice.
- [ ] On desktop (≥ 768px): logo and body text are on the left; menu is on the right, aligned to the top of the section.
- [ ] On narrow screens (< 768px): menu appears above logo, which appears above body text — all centered.
- [ ] Nav labels are uppercase Oxanium, 14px, black, with a visible underline decoration below each label.
- [ ] Body text uses Source Sans 3, ~14px, with a muted grey color close to `#565656`.
- [ ] Top border is 6px solid black.
- [ ] Background is white.
- [ ] No broken layout when logo, body text, or menu items are missing/empty.
- [ ] Footer partial continues to be rendered via the existing `CachedPartialAsync` call in `master.cshtml`.

## Open Questions
- Should the footer logo and rich text be added as new properties to the existing **Home** document type, or via a new **Footer Settings** composition reused across document types?--added as new properties to existing Home doc type.
- Should the footer navigation use an existing **Multi-URL Picker** property, or should a dedicated footer navigation document be created (e.g. a "Footer Nav" node under Settings)? --multi-url picker
- Is `#565656` close enough to Bootstrap's `--bs-gray-600` (`#6c757d`) or should a custom CSS variable be added? --close enough
- Should the decorative underline on nav items also act as a hover indicator (e.g. animate or change color on hover)? color change on hover to color `#009171`. This will be a new color I will be introducing to the palette. 

## Testing Guidelines
Create a test file at `tests/e2e/footer/updatedFooter.spec.ts` covering the following cases without being overly exhaustive:
- Logo image is visible in the footer on desktop and mobile viewports.
- Body text content is rendered in the footer.
- Footer navigation items are present and each has a working link.
- On a desktop viewport (≥ 768px), the menu is positioned to the right of the logo+text block (assert the menu element has a higher `x` offset than the logo).
- On a narrow viewport (e.g. 390px wide), the menu appears before (above) the logo in DOM/visual order.
- Top border style is `6px solid rgb(0, 0, 0)` (or equivalent).
- When logo property is empty, no broken `<img>` tag is rendered.
