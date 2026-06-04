# Feature: Accessibility Fixes

Visitors — including keyboard-only and screen-reader users — can perceive and operate the site's links, footer, and article cards without barriers. Following a WCAG audit, the site's accessibility gaps are remediated in independent batches; Batch 1 fixed the most severe and widespread issues (link contrast, visible focus, footer link spacing, non-colour link cues, single accessible card links, footer landmark/list semantics), and later batches are tracked on the roadmap.

**Source spec**: `_specs/accessibility-fixes.md`
**Last verified**: 2026-06-04

---

## Increments

The per-feature mini-roadmap: shipped increments + planned increments + parking-lot ideas. Newest planned items first. When an item ships, flip the checkbox and point it at the shipped spec.

- [x] 2026-06-04 — Batch 1: link contrast, focus visibility (consistent accent-red ring), footer link spacing + underline, non-colour link cues, single accessible card links, footer landmark/list semantics (spec: `_specs/accessibility-fixes.md`, plan: `_plans/accessibility-fixes.md`)
- [ ] Batch 2 — forms & semantics: visible form labels, `<fieldset>` grouping, submit button, heading semantics, missing link name (ROADMAP: `a11y-batch-2-forms-semantics`)
- [ ] Batch 3 — content & landmark sweep: content-in-landmark, `<q>`/`<blockquote>` quoting, blockquote attribution, focus-obscured elements (ROADMAP: `a11y-batch-3-content-landmark-sweep`)
- [ ] Batch 4 — long tail: sensory instructions, 200% text scaling, background-image alt, deprecated attributes, high-contrast mode, script-as-link, complementary label, figure label, new-window warning, redundant ARIA role (ROADMAP: `a11y-batch-4-long-tail`)

---

## Behaviors

Scenarios are grouped by Rule — the acceptance criterion the scenarios prove. Concrete values (Specification by Example) and the accessibility domain's own vocabulary (WCAG terms are the ubiquitous language here). See `.claude/skills/BDD.md`.

### Rule: Text links meet AA contrast against their actual background

```scenario
Scenario: Accent link on a tinted content callout meets AA
  Given a visitor reads an article whose "post notes" callout sits on the cream secondary surface
  When an automated check measures the accent link colour against that surface
  Then the contrast ratio is at least 4.5:1 for normal text
```

```scenario
Scenario: The same accent colour clears AA on every light surface
  Given the site uses one accent colour for all body links
  When that colour is measured against the page, secondary, and tertiary light surfaces
  Then it meets at least 4.5:1 on each
```

### Rule: Every interactive element shows a visible focus indicator

```scenario
Scenario: Keyboard focus is visible on a footer link
  Given a keyboard-only visitor is on the home page
  When they Tab to a footer link
  Then a clearly visible focus ring is shown around that link
  And no focus ring was present before it received focus
```

```scenario
Scenario: Focus indicator survives underline-suppressed navigation links
  Given the site navigation links have their underline removed by design
  When a keyboard visitor Tabs to a navigation link
  Then a visible focus ring still appears
```

```scenario
Scenario: Focus rings use one consistent accent-red colour on light surfaces
  Given a keyboard visitor moves focus across body links, navigation, and footer links on light surfaces
  When each element receives focus
  Then every focus ring is the same accent-red colour
  And links on dark or accent-coloured surfaces instead use a light ring that stays visible there
```

### Rule: Adjacent footer links have sufficient target spacing

```scenario
Scenario: Footer links meet the 24px spacing target at desktop and mobile
  Given a visitor views the footer at a desktop width and at a mobile width
  When the interactive box of each stacked footer link is measured
  Then each is at least 24px tall so adjacent targets are not crowded
```

### Rule: Links are distinguishable by more than colour

```scenario
Scenario: A body content link is underlined
  Given a visitor reads page content containing an inline link
  When they view the link
  Then it is underlined in addition to using the link colour
```

```scenario
Scenario: Footer links are persistently underlined
  Given a visitor is on the home page footer
  When they view a footer navigation or social link
  Then it is underlined, not distinguished by colour alone
```

