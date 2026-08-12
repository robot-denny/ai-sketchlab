# Spec for accessibility-fixes

> This spec captures initial requirements and design rationale. For **current system behavior**, see `_features/accessibility-fixes.md`.

branch: claude/feature/accessibility-fixes
figma_component (if used): n/a

## Summary

A recent automated accessibility audit (run against Live, `ai-sketchlab.dev`) surfaced 25 distinct WCAG 2 failure types across ~300 active instances. This feature remediates them **iteratively**: a first batch knocks out the highest-severity, most-pervasive, lowest-risk issues (mostly global CSS plus a few template tweaks), after which the team can return to feature development and pull later batches off the roadmap as capacity allows.

The work is organized so each batch ships independently through the normal `master → Dev → Live` pipeline. The first batch deliberately targets the five areas the audit and the requester both called out — footer link spacing, link-color contrast on backgrounds, more-than-colour state signals, blockquote/callout structure, and ARIA on card image-links — while also sweeping the two highest-count "Very High" items (text contrast, focus visibility) because they share the same CSS surface.

Each batch is its own spec increment. Only **Batch 1** is committed for immediate implementation here; Batches 2+ are inventoried below and land on `ROADMAP.md` as their own future increments.

## Prioritisation model

Issues are ranked by **severity × pervasiveness**, then weighted toward **leverage** (one global CSS/token edit that clears many instances) and **low regression risk**. The audit's own severity ladder (Very High → High → Moderate → Warning → Low) and active-instance counts drive the ordering.

### Full audited inventory (source of truth for batching)

| Audit failure | Severity | Instances | WCAG | User-named? | Primary surface |
|---|---|---|---|---|---|
| `style_focus_visible` | Very High | 27 | 2.4.7 | (focus) | Global CSS — nav/footer links override base `:focus-visible` |
| `text_contrast_sufficient` | Very High | 16 | 1.4.3 | ✅ contrast | Tokens + footer/link colours on backgrounds |
| `input_label_visible` | Very High | 11 | 2.5.3 | | Umbraco Forms / `/member-registration`, `/styleguide` |
| `aria_hidden_nontabbable` | Very High | 6 | 1.3.1 | ✅ card image-links | `v2/_ArticleCard.cshtml` (`aria-hidden` on a focusable `<a>`) |
| `a_text_purpose` | Very High | 1 | 2.4.4 | ✅ (link names) | Home — link with no accessible name |
| `text_block_heading` | High | 7 | 1.3.1 | | Text styled as heading without a heading element/role |
| `target_spacing_sufficient` | High | 6 | 2.5.8 | ✅ footer link spacing | Footer / inline link groups |
| `element_tabbable_unobscured` | High | 6 | 2.4.11 | | Focused element covered by other content |
| `style_color_misuse` | High | 2 | 1.4.1 | ✅ more-than-colour | Required-field marker / link-state by colour alone |
| `form_submit_button_exists` | High | 1 | 3.2.2 | | `/member-registration` |
| `text_sensory_misuse` | Moderate | 26 | 1.3.3 | | Instructions relying on shape/size/location words |
| `text_quoted_correctly` | Moderate | 20 | 1.3.1 | ✅ blockquote/callout | Inline quotes not using `<q>`/`<blockquote>` |
| `blockquote_cite_exists` | Moderate | 3 | 1.3.1 | ✅ blockquote/callout | `<blockquote>` missing `cite`/attribution |
| `style_viewport_resizable` | Low | 14 | 1.4.4 | | Text not scaling to 200% |
| `aria_content_in_landmark` | Warning | 69 | 2.4.1 | | Content outside any landmark region |
| `img_alt_background` | Warning | 4 | 1.1.1 | | Informative CSS background images lack text alt |
| `input_fields_grouped` | Warning | 4 | 1.3.1 | | Related inputs not in `<fieldset>` |
| `element_attribute_deprecated` | Warning | 2 | (3.x) | | Obsolete/deprecated HTML attributes |
| `style_highcontrast_visible` | Warning | 2 | 1.1.1 | | Windows high-contrast mode loses meaning |
| `aria_contentinfo_misuse` | Warning | 1 | 2.4.1 | | `contentinfo`/footer landmark misuse |
| `script_onclick_avoid` | Warning | 1 | 2.1.1 | | Script emulating a link instead of `<a>` |
| `aria_complementary_label_visible` | Warning | 1 | 2.4.1 | | `complementary`/`<aside>` without visible label |
| `figure_label_exists` | Warning | 1 | 1.1.1 | | `<figure>` without associated label — `/styleguide` |
| `a_target_warning` | Warning | 1 | 3.2.2 | | New-window link with no advance warning |
| `aria_role_redundant` | Warning | 1 | (4.x) | | Explicit ARIA role duplicating implicit role |

