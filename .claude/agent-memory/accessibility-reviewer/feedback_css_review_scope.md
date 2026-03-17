---
name: CSS accessibility review scope and contrast math
description: Patterns for reviewing CSS diffs — what to check, how to compute contrast, common Bootstrap 5 pitfalls
type: feedback
---

## Contrast computation approach

Use relative luminance formula per WCAG 2.1:
- Linearize each channel: if C/255 <= 0.04045 → C/255/12.92, else ((C/255 + 0.055)/1.055)^2.4
- L = 0.2126*R + 0.7152*G + 0.0722*B
- Contrast = (L_lighter + 0.05) / (L_darker + 0.05)

AA normal text threshold: 4.5:1
AA large text (18pt / 14pt bold): 3:1
AAA normal text: 7:1

## Common findings in CSS-only diffs

1. **Missing focus rule alongside hover rule** — whenever a `:hover` color rule is added globally, check for a matching `:focus-visible` rule. Bootstrap 5 resets can suppress browser default outlines.

2. **`color: inherit; text-decoration: none`** on `footer a` or similar contexts — this strips both color and underline distinction, violating 1.4.1 Use of Color (Level A). This is a Level A failure, not just advisory.

3. **Near-threshold link colors** — purple/violet hues on white often land in the 4.5–5:1 band. Always compute precisely; values like #8859b6 are 4.59:1 (passes AA, fails AAA). Slightly darker variants (#59338a) clear 7:1.

4. **Nav/dropdown overrides of `text-decoration: none`** — acceptable for navigation components, but must confirm Bootstrap's native focus styles are intact. Flag as Minor if not confirmed.

## Bootstrap 5 context notes

- Bootstrap 5 ships focus styles for `.dropdown-item`, `.btn`, `.navbar-brand` via `box-shadow` — verify they haven't been globally suppressed before escalating Finding 4 to Critical.
- `.btn-link:disabled` inherits the 1.4.3 disabled component exemption.
- `font-weight: 700` on links does NOT trigger the "large text" AA threshold unless the rendered size is ≥18.67px.
