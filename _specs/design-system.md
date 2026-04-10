# Design System: The Human Signal

A living reference for the visual identity of the site. This document captures how imagery, typography, color, layout, interaction, and motion work together toward a cohesive UI. It supersedes all inherited Umbraco Starter Site / Clean Blog defaults unless explicitly preserved.

---

## Core Tension

The site's visual identity is built on a single productive friction: **machine field vs. human voice**.

The imagery layer is **Dark Constructivism** — angular, geometric, dense with overlapping near-black planes and monumental letterforms used as architecture. It is mechanical, precise, and operates in a compressed dark value range.

The content layer is **The Human Signal** — warm, readable, calligraphic where it can afford to be, structured where it needs to be. It is the text that someone actually reads, the voice that emerges from the dark field.

These two layers do not compete. The imagery creates environments; the typography inhabits them. The tension between the two — cold geometry beneath warm language — is what gives the site its character. Every design decision should reinforce this relationship rather than blur it.

---

## Imagery: Dark Constructivism

Source document: `skills/output/canvas-design/radical-android-2026-04-09-philosophy.md`

### Principles

- The canvas is a machine: overlapping planes, angular force lines, monumental glyphs
- Depth through value calibration, not gradient or shadow — the difference between `#1a1a1e` and `#252530` carries compositional weight
- Letterforms at monumental scale (400pt+) function as geometry, not language
- Dense blocks of small monospaced text function as texture, like poured concrete
- Asymmetric composition balanced through visual weight, not centering
- Diagonal force lines prevent the dark palette from becoming static

### Color in imagery

- Palette begins at near-black and never exceeds a controlled mid-tone
- Dark tones: charcoal, anthracite, graphite, obsidian navy
- **Signal red**: a single saturated accent inherited from the revolutionary poster tradition — appears sparingly as a wedge, line, or geometric accent
- "In darkness, a two-percent shift in luminance changes everything"

### Role in the UI

Hero banners, featured images, and decorative backgrounds use generated Dark Constructivism imagery. The content layer (text, navigation, interactive elements) sits on top. The imagery should remain subordinate to foreground content but reward direct attention with its own internal logic.

---

## Typography: The Human Signal

Implementation: `wwwroot/assets/css/typography.css`

### Typeface roles

| Typeface | Role | Voice |
|----------|------|-------|
| **Cormorant Garamond** | Display headings (h1, h2), article titles, blockquotes, pull quotes, section headings | The editorial voice — calligraphic, high stroke contrast, humanist proportions. The readable word floating above the architectural form. |
| **Source Sans 3** | Body text, UI chrome (nav, buttons, form labels), structural headings (h3-h6), subtitles, metadata | The workhorse — warm humanist sans, excellent screen rendering, wide weight range. Handles all functional typography without competing with the display serif. |
| **IBM Plex Mono** | Code blocks, inline code, AI content markers, technical metadata | The bridge — a monospace that echoes the constructivist "granular text blocks" while remaining readable. The one place where the imagery's aesthetic leaks into the text layer. |

### Heading hierarchy

The transition from **serif** (h1-h2) to **sans** (h3-h6) is deliberate. The top two heading levels carry the editorial *voice*. h3 and below become *structural* — uppercase, tracked, organized. This mirrors the constructivist principle of hierarchy through material change rather than scale alone.

### Text color temperature

All text colors are warm-toned (stone/brown undertone) rather than cool Bootstrap grays. This warmth in the text layer contrasts with the cool near-blacks of the constructivist imagery.

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#1C1917` | Body text on light backgrounds |
| `--text-secondary` | `#57534E` | Metadata, captions, secondary content |
| `--text-tertiary` | `#78716C` | Block attribution, tertiary labels |
| `--text-on-dark` | `#F0EDE8` | Text on dark/image backgrounds (warm off-white) |
| `--text-on-dark-secondary` | `#A8A29E` | Secondary text on dark backgrounds |

Pure white (`#fff`) is avoided on dark backgrounds — it reads as harsh and digital. The warm off-white `#F0EDE8` softens against cool near-blacks.

### Context switching

Text on dark imagery (hero banners, accent sections) uses **Cormorant at weight 600** with a subtle text-shadow. On light backgrounds, the same headings use **weight 400** — thinner, more elegant. This context-aware weight switching will be CMS-controlled via an `.on-dark` class.