### Proposed batches

**Batch 1 — "first batch" (committed in this spec).** Global-CSS-led, high-severity, low-risk, and covers every area the requester named:

1. **Link-colour contrast on backgrounds** (`text_contrast_sufficient`, Very High) — footer links currently render in a muted secondary-text colour on the cream surface, and base link colour sits on coloured surfaces (alert banners, page head) without a contrast-safe treatment. Resolve via design tokens / scoped CSS so AA (4.5:1 normal text, 3:1 large) is met.
2. **Visible focus indicator everywhere** (`style_focus_visible`, Very High) — the base `:focus-visible` outline exists but nav and footer links remove `text-decoration` and don't re-assert a visible focus ring; ensure all interactive elements show a clear focus indicator that survives the colour overrides.
3. **Footer link target spacing** (`target_spacing_sufficient`, High) — increase hit-target spacing between adjacent footer links so they meet the 24px spacing target.
4. **More-than-colour state signals** (`style_color_misuse`, High) — links must carry a non-colour affordance (underline) wherever colour alone currently distinguishes them; required form fields and link states must not rely on colour alone.
5. **Card image-link ARIA** (`aria_hidden_nontabbable`, Very High) — the article-card thumbnail link wraps a focusable `<a>` inside `aria-hidden="true"`, hiding a tabbable element from assistive tech while leaving it in the tab order. Resolve the card link pattern so there is exactly one accessible, focusable link per card with an accessible name.
6. **Footer landmark hygiene** (`aria_contentinfo_misuse`, Warning; supports `aria_content_in_landmark`) — give the footer a single correct `contentinfo` landmark and mark footer link groups up as navigable lists.

**Batch 2 — forms & semantics (roadmap).** Umbraco Forms theme + member-registration: visible labels (`input_label_visible`), `<fieldset>` grouping (`input_fields_grouped`), submit button presence (`form_submit_button_exists`), required-field indicators if not fully closed in Batch 1; plus heading semantics (`text_block_heading`) and the single missing accessible link name (`a_text_purpose`).

**Batch 3 — content & landmark sweep (roadmap).** `aria_content_in_landmark` (69), `text_quoted_correctly` (20, blockquote/`<q>`), `blockquote_cite_exists` (3), `element_tabbable_unobscured` (6).

**Batch 4 — long tail (roadmap).** `text_sensory_misuse` (26), `style_viewport_resizable` (14), `img_alt_background` (4), `element_attribute_deprecated` (2), `style_highcontrast_visible` (2), `script_onclick_avoid` (1), `aria_complementary_label_visible` (1), `figure_label_exists` (1), `a_target_warning` (1, already acknowledged in `featureCard.cshtml`), `aria_role_redundant` (1, `colorPaletteBlock.cshtml`).

## Functional Requirements

**Scope of this spec is Batch 1 only.** Batches 2–4 are documented above for roadmap placement and are out of scope for the implementation plan derived from this spec.

