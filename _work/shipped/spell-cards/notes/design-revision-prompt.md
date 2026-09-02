# Design-revision prompt — spell cards, round 2

Produced by `/explore` on 2026-08-31. Feed the section below to Claude Design alongside the existing
`Spell Cards.dc.html` prototype and its README handoff. Everything above the rule is context for us;
everything below it is the prompt.

---

## Prompt

You previously produced a high-fidelity design reference for the Cantrip **spell cards** — a flip-card
deck documenting the toolkit — delivered as `Spell Cards.dc.html` with a README handoff. We have now run
discovery on it. **The card itself is validated and should not change. What changes is everything above
the card: how the deck is organized.** Please revise the design reference accordingly.

### What is settled and must carry over unchanged

Treat these as fixed. Do not redesign, re-derive, or "improve" them:

- **The card box.** Fixed width (grid column, min 352px) and fixed **690px** height. The height exists to
  accommodate the content at the narrowest column — it is derived, not arbitrary. Do not shrink it, do
  not make the reverse scroll, and do not introduce differently-sized faces.
- **The flip mechanic.** `rotateY` 0 → 180deg, 550ms `cubic-bezier(.4,0,.2,1)`, both faces sharing one
  box under `backface-visibility: hidden`.
- **The reverse layout** in full — header row with kind badge and group name, title, subtitle, the
  1px-gap stat grid, Does, Modes, Watch for, footer. Field order and treatment stay as specified.
- **All design tokens**, the type system (Cormorant Garamond / Source Sans 3 / IBM Plex Mono, 18px base),
  radius 0 everywhere, the single shadow value, and the two transition speeds.
- **The five group sigils** and the whole `--sig-play` animation-gating mechanism, including the three
  documented cascade traps and `prefers-reduced-motion` behaviour.

**We explicitly rejected scale-on-flip** (small faces that grow to full size on reveal). A `rotateY`
flip requires both faces to share one box, so differing sizes means cross-fading and scaling rather
than flipping — which either distorts the reverse's type or reflows the grid mid-interaction. Do not
reintroduce it.

### The problem discovery found

The prototype hard-codes 6 cards + 5 dividers = **11 items**. Production is **30 units + 5 dividers = 40
items**. At `minmax(352px, 1fr)` inside the 1400px container the grid resolves to 3 columns and each row
costs ~755px, so 40 items is 14 rows — **roughly a 10,000px page, about ten screens.**

The pain this deck exists to relieve is *volume and intimidation*: newcomers bounce off Cantrip's long
README because the volume lands before the payoff. A ten-screen wall of dense stat blocks reproduces
that same feeling in a new medium. **The cure inherits the disease.** The flat filterable grid does not
survive contact with the real card count.

### The new organizing model: stacks

Replace the flat grid-plus-filter-chips index with a **stack** model.

- The deck presents **one stack per pack**, all visible on a single screen — this is what makes the
  toolkit read as finite. Five stacks (or four; see the open question below) is a glanceable whole in a
  way that 40 cards is not.
- **Opening a stack reveals that stack's cards as a grid.** Prefer a grid over a carousel: the largest
  stack is small enough to show completely, and seeing all of a stack's cards at once is the point.
- A stack should *look* like a stack — suggest physical depth, several cards resting under the top one.
  The metaphor is deliberate and doubly apt: in this domain a "stack" is both a technology stack and a
  stack of cards.
- **Only one stack need be open at a time**, and the deck should land with a stack already open rather
  than showing everything at once. Which stack opens by default is our decision, not yours — but design
  for that resting state, not for an all-expanded state.

**The stack face absorbs the divider cards.** The design currently has five "deck divider" cards that sit
awkwardly interleaved in the card grid. Their content — group name, a paragraph on what the area is, a
closing note — is *already exactly* what a stack face needs. Fold them in: the divider becomes the
stack, not a card within it. The divider-as-card treatment should disappear entirely.

Note the design README anticipated replacing the divider monograms (`CS` / `CR` / `17` / `UC` / `.N`)
with commissioned SVG art. Keep a slot for that on the stack face, with the monogram as the fallback
when no art is set.

### Differentiating spells from references on the face

Every stack's card grid should be **sectioned — spells with spells, references with references** — under
light section headings. We are dropping the `Kind` filter chips entirely: always-visible differentiation
beats a mode the reader has to select, and one stack (`dotnet`) has only reference cards, so it simply
renders a single section.

For this to work, the **face** must distinguish a spell from a reference at a glance in a grid. It
currently does not: both use Source Sans for the name, with kind demoted to a 0.6rem mono line
underneath.

**The design already has the right idea — it is just only applied to the reverse.** There, spells get a
dark-filled badge and their title in **IBM Plex Mono** (an invocation is code), while references get an
accent-outlined badge and their title in **Cormorant Garamond** (a name is language). That code-vs-
language split is a real idea, not decoration. **Extend it to the face** rather than inventing a new
signal — and go further than typography alone if the grid still reads as undifferentiated at a glance,
staying within the existing token set and the one-signal-red-per-composition rule.

### Growth

The card count is not the growth axis — **packs are.** An Optimizely pack is expected, and others after
it. Design the stack row so adding a sixth, seventh, or eighth stack is graceful rather than a
re-layout. Note the packs are very uneven in size (currently 10 / 6 / 9 / 2 / 3 cards), so a stack of two
must still read as a stack.

### Interaction and accessibility

There are now **two nested disclosure layers** — opening a stack, and flipping a card — and the previous
prototype handled click only. Please specify, for both layers:

- the keyboard affordance and activation, and what element carries it
- focus management on open, close, and flip (including where focus goes when a stack closes)
- `aria-expanded` / `aria-controls` relationships
- what assistive tech should encounter given **both card faces are in the DOM** under
  `backface-visibility: hidden` — a screen reader will read both unless the hidden face is managed
- how the existing `prefers-reduced-motion` handling extends to the stack-open transition

Also indicate how the two layers should behave as **URL state**, since we want a stack — and possibly an
individual card — to be linkable. We may share this from a conference stage.

### One open question we have not settled

**Four stacks or five?** The existing taxonomy has five groups (Core spellbook, Core reference,
umbraco-17, umbraco-cloud, dotnet). But the *installable* units are four packs (`core`, `umbraco-17`,
`umbraco-cloud`, `dotnet`), and sectioning every stack into Spells and References dissolves the
spellbook/reference distinction — which would make Core a single stack of 16 cards with two sections.

Four aligns with what a person actually installs, which is the basis for stacks-as-segmentation in the
first place. **Please design primarily for four**, but flag anything that breaks or reads badly at five,
and note how the largest stack behaves at 16 cards rather than 10.

### What to deliver

1. A revised `Spell Cards.dc.html` design reference showing: the resting stack view, a stack opened with
   its sectioned card grid, and the face treatment differentiating spells from references. Populate with
   enough real content to test the layout at true scale — the full stack roster and at least one stack
   filled to its real card count, not a six-card sample. Card counts per stack are 10 / 6 / 9 / 2 / 3 at
   five stacks, or 16 / 9 / 2 / 3 at four.
2. An updated handoff README covering only what changed, in the same style as the original — including
   any newly derived measurements, the interaction and accessibility specification above, and any new
   tokens needed (prefer existing ones).

Keep the same design language throughout. The intent is a **revision of the organizing layer**, not a new
design — someone who saw the first prototype should recognize this immediately as the same deck, better
arranged.