### AI vs. human authorship

Content authored by AI gets a subtle typographic temperature shift — cooler, more measured — rather than a heavy-handed visual break:

- **Human-authored** (default): Cormorant headings, Source Sans body, Cormorant italic blockquotes
- **AI-authored**: Source Sans headings at light weight, slightly wider letter-spacing, IBM Plex Mono blockquotes, thin left border rule, monospace label
- **AI-assisted** (human-edited): Standard human styling, smaller/lighter label, no border

The distinction should be perceptible on inspection but never distracting.

---

## Link Behavior

All links carry a non-color identifier per WCAG 1.4.1. The system uses refined underlines as the primary mechanism — thin (1px), slightly offset from the baseline, with `text-decoration-skip-ink` for clean descender handling.

| Context | Default state | Hover | Focus |
|---------|--------------|-------|-------|
| Inline text | 1px underline, full opacity | Thickens to 2px | 2px outline, no underline |
| Title/heading links | 1px underline at 40% opacity | Full opacity, 2px | Same as hover |
| Dark background links | 1px underline at 50% warm-white | Full opacity, 2px | Warm-white outline |
| Navigation, buttons, badges | No underline (context provides ID) | Varies by component | Outline |

The old approach of bolding all links (`font-weight: 700` on `a`) was removed — it disrupted the typographic weight hierarchy, particularly for Cormorant headings wrapped in links.

---

## Color Palette

The color system bridges the dark constructivist imagery and the warm typographic layer. It replaces the inherited Bootstrap/Clean Blog palette (`#005E70` teal primary, `#8859b6` purple links, `#6c757d` generic grays) with colors that emerge from the same design logic as the imagery and type.

### Design principles for color

1. **Colors from the material.** Every UI color should trace its lineage to either the dark constructivist palette (cool near-blacks, signal red) or the warm typographic layer (stone tones, warm off-whites). No orphan colors.
2. **Warmth in the foreground, coolness in the substrate.** Surfaces and backgrounds lean cool-neutral to dark. Text, interactive elements, and accent marks lean warm.
3. **Signal, not decoration.** Color draws attention to one thing at a time. If signal red appears, it means something — an action, a state change, a boundary. It never wallpapers.
4. **Accessible by construction.** Every foreground/background pair meets WCAG AA (4.5:1 for body text, 3:1 for large text and UI components). The palette is designed so that compliant pairings are the natural ones.

### Surface palette

Surfaces create the spatial layers of the page. They progress from warm-light (content reading surfaces) through neutral mid-tones (structural boundaries) to cool-dark (immersive sections, code blocks, the imagery substrate).

| Token | Value | Usage |
|-------|-------|-------|
| `--surface-primary` | `#FFFCF9` | Main content background — warm paper white, not sterile `#fff` |
| `--surface-secondary` | `#F5F0EB` | Cards, inset panels, sidebar backgrounds — one step down from primary |
| `--surface-tertiary` | `#EDE8E3` | Nested surfaces, table stripes, input fields — warm stone-cream |
| `--surface-dark` | `#1A1A1E` | Dark sections, code blocks, footer — the constructivist near-black |
| `--surface-dark-elevated` | `#252530` | Elevated elements on dark surfaces — cards on dark, hover states |
| `--surface-overlay` | `rgba(26, 26, 30, 0.6)` | Hero/masthead overlay — replaces the inherited `#212529` at 50% |

The current masthead overlay (`background-color: #212529; opacity: 0.5`) shifts to `--surface-overlay` — same darkness, but as a single composited layer rather than a separate pseudo-element with opacity. This avoids the washed-out effect the current approach creates on vibrant hero images.

### Accent palette

The accent system is built around two poles: **signal red** from the constructivist imagery and **warm earth** from the typographic layer. These are not interchangeable — each has a specific communicative role.

