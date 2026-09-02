# Handoff: Cantrip spell cards

> **Round 2 supersedes parts of this document.** The organizing layer was revised after discovery —
> the flat filterable grid became one stack per pack, and the deck dividers became the stacks. See
> `README-round-2.md`, which lists exactly which sections below it replaces. Everything about the
> card itself — box, flip, reverse, sigils, tokens, animation traps — still stands, except the face's
> title block and plane value.

## Overview

A browsable deck of flip cards documenting the Cantrip toolkit — one card per unit. Thirty units
exist (14 spells, 16 references) plus five deck dividers. The card **face** carries the group's
identity (a geometric sigil, group name, kind); the **reverse** carries the reference content (stat
block, what it does, the one gotcha, the suggested next step).

The surface is a filterable grid on the AI Sketch Lab publication site, where the toolkit is
discussed and promoted. It is a reading surface, not an app: no auth, no persistence, no writes.

## About the design files

`Spell Cards.dc.html` in this bundle is a **design reference created in HTML** — a prototype showing
intended look and behavior. It is not production code to copy. It uses a bespoke streaming-component
runtime (`support.js`, included so the file opens in a browser) that has nothing to do with the
target stack.

The task is to **recreate this design in the ai-sketchlab site's existing environment** — Umbraco 17,
Razor views, Bootstrap 5, and the `typography.css` / `site.css` overlay — using its established
patterns. Markup and CSS should be authored fresh against those conventions. The prototype's logic
class is a data + filter model, not an implementation to port.

## Fidelity

**High-fidelity.** Colors, type, spacing, and interactions are final and traceable to the AI Sketch
Lab design system (`reference/colors_and_type.css`, included). Recreate pixel-accurately. Every value
in the prototype is a literal hex/px; substitute the corresponding `var(--*)` token from
`typography.css` when implementing (mapping in *Design tokens* below).

## Screens / views

### 1. Deck index (the only screen)

**Purpose.** Browse the deck, filter it, flip individual cards to read the reverse.

**Layout.**

- Page: `--surface-primary` (`#FFFCF9`), max-width `1400px`, centered, padding `64px 40px 96px`.
- Intro block: max-width `34em`, bottom margin `56px`. Contains
  - eyebrow — IBM Plex Mono, `0.7rem`, weight 500, letter-spacing `0.08em`, uppercase, `#57534E`
  - `h1` — Cormorant Garamond 300, `clamp(2.4rem, 1.8rem + 2.5vw, 3.4rem)`, line-height `1.05`,
    letter-spacing `-0.015em`; second word italic 400
  - lede — Source Sans 3, `1.05rem`, line-height `1.6`, `#57534E`
  - sub-note — `0.9rem`, `#78716C`
- Filter bar: flex row, wrap, `gap: 36px`, `padding-bottom: 18px`, `border-bottom: 1px solid #E0DAD4`,
  `margin-bottom: 40px`. Two labelled chip groups on the left (Group, Kind), result count +
  "Show all backs" button pushed right with `margin-left: auto`.
- Card grid: `display: grid; grid-template-columns: repeat(auto-fill, minmax(352px, 1fr));
  gap: 44px 32px; align-items: start`.
- Each grid cell: flex column, `gap: 12px` — the flip card, then a caption row below it
  (two-digit index in mono `0.62rem` `#A8A29E`, then a one-line hint in `0.78rem` `#78716C`).
- Notes block at the bottom: `margin-top: 72px`, `border-top: 1px solid #E0DAD4`, max-width `34em`.
  This is design commentary in the prototype — **drop it** in production.

**Filter chips.** `padding: 7px 13px`, Source Sans 3 `0.78rem` weight 600, letter-spacing `0.02em`,
`white-space: nowrap`, square corners, `transition: background/color/border-color 150ms ease`.

- inactive: `background: transparent; color: #57534E; border: 1px solid #E0DAD4`
- active: `background: #1C1917; color: #FFFCF9; border: 1px solid #1C1917`
- hover: `border-color: #8B6B4A`
- Group chips: All · Core spellbook · Core reference · umbraco-17 · umbraco-cloud · dotnet
- Kind chips: All · Spells · References · Dividers

**"Show all backs" button.** `border: 1px solid #C4BCB4`, `padding: 7px 14px`, `0.78rem` weight 600,
`#1C1917`; hover `border-color: #8B6B4A; color: #6E5339`. Label toggles to "Show faces" when every
visible card is already flipped.

