# Feature: Alert Banner Icons

Alert banners display a contextual icon alongside their content so that visitors can immediately recognize the severity of the message. Each alert level -- emergency, warning, and informational -- shows a distinct default icon. CMS editors can override the default icon by choosing from a curated dropdown, giving them control over visual communication without needing to edit templates.

**Source spec**: `_specs/shipped/alert-banner-icons.md`
**Last verified**: 2026-04-09

---

## Increments

- [x] 2026-04-09 — default icons per severity + curated icon override dropdown (spec: `_specs/shipped/alert-banner-icons.md`)

---

## Behaviors

### Rule: Each alert level displays a recognizable default icon

```scenario
Scenario: Emergency alert displays an exclamation-circle icon
  Given an alert banner with level "Emergency"
  And no icon override is selected
  When a visitor views the page
  Then the alert displays a circle-exclamation icon inside a danger-styled banner
```

```scenario
Scenario: Warning alert displays a triangle-exclamation icon
  Given an alert banner with level "Warning"
  And no icon override is selected
  When a visitor views the page
  Then the alert displays a triangle-exclamation icon inside a warning-styled banner
```

```scenario
Scenario: Informational alert displays an info-circle icon
  Given an alert banner with level "Informational"
  And no icon override is selected
  When a visitor views the page
  Then the alert displays a circle-info icon inside an info-styled banner
```

### Rule: Alert styling matches the severity level

```scenario
Scenario: Emergency alerts use danger styling
  Given an alert banner with level "Emergency"
  When a visitor views the page
  Then the banner uses the danger color theme
  And the icon color inherits from the alert theme
```

```scenario
Scenario: Warning alerts use warning styling
  Given an alert banner with level "Warning"
  When a visitor views the page
  Then the banner uses the warning color theme
  And the icon color inherits from the alert theme
```

```scenario
Scenario: Informational alerts use info styling
  Given an alert banner with level "Informational"
  When a visitor views the page
  Then the banner uses the info color theme
  And the icon color inherits from the alert theme
```

### Rule: CMS editors can override the default icon

```scenario
Scenario: Editor overrides the icon on an informational alert
  Given a CMS editor creates an alert banner with level "Informational"
  And selects "heart" as the icon override
  When a visitor views the page
  Then the alert displays a heart icon instead of the default circle-info icon
  And the banner still uses the info color theme
```

```scenario
Scenario: Icon override replaces the default entirely
  Given an alert banner with level "Informational" and icon override "heart"
  When a visitor views the page
  Then only the heart icon is displayed
  And the default circle-info icon does not appear
```

### Rule: The icon override property is optional

```scenario
Scenario: Icon override dropdown is available but not required
  Given a CMS editor is configuring an alert banner block
  Then the icon override field is visible
  And it is not mandatory
  And it offers a curated list of icon choices
```

### Rule: Icons display inline with alert content

```scenario
Scenario: Icon appears to the left of the alert text
  Given an alert banner with level "Warning" and content "System maintenance tonight"
  When a visitor views the page
  Then the icon appears to the left of the text "System maintenance tonight"
  And the icon is vertically centered with the text
```

```scenario
Scenario: Icon does not collapse when alert content is long
  Given an alert banner with very long content text
  When a visitor views the page
  Then the icon maintains its size and does not shrink
  And the content text wraps beside the icon
```

### Rule: Icons render as scalable vector graphics in the browser

```scenario
Scenario: Icons appear as SVG elements in the rendered page
  Given an alert banner with level "Emergency"
  When a visitor views the page
  Then the icon displays as an SVG graphic (not a text character or image file)
  And the icon scales proportionally with the surrounding text size
```

---

## Edge Cases

### Rule: Missing or empty icon override falls back to the default

```scenario
Scenario: No icon override is set on an existing alert banner
  Given an alert banner created before the icon feature existed
  And it has no icon override value
  When a visitor views the page
  Then the default icon for the alert level is displayed
```

```scenario
Scenario: Editor clears a previously set icon override
  Given an alert banner that previously had an icon override
  And the CMS editor clears the icon override field
  When a visitor views the page
  Then the default icon for the alert level is displayed
```

### Rule: Unrecognized alert levels fall back gracefully

```scenario
Scenario: Alert with an unrecognized level uses informational defaults
  Given an alert banner with an unrecognized alert level value
  When a visitor views the page
  Then the alert displays the circle-info icon
  And the banner uses the info color theme
```

### Rule: Alert content is still readable without icon rendering

```scenario
Scenario: Alert content remains accessible if icons fail to load
  Given an alert banner with level "Warning" and content "Service disruption"
  And the icon library is unavailable
  When a visitor views the page
  Then the text "Service disruption" is still visible and readable
  And the icon is marked as decorative (hidden from screen readers)
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Emergency alert displays an exclamation-circle icon | `tests/e2e/blocks/alertBanner.spec.ts:L357` | Covered |
| Warning alert displays a triangle-exclamation icon | `tests/e2e/blocks/alertBanner.spec.ts:L366` | Covered |
| Informational alert displays an info-circle icon | `tests/e2e/blocks/alertBanner.spec.ts:L375` | Covered |
| Editor overrides the icon on an informational alert | `tests/e2e/blocks/alertBanner.spec.ts:L385` | Covered |
| Icon override replaces the default entirely | `tests/e2e/blocks/alertBanner.spec.ts:L385` | Covered |
| Icon override dropdown is available but not required | `tests/e2e/blocks/alertBanner.spec.ts:L87` | Covered |
| Element type has iconOverride property | `tests/e2e/blocks/alertBanner.spec.ts:L74` | Covered |
| Partial view contains icon logic and flexbox layout | `tests/e2e/blocks/alertBanner.spec.ts:L115` | Covered |
| Unrecognized alert levels fall back gracefully | -- | Not covered |
| Alert content remains accessible if icons fail to load | -- | Not covered |
| Icon does not collapse when long content | -- | Not covered |

---

## Revision Notes

- 2026-04-09: Initial feature doc from spec + implementation
