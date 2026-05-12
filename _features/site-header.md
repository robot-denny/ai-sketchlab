# Feature: Site Header

The site header is the persistent navigation bar at the top of every page. It has a white background and stays visible as visitors scroll, using sticky positioning. Navigation links use dark text for strong contrast, and the header sits above the hero image in normal document flow rather than floating over it. On mobile, the collapsed menu expands as a dark overlay below the white header bar.

**Source spec**: (no dedicated spec — derived from design system)
**Last verified**: 2026-04-14 (all 20 E2E tests passing)

---

## Increments

- [x] 2026-04-14 — Sticky white-background header with dark nav text, hero in normal flow below header, mobile dark-overlay menu, removal of legacy scroll-triggered nav classes (no source spec — design-system driven)

---

## Behaviors

### Rule: The site header always has a white background

```scenario
Scenario: Header on desktop has white background
  Given a visitor views any page at 1200px viewport width
  When the page loads
  Then the header background color is "--surface-primary" (rgb(255, 252, 249))
  And the header has a bottom border in "--border-light"
```

```scenario
Scenario: Header on mobile has white background
  Given a visitor views any page at 390px viewport width
  When the page loads
  Then the header bar background color is "--surface-primary" (rgb(255, 252, 249))
```

### Rule: The header stays visible when scrolling (sticky)

```scenario
Scenario: Header uses sticky positioning
  Given a visitor views any page at 1200px viewport width
  When the page loads
  Then the header computed position is "sticky"
```

```scenario
Scenario: Header remains visible after scrolling down
  Given a visitor views a page with enough content to scroll at 1200px viewport width
  When the visitor scrolls down 500px
  Then the header remains visible at the top of the viewport
  And the header background color is still "--surface-primary"
  And there is no opacity transition or flash
```

### Rule: The hero image sits below the header in normal document flow

```scenario
Scenario: Masthead starts below the header with no overlap
  Given a visitor views a page with a hero image at 1200px viewport width
  When the page loads
  Then the masthead top edge is at or below the header bottom edge
```

```scenario
Scenario: Masthead CSS has no nav-height padding compensation
  Given the styles.css file
  Then the "header.masthead" padding-top rule does not include "+ 57px" compensation
```

### Rule: Nav link contrast is adequate on white background

```scenario
Scenario: Nav links use dark text on white background
  Given a visitor views any page at 1200px viewport width
  When the page loads
  Then navigation links have color "--text-primary" (rgb(28, 25, 23))
```

```scenario
Scenario: Nav link hover uses accent color
  Given a visitor views any page at 1200px viewport width
  When hovering over a navigation link
  Then the link color changes to "--accent-secondary" (rgb(139, 107, 74))
```

### Rule: No scroll-triggered JavaScript manipulates the navbar

```scenario
Scenario: Scripts do not contain navbar class toggling
  Given the scripts.js file
  Then it does not contain "is-fixed" class manipulation
  And it does not contain "is-visible" class manipulation
```

```scenario
Scenario: CSS does not contain scroll-triggered navbar rules
  Given the styles.css file
  Then it does not contain "#mainNav.is-fixed" rules
  And it does not contain "#mainNav.is-visible" rules
```

### Rule: Mobile collapsed menu retains dark overlay

```scenario
Scenario: Expanded mobile menu has dark background
  Given a visitor views any page at 390px viewport width
  When the visitor taps the menu toggle
  Then the expanded navigation area has a dark background ("--surface-dark")
  And navigation links in the menu use light text ("--text-on-dark")
```

---

## Edge Cases

### Rule: Header works on pages without a hero image

```scenario
Scenario: Page with no masthead
  Given a visitor views a page that has no hero/masthead section
  When the page loads
  Then the header still renders with white background and sticky positioning
```

### Rule: Header works on very short pages

```scenario
Scenario: Short page with no scrollable content
  Given a visitor views a page with minimal content that does not cause scrolling
  When the page loads
  Then the header is visible with white background
  And no JavaScript errors occur
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Header on desktop has white background | `tests/e2e/header/siteHeader.spec.ts:L89` (CSS), `L171` (browser) | Covered |
| Header on mobile has white background | `tests/e2e/header/siteHeader.spec.ts:L270` | Covered |
| Header uses sticky positioning | `tests/e2e/header/siteHeader.spec.ts:L81` (CSS), `L204` (browser) | Covered |
| Header remains visible after scrolling down | `tests/e2e/header/siteHeader.spec.ts:L229` | Covered |
| Masthead starts below the header with no overlap | `tests/e2e/header/siteHeader.spec.ts:L214` | Covered |
| Masthead CSS has no nav-height padding compensation | `tests/e2e/header/siteHeader.spec.ts:L109` | Covered |
| Nav links use dark text on white background | `tests/e2e/header/siteHeader.spec.ts:L102` (CSS), `L193` (browser) | Covered |
| Nav link hover uses accent color | — | Not covered (hover state difficult to assert in E2E) |
| Scripts do not contain navbar class toggling | `tests/e2e/header/siteHeader.spec.ts:L129`, `L133` | Covered |
| CSS does not contain scroll-triggered navbar rules | `tests/e2e/header/siteHeader.spec.ts:L94`, `L98` | Covered |
| Expanded mobile menu has dark background | — | Not covered (requires toggling Bootstrap collapse in E2E) |
| No opacity transition on scroll | `tests/e2e/header/siteHeader.spec.ts:L250` | Covered |
| Header has bottom border | `tests/e2e/header/siteHeader.spec.ts:L182` | Covered |
| Mobile nav toggler visible | `tests/e2e/header/siteHeader.spec.ts:L281` | Covered |
| Mobile header position is sticky | `tests/e2e/header/siteHeader.spec.ts:L288` | Covered |

---

## Revision Notes

- 2026-04-14: Initial feature doc — all scenarios verified against implementation, 20 E2E tests passing