**Result count.** IBM Plex Mono `0.72rem`, letter-spacing `0.04em`, `#78716C` — e.g. `11 cards`.

### The card

Fixed box: **width = grid column** (min `352px`), **height `690px`**. `perspective: 1400px` on the
outer element; inner element `position: relative; width/height 100%; transform-style: preserve-3d;
transition: transform 550ms cubic-bezier(.4,0,.2,1)`, `transform: rotateY(0deg | 180deg)`.

Both faces: `position: absolute; inset: 0; backface-visibility: hidden; overflow: hidden;
box-shadow: 0 2px 8px rgba(28,25,23,0.10)`. The reverse additionally carries `transform: rotateY(180deg)`.

> The 690px height is derived, not arbitrary: it is the height of the tallest reverse
> (`/code-review`, the only card with a `Modes` line) measured at the narrowest grid column. If you
> change the reverse's type scale or add a field, re-derive it.

#### Face (Dark Constructivism layer)

- Background: the group's dark plane (see *Group suits*). Ink `#F0EDE8`.
- Inner frame: `position: absolute; inset: 14px; border: 1px solid rgba(240,237,232,0.20)`.
- Second frame: `inset: 21px; border: 1px solid rgba(240,237,232,0.09)`.
- Corner marks: `26×26px`, `3px` solid in the group accent — top-left (top+left borders) and
  bottom-right (bottom+right borders) only. Asymmetric on purpose.
- Diagonal force line: `1px` wide, `160%` tall, `top: -30%; left: 64%`, `rotate(18deg)`,
  `rgba(240,237,232,0.13)`.
- Content column: centered, `gap: 30px`, `padding: 52px 34px` — sigil (132×132), then the title
  block: name in Source Sans 3 `0.92rem` weight 600, letter-spacing `0.22em`, uppercase, and
  beneath it the kind in IBM Plex Mono `0.6rem`, letter-spacing `0.14em`, uppercase, `#A8A29E`.
- Divider cards show a **monogram** instead of a sigil: Cormorant Garamond 300, `6.2rem`,
  line-height `0.82`, letter-spacing `-0.04em`, opacity `0.92`. *(Planned replacement — see
  "Next moves", item 1.)*

#### Reverse (Human Signal layer)

`background: #FFFCF9`, `border: 1px solid #E0DAD4`, `border-top: 3px solid <group accent>`,
`padding: 26px 24px 22px`, flex column full height.

Order, top to bottom:

1. **Header row** — space-between. Left: kind badge. Right: group name, IBM Plex Mono `0.6rem`,
   letter-spacing `0.08em`, uppercase, `#78716C`, right-aligned, `padding-top: 3px`.
   - Spell badge: `background: #1C1917; color: #FFFCF9; border: 1px solid #1C1917`
   - Reference badge: transparent fill, text and `1px` border in the group accent
   - Both: IBM Plex Mono `0.58rem` weight 500, letter-spacing `0.1em`, uppercase, `padding: 4px 8px`
2. **Title** — `margin-top: 16px`, `line-height: 1.15`, `#1C1917`, `overflow-wrap: break-word`.
   - Spells (an invocation, so it is code): IBM Plex Mono `1.32rem` weight 500
   - References (a name, so it is language): Cormorant Garamond `1.75rem` weight 400
3. **Subtitle** — Cormorant Garamond italic `1.02rem`, `#57534E`, `margin: 2px 0 16px`.
   Format: `<Group> · <qualifier>` (e.g. `Core spellbook · Spell 2 of 10`).
4. **Stat block** — `display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
   background: #E0DAD4; border: 1px solid #E0DAD4; margin-bottom: 16px`. The 1px gap over a grey
   background is what draws the cell rules — no per-cell borders. Cells: `background: #FFFCF9;
   padding: 9px 10px`. Label: Source Sans 3 `0.6rem` weight 700, letter-spacing `0.07em`, uppercase,
   `#78716C`, `margin-bottom: 4px`. Value: IBM Plex Mono `0.66rem`, line-height `1.45`, `#1C1917`,
   `overflow-wrap: break-word`.
   - Row 1 is always full width (`grid-column: 1 / -1`): **Cast** for spells, **Triggers** for
     references. This swap is the whole spell-vs-reference distinction in the layout.
   - Then **Needs** and **Leaves** side by side (spells), or **Holds** full width (references).
   - Omit any absent field. Do not pad the grid to balance it.
