# Handoff: Cantrip spell cards — round 2 (stacks)

Read `README.md` first. It remains accurate for **the card** — box, flip, face, reverse, sigils,
tokens, animation gating and its three traps. This document covers **only what changed above the
card**, and supersedes `README.md` wherever the two disagree (the sections it replaces are named
below).

## What changed, in one paragraph

The flat filterable grid is gone. The deck now presents **one stack per pack**, all four visible on a
single screen, and opening a stack reveals that stack's cards as a grid **sectioned into Spells and
References**. The five deck-divider cards became the stacks themselves. The `Group` and `Kind` filter
chips are both gone — grouping replaced the first, always-visible face differentiation replaced the
second. The card is untouched except on its **face**, where the reverse's code-versus-language split
now also runs.

**Sections of `README.md` this replaces:** *Screens / views → 1. Deck index* (filter bar, chips,
result count), *The card → Face* (content column and title block only), *Divider reverse* (deleted),
*Group suits* (re-cut), *Interactions & behavior → Flip and Filtering*, *State management*,
*Content model*, and *Next moves* items 1 and 3.

## Why

The prototype showed 6 cards + 5 dividers. Production is 30 units. At `minmax(352px, 1fr)` in the
1400px container the grid resolves to 3 columns at ~755px a row, so 40 items is 14 rows — about a
**10,000px page**. The deck exists to relieve volume and intimidation; a ten-screen wall of stat
blocks reproduces it. Grouping is the fix, and packs — not cards — are the growth axis.

**Derived, for reference:** at four stacks the largest panel (Core, 16 cards) is 4 rows of spells +
2 rows of references plus two section headers, ≈ **5,050px** including the panel header. Every other
stack is one screen or less: umbraco-17 ≈ 2,600px, dotnet ≈ 800px, umbraco-cloud ≈ 800px. Landing
with one stack open means the first screen is the stack row, not a card wall.

## Stack count: four

**Four stacks — `Core` (16) · `umbraco-17` (9) · `umbraco-cloud` (2) · `dotnet` (3)** — matching what
a person installs. Sectioning every stack into Spells and References dissolves the old
spellbook/reference split, so Core is one stack of 16 with two sections.

Five still works and is wired as a prop (`stackCount`) so you can see it: Core splits into
`Core spellbook` (10 spells, one section) and `Core reference` (6 references, one section). What
reads worse at five:

- **Two of five stacks render a single section**, which makes the section headings look like
  decoration rather than structure — the whole point of the sectioning decision.
- The row loses its correspondence to installation. `Core spellbook` and `Core reference` are not
  separately installable, so a reader reasonably infers they are.
- The two Core stack faces need distinct sigils and accents, spending two of the five accents on one
  pack. At four, `Core` takes signal red alone and the one-red-per-composition rule stays clean.

**At 16 cards** the Core panel behaves the same as at 10 — the grid is the same three columns, there
is simply one more row of spells. The section headings do more work at 16 than at 10, which argues
for four.

## The stack

Fixed box: **224 × 404px**, `flex: 0 0 auto` in a `display: flex; flex-wrap: wrap; gap: 28px 26px`
row. Fixed width rather than a `1fr` grid, so a fifth through eighth stack **wraps onto a second row
at the same size** instead of re-laying out the first four. Growth is a wrap, not a redesign.

Three layers build the depth, all `position: absolute` inside the button:

| Layer | Inset | Background | Border |
|---|---|---|---|
| back | `left/top: 14px; right/bottom: 0` | `#202026` (dc-graphite) | `1px solid rgba(240,237,232,0.07)` |
| middle | `inset: 7px` | `#1A1A1E` (dc-anthracite) | `1px solid rgba(240,237,232,0.09)` |
| top face | `left/top: 0; right/bottom: 14px` | `#101014` (dc-obsidian) | none; `box-shadow: 0 2px 8px rgba(28,25,23,0.12)` |

