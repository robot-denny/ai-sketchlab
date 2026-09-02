# Handoff: Cantrip spell cards — round 4 (responsive)

Read `README.md`, `README-round-2.md`, `README-round-3.md` first. All remain accurate. Round 4 makes
the live prototype fluid and adds one companion file, `Spell Cards Narrow.dc.html` — static reference
frames at real phone widths, plus a reflow-rules table. Read the frames file alongside this note; this
note explains the mechanism, the frames show the result.

## Mechanism

Almost none of this is a media query. Tiles and cards hold a **ratio**, not a fixed height
(`aspect-ratio: 224 / 404` for the stack tile, `352 / 690` for the card), and each is a **CSS
containment context** (`container-type: inline-size`) sized off its own rendered width via `cqi`
units — so a component scales the same way whether it sits in a four-up desktop row or a one-up phone
column, with no viewport check anywhere in its own styles.

Two caps stop the fluid rule from overshooting the approved design sizes:

- **The stack tile** carries `max-width: 224px` — its own design maximum — so a stretched grid
  column (the two-up range around 560–760px, before four columns fit) cannot inflate it past 224px.
  `justify-self: start` keeps it left-aligned in a track wider than itself rather than centered with
  dead space on both sides.
- **The card** carries `max-width: 352px` on both the flip wrapper and its `<sc-for>` list item — a
  stretched grid column cannot grow the card past its 690px design height either. The ratio can only
  ever shrink the card, never grow it.

**The one real media query**: root font-size drops from 18px to 17px below a 400px viewport, which
pulls every rem-based step in the design down with it without touching a single component.

## What changed, by area

| Area | Before | Now |
|---|---|---|
| Stack row | `flex-wrap`, fixed 224×404 tiles | `grid-template-columns: repeat(auto-fit, minmax(min(176px, 45%), 1fr))`, capped at the row's own natural width so four stacks never stretch past 224px tiles |
| Stack tile | fixed `width:224px;height:404px` | `aspect-ratio:224/404`, `max-width:224px`, `container-type:inline-size`; every interior offset (deck edges, padding, sigil size, corner marks, open strip, base rule, pointer) is `clamp(min, N cqi, max)`, the design value at 224px, flooring out at the narrowest tile |
| Card grid | `repeat(auto-fill, minmax(352px, 1fr))` | `minmax(min(352px, 100%), 1fr)` — was already correct for one-column collapse; unchanged in effect |
| Card | fixed `height:690px` | `aspect-ratio:352/690`, `max-width:352px` on the flip wrapper and its list-item, `container-type:inline-size`; every interior offset is a `cqi` clamp the same way |
| Reverse stat grid | fixed `1fr 1fr` | `repeat(auto-fit, minmax(min(130px, 100%), 1fr))` — falls to one column under a ~261px card |
| Panel header | `flex-wrap`, count+buttons pinned right | count+buttons wrap onto their own row under the label at narrow widths; the "Turn all cards" / "Close" buttons keep a 44px minimum hit height at every width |
| Page gutter | fixed `64px 40px` | `clamp(36px, 7vw, 64px) clamp(16px, 5vw, 40px)` |

## Why a percentage floor, not a pixel floor, on the stack row

`minmax(min(176px, 45%), 1fr)` — the floor is `45%` of the row, not a flat `176px`. A flat pixel floor
plus the row's gap cannot fit two columns inside a phone gutter (176 + 26 + 176 exceeds the ~290–350px
of content width left after the page padding), so the row would go one-up on every phone — worse than
before, and against the round-3 reference's own "two columns, always" rule. The percentage floor drops
with the container, so two columns fit at every width down to 320px, while the cap on the row's own
`max-width` (four tile-widths plus their gaps) keeps the desktop row from stretching past 224px tiles
in the first place.

## Companion file: `Spell Cards Narrow.dc.html`

Four static frames at real pixel widths (390 roster, 390 Core open, 390 turned card, 320 narrowest)
plus a reflow-rules table, built to match the live prototype's actual data (4 stacks · 30 cards; Core
16, umbraco-17 9, umbraco-cloud 2, dotnet 3). Not a live breakpoint demo — a fixed reference to
measure the built prototype against. If the roster changes, regenerate the counts in this file from
the prototype rather than hand-editing them; the two drifted apart once already in this round.

## What did not change

Everything not named above: the flip mechanics and 550ms curve, the selection signals from round 3,
the paper-edge deck, the pack accent triples, all fourteen spell sigils and the shared tome, the type
system, radius 0, the URL state, and `prefers-reduced-motion` behaviour.

## Still open

Scroll-on-open remains unimplemented and matters more at narrow widths, where an open stack's panel
sits closer to the fold. Sixteen cards in one column (Core, phone width) is a long scroll — a
per-section collapse was flagged in round 3 and is still undecided.