5. **Does** — Source Sans 3 `0.86rem`, line-height `1.58`, `#1C1917`, `text-wrap: pretty`,
   `margin-bottom: 12px`.
6. **Modes** (optional) — `0.78rem`, `#57534E`, preceded by an inline uppercase `MODES` label
   (`0.6rem`, weight 700, letter-spacing `0.07em`, `#78716C`, `margin-right: 6px`).
7. **Watch for** (optional) — `border-left: 2px solid #C23D2E`, `padding: 2px 0 2px 12px`.
   Label: IBM Plex Mono `0.58rem` weight 500, letter-spacing `0.09em`, uppercase, `#C23D2E`.
   Body: `0.78rem`, line-height `1.5`, `#1C1917`. This is the reverse's single signal-red element.
8. **Footer** — `margin-top: auto; padding-top: 12px; border-top: 1px solid #E0DAD4`, baseline-aligned
   row. Label (`Then` or `Pairs with`) in the uppercase `0.6rem` style; value in IBM Plex Mono
   `0.68rem`, `#8B6B4A`.

#### Divider reverse

Same box, different content: `padding: 34px 30px`. Mono uppercase "Deck divider" eyebrow → group
name as `h2` (Cormorant Garamond 400, `1.9rem`, line-height `1.08`) → a `44×2px` rule in the group
accent (`margin: 20px 0 22px`) → the divider paragraph (`0.95rem`, line-height `1.62`, `#1C1917`) →
a Cormorant italic `1.05rem` `#57534E` note pinned to the bottom above a `1px #E0DAD4` rule.

## Group suits

Face art, plane value, and accent differ per group; the reverse layout never does.

| Group | Face plane | Accent (corner marks, top rule, ref badge) | Monogram | Sigil |
|---|---|---|---|---|
| Core spellbook | `#101014` (dc-obsidian) | `#C23D2E` signal red | `CS` | rotating double diamond |
| Core reference | `#1A1A1E` (dc-anthracite) | `#8B6B4A` warm bronze | `CR` | framed page, mono text lines |
| umbraco-17 | `#202026` (dc-graphite) | `#4A6B6E` quiet teal | `17` | 2×2 block lattice |
| umbraco-cloud | `#1A1A1E` (dc-anthracite) | `#A8A29E` stone | `UC` | stacked offset planes |
| dotnet | `#252530` (dc-charcoal) | `#B8860B` ochre | `.N` | hexagon ring, three dots |

Each sigil is drawn on a `0 0 120 120` viewBox, `stroke: currentColor` (`#F0EDE8` on dark),
`stroke-width: 1.6` (`2.4` for the emphasis stroke), and contains **exactly one** `#C23D2E`
element — per the design system's one-signal-red-per-composition rule. Sigils are defined once in a
hidden `<svg><defs>` sprite and instanced with `<use href="#sig-…">`.

## Interactions & behavior

**Flip.** Click anywhere on a card. `rotateY` 0 ↔ 180deg over `550ms cubic-bezier(.4,0,.2,1)`.
State is per-card and independent; "Show all backs" sets every currently-visible card at once and
its label inverts when all are flipped. In production give each card a `<button>` or
`aria-expanded` affordance and keyboard activation — the prototype only handles click.

**Filtering.** Group and Kind are independent single-select. `All`/`All` shows units then dividers.
Selecting a Kind of Spells or References hides dividers; selecting Dividers shows only the five
group cards. No URL state in the prototype — worth adding query params in production so a filtered
deck is linkable.

**Sigil animation.** The only animation on the page, and it is deliberately confined to the
imagery layer — the reading layer stays editorially still, per the design system.

Three modes, set per deck: **continuous** (the default), **hover only**, and **off** — intended as a
CMS setting on the deck page. A class on each card face (`motion-continuous` / `motion-hover` /
`motion-off`) resolves `--sig-play` to `running` or `paused`; `motion-hover` rests paused and flips
to running on `:hover`.

Mechanism: every animation is declared on the sigil's SVG children but gated by
`animation-play-state: var(--sig-play, paused)`. Because custom properties inherit into a `<use>`
element's shadow tree, one rule on the host reaches inside every instanced sigil — which is
otherwise unstylable from outside. `prefers-reduced-motion: reduce` forces `paused` in all three
modes, so the deck is completely still for users who ask for that.