- **FR1 — Link contrast on all backgrounds.** Every text link meets WCAG AA contrast (≥ 4.5:1 for normal text, ≥ 3:1 for large text) against its actual rendered background, including footer links on the cream surface and links over coloured surfaces (alert banners, page head, any tinted callout).
- **FR2 — Visible focus indicator.** Every interactive element (links — including nav and footer links that suppress underline — buttons, form controls) shows a clearly visible keyboard focus indicator when focused, with contrast against its background. The indicator must not be removed by the styling that strips link underlines.
- **FR3 — Footer link spacing.** Adjacent interactive targets in the footer have sufficient spacing (target ≥ 24px) so they are not flagged by `target_spacing_sufficient`, without visually breaking the footer layout at desktop or mobile breakpoints.
- **FR4 — Non-colour state signals.** Links are distinguishable from surrounding text by more than colour (e.g. underline) in body/content and footer contexts; any required-field indicator and link state uses a non-colour cue in addition to colour.
- **FR5 — Accessible, single-focus card links.** Article cards expose exactly one focusable link to the article with a meaningful accessible name; no focusable element sits inside an `aria-hidden="true"` subtree. The visible thumbnail remains clickable behaviour-wise without duplicating the link in the accessibility tree.
- **FR6 — Footer landmark & list semantics.** The footer is a single `contentinfo` landmark; grouped footer links are marked up as lists so they are reported as navigable groups and counted within a landmark.
- **FR7 — No visual or behavioural regression.** All changes preserve the existing visual design within the project's Playwright visual-regression tolerance (`maxDiffPixelRatio: 0.01`), or baselines are intentionally regenerated and reviewed where the change is a deliberate visual improvement (e.g. footer link underlines/spacing).
- **FR8 — Roadmap handoff.** Batches 2–4 are added to `ROADMAP.md` (under Next/Later as appropriate) as named future increments pointing back at this spec's inventory.

## Possible Edge Cases

- Footer links currently inherit a muted secondary-text colour and no underline; adding underline + contrast-safe colour must not make the footer look like body copy or fight the wordmark/social-icon rows.
- Links over alert-banner backgrounds (`alert-info`/`-warning`/`-danger`) need a treatment that works across all three tints, not just the default surface.
- The article-card pattern has a real link on the `<h3>` title and an `aria-hidden` link on the thumbnail; collapsing to one accessible link must keep the whole card clickable if that's the current UX, and keep the title link's accessible name.
- Focus-ring colour must itself meet contrast against both light surfaces and any coloured surface it can appear on.
- Visual-regression baselines are Linux-only and ARIA/contrast are **not** currently baseline-tested — deliberate visual changes (underlines, spacing) will require regenerating baselines via the `update-snapshots` workflow, and new semantic assertions need new axe-core/role specs rather than screenshots.
- The dead `Views/Components/Contact/Default.cshtml` view component is **not** the live form surface — form findings belong to Umbraco Forms / `/member-registration` and are deferred to Batch 2 (see ROADMAP `cleanup-contact-dead-code`).

## Acceptance Criteria

- **AC1.** Footer links and links on coloured surfaces pass automated contrast checks at WCAG AA. (FR1)
- **AC2.** Every link, button, and form control shows a visible focus indicator when reached by keyboard, including footer/nav links. (FR2)
- **AC3.** Adjacent footer links meet the 24px target-spacing requirement at desktop and mobile widths. (FR3)
- **AC4.** Body/content and footer links are visually distinguishable from text without relying on colour (underline present). (FR4)
- **AC5.** Each article card has exactly one keyboard-focusable link with a non-empty accessible name, and no focusable element is inside an `aria-hidden` subtree. (FR5)
- **AC6.** The footer is a single `contentinfo` landmark and its link groups are marked up as lists. (FR6)
- **AC7.** An automated accessibility scan (axe-core) of the home page and a blog/article page reports zero violations for the rule families addressed in Batch 1 (contrast, focus-visible, aria-hidden-focus, link-name, landmark-contentinfo). (FR1–FR6)
- **AC8.** Existing Playwright visual specs pass, or any baseline changes are regenerated through the documented workflow and reviewed in the diff. (FR7)
- **AC9.** `ROADMAP.md` contains entries for Batches 2–4 referencing this spec. (FR8)

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation. See `_features/accessibility-fixes.md` for the verified version.

### Rule: Links meet AA contrast against their actual background

```scenario
Scenario: Footer link contrast on the cream surface
  Given a visitor is on the home page footer
  When an automated contrast check measures a footer link against the footer background
  Then the contrast ratio is at least 4.5:1
```

```scenario
Scenario: Link contrast on a coloured alert banner
  Given a page renders an alert banner with a tinted background
  When a link inside the banner is measured against the banner background
  Then the contrast ratio meets WCAG AA for its text size
```

### Rule: Every interactive element shows a visible focus indicator

```scenario
Scenario: Keyboard focus is visible on a footer link
  Given a keyboard-only visitor is on any page
  When they Tab to a footer link
  Then a clearly visible focus indicator is shown around that link
```

```scenario
Scenario: Focus indicator survives underline-suppressed nav links
  Given the site navigation links have their underline removed by design
  When a keyboard visitor Tabs to a navigation link
  Then a visible focus indicator still appears
```