The offsets are down-and-right, so the stack reads as cards resting under the top one. Value
separation between the three planes is the only depth cue — no gradients, hard edges only, per the
Dark Constructivism rules. **A two-card stack uses the same three layers as a sixteen-card one**: the
depth is the motif, not a quantity read. The count is stated in words instead.

Top face, using the card face's own vocabulary at reduced scale:

- Single inner frame at `inset: 11px`, `1px solid rgba(240,237,232,0.18)` (the card has two; one at
  this size).
- One corner mark, top-left only: `22×22px`, `3px` solid in the stack accent.
- Diagonal force line: `1px`, `160%` tall, `top: -30%; left: 66%`, `rotate(18deg)`,
  `rgba(240,237,232,0.13)`.
- Content column, centered, `gap: 22px`, `padding: 34px 22px 30px` — the stack's sigil at **86×86**,
  then the stack name in Source Sans 3 `0.8rem` weight 600, letter-spacing `0.18em`, uppercase, then
  the count in IBM Plex Mono `0.58rem`, letter-spacing `0.12em`, uppercase, `#A8A29E` (e.g.
  `16 cards`).
- **Accent bar, bottom edge, full width.** Closed: `1px`, accent at `opacity: 0.32`. Open: `5px`,
  `opacity: 1`. This is the open-state signal.
- Open stacks also `transform: translateY(-8px)`, `transition: transform 250ms
  cubic-bezier(.4,0,.2,1)`. Hover applies the same lift, so the affordance is legible before click.

**Stack art slot.** The face renders the stack's sigil by default. The monogram
(`C` / `17` / `UC` / `.N` at four stacks; `CS` / `CR` / … at five) is the fallback, in Cormorant
Garamond 300 at `4.4rem`, line-height `0.82`, letter-spacing `-0.04em`, opacity `0.92`. When
commissioned SVG art arrives it takes the sigil's place at the same 86×86 box. In the prototype the
`frontArt` prop switches sigil / monogram / placeholder so all three states are inspectable.

> **Security note carried from discovery.** To inherit `currentColor` and the `--sig-play` gate, art
> must be *inlined*, not `<img>`-referenced. An editor-uploaded SVG rendered inline is a stored-XSS
> surface and needs sanitising, or the slot needs to be a fixed list of site-supplied art rather than
> a media picker. Decide before shipping the slot.

## The stack panel

Appears below the row, `margin-top: 46px`. One 250ms `cubic-bezier(.4,0,.2,1)` fade-and-rise
(`opacity 0→1`, `translateY(10px)→0`) on the panel as a whole — **not per card**; thirty staggered
cards would be a second wall of motion. Suppressed entirely under `prefers-reduced-motion`.

**Panel header** — this is where the divider content went. Flex row, `gap: 40px`,
`padding-bottom: 26px`, `border-bottom: 1px solid #E0DAD4`, `margin-bottom: 44px`.

- Left column, max-width `30em`: mono uppercase `Stack` eyebrow (`0.62rem`, weight 500,
  letter-spacing `0.1em`, `#78716C`) → stack name as `h2` (Cormorant Garamond 400, `2.2rem`,
  line-height `1.06`, letter-spacing `-0.012em`) → a `44×2px` rule in the stack accent
  (`margin: 20px 0 22px`) → the blurb (`0.98rem`, line-height `1.6`, `#1C1917`) → the closing note
  in Cormorant Garamond italic `1.08rem`, `#57534E`, `margin-top: 16px`.
- Right, `margin-left: auto`: card count in mono `0.72rem` `#78716C`, then `Show all backs` and
  `Close stack` buttons in the existing `1px solid #C4BCB4` button style from `README.md`.

The old divider *reverse* layout is deleted. Its three fields map straight across: group name →
`h2`, body → blurb, note → closing note.

**Section header** — flex row, `gap: 16px`, `margin-bottom: 26px`; heading in Source Sans 3
`0.78rem` weight 700, letter-spacing `0.14em`, uppercase, `#1C1917`; count in mono `0.66rem`
`#A8A29E` (`10 of 16`); a Cormorant italic `1.02rem` `#57534E` gloss (`cast by name` /
`the model reaches for them`); then a `flex: 1` `1px #E0DAD4` rule filling the line. Sections are
`margin-bottom: 72px`. **Spells first, then References.** A section with no cards is not rendered —
`dotnet` shows one section, and that is correct, not a degraded state.

