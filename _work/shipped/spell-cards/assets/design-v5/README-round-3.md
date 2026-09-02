# Handoff: Cantrip spell cards — round 3 (selection, depth, colour, sigils)

Read `README.md` then `README-round-2.md` first. Both remain accurate except where this document
says otherwise. Round 3 changes four things: how a **selected stack** reads, how the **deck depth**
reads, how **pack colour** is distributed, and the **sigil system** — which is now one sigil per
spell plus a single shared reference sigil.

**Sections this replaces:** round 2's *The stack* (layer table and accent bar), *Sigil assignment at
four stacks* (entirely), and the *Kind rule* row of the face table. Round 2's *Prototype props* table
gains two entries.

---

## 1. Selection carries all the colour and all the motion

The problem: with the panel below the fold, nothing on screen said which stack was open. An 8px lift
and a 5px base rule read as a layout bug rather than a state.

The open stack is now the only stack with an accent, the only one whose sigil is at full ink, and the
only one whose sigil moves. Five signals, all on the same element:

| | Open stack | Closed stack |
|---|---|---|
| Top strip | `24px` full-width band in `accentInk`, mono `0.55rem`/500, letter-spacing `0.2em`, uppercase `Open`, text in `onAccent` | none |
| Corner mark | `22×22`, `3px`, `accentDark`, dropped to `top: 35px` to clear the strip | `22×22`, `1px`, `rgba(240,237,232,0.28)`, at `top: 11px` |
| Base rule | `6px`, solid `accentInk` | `1px`, `rgba(240,237,232,0.28)` |
| Pointer | accent triangle below the stack: `11px` half-width, `13px` tall, `bottom: -15px`, centered, `opacity 1` | same element at `opacity 0`, `transition: opacity 200ms ease` |
| Sigil | `color: accentDark`, full ink structure, animated per `sigilMotion` | `color: #9A948D`, `opacity: 0.5`, **animation paused** (`motion-off` regardless of the prop) |
| Plane | `#101014`, `box-shadow: 0 14px 30px rgba(28,25,23,0.30)` | `#1A1A1E`, ink `#B5AFA8`, `box-shadow: 0 3px 10px rgba(28,25,23,0.16)` |
| Lift | `translateY(-14px)` | `0`; hover still lifts `-8px` |
| Inner frame | `top: 35px` (clears the strip), otherwise `11px` | `inset: 11px` |

Closed stacks also take `opacity: 0.92` when `dimUnselected` is on. Deliberately shallow: a heavier
dim turned the near-black plane into flat grey against the warm page and lost the Dark Constructivism
value range. If you want the dim gone entirely, the prop turns it off.

The panel's `margin-top` dropped from `46px` to `26px`, and the pointer sits in that gap, so the
open stack visually attaches to the panel it controls.

**Production note.** A linked or clicked stack still does not scroll the panel into view. With the
pointer and the strip the connection survives an off-screen panel better than before, but scroll-on-
open remains the right behaviour and is still unimplemented (see round 2, *URL state*).

---

## 2. Deck depth: paper edges, not more near-black

Round 2 built the stack from three near-black planes (`#202026` / `#1A1A1E` / `#101014`). Against the
warm page they collapsed into one flat geometric shape — the 2% luminance calibration that works
*inside* a dark composition does not survive being a 224px object on `#FFFCF9`.

The two layers beneath the top card are now **page edges**, warm and light, which is what a real deck
shows. Offsets step down-and-right in 5px increments:

| Layer | Inset | Background | Border |
|---|---|---|---|
| edge 3 (furthest) | `left/top: 15px; right/bottom: 0` | `#D5CCC1` | `1px solid rgba(28,25,23,0.22)` |
| edge 2 | `left/top: 10px; right/bottom: 5px` | `#E3DBD1` | `1px solid rgba(28,25,23,0.22)` |
| edge 1 | `left/top: 5px; right/bottom: 10px` | `#EFE8E0` | `1px solid rgba(28,25,23,0.22)` |
| top card | `left/top: 0; right/bottom: 15px` | `#101014` open / `#1A1A1E` closed | none; shadow per the table above |

Three edges rather than two: at three the stack reads as *several* cards, which is the motif's job.
Still no quantity read — a two-card stack and a sixteen-card stack show the same three edges, and the
count is stated in words.

The `deckEdge` prop switches the edges back to dark planes (`#2D2D38` / `#252530` / `#1E1E24`, light
hairlines) if you want the round-2 treatment side by side. Paper is the default and the
recommendation.

---

