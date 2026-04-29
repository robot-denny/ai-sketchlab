# Spec for Alert Banner Icons

branch: claude/feature/alert-banner-icons

## Summary

Enhance the existing alert banner block to display a contextual icon alongside the alert content. Each alert level (emergency, warning, informational) has a default icon, and CMS editors can override the icon at the block level. Icon and alert colors should be driven by theming rather than hardcoded values.

## Functional Requirements

- Each alert level displays a default icon to the left of the alert content:
  - **Emergency**: circle with exclamation mark (e.g. Bootstrap Icon `bi-exclamation-circle-fill`)
  - **Warning**: triangle with exclamation mark (e.g. Bootstrap Icon `bi-exclamation-triangle-fill`)
  - **Informational**: circle with "i" (e.g. Bootstrap Icon `bi-info-circle-fill`)
- The icon appears inline beside the alert text, vertically centered
- Alert colors (background, border, text, icon) are informed by theming — use CSS custom properties or Bootstrap's contextual alert classes so colors adapt to theme changes
- CMS editors can override the default icon by selecting a different icon at the block level via a new optional property on the Alert Banner element type
- When no override is set, the default icon for the alert level is used
- The icon override property should offer a curated list of icon options (not a free-text field)

## Possible Edge Cases

- Editor selects an icon override but leaves it empty or clears it — should fall back to the default for the alert level
- Alert content is very long — icon should stay aligned at the top or vertically centered, not stretch
- Icon rendering on older browsers or when icon font fails to load — ensure graceful degradation (alert content remains readable)
- Existing alert banner blocks in content should continue to work without modification (backward compatible — no icon override means default icon)

## Acceptance Criteria

- Emergency alerts render a circle-exclamation icon by default
- Warning alerts render a triangle-exclamation icon by default
- Informational alerts render an info-circle icon by default
- Icon colors match the alert theme (not hardcoded hex values)
- A CMS editor can select an icon override from a dropdown on the alert banner block
- When no override is selected, the default icon for the level is displayed
- Existing alert banner content renders correctly without needing re-saves
- The icon is visually aligned with the alert text

## Open Questions

- Which icon library to use — Bootstrap Icons (already available via CDN?), or inline SVGs for zero external dependencies? - Bootstrap icons via CDN for now--if there is already an icon set installed and being used in Umbraco backoffice, that library should be considered. 
- Should the curated icon list for overrides be limited to the three default icons, or include a broader set? The curated icon list that CMS editors select from to overide the default should contain a wide selection of Bootstrap Icons of common icons to select from.
- Should the icon size scale with text size or be a fixed size? icon can size/scale responsively with the text.

## Testing Guidelines

Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- Verify the element type has the new icon override property (dropdown type, optional)
- Create an alert banner block for each level and verify the correct default icon CSS class is rendered in the HTML
- Create an alert banner with an icon override and verify the overridden icon class appears instead of the default
- Verify that an alert banner with no icon override still renders the level-appropriate default icon