### Rule: Adjacent footer links have sufficient target spacing

```scenario
Scenario: Footer links meet 24px spacing on desktop
  Given a visitor views the footer at a desktop width
  When the spacing between two adjacent footer links is measured
  Then it satisfies the 24px target-spacing requirement
```

### Rule: Links are distinguishable by more than colour

```scenario
Scenario: A content link is underlined
  Given a visitor reads an article body containing an inline link
  When they view the link
  Then the link is underlined in addition to using the link colour
```

### Rule: Each card has exactly one accessible, focusable link

```scenario
Scenario: Article card exposes one named link to a screen reader
  Given a screen-reader user navigates the latest-articles grid
  When they move through the links in a single article card
  Then they encounter exactly one link to the article with a meaningful name
  And no focusable element is hidden inside an aria-hidden region
```

### Rule: The footer is a single contentinfo landmark with list semantics

```scenario
Scenario: Footer is reported as a contentinfo landmark
  Given a screen-reader user lists the landmarks on a page
  When they review the footer region
  Then it is reported once as contentinfo
  And its link groups are reported as lists
```

### Rule: No visual or semantic regression is introduced

```scenario
Scenario: Visual baselines are honoured or intentionally regenerated
  Given the Batch 1 CSS and template changes are applied
  When the Playwright visual-regression suite runs on Linux
  Then it passes, or any changed baselines have been regenerated through the documented workflow and reviewed
```

## Open Questions

- Should the article-card thumbnail remain a clickable target (collapsing to a single `<a>` wrapping both image and title) or should only the title link be the accessible link, with the image purely decorative? (Affects FR5 implementation and whole-card click UX.) --yes it should still link. There are accessible code patterns for this, here is just one example: https://inclusive-components.design/cards/
- For links on coloured surfaces, do we introduce a dedicated "on-surface" link token, or restyle the affected components (alert banner, page head) individually? --Open to the plan. We can either make sure all color token values work across the background combos, or I am totally ok if we have a range of colors for each token color. For example, a slightly darker and ligher variation of a color, applied based on it's contrast to meet accessible color combo requirements. Visually, this is usually not noticable to the user. 
- What focus-indicator style is preferred site-wide — keep the current 2px outline + offset, or adopt a higher-contrast/box-shadow ring that reads on every surface? The current style is acceptable. 
- Should footer links adopt persistent underlines, or underline-on-hover/focus only? (Persistent underline most clearly satisfies FR4 but is a visible design change requiring baseline regeneration.) --I don't mind if the footer links have default underlines. 
- Is automated axe-core scanning acceptable as the primary verification for Batch 1, given the project currently has no semantic/a11y specs? (CLAUDE.md notes ARIA/contrast are not baseline-tested today.) --automated AXE testing is accessible. 
- Confirm Batch boundaries: is the requester happy with Batch 1 as scoped (the five named areas + the two highest-count Very High items), or should any Batch 2 item (e.g. heading semantics) be pulled forward? --yes

## Testing Guidelines

Create test file(s) in `./tests/e2e` for the new behaviour, without going too heavy:

- **axe-core scan spec** — add a Playwright spec that runs an axe-core scan against the home page and one article/blog page, asserting zero violations for the Batch 1 rule families: `color-contrast`, `focus`/`:focus-visible`, `aria-hidden-focus`, `link-name`/`link-in-text-block`, and `landmark-contentinfo`. (This is the first semantic/a11y spec in the suite — note that pattern in the test header.)
- **Footer focus + spacing spec** — assert a footer link receives a visible focus indicator on keyboard focus, and that adjacent footer links meet the target-spacing requirement at a desktop and a mobile viewport.
- **Card link semantics spec** — assert each article card in the latest-articles grid exposes exactly one focusable link with a non-empty accessible name and no focusable element inside an `aria-hidden` subtree.
- **Visual regression** — re-run existing block/page visual specs; where a deliberate visual change (underlines, footer spacing) shifts a baseline, regenerate via the `update-snapshots.yml` workflow and review the diff rather than masking the failure.

Follow the E2E resilience rules in CLAUDE.md (no hardcoded UUIDs/slugs, dynamic lookups, regex for CSS assertions, prefer browser assertions over `.cshtml` file-content checks).