## 3. Pack colour: signal red belongs to Core alone

Every sigil previously carried `#C23D2E` in its animated accent shape, whatever the pack, so four
accents read as one. The accent shape now takes the pack's colour.

Each pack carries **three values of one identity**, because the same hue cannot serve a near-black
plane, the warm page, and text sitting on the accent itself:

| Pack | `accentInk` (on `#FFFCF9`) | `accentDark` (on `#101014`) | `onAccent` |
|---|---|---|---|
| Core | `#C23D2E` signal red | `#E0674E` | `#FFFCF9` |
| umbraco-17 | `#4A6B6E` teal | `#7FAFB3` | `#FFFCF9` |
| umbraco-cloud | `#6E6A62` stone | `#BDB6AC` | `#FFFCF9` |
| dotnet | `#8B6B4A` bronze | `#C39A6B` | `#FFFCF9` |
| Core spellbook / Core reference (five-stack mode) | as Core / as dotnet | | |

**Two accents changed.** `umbraco-cloud` was `#A8A29E`, which is 2.3:1 on the page — it failed as
text and as a 1px border on every reverse side that used it. `dotnet` was `#B8860B` ochre, which is
not in the design system; it becomes the system's bronze. Bronze is therefore no longer "freed" as
round 2 had it — it is dotnet's accent and remains the link colour, which is consistent, both being
warm-page marks.

Where each value is used:

- `accentInk` — the open stack's strip, base rule and pointer; the panel's `44×2px` rule; the
  reverse's `3px` top border, its outlined reference badge, and the *Watch for* left rule and label
  (previously hardcoded signal red on all four packs).
- `accentDark` — the card face's two corner marks, the face's outlined reference badge, and the
  sigil's accent shape.
- `onAccent` — the `Open` strip's text only.

All `accentInk` values clear 4.5:1 on `#FFFCF9`; all `accentDark` values clear 4.5:1 on `#101014`.
The one-saturated-accent-per-composition rule holds: the accent is a single shape inside a sigil
otherwise drawn in `#F0EDE8`, not a tint over the whole mark.

---

## 4. Sigils: one per spell, one for all references

### The rule

- **Every reference in every pack shares `#sig-tome`.** Static, no accent shape, drawn entirely in
  `#F0EDE8` at `opacity: 0.78`. It signifies *reference / tome of knowledge*, not a pack and not a
  spell. Round 2's per-stack reference sigils (and Core's separate reference sigil) are gone.
- **Every spell has its own sigil**, drawn from what the spell does, animated, with one accent shape
  in the pack's `accentDark`.
- **Stack faces keep the pack sigils** — `sig-spellbook`, `sig-umbraco17`, `sig-cloud`, `sig-dotnet`,
  plus `sig-reference` for `Core reference` in five-stack mode. These are the round-1 drawings,
  unchanged except for the colour mechanism below.

The kind read on a card face is now: sigil (tome vs. drawn spell mark), plane value, title typeface,
badge treatment. Four axes, of which the sigil is legible first and from furthest away.

### The fourteen spell sigils

All `viewBox="0 0 120 120"`, rendered at `132×132` on the card face. Structure in `#F0EDE8` with
`stroke-width: 1.6` (`2.2`–`2.4` for a load-bearing line), one accent shape per mark.

| Spell | Sigil | Figure | Motion |
|---|---|---|---|
| `/explore` | `sig-explore` | open axis frame, widening diagonal, three probe squares | diagonal draws; squares blink in sequence; accent square pulses |
| `/spec` | `sig-spec` | framed document, ruled band, four text lines | lines scan in; accent bar slides |
| `/plan` | `sig-plan` | four ascending steps | step markers blink in order; accent square drifts |
| `/implement-step` | `sig-implement-step` | isolation brackets around one step | centre rule draws; accent block slides through |
| `/feature` | `sig-feature` | three interlocking planes forming a whole | overlap plane fades; accent square pulses |
| `/code-review` | `sig-code-review` | viewport frame, rotating inner square, findings | four finding lines scan; accent square pulses |
| `/commit-message` | `sig-commit-message` | commit spine with two branches | lower branch draws; nodes blink; accent node pulses |
| `/retrofit` | `sig-retrofit` | rectilinear loop back to the spine | loop draws; accent wedge drifts |
| `/setup` | `sig-setup` | 3×3 slot grid | two slots blink; accent centre slot pulses |
| `/update-toolkit` | `sig-update-toolkit` | nested squares inside a guard | squares counter-rotate; accent tab drifts |
| `/block` | `sig-block` | two units plus a registered palette entry | base rule draws; unit blinks; accent entry pulses |
| `/guide` | `sig-guide` | two-column page | six lines scan; accent pointer slides |
| `/umbraco-edit` | `sig-umbraco-edit` | nib over a field | field rule draws; accent nib tip drifts |
| `/check-uda` | `sig-check-uda` | two offset artifacts, diff diagonal | diagonal draws; three lines scan; accent square pulses |