The card grid inside a section is unchanged: `repeat(auto-fill, minmax(352px, 1fr))`, `gap: 44px 32px`,
`align-items: start`.

**Card caption** below each card is now the two-digit index within its section plus a fixed
one-liner — `Cast by name` for spells, `Loads itself` for references. The per-card prose hints from
round 1 were mockup commentary; drop them.

## Stack copy (four stacks)

Verbatim, for the content nodes. `umbraco-17`, `umbraco-cloud` and `dotnet` are the upstream divider
text; `Core` is new, since it merges two dividers.

- **Core** — *Sixteen units, installed with the toolkit. Ten spells that make up the workflow chain
  and its configuration, six opinions the toolkit holds about how work should be done.*
  Note: *Spells run only when a person types /&lt;name&gt;. References load themselves when the work
  matches.*
- **umbraco-17** — *Optional pack, pinned to the CMS major. Six references and three spells for
  building and reviewing Umbraco work.* Note: *Pinned to the major, not the minor.*
- **umbraco-cloud** — *Optional pack for Umbraco Deploy. Applies to any licensed install, not only
  Cloud.* Note: *Cloud-only behaviours are marked as such.*
- **dotnet** — *Optional pack for C# and .NET, CMS or not. Three references, no spells.* Note: *It
  applies even when nobody said "C#".*

## The face, revised

This is the only change to the card, and it exists so a grid of sixteen reads as two kinds without a
filter. The reverse already had the right idea — a spell's title in IBM Plex Mono because an
invocation is code, a reference's in Cormorant Garamond because a name is language. That split now
runs on the face too, and typography alone was not enough at a glance in a grid, so it carries on
three axes. No new tokens.

| | Spell | Reference |
|---|---|---|
| **Plane value** | `#101014` (dc-obsidian) — the deepest | `#252530` (dc-charcoal) — one step up |
| **Title** | IBM Plex Mono 500, `1.18rem`, letter-spacing `-0.005em` | Cormorant Garamond 400, `1.72rem`, letter-spacing `-0.012em` |
| **Badge** | filled: `background/border #F0EDE8`, text `#101014` | outlined: transparent, text and `1px` border in the stack accent |
| **Kind rule** | solid, full-bleed `left/right: 21px`, `2px` | short tick, `left: 21px`, `width: 56px`, `1px` |

Both titles are `line-height: 1.18`, centered, `overflow-wrap: break-word`, ink `#F0EDE8`. Both
badges are IBM Plex Mono `0.58rem` weight 500, letter-spacing `0.1em`, uppercase, `padding: 4px 9px`.
Both kind rules sit at `top: 96px` in `rgba(240,237,232,0.28)`.

Three things follow:

1. **The face's plane value now encodes kind, not group.** Round 1 gave each group its own plane. It
   cannot do both, and kind is what needs distinguishing *inside* a stack — the reader already knows
   which stack they opened. This is the design system's own logic: "depth is built through value
   calibration", and a controlled two-step shift carries the read.
2. **Group identity moves entirely to the accent and the sigil** — corner marks, the reverse's top
   rule, the reference badge outline. Unchanged mechanisms, more load.
3. The uppercase letterspaced Source Sans face title from round 1 is **gone**. It was the same for
   both kinds, which is exactly the problem.

`faceValueSplit` is exposed as a prop so the value axis can be turned off (both kinds on `#1A1A1E`)
and the typographic split judged on its own. Default on.

## Sigil assignment at four stacks

All five sigils from round 1 stay in use, none redrawn. Selection is now by **stack + kind**:

| Stack | Spell face | Reference face | Stack face |
|---|---|---|---|
| Core | `sig-spellbook` (rotating double diamond) | `sig-reference` (framed page, mono lines) | `sig-spellbook` |
| umbraco-17 | `sig-umbraco17` | `sig-umbraco17` | `sig-umbraco17` |
| umbraco-cloud | `sig-cloud` | `sig-cloud` | `sig-cloud` |
| dotnet | — (no spells) | `sig-dotnet` | `sig-dotnet` |