**Three traps, all hit during build — honor them when re-authoring:**

1. **Cascade order.** The gate declaration must come **after** every `animation:` shorthand. The
   shorthand resets `animation-play-state` to its initial value `running`, and at equal specificity
   the later rule wins — so a gate declared first is silently overridden and every sigil animates
   forever, reduced-motion included.
2. **Set the resting value explicitly** on named selectors rather than relying on the `var()`
   fallback; the fallback did not hold reliably in testing.
3. **Scope the sprite's paused default by id, not by attribute.** It belongs on `#sig-sprite`, the
   hidden `<defs>` holder. A selector like `svg[aria-hidden="true"]` also matches every card's sigil
   `<svg>` — correctly `aria-hidden`, being decorative — and that svg is the nearest ancestor of the
   `<use>`, so its `paused` overrides the host before the value reaches the shadow tree. Motion then
   never runs, in any mode.

The animation classes, all infinite:

| Class | Motion | Duration / easing |
|---|---|---|
| `sig-spin` | `rotate(360deg)`, `transform-box: view-box`, origin 50% 50% | 16s linear |
| `sig-spin-rev` | same, reversed | 22s linear |
| `sig-pulse` | `scale(1 → 1.4)`, opacity `1 → 0.7`, `transform-box: fill-box` | 2.6s ease-in-out |
| `sig-draw` | `stroke-dashoffset 190 → 0 → -190` (`stroke-dasharray: 190`) | 3.4s ease-in-out |
| `sig-slide` | `translateX(0 → 40px → 0)` | 3.6s ease-in-out |
| `sig-drift` | `translateY(0 → -7px → 0)` | 3.8s ease-in-out |
| `sig-scan` | `scaleX(0 → 1 → 0)`, origin `0% 50%`, staggered `0.18s` per line | 3.2s ease-in-out |
| `sig-blink` | opacity `0.22 → 1 → 0.22`, staggered `0.7s` | 2.8s ease-in-out |
| `sig-fade` | `fill-opacity 0.08 → 0.32 → 0.08` | 3.4s ease-in-out |
| `sig-trace` | `offset-distance 0% → 100%` along `offset-path: path("M60 10 L103 35 L103 85 L60 110 L17 85 L17 35 Z")`, `offset-rotate: 0deg`, three dots at `-2.33s` stagger | 7s linear |

Per-sigil assignment:

- **Core spellbook** — outer diamond `sig-spin`, inner diamond `sig-spin-rev`, two corner ticks
  `sig-draw`, red square `sig-pulse`.
- **Core reference** — seven mono text-lines `sig-scan` (staggered, so the block appears to typeset
  itself), diagonal `sig-draw`, red bar `sig-slide`.
- **umbraco-17** — three faint blocks `sig-blink` in sequence, diagonal `sig-draw`, red block
  `sig-pulse`.
- **umbraco-cloud** — lower plane `sig-drift`, upper plane fill `sig-fade`, dropline `sig-draw`,
  red bar `sig-slide`.
- **dotnet** — three dots `sig-trace` around the hexagon, inner hexagon `sig-spin-rev`, diagonal
  `sig-draw`, red centre dot `sig-pulse`.

**Browser note.** `offset-path` / `offset-distance` on SVG children is Chrome/Edge/Safari 16+/
Firefox 72+. If the target browser matrix includes anything older, fall back to `sig-blink` on
three dots placed at hexagon vertices — same read, no motion path.

## State management

Three pieces of client state, all ephemeral:

- `flipped: Record<cardId, boolean>` — per-card flip
- `group: "all" | "spellbook" | "reference" | "u17" | "cloud" | "dotnet"`
- `kind: "all" | "Spell" | "Reference" | "Divider"`

Derived: the visible card list, the result count, and whether every visible card is flipped (drives
the button label). No fetching in the prototype — content is a static array.

## Content model (Umbraco)

The prototype hard-codes six representative cards. In production the deck is 30 units + 5 dividers
and will keep growing, so it should be content, not markup. Suggested shape:

- **Document type `spellCardDeck`** — the index page. Properties: title, lede, sub-note.
- **Element type `spellCard`** (block list on the deck page), one per unit:
  `title` (textstring), `kind` (radio: Spell / Reference), `group` (dropdown, 5 values),
  `subtitle` (textstring), `cast` (textstring), `triggers` (textstring), `needs` (textstring),
  `leaves` (textstring), `holds` (textstring), `does` (textarea), `modes` (textarea),
  `watchFor` (textstring), `footerLabel` (radio: Then / Pairs with), `footerValue` (textstring),
  `captionHint` (textstring).