| Token | Value | Role |
|-------|-------|------|
| `--accent-primary` | `#C23D2E` | Primary action color — buttons, active states, primary CTAs. A tempered signal red: saturated enough to command attention on both light and dark surfaces, earthen enough to sit in the warm palette without screaming. Replaces inherited `#005E70` teal. |
| `--accent-primary-hover` | `#A83428` | Darkened primary for hover states |
| `--accent-primary-subtle` | `rgba(194, 61, 46, 0.08)` | Primary tint for backgrounds — alert banners, selected rows |
| `--accent-primary-light` | `#E8ADA7` | Light signal red — badges, tags, pill indicators on light backgrounds. Desaturated enough to read as a tint rather than a warning, but still traceable to the constructivist red. Text on this surface uses `--accent-primary-hover` for contrast. |
| `--accent-secondary` | `#8B6B4A` | Secondary accent — warm bronze/umber. For links, metadata emphasis, secondary buttons. Derived from the stone text tones pushed toward warmth. Replaces inherited `#8859b6` purple. |
| `--accent-secondary-hover` | `#6E5339` | Darkened secondary for hover states |
| `--accent-tertiary` | `#4A6B6E` | Tertiary accent — desaturated teal-slate. Retained from the old palette but cooled and muted. For informational badges, code annotations, less-prominent interactive elements. A bridge between the warm UI and the cool imagery. |

**Why signal red as the primary action color?** The constructivist poster tradition uses red as the single point of decisive energy in a field of dark geometry. Carrying that into the UI layer (buttons, CTAs) creates a direct visual thread from the hero imagery into the interactive surface. The red is tempered — not `#ff0000` fire-engine, but a brick/oxide tone that lives in the warm family.

**Why bronze for links?** The purple `#8859b6` has no connection to either the constructivist palette or the warm stone typography. A warm bronze connects to the stone text tones while remaining distinct enough from body text color to function as a link identifier (supported by underlines per WCAG 1.4.1).

### Semantic colors

Status colors serve functional communication. They should not fight the accent palette for attention.