Core is the one stack whose two sections get different sigils, which is a bonus of merging the two
Core dividers: the old spellbook/reference sigils become the section marks. The packs use one sigil
for both kinds — plane value, title face, badge and rule already carry kind there.

Accents at four stacks: `Core` `#C23D2E` signal red · `umbraco-17` `#4A6B6E` teal ·
`umbraco-cloud` `#A8A29E` stone · `dotnet` `#B8860B` ochre. Bronze `#8B6B4A` is freed and stays what
it is elsewhere on the site — the link colour and the reverse's footer value.

## Interaction & accessibility

Two nested disclosure layers. Both are **real `<button>` elements**, so keyboard activation,
focus ring and role come from the platform rather than being re-implemented.

### Layer 1 — the stack

- **Element:** the whole stack is one `<button type="button">`. The three depth layers and the face
  are its decorative children (`pointer-events: none` where they would intercept).
- **Activation:** click, `Enter`, `Space`. Wrapped in a `<div role="group" aria-label="Card stacks">`
  so the row announces as a set.
- **`aria-expanded`** on the button, `true` for the open stack. **`aria-controls`** points at the
  panel's id (`stack-panel-<key>`). The panel carries that id.
- **Single-open.** Opening a stack closes the other. Activating the open stack closes it, leaving the
  row alone — that state is worth keeping: it is the "here is the whole toolkit" view, and it is what
  a reader returns to.
- **Focus on open:** stays on the stack button. Do not move it into the panel — the button is
  `aria-expanded`, the panel follows it in DOM order, and a screen reader reaches it with the next
  read. Moving focus would also fight the 250ms reveal.
- **Focus on close:** stays on the stack button that closed it, which is already where it was.
  Never let it fall to `<body>`.
- **Announce the panel** with `aria-live` only if the panel does not immediately follow the button in
  DOM order. In this design it does, so no live region.

### Layer 2 — the card

- **Element:** `<button type="button">` wrapping the flip. **The `perspective` must go on a plain
  `<div>` inside the button, not on the button itself** — a button host flattens the 3D context in
  Chrome, and both faces then render as mirrored 2D layers with `backface-visibility` doing nothing.
  This was hit during build.
- **Activation:** click, `Enter`, `Space`. **`aria-pressed`** reflects the flipped state.
- **`aria-label`** carries the whole affordance, since the visible face changes:
  `"/code-review — Spell card. Activate to turn the card and read its details."` and, when flipped,
  `"… Showing details, activate to show the face."`
- **The hidden face must be `aria-hidden`.** Both faces are in the DOM under
  `backface-visibility: hidden`, which hides them visually and **not** from assistive tech — a
  screen reader otherwise reads the face and the reverse back to back on every card. Toggle
  `aria-hidden` with the flip: `aria-hidden="true"` on the reverse when face-up, on the face when
  flipped. `inert` on the hidden face is a belt-and-braces addition if the browser matrix supports
  it; neither face contains focusable children, so it is not required.
- **Focus on flip:** does not move. The button is the card.
- **`Show all backs`** flips every card in the open stack and its label inverts. It does not move
  focus. Consider `aria-live="polite"` on a short status string if a bulk flip needs announcing.

### Reduced motion

`prefers-reduced-motion: reduce` already forced every sigil to `paused`. It now also:

- sets `animation: none` on the panel reveal, so the panel appears immediately, and
- sets `transition: none` on the flip's inner element, so the card changes face without the 550ms
  `rotateY`. State still changes; the 3D transform still applies, it just is not animated.

The stack lift (`translateY(-8px)`) is a 250ms transition and should be suppressed too if you are
being strict. It is a position change of 8px, so it is the one motion that could reasonably stay.

## URL state

Two levels, one hash. Deep-linkable from a stage, which is the point.