- **Element type `spellCardDivider`** — `group`, `title`, `body`, `note`.
- **`group`** drives face plane, accent, sigil, and monogram through a lookup in the view — do not
  make editors pick colors.

Two traps flagged by the toolkit's own `umbraco-17` reference material and worth honoring here:
unset is indistinguishable from false on optional properties (the layout must treat empty as
"omit the row", which is the intended behavior anyway), and `content` is a colliding unprefixed
alias — prefix these.

**Field caps from the source doc**, which the design assumes: `Cast`/`Triggers`/`Needs`/`Leaves`
one line each, `Does` two sentences ≤40 words, `Modes` ≤2 lines, `Watch for` one line. The stat-block
cells will grow the card past 690px if editors exceed them. Either enforce with `maxLength` or make
the height derivation dynamic.

## Design tokens

All values below already exist in the site's `typography.css`. Use the token, not the literal.

| Literal | Token | Used for |
|---|---|---|
| `#FFFCF9` | `--surface-primary` | page, card reverse, stat cells |
| `#F5F0EB` | `--surface-secondary` | warm face variant |
| `#1C1917` | `--text-primary` | body, titles, active chip fill |
| `#57534E` | `--text-secondary` | lede, subtitle |
| `#78716C` | `--text-tertiary` | labels, meta, hints |
| `#F0EDE8` | `--text-on-dark` | face ink |
| `#A8A29E` | `--text-on-dark-secondary` | face kind line, card index |
| `#E0DAD4` | `--border-light` | rules, inactive chip border, stat grid |
| `#C4BCB4` | `--border-medium` | button border |
| `#C23D2E` | `--accent-primary` / `--dc-signal` | Watch-for rule, one sigil element |
| `#8B6B4A` | `--accent-secondary` | footer value, hover border |
| `#6E5339` | `--accent-secondary-hover` | button hover text |
| `#4A6B6E` | `--accent-tertiary` | umbraco-17 accent |
| `#B8860B` | `--status-warning` | dotnet accent |
| `#101014` `#1A1A1E` `#202026` `#252530` | `--dc-obsidian` … `--dc-charcoal` | face planes |

Type: `--font-display` Cormorant Garamond (300/400 + italic), `--font-body` Source Sans 3
(300–700), `--font-mono` IBM Plex Mono (400/500). `html` base is **18px**, so every `rem` here is
18px-relative.

Radius: **0 everywhere.** No exceptions on this surface. Shadow: one value only,
`0 2px 8px rgba(28,25,23,0.10)` on card faces. Transitions: `150ms ease` for interactive feedback,
`550ms cubic-bezier(.4,0,.2,1)` for the flip only.

## Assets

- **Sigils** — five inline SVGs, authored for this design, in the `<defs>` sprite at the top of
  `Spell Cards.dc.html`. Copy them out verbatim; they are the only art in the design.
- **Monograms** — type, not assets (Cormorant Garamond). Slated for replacement with commissioned
  SVG art.
- No photography, no icon font, no third-party icons. Nothing to procure.

## Next moves the design anticipates

1. **Divider face art becomes a selector.** Replace the `CS` / `CR` / `17` / `UC` / `.N` monogram
   with a per-group SVG media pick. In the content model that is a media picker on
   `spellCardDivider` (and optionally an override on `spellCard`), constrained to SVG, rendered
   inline so it inherits `currentColor` and the `--sig-play` hover gate. Keep the monogram as the
   fallback when no art is set. Build the slot now; drop art in later.
2. **Per-card art overrides.** Same mechanism, if individual units eventually get their own sigils
   rather than inheriting the group's.
3. **Deep-linkable filters** — query params for group/kind.
4. **Print sheet** — the fixed card geometry is close to a 2.5×3.5 cut card already; a print
   stylesheet that lays out fronts and backs for duplex printing is a small, separable follow-on.

## Files in this bundle

- `Spell Cards.dc.html` — the design reference. Opens in a browser. Contains the sigil sprite, all
  animation CSS, the layout, and the six-card + five-divider content array.
- `support.js` — runtime required for that file to open. Not part of the deliverable.
- `reference/colors_and_type.css` — the AI Sketch Lab token sheet the design was built against, for
  cross-checking token names.