Motion classes are the round-1 set (`sig-draw`, `sig-pulse`, `sig-blink`, `sig-slide`, `sig-drift`,
`sig-scan`, `sig-spin`, `sig-spin-rev`, `sig-fade`, `sig-trace`) with the `--sig-play` gate and all
three cascade traps documented in `README.md` — unchanged, and still the only motion in the design.
References render with `motion-off`, so `sigilMotion` has no effect on them.

### Colour mechanism — read this before editing a symbol

Sigils are one `<symbol>` sprite consumed by `<svg><use href="#sig-x">`. A `<use>` shadow tree
inherits `color` from the host, so **`currentColor` is the accent channel**:

- structure and texture are the **literal** `#F0EDE8` (with `stroke-opacity` / `fill-opacity`
  variants), never `currentColor`;
- the single accent shape is `fill="currentColor"`;
- the consuming `<svg>` sets `style="color: <accentDark>"`, and for a dimmed or reference mark sets
  `opacity` instead.

**Two approaches that do not work here** and cost time in build:

1. `--sig-accent` as a CSS custom property on the consuming `<svg>` — the value resolves on the
   `<svg>` (verified in DevTools) but does **not** reach the `<use>` shadow tree, so the shape falls
   back to its literal default. Same result whether the property is set inline or by a class rule.
2. `fill` on the consuming `<svg>`, with the accent shape inheriting it — applies to the `<svg>`,
   does not reach the shadow tree either.

Only `color` / `currentColor` crosses. If a second accent colour per sigil is ever needed, it needs a
second `<symbol>` and a second stacked `<use>` with its own `color`, not a custom property.

**Verification caveat.** Both the flip and `currentColor` tinting render incorrectly in DOM-cloning
screenshot tools (backs appear mirrored and face-up; accent shapes appear black). Judge both in a
real browser, not from a captured image.

---

## 5. The face rule is gone

Round 2's fourth kind signal — a full-bleed `2px` rule for spells, a `56px` tick for references, both
at `top: 96px` — read as an unexplained horizontal line rather than a signal, and it is redundant now
that the sigil carries kind. Removed from both kinds. The rest of the face table in round 2 stands:
plane value, title typeface, badge treatment.

---

## 6. Prototype props (replaces round 2's table)

| Prop | Values | Purpose |
|---|---|---|
| `stackCount` | `four` (default) · `five` | Round 2, unchanged. Not a production setting. |
| `dimUnselected` | `true` (default) · `false` | Whether closed stacks take `opacity: 0.92`. Design question. |
| `deckEdge` | `paper` (default) · `dark` | Page-edge layers vs. round 2's dark planes. Design question. |
| `faceValueSplit` | `true` (default) · `false` | Round 2, unchanged. |
| `sigilMotion` | `continuous` (default) · `hover` · `off` | Round 1. Intended as a real CMS setting. Applies to spells and the open stack only. |
| `frontArt` | `sigil` (default) · `monogram` · `placeholder` | Round 1, unchanged. |

---

## 7. Content-model consequences

Small, and all in the direction of less editor freedom:

- **`sigil` is a lookup, not a field.** A spell's sigil is keyed by its own slug
  (`SPELL_SIGILS[u.id]`), a reference's is fixed, a stack's is keyed by pack. Nothing to author, and
  a new spell without a drawn sigil falls back to its pack sigil rather than rendering empty.
- **A new spell needs a new sigil** — an SVG symbol commission, not a content operation. Fourteen
  exist; the roster is expected to be stable. A new *pack* is still purely content plus one pack
  sigil and an accent.
- **`accent` stays a fixed list**, and the list item is now a triple (`accentInk`, `accentDark`,
  `onAccent`), not one hex. Do not expose a colour picker: two of the three values exist to hold
  contrast on a specific background.

## What did not change

The card box and its 690px height, the flip and its 550ms curve, the entire reverse layout and field
order, the type system, radius 0, both transition speeds, the panel reveal, the two-level disclosure
and its ARIA contract, the URL state, `prefers-reduced-motion` behaviour, and the sectioning of every
stack into Spells then References.