```
#core                      → the Core stack open, all cards face-up
#core/code-review          → the Core stack open, /code-review flipped to its reverse
#                          → all stacks closed, the row alone
```

- Written with `history.replaceState` on open, close and flip — flipping a card should not fill the
  back button with thirty entries.
- Read on load and on `hashchange`, so browser back/forward and a pasted link both work.
- Unknown stack key: ignored, default open state stands. Unknown card id: stack still opens.
- The card id is the unit's own slug (`code-review`, `umbraco-17-planning`) — no separate identifier.
- **A linked card should also scroll into view.** The prototype opens the stack and flips the card
  but does not scroll; add that in production.

If query params are preferred over a hash for the CMS's routing, `?stack=core&card=code-review` maps
one-to-one. A route per stack (`/spell-cards/core`) also works and would be better for site search
and sharing, at the cost of a page load between stacks — worth deciding against how the block is
placed, since the deck is a block and the page around it may not want re-rendering.

## State management (replaces the round-1 section)

Two pieces of client state:

- `open: string | null` — the open stack's key. Initial value is the default-open stack; `null` is
  the all-closed state.
- `flipped: Record<cardId, boolean>` — per-card, and **kept when a stack closes**. Reopening a stack
  restores the cards as the reader left them.

Derived: the stack roster with counts, the open stack's sections, and whether every card in the open
stack is flipped (drives the button label). `group` and `kind` are gone with the chips.

## Content model (replaces the round-1 section)

Discovery settled this: **cards are content nodes and stacks are their container nodes.** The
`spellCardDivider` element type disappears; `group` stops being a property on 30 cards and becomes
position in the tree.

```
Spell Cards            (container / the deck)
├── Core               ← stack node: name, blurb, note, accent, art
│   ├── /explore       ← card nodes, editor tree order = display order
│   └── …
├── umbraco-17         ← stack node
├── umbraco-cloud      ← stack node
└── dotnet             ← stack node (references only)
```

- **Stack node** carries what the divider element type used to: `title`, `blurb`, `note`, plus
  `accent` (a fixed list, not a colour picker) and the art slot. `sigil` is a lookup, not an editor
  field, unless the art slot replaces it.
- **Card node** keeps the round-1 `spellCard` fields **minus `group`** — that is now the parent — and
  minus `captionHint`, which the fixed caption replaced. `kind` (radio: Spell / Reference) stays, and
  it is what sections the grid.
- The deck is a **block** placed on the page, reading `Children<SpellCardStack>()` and each stack's
  `Children<SpellCard>()` — the `latestArticlesRow` pattern already in the repo, two levels deep.
- Section order is fixed in the view (Spells, then References), not editor-controlled. Within a
  section, editor tree order.
- **Adding the Optimizely pack becomes a content operation** — a new stack node — not a schema
  change.
- Cards join the content tree, so they need hiding from navigation and site search. Existing
  precedent: `IsVisible()` and the `search` document type.
- Aliases: prefix the card fields. `content` is a colliding unprefixed alias per
  `umbraco-17-starter-facts`.
- Field caps from `README.md` still bind — the 690px height depends on them.

## Prototype props

Four, all in the Tweaks panel, all design questions rather than production settings except the first:

| Prop | Values | Purpose |
|---|---|---|
| `sigilMotion` | `continuous` (default) · `hover` · `off` | Unchanged from round 1. Intended as a real CMS setting. |
| `stackCount` | `four` (default) · `five` | See *Stack count* above. Not a production setting — pick one. |
| `faceValueSplit` | `true` (default) · `false` | Turns the plane-value axis of the face split off, to judge the typographic split alone. Not a production setting. |
| `frontArt` | `sigil` (default) · `monogram` · `placeholder` | Inspect the art slot's three states on both stack faces and card faces. |

## What did not change

The card box and its 690px height, the flip mechanic and its 550ms curve, the entire reverse layout
and field order, every token, the type system, radius 0, the single shadow, both transition speeds,
the five sigils and the `--sig-play` gating mechanism with all three cascade traps, and the
`prefers-reduced-motion` behaviour. **Scale-on-flip was not reintroduced.**