| Token | Value | Usage |
|-------|-------|-------|
| `--status-success` | `#3D7A4A` | Success states, confirmations — muted forest green |
| `--status-warning` | `#B8860B` | Warnings, caution — dark goldenrod, warm-toned |
| `--status-error` | `#C23D2E` | Errors, destructive actions — shares value with `--accent-primary` (signal red is the site's alarm color) |
| `--status-info` | `#4A6B6E` | Informational — shares value with `--accent-tertiary` (cool-calm register) |

### Border and divider tones

| Token | Value | Usage |
|-------|-------|-------|
| `--border-light` | `#E0DAD4` | Borders on light surfaces — warm, not the cool Bootstrap `#dee2e6` |
| `--border-medium` | `#C4BCB4` | More prominent dividers, input borders |
| `--border-dark` | `#3A3A42` | Borders on dark surfaces — slightly lighter than `--surface-dark` |
| `--border-accent` | `var(--accent-primary)` | Active/focus borders, selected states |

### What this replaces

| Inherited value | Role | Replaced by |
|-----------------|------|-------------|
| `#005E70` (teal) | Primary buttons, active nav, accent sections | `--accent-primary` (`#C23D2E`) |
| `#8859b6` (purple) | Links, post titles, underlines | `--accent-secondary` (`#8B6B4A`) |
| `#000` (pure black) | Link hover, footer border | `--text-primary` (`#1C1917`) for hover; `--accent-primary` (`#C23D2E`) for footer top border |
| `#6c757d` (Bootstrap gray) | Masthead fallback, secondary buttons | `--text-secondary` (`#57534E`) or `--surface-dark` depending on context |
| `#f8f9fa` (Bootstrap light) | Light section backgrounds | `--surface-secondary` (`#F5F0EB`) |
| `#212529` (Bootstrap dark) | Masthead overlay, dark text | `--surface-dark` (`#1A1A1E`) for backgrounds; `--text-primary` for text |
| `#fff` (pure white) | Page background, text on dark | `--surface-primary` (`#FFFCF9`) for backgrounds; `--text-on-dark` (`#F0EDE8`) for text on dark |

### Resolved decisions

- **Light signal red for badges/tags**: Yes — `--accent-primary-light` (`#E8ADA7`) provides a desaturated tint for badges and tags on light backgrounds. Text within uses `--accent-primary-hover` for readable contrast. `--accent-tertiary` remains available for informational/neutral badges where red would over-signal.
- **Footer top border**: Signal red (`6px solid var(--accent-primary)`) — it connects the structural frame of the page to the constructivist imagery accent, making the footer feel like the base of a poster rather than a generic divider.

---

## Layout & Composition

The layout system uses Bootstrap 5's grid as infrastructure but applies compositional logic from the constructivist aesthetic: asymmetric weight distribution, deliberate use of negative space, and structural rhythm through proportion rather than decoration.

### Principles

1. **Asymmetry in content, symmetry in containment.** The constructivist imagery is never centered; the UI uses centered content columns as a deliberate counterpoint. But within those centered containers, content elements should seek natural balance through visual weight, not mechanical centering of every element.

2. **The narrow column is sacred.** Article body text at `col-lg-8 col-md-10` produces ~65-75 characters per line at 18px — the readable optimum. Nothing should break this constraint for main reading content. Wider content (grids, images, tables) can break out of the text column but should be visually anchored to it.

3. **Vertical rhythm is spacing, not rules.** Sections are separated by calibrated whitespace, not horizontal rules or borders. The exception is structural transitions (content → dark section, article body → section rows) where a change in surface color provides the boundary.

4. **Full-bleed as emphasis.** Full-width sections (dark backgrounds, hero imagery, accent bands) are emphatic — they signal a register change. They should not be the default; most content sits in containers.

### Page anatomy

Every page follows a three-part vertical structure:

```
┌─────────────────────────────────────────────────┐
│  NAVIGATION (transparent → fixed white on scroll)│
├─────────────────────────────────────────────────┤
│                                                   │
│  MASTHEAD / HERO                                  │
│  Full-bleed, dark imagery, warm text overlay      │
│  Generous vertical padding (12.5rem on desktop)   │
│                                                   │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌─── container ─────────────────────────┐       │
│  │  ┌─── content column (8/12) ────┐     │       │
│  │  │                                │     │       │
│  │  │  Body content / Block List     │     │       │
│  │  │                                │     │       │
│  │  └────────────────────────────────┘     │       │
│  └─────────────────────────────────────────┘       │
│                                                   │
│  ── Section rows (full-bleed or contained) ──     │
│                                                   │
├─────────────────────────────────────────────────┤
│  FOOTER (dark surface, warm text)                 │
└─────────────────────────────────────────────────┘
```

### Content column variants

| Template | Column structure | Rationale |
|----------|-----------------|-----------|
| Article, Home, Contact | `col-lg-8 col-md-10 mx-auto` | Narrow reading column — optimized for prose |
| Content (with section nav) | `col-lg-3` sidebar + `col-lg-9` main | Documentation layout — navigation provides context |
| Article List | `col-lg-12 col-md-10 mx-auto` | Full container width for card grids |

### Spacing system

Replace Bootstrap's default spacing scale with a system tied to the 18px base font size. The goal is vertical rhythm that feels measured, not mechanical.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `0.25rem` (4.5px) | Tight gaps: inline elements, icon-to-text |
| `--space-sm` | `0.5rem` (9px) | Within components: label-to-input, badge padding |
| `--space-md` | `1rem` (18px) | Base unit: paragraph spacing, card padding |
| `--space-lg` | `2rem` (36px) | Between components: card-to-card, block-to-block |
| `--space-xl` | `4rem` (72px) | Section breaks: section-to-section, masthead padding |
| `--space-2xl` | `8rem` (144px) | Page-level: masthead top/bottom on desktop |

The section row spacing (currently CMS-controlled via `SpacingHelper`) should map to this token scale rather than arbitrary values.

### Breakout patterns

Some content types need to escape the narrow reading column. These breakouts should feel intentional, not accidental:

- **Wide image**: Breaks to `col-lg-10` (one step wider than text column), centered. Subtle visual expansion without going full-bleed.
- **Full-bleed image/section**: Extends to viewport edges. Reserved for high-impact moments — a single hero image mid-article, a dark callout section.
- **Pull quote**: Floats into the left margin on desktop (`margin-left: -2rem`), creating asymmetric tension. On mobile, becomes full-width with a left border accent.
- **Code block**: Stays within the text column but uses `--surface-dark` background, creating a visual "punch-through" to the constructivist substrate.

### Grid and card composition

Article list grids and card layouts should use a consistent internal rhythm:

- **Card grid**: 3 columns on `lg`, 2 on `md`, 1 on `sm`. Gap of `--space-lg`.
- **Card internal padding**: `--space-md` horizontal, `--space-sm` vertical between elements.
- **Card corners**: `0` — sharp corners echo the constructivist angular aesthetic. The current `border-radius: 0.5rem` inherited from Clean Blog softens the visual language and should be removed.
- **Card shadows**: None at rest. On hover, a subtle elevation (`0 2px 12px rgba(26, 26, 30, 0.08)`) — less dramatic than the current `0 4px 16px rgba(0, 0, 0, 0.12)`.

### Navigation composition

The navigation bar is the one persistent horizontal element. Its treatment signals the design system:

- **Default state**: Transparent over the hero, text in warm off-white. No background, no border — the navigation floats on the imagery.
- **Scrolled/fixed state**: `--surface-primary` background with `--border-light` bottom border. Transition via opacity, not slide. The current translate-Y show/hide animation creates unnecessary motion.
- **Mobile**: Full-height overlay in `--surface-dark` with warm off-white text and generous vertical spacing between items. Not a cramped dropdown but a proper surface takeover.

### Footer composition

The footer is a structural anchor — the heaviest visual element on the page:

- **Background**: `--surface-dark` (`#1A1A1E`) — connects to the constructivist imagery substrate
- **Top border**: `6px solid var(--accent-primary)` — signal red as structural punctuation (replaces pure black)
- **Layout**: Two-column (brand + nav) on desktop, stacked on mobile
- **Text**: `--text-on-dark` with `--text-on-dark-secondary` for supporting content
- **Link indicators**: Bottom-border (retained), using `--accent-secondary` on hover

---

## Interaction & Motion

Motion on this site should feel like material responding to force — not bouncy, not elastic, not playful. Movements are brief, directional, and purposeful. They reference the constructivist language: translation along vectors, opacity shifts, scale that suggests mass.

### Timing principles

1. **Micro-interactions are fast.** Color changes, underline shifts, border transitions: `150ms`. The user should never wait for a hover state.
2. **Layout transitions are measured.** Navigation state changes, section reveals, card elevations: `250ms–350ms`. Enough to register as motion without feeling sluggish.
3. **Nothing bounces.** Easing is always `ease` or `ease-out`. No `ease-in-out` (which creates a rubbery quality), no spring physics, no overshoot. Objects move and stop.
4. **Reduced motion is first-class.** All motion is wrapped in `prefers-reduced-motion` checks. When reduced motion is preferred, transitions are instant (opacity crossfade at most). This is already partially implemented and should be completed.

### Easing tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-micro` | `150ms ease` | Hover states: color, underline, border, opacity |
| `--ease-standard` | `250ms ease-out` | Component transitions: elevation, layout shifts |
| `--ease-emphasis` | `350ms ease-out` | Page-level: navigation state, section reveals |

### Interaction vocabulary

**Hover states** — changes should indicate "this responds to you" without being distracting:

| Element | Hover effect | Implementation |
|---------|-------------|----------------|
| Text links | Underline thickens 1px → 2px, color warms | `text-decoration-thickness`, `color` transition at `--ease-micro` |
| Cards | Subtle upward shadow appears | `box-shadow: 0 2px 12px rgba(26, 26, 30, 0.08)` at `--ease-standard` |
| Buttons (primary) | Background darkens to `--accent-primary-hover` | `background-color` at `--ease-micro` |
| Navigation links | Color shifts to `--accent-secondary` | `color` at `--ease-micro` |
| Images in cards | Slight scale (`1.02`) within clipped container | `transform: scale(1.02)` at `--ease-standard` |

**Focus states** — must be unambiguous for keyboard navigation (WCAG 2.4.7):

| Context | Focus-visible style |
|---------|-------------------|
| Light background | `2px solid var(--accent-primary)` with `2px` offset |
| Dark background | `2px solid var(--text-on-dark)` with `2px` offset |
| Within navigation | `2px solid currentColor` with `2px` offset |

Focus styles use `:focus-visible` (not `:focus`) to avoid showing outlines on mouse clicks. Already partially implemented.

**Active/pressed states** — brief, physical:

| Element | Active effect |
|---------|-------------- |
| Buttons | `translateY(1px)` + slightly darker background — the button "presses in" |
| Cards (clickable) | Shadow removed, slight `translateY(1px)` — the card descends |

### Page-level motion

**Navigation show/hide on scroll**: The current implementation uses `transform: translate3d(0, 100%, 0)` to reveal a fixed navbar. This is replaced with a simpler approach:
- Scrolling down: navbar fades to `opacity: 0` and gets `pointer-events: none`
- Scrolling up: navbar fades to `opacity: 1` at `--ease-emphasis`
- This eliminates the jarring slide-in and keeps the navigation present but unobtrusive

**Section reveals on scroll** (new): Content sections below the fold get a subtle entrance:
- Start at `opacity: 0; translateY(1rem)` — content begins slightly below its final position
- On entering viewport (via `IntersectionObserver`): transition to `opacity: 1; translateY(0)` at `--ease-emphasis`
- Stagger: if multiple elements enter together (card grid), each delays by `50ms` from the previous
- Only applies once (no re-animation on scroll-back)
- Disabled entirely under `prefers-reduced-motion`

**Hero parallax** (optional, low priority): The masthead background image scrolls at `0.5×` the page scroll rate, creating depth. Pure CSS via `background-attachment: fixed` (already partially in place with `background-attachment: scroll` — evaluate switching). Skip on mobile where fixed attachment causes performance issues.

### Button system

Buttons are the most direct intersection of the interaction and color systems. They inherit the constructivist sharp-corner aesthetic:

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| Primary | `--accent-primary` | `--text-on-dark` | none | Main CTAs, form submits |
| Secondary | `transparent` | `--accent-secondary` | `2px solid --accent-secondary` | Alternative actions, cancel |
| Ghost | `transparent` | `--text-primary` | `1px solid --border-medium` | Tertiary actions, filters |
| Danger | `--status-error` | `--text-on-dark` | none | Destructive actions |

All buttons: `border-radius: 0`, uppercase `Source Sans 3` at `weight 600`, `letter-spacing: 0.05em`, padding `0.75em 1.5em`.

---

## Component Treatments

This section defines how the color, layout, and motion systems apply to specific recurring components. These replace the inherited Clean Blog defaults.

### Masthead / Hero

- **Overlay**: Single `--surface-overlay` layer (not a pseudo-element with separate opacity)
- **Text**: `--text-on-dark`, Cormorant at 600 weight, text-shadow `0 1px 3px rgba(0, 0, 0, 0.4)`
- **Badges** (article categories): `--surface-dark-elevated` background, `--text-on-dark` text, no border-radius
- **Meta text** (date, author): `--text-on-dark-secondary`, Source Sans 3 at 300 weight

### Cards (article previews)

- **Background**: `--surface-primary` (or `--surface-secondary` when on primary background)
- **Border**: `1px solid --border-light`
- **Corner radius**: `0`
- **Title**: Cormorant Garamond, linked with `--accent-secondary` underline at 40% opacity
- **Meta**: `--text-secondary`, Source Sans 3
- **Hover**: Shadow elevation + image scale (defined in motion section)
- **Image**: Full-width within card, `object-fit: cover`, no rounded corners

### Code blocks

Code blocks are where the constructivist substrate surfaces through the content layer:

- **Background**: `--surface-dark`
- **Text**: Current VS2015 syntax theme (retained — it works with the dark palette)
- **Border**: None (the surface change is sufficient)
- **Corner radius**: `0`
- **Font**: IBM Plex Mono at 0.875em
- **Inline code**: `--surface-tertiary` background, `--text-primary` text, `0.125em` horizontal padding

### Section rows

- **Light variant**: `--surface-secondary` background (replaces Bootstrap `#f8f9fa`)
- **Accent variant**: `--accent-primary` background, `--text-on-dark` text (replaces teal `#005E70`)
- **Contained variant**: `border-radius: 0` (replaces `0.375rem`), `1px solid --border-light`
- **Full-bleed variant**: No border, no radius — extends to viewport edges

### Alerts / notices

- **Primary**: `--accent-primary-subtle` background, `--accent-primary` left border (4px), `--text-primary` text
- **Success**: `rgba(61, 122, 74, 0.08)` background, `--status-success` left border
- **Warning**: `rgba(184, 134, 11, 0.08)` background, `--status-warning` left border
- **Error**: `--accent-primary-subtle` background, `--status-error` left border

All alerts use a left-border-only design (constructivist edge line) rather than the full-surround pastel backgrounds inherited from Bootstrap.

### Forms

- **Input background**: `--surface-tertiary`
- **Input border**: `1px solid --border-medium`
- **Focus border**: `--accent-primary` (signal red draws the eye to the active field)
- **Focus shadow**: `0 0 0 3px var(--accent-primary-subtle)`
- **Labels**: Source Sans 3, `--text-secondary`, uppercase at `0.75rem` with `0.05em` tracking
- **Corner radius**: `0`

---

## Removing the Starter Site

The following inherited Clean Blog / Umbraco Starter Site patterns should be systematically replaced:

### Visual patterns to retire

| Pattern | Current | Replacement |
|---------|---------|-------------|
| Rounded corners on cards, inputs, containers | `border-radius: 0.375rem` / `0.5rem` | `border-radius: 0` throughout |
| Cool gray surface (`#f8f9fa`) | Bootstrap default light | `--surface-secondary` (`#F5F0EB`) |
| Teal accent (`#005E70`) everywhere | Primary color | `--accent-primary` (signal red) for actions; `--accent-tertiary` for passive/info |
| Purple links (`#8859b6`) | All link contexts | `--accent-secondary` (warm bronze) |
| Pure white backgrounds | `#fff` | `--surface-primary` (`#FFFCF9`) |
| Pure black text elements | `#000` | `--text-primary` (`#1C1917`) or `--surface-dark` (`#1A1A1E`) |
| Bootstrap gray borders | `#dee2e6`, `rgba(0,0,0,0.125)` | `--border-light` (`#E0DAD4`) |
| Slide-in navbar animation | translate3d show/hide | Opacity fade |
| Font Awesome icons | CDN-loaded icon font | Evaluate: keep if minimal, replace with inline SVGs if usage is low |
| `styles.css` monolith | Bootstrap + Clean Blog in one 11K-line file | Extract custom styles into component files; load Bootstrap from CDN separately |

### What to keep from the starter site

- Bootstrap 5 grid system (container/row/col) — it works and is well understood
- Responsive breakpoint values (576/768/992/1200/1400) — standard and sufficient
- `CachedPartialAsync` pattern for navigation and footer — performance pattern, not design
- Swiffy Slider for carousels (if carousels are retained)
- Highlight.js for code syntax highlighting

---

## Implementation Priority

The design system should be implemented in phases, each producing a visible and testable result:

### Phase 1: Color tokens and surfaces
Replace the inherited color values with CSS custom properties. This is the highest-leverage change — it touches everything but can be done entirely in CSS without Razor template changes.

### Phase 2: Component sharpening
Remove border-radius, update card/alert/form treatments, apply the new border and shadow system. Still primarily CSS.

### Phase 3: Layout refinements
Update the footer to dark surface treatment, refine section row backgrounds, implement breakout patterns for images and pull quotes. Requires some Razor partial changes.

### Phase 4: Motion system
Replace navbar scroll behavior, add section reveal animations, implement the easing token system. Requires JS changes.

### Phase 5: Navigation and structural chrome
Rework the mobile navigation overlay, implement the transparent → solid nav transition, update the masthead overlay approach. Razor + CSS + JS.

---

## Guiding Principles

1. **Contrast through complement, not similarity.** The typography doesn't mimic the imagery. Where the imagery is geometric, the text is calligraphic. Where the imagery is dense, the text breathes.

2. **Restraint and intensity are not opposites.** A narrow value range, a single accent, a small number of typefaces — these constraints create focus, not limitation.

3. **Every identifier serves accessibility.** Color is never the sole means of distinguishing interactive elements. Underlines, borders, weight shifts, and outlines provide redundant cues.

4. **Warm text on cool fields.** The stone-toned text colors and warm off-whites exist specifically to contrast the blue-cool near-blacks of the imagery. This temperature difference is load-bearing.

5. **The machine hums; the human speaks.** Monospace elements (code, AI labels) are the interface between the two layers. They should feel precise but not cold.

6. **Sharp geometry, warm material.** Zero border-radius, angular composition, and straight edges echo the constructivist imagery. But the surfaces and colors within those sharp boundaries are warm — stone, earth, paper. The container is the machine; the content is the human.

7. **Motion serves comprehension.** Transitions help the user track what changed and where. They never exist for delight alone. If a transition can be removed without losing information, remove it.
