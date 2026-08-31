# Discovery: Cantrip spell cards

_Discovery input for `/spec` — produced by `/explore` on 2026-08-31. Scope: lightweight._

Prior art in this bundle: `assets/` holds the design reference (`Spell Cards.dc.html`, its README
handoff, and the token sheet). Card content is drafted upstream at
[`cantrip/docs/spell-cards.md`](https://raw.githubusercontent.com/robot-denny/cantrip/main/docs/spell-cards.md)
— 30 units (14 spells, 16 references) plus 5 deck dividers, written against cantrip `1df963f`.
The design-revision prompt produced by this discovery is at `notes/design-revision-prompt.md`.

## Problem framing

**Who is affected.** Three audiences, in priority order: Diagram teammates adopting Cantrip;
attendees of an upcoming conference talk on Cantrip; people who find the project on their own.

**What the current situation costs.** Cantrip's capabilities are discoverable only by reading a long
README — and, for a substantial share of them, by opening the skill files themselves. Capabilities
exist that the README never mentions. Volume compounds a conceptual gap: the team's working model is
"prompt the agent, get code back," while Cantrip asks them to adopt named stages with artifacts handed
between them. The README opens with setup and taxonomy (skills, spells, packs), so the volume lands
before the payoff does, and people stop.

**Worth keeping.** The README remains the setup and reference document. The deck does not replace it,
and is not a second place to maintain the same prose.

**Observed, not assumed.** Direct observation of teammates plus their verbal feedback. The originating
analogy is D&D spell cards: a player has the full rulebook, but on their turn they cannot recall what
they have, what it does, or when to use it — so they reach for a card.

**Explicitly not this deck's job.**
- *Closing the conceptual gap.* Carried by pairing, other repo docs, the
  [existing blog post](https://ai-sketchlab.dev/blog/an-agentic-development-toolkit-for-cross-functional-teams/)
  (itself due an update), and the conference talk. A reference deck structurally cannot teach a
  paradigm — every card presupposes the frame.
- *Selling Cantrip.* A separate promotional landing page is planned and out of scope here. This is the
  **spellbook page**.

**The problem in one sentence.** Cantrip's capabilities can only be found by reading a long README or
the skill files themselves, so a newcomer cannot answer "what can I do?" — and the volume makes them
stop trying.

## Outcomes sought

- A newcomer can answer **"what can I do?"** from one surface, and re-find the answer later — the
  cheat-sheet job, not the tutorial job.
- The toolkit reads as **finite and bounded** rather than endless.
- Capabilities currently buried in skill files become visible without opening source.
- **How we would know:** teammates reach for the deck instead of the README when asking what is
  available, and a conference audience can browse it unaided.

## Options considered

### 1. Keeping 35 cards true (content maintenance)

The upstream content doc convicts itself: *"The deck is a snapshot: a new spell or reference means a
missing card, and nothing here will notice."* Evidence is strong — that doc was written 2026-08-31 and
already flags `/styleguide` as in flight; in a single session cantrip gained `tdd-principles`,
`/guide`, `/setup`, and three packs.

- **(a) Hand-author, manual governance.** Ships fastest, editors in full control. Worse at: drifts
  silently and permanently.
- **(b) Generate from cantrip frontmatter.** *Not possible today* — frontmatter carries only `name` and
  `description`. The card's best fields (`Cast`, `Needs`, `Leaves`, `Watch for`, `Then`) exist nowhere
  machine-readable; they were hand-derived by an agent reading each unit.
- **(c) Hand-author plus a drift check** against cantrip's unit roster. Cheap; catches the missing 31st
  card. Worse at: another thing to maintain. Note a detector must read *cantrip's repo*, not this
  repo's `skills-lock.json` — the deck documents Cantrip the product, and includes units not installed
  here (`/setup`, `/guide`, the `dotnet` pack).
- **(d) Cantrip ships structured card data** the site imports. The durable answer, but upstream work
  and the wrong shape for a date-bound deliverable.

**Chosen: (a) for this increment**, populated via MCP / Management API from the generated markdown.
Drift detection explicitly deferred to a future increment; (d) noted as the long-term answer, and it
belongs upstream in cantrip rather than here.

### 2. Where card records live

- **Nested element types** — `spellCardDeck` block containing a block list of `spellCard`, per the
  design README. Precedent: `imageCarouselRow` → `imageCarouselSlide`.
- **Content nodes queried by a block.** Precedent already in this repo: `latestArticlesRow` doing
  `row.ArticleList.Children<Article>()`.

**Chosen: content nodes.** Reasons: MCP population becomes many small retryable creates rather than one
enormous nested property value regenerated on every edit; it sidesteps the known copilot ceiling where
`set_value` replaces a whole property value and silently aborts on large ones; the planned promo page
can reference the same cards instead of copying them (site-internal drift would be worse than the
cantrip drift being deferred); and a list view is a better manual-governance surface than one long
block list. Worse at: more schema up front, and cards join the content tree, so they need hiding from
navigation and site search.

### 3. How the deck is partitioned

- **One deck, packs as a filter facet** (the prototype's model).
- **One deck per pack.** Rejected: makes all five divider cards redundant, splits the finiteness win
  across five pages, and kills cross-cutting lookup. The packs are also wildly uneven (10 / 6 / 9 / 2 / 3).

**Chosen: one deck concept**, with the deck as a *block* so it can sit on the spellbook page now and a
curated variant on the promo page later.

### 4. First impression at real scale — the decisive one

The prototype hard-codes 6 cards + 5 dividers = 11 items. Production is 40. At `minmax(352px, 1fr)`
inside a 1400px container the grid resolves to 3 columns, and each row costs ~755px — so 40 items is
14 rows, roughly **a 10,000px page**. The framed pain is *volume and intimidation*; a ten-screen wall
of dense stat blocks risks reproducing it in a new medium.

- **(a) Accept the wall,** filtering as mitigation. Worse at: the first impression *is* the wall, and
  that is what a conference audience gets.
- **(b) Land pre-filtered.** Near-zero cost, design untouched.
- **(c) Shrink the card / scroll the reverse.** Rejected — the 690px height exists to accommodate the
  content, and this fights a design already declared final.
- **(d) Dense index expanding cards on demand.** Real redesign; discards the prototype's validated core.
- **(e) Scale-on-flip** — small faces that scale up to full size on reveal. Rejected: a `rotateY` flip
  requires both faces to share one box, so differing sizes means cross-fade-and-scale rather than a
  flip, which either distorts the reverse's type or reflows the grid mid-interaction. It also spends
  front-end budget on the one part of the prototype that is already validated.
- **(f) The stack motif.** Show a stack per pack; opening a stack reveals that stack's card grid.

**Chosen: (f), with (b) as its natural consequence.** More front-end prototyping, accepted knowingly.

### 5. The spells-vs-references axis

- **A `Kind` filter** (the prototype's second chip group).
- **Always-visible differentiation plus within-stack grouping** — spells sectioned with spells,
  references with references, in every stack's grid.

**Chosen: the latter.** Always-visible beats a mode you must select, and it degrades gracefully for
`dotnet`, which has only reference cards — that stack simply renders one section. The design already
encodes the distinction on the *reverse* (spells: dark badge, title in IBM Plex Mono, because an
invocation is code; references: outlined badge, title in Cormorant Garamond, because a name is
language) but only weakly on the *face*, where both use Source Sans with kind demoted to a 0.6rem mono
line. Extending the existing code-vs-language type split to the face follows the design's own logic
rather than inventing a new signal.

## Trade-offs & second-order effects

**The decisive trade-off.** The stack motif costs meaningfully more front-end work — two view states,
transitions, and two nested interaction layers (open a stack, flip a card) — and roughly doubles the
accessibility surface, since each layer is a disclosure needing focus management and announcement. In
exchange it delivers the framed outcome that a filter bar cannot: five stacks on one screen genuinely
*is* "here is the whole toolkit," and it is true to the originating D&D framing.

**Stacks are audience segmentation, not taxonomy.** Packs are tech-stack specific, and the roster will
grow (an Optimizely pack is expected). Someone on an Optimizely project has no reason to open the
umbraco stacks. So the growth axis is *packs*, not cards — and a row of stacks scales along exactly
that axis, where a flat filtered grid degrades. The metaphor is doubly apt: a stack is both a tech
stack and a stack of cards.

**The design has a spare part the stack motif absorbs.** The five divider cards are currently odd
interlopers in a card grid; as stack faces they become the primary navigation, and their existing
content (group name, what the area is, a closing note) is already exactly that shape.

**The content model gets simpler, not more complex.** Combining cards-as-nodes with stacks-as-motif and
packs-that-grow: the **stack becomes the container node**, and `group` stops being a property at all —
it is position in the tree.

```
Spell Cards            (container)
├── Core …             ← stack node: divider content + accent + sigil
│   ├── /explore       ← card nodes
│   └── …
├── umbraco-17         ← stack node
└── dotnet             ← stack node (references only)
```

Consequences: the `spellCardDivider` element type disappears; the 5-value `group` dropdown disappears
from all 30 cards, along with every chance an editor picks the wrong one; accent and sigil are set once
per stack instead of looked up 30 times; **adding the Optimizely pack becomes a content operation**
rather than a schema change and redeploy; MCP population is a clean two-level walk; and per-stack sort
order is editor-controlled tree order, free. Worse at: a card lives in exactly one stack (true of the
domain today, but it forecloses a card appearing in two), and the view walks two tree levels.

**The stack shell is separable from the card.** It sits above a card component that does not change, so
card + deck could ship first with stacks as a fast follow if the conference date tightens. Worth
holding as a de-risking option even if the preference is to build it whole.

**Knock-on benefit for the promo page.** A row of stacks is a considerably better marketing object than
a card grid, so the work serves the out-of-scope page too.

## Direction

**Chosen.** A **stack-based spellbook deck**: one stack per pack, each stack opening to reveal a card
grid sectioned into Spells and References. Cards are **content nodes**; **stack nodes are their
containers** and carry what were the divider cards. The deck is a **block**, so the spellbook page
places it now and the promo page can place a curated variant later. The prototype's card — its box,
690px height, flip mechanic, reverse layout, tokens, and sigil animation gating — is treated as
validated and carried over unchanged; **organization above the card is what changes.** Content is
hand-authored via MCP / Management API from the upstream markdown, with manual governance and drift
detection explicitly deferred.

Work type is **new-capability**, so it earns a new `_features/` capability doc.

## Open questions for /spec

1. **Four stacks or five?** The prototype's taxonomy has five groups (Core spellbook, Core reference,
   umbraco-17, umbraco-cloud, dotnet) and five dividers. But the *installable* units are four packs
   (`core`, `umbraco-17`, `umbraco-cloud`, `dotnet`), and the decision to section every stack into
   Spells and References dissolves the spellbook/reference split — making Core one stack of 16 with two
   sections. Four stacks align with what a person actually installs, which is also the stated basis for
   stacks-as-segmentation. **This fork was created by the last two decisions and is genuinely open** —
   it changes the stack count, the divider content, and the largest stack size (16 vs 10).
2. **How does a stack open?** In-place expansion, or a route per stack? This decides deep-linking and
   materially changes the accessibility work.
3. **Deep-linkable URLs** — in scope, or deferred? Landing pre-filtered makes linkability close to
   mandatory rather than a nice-to-have, especially for sharing from a stage.
4. **Field caps.** The 690px height is derived from the tallest reverse and holds only if the source
   doc's caps hold (`Cast`/`Triggers`/`Needs`/`Leaves` one line, `Does` ≤40 words, `Modes` ≤2 lines,
   `Watch for` one line). Enforce with `maxLength`, or make the height derivation dynamic?
5. **Card art.** The face art is currently five group sigils selected by lookup. The brief asks for
   "geometric art and/or uploadable image," and the design README wants a media picker for stack art
   with the monogram as fallback. **Security:** to inherit `currentColor` and the `--sig-play` gate an
   SVG must be *inlined*, not `<img>`-referenced — so editor-uploaded SVG becomes a stored-XSS surface
   needing sanitization. Decide whether the art slot is in this increment at all.
6. **Accessibility contract for two nested disclosures.** Both card faces are in the DOM under
   `backface-visibility: hidden`, so assistive tech reads both unless managed. Add stack-open on top and
   there are two layers to get right. The prototype handles click only.
7. **Aliases.** Per `umbraco-17-starter-facts`, `content` is a colliding unprefixed alias — prefix the
   card fields. Optional properties must treat unset as "omit the row," which is the intended layout
   behaviour anyway.
8. **Hiding cards from navigation and site search** — the cost of cards-as-nodes. There is existing
   precedent (`IsVisible()`, the `search` document type) but it needs deciding.
9. **The conference date is unknown to this discovery** and is the binding constraint on scope. It
   decides whether stacks ship in this increment or as the fast follow described above.