### Rule: Each article card exposes exactly one accessible, focusable link

```scenario
Scenario: Article card exposes one named link to a screen reader
  Given a screen-reader user navigates the article grid
  When they move through the links in a single article card
  Then they encounter exactly one link to the article, with a meaningful name
  And no focusable element is hidden inside an aria-hidden region
```

```scenario
Scenario: The whole card stays clickable with one link
  Given a visitor sees an article card with a thumbnail and a title
  When they click anywhere on the card, including the thumbnail
  Then they are taken to the article
```

### Rule: The footer is a single contentinfo landmark with labelled list groups

```scenario
Scenario: Footer link groups are labelled navigation lists
  Given a screen-reader user reviews the footer region
  When they list its landmarks and groups
  Then the footer is reported once as contentinfo
  And each link group is a navigation landmark named by its heading, marked up as a list
```

---

## Edge Cases

### Rule: Deliberate visual changes are reconciled with the screenshot baselines

```scenario
Scenario: Visual baselines are regenerated for the intended changes
  Given the Batch 1 link-colour, footer underline/spacing, and card changes shift rendered pixels
  When the Playwright visual-regression suite runs on Linux against the deployed environment
  Then it passes, or the changed baselines have been regenerated through the documented workflow and reviewed
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Accent link on a tinted content callout meets AA | `tests/e2e/linkStyles.spec.ts:19` | Covered (asserts the AA-chosen accent colour) |
| The same accent colour clears AA on every light surface | `tests/e2e/linkStyles.spec.ts:19` | Covered (colour value); ratios verified by hand |
| Keyboard focus is visible on a footer link | `tests/e2e/accessibility/footerLinks.spec.ts:63`, `tests/e2e/accessibility/axe.spec.ts:487` | Covered |
| Focus indicator survives underline-suppressed navigation links | `tests/e2e/accessibility/axe.spec.ts:472` | Covered |
| Focus rings use one consistent accent-red colour on light surfaces | — | Manual (ring presence tested; colour verified via CSS) |
| Footer links meet the 24px spacing target at desktop and mobile | `tests/e2e/accessibility/footerLinks.spec.ts:145` | Covered |
| A body content link is underlined | `tests/e2e/linkStyles.spec.ts:19` | Covered |
| Footer links are persistently underlined | `tests/e2e/accessibility/footerLinks.spec.ts:63`, `tests/e2e/linkStyles.spec.ts:90` | Covered |
| Article card exposes one named link to a screen reader | `tests/e2e/accessibility/cardLinks.spec.ts:95`, `tests/e2e/accessibility/axe.spec.ts:172` | Covered |
| The whole card stays clickable with one link | `tests/e2e/accessibility/cardLinks.spec.ts:95` | Covered (one-link assertion; click behaviour verified manually) |
| Footer link groups are labelled navigation lists | `tests/e2e/accessibility/footerLinks.spec.ts:117`, `tests/e2e/accessibility/axe.spec.ts:172` | Covered |
| Visual baselines are regenerated for the intended changes | — | Not covered (Batch 1 Step 5 — pending post-merge) |

---

## Revision Notes

- 2026-06-02: Draft scenarios from initial spec.
- 2026-06-04: Verified against shipped Batch 1 (commits `760263e`, `a7e4e62`); removed Draft banner. Conflicts resolved toward implementation reality: (1) the draft "link contrast on a coloured alert banner" scenario was dropped — the alert-link contrast was reviewed and **passes** AA (axe false positive); the real, fixed failure was the accent link on the cream `--surface-secondary` surface (was 4.31:1), so the contrast scenarios now describe that. (2) Added a scenario for the consistent accent-red focus ring (a design decision made during review; light surfaces share one red ring, dark/accent surfaces keep a light ring). (3) Added a whole-card-clickable scenario reflecting the inclusive-components card pattern. (4) The footer was already the sole `contentinfo`; the shipped change added labelled `<nav>` + list semantics, so that rule now emphasises the list/landmark grouping.
```
