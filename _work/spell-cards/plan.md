# Plan: Spell Cards

**Spec**: [_work/spell-cards/spec.md](spec.md)
**Branch**: `claude/feature/spell-cards`
**Work type**: new-capability
**Feature doc**: `spell-card-deck`

## Context

A browsable deck answering "what can I do with Cantrip?" — four pack **stacks**, one open at a time,
each opening to a panel of **cards** sectioned into Spells then References, each card flipping to its
reverse. Content-driven end to end: stacks and cards are content nodes beneath a **Spellbook** page,
and the deck itself is a **block** placed on that page (Decision 8), reading its stacks and their
cards from a resolved source node — the `latestArticlesRow` + `articleList` + `article` pattern
already in the repo, one level deeper
([latestArticlesRow.cshtml:19](../../src/UmbracoProject/Views/Partials/blocks/Components/latestArticlesRow.cshtml#L19)).
See *The content tree* under Key Decisions for the exact shape.

The unit of work here is the repo's own vertical slice (`.agents/config/conventions.md` → *Unit of
work*): schema → shared block view → global block CSS → progressive-enhancement JS → E2E + screenshot
baseline. Nothing about the deck needs a controller, a service, or a backoffice extension.

The design reference (`assets/design-v5/`) is authoritative for **geometry, colour, type and motion**.
Where the spec's *Deliberate deviations* disagree — the equal-height mechanism (Decision 4) and sigil
assignment (Decision 10) — **the spec wins**. Open Question 2 (whether a round 6 reconciles the
reference) is the user's call and is not a step here.

---

## Key Decisions

Everything below was settled while planning. Do not re-derive it.

### Settled from the spec's open questions

- **OQ5 — `grid-auto-rows: 1fr` spike is Step 1.** Decision 4 rests on it and it changes what AC 18
  means. Per CSS Grid's indefinite-free-space rule, `1fr` auto-rows in an auto-height grid resolve
  every flexible track to the *largest* track's base size — which is exactly "equal to the tallest
  real content in that section". Three things must hold alongside it and the spike must confirm all
  three, not just the headline: the section grid must **not** carry `align-items: start` (round 2 set
  it; it defeats the stretch), the card must **drop `aspect-ratio`** (round 4's `352/690`, round 5's
  `400/690` — a ratio fights a content-driven height), and both faces must sit in **one grid cell**
  (`grid-area: 1 / 1`) with `overflow: hidden` removed so the cell measures the taller face. `cqi`
  clamps and `container-type: inline-size` are width-driven and survive all of it.
  **If it fails**, fall back to per-row equality (plain grid) and amend AC 18's reading in the feature
  doc to "equal within a row"; record the outcome in this file before Step 6.

  **RESULT (spike run 2026-09-01) — Decision 4 stands as written. The fallback is not needed, and
  AC 18 keeps its "equal across the whole section" reading.** Six cards of deliberately unequal copy
  (one ~3× the shortest, one with a reverse far longer than its front), measured in Playwright
  Chromium, real Google Chrome (`channel: 'chrome'`) and WebKit, at 1000px (2 cols × 3 rows), 460px
  and 340px (1 col × 6 rows):
  - **All six equalise, not just per-row.** Chromium/Chrome @1000px: natural heights
    `127 / 494 / 148 / 299 / 148 / 148` → every card `494`. Per-row equality would have given
    `494 / 299 / 148` by row, so the three-row fixture discriminates and `1fr` won. WebKit: natural
    `127 / 484 / 148 / 295 / 148 / 148` → every card `484`. Same at 460px and 340px (1 col × 6 rows),
    where per-row equality would have left every card at its natural height.
  - **Nothing clips.** `scrollHeight === offsetHeight` on all 6 cards, all 3 viewports, all 3 engines.
  - **Height tracks the taller face.** The equalised height is driven by the card whose *reverse* is
    longest, and flipping it changes no measurement — both faces are always in layout.
  - **`cqi` still resolves** with `aspect-ratio` gone: at a 292px card, `clamp(16px, 6cqi, 24px)`
    computed to `17.52px` (= 292 × 0.06, mid-clamp) identically in all three engines.

  **One thing the spike found that is not OQ5, and must not be misread as a defect in this
  structure**: Playwright's **WebKit** build does not paint `backface-visibility: hidden` at all — at
  rest it shows the *back* face, mirrored, over the front. This is a limitation of that build's paint
  pipeline, not a Safari bug and not caused by Decision 4: the canonical MDN flip-card snippet
  (`position: absolute` faces, no button, no container query, no grid) fails identically, as does the
  design's own round-5 structure, headed and headless alike, while `elementFromPoint` correctly
  returns the front face. Chromium renders every variant correctly. Real Safari could not be driven
  here (screen-recording and "Allow JavaScript from Apple Events" are both denied to the agent), so
  Safari *paint* remains unverified — **Safari layout is verified, Safari paint is not.** No action
  needed for the suite: `playwright.config.ts` runs a Chromium-only `e2e` project, so no baseline can
  bake this in. Extend the "judge the flip in a real browser" warning to cover Playwright WebKit
  screenshots too, and have someone eyeball the flip in real Safari during Step 6.

- **OQ4 — URL state is a hash, namespaced: `#deck/<stack-slug>` and `#deck/<stack-slug>/<card-slug>`.**
  Three reasons a fragment beats `?stack=&card=`: it never reaches the server, so it cannot create
  crawlable duplicate URLs of the host page, cannot interact with the URL Tracker's 301 rules, and
  cannot be confused with a server-read param like the `?page=` this repo already uses for article
  paging ([latestArticlesRow.cshtml:18](../../src/UmbracoProject/Views/Partials/blocks/Components/latestArticlesRow.cshtml#L18)).
  The design already models a hash.
  **The `deck/` prefix is not decoration.** This repo emits slugified in-page anchors on guide and
  styleguide pages (`_GuideToc.cshtml:22`, `_StyleGuideSectionRows.cshtml:70`), and the deck is a
  block that may later sit on such a page — a bare `#core` could collide with a TOC anchor. No
  slugified heading anchor ever contains `/`, so the prefixed form cannot collide.
  **Constraint this accepts**: one deck per page. Two decks would share the hash. Out of scope; note
  it in the feature doc.
  Written with `history.replaceState` (never `pushState` — thirty flips must not fill the back
  button); read on load and on `hashchange`.

- **OQ3 — `sigilMotion` is not a CMS property this increment, but the seam ships.** The deck root
  carries `data-sigil-motion="continuous"` hardcoded in the view, and every motion rule keys off that
  attribute (`[data-sigil-motion="off"] .spell-sigil { animation: none }`). Adding the property later
  is a one-line view change and zero CSS change.

- **OQ1 — per-section collapse for Core's 16 on a phone** is answered by looking, not by planning.
  Step 9 ends with that observation recorded in the feature doc's Increments section.

### The content tree, and who holds which words

The deck separates **where the words live** (content nodes) from **what displays them** (a block on a
page). One page, everything else hanging beneath it:

```
Home
└── Spellbook                  ← doc type `spellbook`. A normal page: in nav, in search, has a URL.
    │                            Its contentRows holds one Spell Card Deck block.
    ├── Core                   ← spellCardStack
    │   ├── /explore           ← spellCardSpell
    │   ├── /spec              ← spellCardSpell
    │   └── workflow           ← spellCardReference
    ├── umbraco-17
    ├── umbraco-cloud
    └── dotnet
```

| Text | Lives on |
|---|---|
| Intro heading, lede, note above the deck | the **block** (`deckHeading`, `deckLede`, `deckNote`) |
| Which stack is open on arrival | the **block** (`deckDefaultStack`) |
| Stack name, blurb, note, pack key, monogram | the **stack node** |
| Everything on a card, both faces | the **card node** |

**Cards are nodes, not blocks nested in the deck block.** Thirty cards inside one block editor is one
enormous editor with drag-reordering across thirty items; nodes give per-card edit screens and tree
ordering for free. It also keeps Decision 8 cheap — a second deck block on another page points at the
same Spellbook rather than duplicating thirty cards. This is the repo's existing shape one level
deeper: `latestArticlesRow` is a block with a content picker at an **Article List** page holding
`Article` children.

**The Spellbook page is not special and needs no new palette.** `contentRows` comes from the
**Content Controls** composition (`b1c27e8c-…`), which `content` and `articleList` already compose;
`spellbook` composes the same one. What *does* change is the shared `[BlockList] Main Content` palette,
which gains the deck block — that is what makes the deck placeable on every page using that palette
(AC 15). The only reason `spellbook` needs to be its own document type at all is **allowed children**:
"a Spell Card Stack may be added here" is a per-doc-type setting, and reusing the generic `content`
type would let editors add stacks under any page.

**`deckSource` defaults to the current page when left empty**, so placing the deck on the Spellbook
page is zero-config; picking a node explicitly is only needed when the deck sits on some *other* page.

### Keep content resolution in one place

The view must resolve **everything it renders in a single `@{ }` block at the top** — the source page,
the ordered stacks, and each stack's cards partitioned into spells and references — into plain local
collections that the markup below then only iterates. No `Children<SpellCardStack>()` or
`Children<SpellCardSpell>()` scattered through the markup.

This is better Razor either way (one place to reason about null and ordering, one place a
`perf-reviewer` looks). It also matters for a specific, known future: **Umbraco 18's Elements are
where this content should eventually live.** Elements sit in a Library rather than the content tree,
are explicitly "not routable and are not attached to a Template", and are consumed through an Element
Picker. That is the exact shape of this data — thirty structured records that are content, need
editing and ordering, and should never have had URLs. Adopting them would delete the redirect
template, both visibility ticks, the sitemap reasoning and most of the reason `spellbook` is its own
document type.

Not available here — this repo is on CMS 17.5.x and the AI suite is pinned to the 17 line — and the
schema is the small half of this increment anyway; the view, CSS, sigils, flip, carousel and URL state
are agnostic to where the data comes from. One resolution block is what keeps that true, so the
migration is a schema change plus one `@{ }` block rather than a rewrite.

Two things to settle at migration time, neither answered by the current Elements docs: whether a
Library gives editor-controlled **ordering** (if not, the relationship likely inverts — a stack holds
an Element Picker of its cards, and picker order *is* the order, which is arguably the better model),
and whether elements are **indexed for site search** (if not, Decision 6 has to be re-made — though
that also removes the only reason the redirect template exists).

### Nav, sitemap and search exposure — four ticks, not thirty-four

Checked against what actually enumerates the tree, rather than flagged defensively:

| Surface | Walks | Reaches stacks? | Reaches cards? |
|---|---|---|---|
| Top navigation (`_SiteHead.cshtml:39`) | Home's **direct children**, filtered by `hideFromTopNavigation` | no | no |
| Section navigation (`sectionNavigation.cshtml:13`) | current page's siblings + its **direct children**, filtered by `IsVisible()` and `hideFromSectionNavigation` | **yes**, on the Spellbook page | no |
| XML sitemap (`xmlSitemap.cshtml`) | recursive — but skips a hidden node **and never descends into it** | **yes** | yes, unless the stack is hidden |
| Site search (`SearchService.cs:40`) | everything, filtered by **document-type alias only** | yes | **yes — and that is wanted** (Decision 6) |

So: tick `umbracoNaviHide` and `hideFromSectionNavigation` on the **four stack nodes**. That clears the
section-nav sidebar and, because the sitemap stops descending at a hidden node, takes all thirty cards
out of the sitemap with it. **The thirty card nodes need no flags at all**, and the Spellbook page
itself must stay unflagged — it is the one node you want in nav and search.

**Label trap.** In this repo `umbracoNaviHide` is described in the backoffice as *"Hide From Search"*,
but it is what `IsVisible()` keys on — the section navigation and the sitemap. The site search does not
read it. Setting it leaves cards searchable, which is exactly Decision 6; do not "correct" it.

**The four ticks are load-bearing, and they are content state rather than schema.** `IsVisible()`
returns **true** when the property is absent, and the card types deliberately do not compose Visibility
Controls — so nothing structural keeps thirty card URLs out of the sitemap. It works because the
sitemap never descends past a hidden stack. A fifth pack added later without the tick would silently
leak its cards. Step 10 therefore ships a `/sitemap.xml` assertion as a standing regression guard, and
this needs saying in the feature doc so the next person to add a pack knows the tick is not cosmetic.

### Schema shape

- **Two card document types, not one with a `kind` radio.** `spellCardSpell` and `spellCardReference`,
  both composing a shared `spellCardFields` composition. This supersedes round 1/round 2's
  `kind` (radio) field. It is what makes AC 16's third scenario — *"Given a content editor is editing
  the `umbraco-deploy-facts` reference card / Then no choice of mark is offered"* — actually true:
  Umbraco cannot conditionally hide a property based on a sibling property's value without a custom
  editor, but a field that only exists on one document type is simply absent on the other. It also
  lands the field split cleanly: `cardCast`/`cardNeeds`/`cardLeaves`/`cardMark` on the spell,
  `cardTriggers`/`cardHolds` on the reference, everything shared in the composition. The view sections
  by document type; section order stays fixed in the view (Spells, then References).

- **`stackPack` is a textstring, not a dropdown.** AC 9 requires adding a pack to be a content
  operation with **no schema change**, "given its sigil and accent entry exist" — both of which are
  code commits (a `<symbol>` in the sprite partial, an accent block in the stylesheet). A dropdown
  would add a *third* change, a `.uda` edit, and break AC 9 literally. A textstring holding the pack
  key (`core`, `umbraco-17`, `umbraco-cloud`, `dotnet`) drives both the CSS class
  (`spell-deck__stack--<key>`) and the sigil id (`#sig-<key>`). This does **not** reopen "never a
  colour picker" — an editor picks an identity key, never a colour. An unknown key degrades to the
  neutral accent and the monogram (`stackMonogram`), which is the same path as the
  "stack with no art set" edge case.

- **`cardMark` *is* a dropdown**, of the 14 shipped spell-sigil keys plus blank. Here the spec is
  explicit that adding a new mark is a developer task, "so carrying a schema change alongside costs
  nothing that deploy was not already paying" (Decision 10). Blank → falls back to the pack sigil,
  which covers the "spell with no drawn sigil" edge case. Because the mark is a stored value and not
  a slug lookup, AC 17 (renaming never changes the mark) is satisfied structurally, not by a test.

- **No media picker for stack art.** Decision 5 defers uploadable art; an unused picker is dead
  schema and a live stored-XSS surface waiting to be wired. `stackMonogram` (textstring, ≤3 chars)
  carries the fallback the edge case names.

- **No `cardSubtitle` field.** Round 1's `<Group> · <qualifier>` subtitle and round 2's card caption
  are both derivable from the parent stack, the document type, and the index within the section.
  Derive them in the view.

- **Titles follow the repo's Title-or-Name idiom** — `!string.IsNullOrWhiteSpace(x.Title) ? x.Title :
  x.Name`, as `latestArticlesRow.cshtml` does. So AC 8 ("change any text") holds whether the editor
  edits the field or the node name.

### Live schema identifiers (queried via MCP, 2026-09-01 — do not look these up again)

| Thing | Identifier |
|---|---|
| Doc-type folder **Pages** | `a2c71960-9678-4b56-9828-c1d8f8f7df40` |
| Doc-type folder **Compositions** | `3503b89f-2819-4e41-86d7-d17dcc5b4212` |
| Element folder **Elements → Content Models** | `1645b9b1-459b-40e7-90a5-ea194afda61d` |
| Element folder **Elements → Setting Models** | `a3274987-1799-46d6-885c-551ba2986c90` |
| Composition **Visibility Controls** | `7cebdc47-a965-49ec-ab42-bc887d6b1119` |
| Composition **SEO Controls** | `9090575e-290c-4585-91a4-b72ec30ff41f` |
| Composition **Content Controls** (supplies `contentRows`) | `b1c27e8c-1692-42ad-9701-c87f12716ee7` |
| Composition **Header Controls** (supplies `title` / `subtitle`) | `d690c8cb-2622-43b9-8cf9-fdca7811ee4d` |
| Composition **Page Head Pattern Controls** | `d03e1062-f895-4262-9827-5f35caa93a42` |
| Composition **Section Navigation Controls** | `ef741d00-fa22-4ab6-b5ba-1b450850a350` |
| Setting model **Spacing Properties** | `2e1a4fd4-b695-4033-8626-1a45b54e04cb` |
| Setting model **Hide Property** | `02180d87-1eea-45d9-93a6-1e38f2ee0165` |
| Page-body palette **`[BlockList] Main Content`** | `umb://data-type/b5922818d8d843df88ed4582a24c0fa6` |
| Data type **Textstring** | `umb://data-type/0cc0eba1996042c9bf9b60e150b429ae` |
| Data type **Textarea** | `umb://data-type/c6bac0dd4ab945b18e30e4b619ee5da3` |
| Data type **Content Picker** | `umb://data-type/fd1e0da556064862b6795d0cf3a52a59` |
| Data type **True/false** | `umb://data-type/92897bc6a5f34ffeae27f2e7e33dda49` |
| Reference element for a block pair | `LatestArticlesRow` / `LatestArticlesRowSettings` (`60085a63-…` / `c56fb5b8-…`) |

Project dropdown naming convention is `[Dropdown] <Name>` (e.g. `[Dropdown] Pillar Tone`).

### Where the code goes

- **View**: one shared block view at
  `src/UmbracoProject/Views/Partials/blocks/Components/spellCardDeck.cshtml`, bound to
  `IBlockReference<IPublishedElement, IPublishedElement>` and reading settings via `ISpacingProperties`
  — the contract in [AGENTS.md → Block / component rendering](../../AGENTS.md). The
  `BlockRenderCoverageTests` guard turns red automatically the moment the alias joins a palette
  without this file, so palette membership needs no new test.
- **Sprite**: `src/UmbracoProject/Views/Partials/_SpellSigils.cshtml` — the 20 `<symbol>` definitions
  lifted verbatim from `assets/design-v5/Spell Cards.dc.html`. Rendered once per deck. Editors never
  author drawing instructions (Decision 10), so the sprite is a partial, not content.
- **CSS**: a new **global** `src/UmbracoProject/wwwroot/assets/css/spell-cards.css`, linked from
  `master.cshtml` after `blocks.css`. The block-CSS seam ([docs/block-css-seam.md](../../docs/block-css-seam.md))
  requires a block's functional CSS to be globally loaded so the block renders on any page; a
  dedicated topic file satisfies that while keeping `blocks.css` (493 lines today) from roughly
  doubling — the same split `listings.css` already uses.
- **JS**: `src/UmbracoProject/wwwroot/assets/js/spell-cards.js`, linked from `master.cshtml` after
  `carousel.js`, opening with an early return when no `.spell-deck` is on the page so it costs nothing
  elsewhere. **Reuse the conventions, not the library** (Decision 13): `carousel.js`'s live
  `prefers-reduced-motion` change listener, `aria-label`-as-accessible-name on icon-only buttons, and
  the `image-carousel__*` naming style. Do not initialise Bootstrap Carousel or Swiffy Slider.
- **CSS class prefix**: `spell-deck` / `spell-deck__*` for the deck, row, panel and sections;
  `spell-card` / `spell-card__*` for the card. The design's `.card-row`, `.card-item` and
  `.carousel-nav` are far too generic for a globally-loaded stylesheet — prefix all three.

### Rendering and state

- **All four panels render server-side; the closed three carry `hidden`.** This makes the default-open
  stack work with JS off, removes any open-on-load flash, and makes AC 6 (flips survive a stack
  round-trip) true for free, because the DOM never goes away. Cost is ~30 cards of markup on the page;
  `hidden` + `display: none` means the closed ones cost no layout. Accepted deliberately — the deck is
  a reading surface, not a hot path.
- **The default-open stack is server-rendered from the block's `deckDefaultStack` property**
  (Decision 11). A hash naming a different stack is applied by JS on load — which is also why an
  unknown hash "degrades" rather than breaks: nothing server-side depended on it.
- **`perspective` goes on a plain `<div>` inside the card `<button>`, never on the button.** A button
  host flattens the 3D context in Chrome and both faces render as mirrored 2D layers. The design hit
  this during its own build; do not rediscover it.
- **`currentColor` is the only channel that reaches a `<use>` shadow tree.** Structure is the literal
  `#F0EDE8`; the single accent shape is `fill="currentColor"`; the consuming `<svg>` sets `color`.
  Neither a CSS custom property nor `fill` on the consuming `<svg>` crosses. See round 3 §4.

### Constraints this plan must respect

- **New colour values.** The `--dc-*` planes, `--accent-primary`, `--accent-secondary` and
  `--accent-tertiary` all exist. The pack **accentDark** values (`#E0674E`, `#7FAFB3`, `#BDB6AC`,
  `#C39A6B`), the corrected `umbraco-cloud` **accentInk** (`#6E6A62`) and the three **paper-edge**
  values (`#D5CCC1`, `#E3DBD1`, `#EFE8E0`) are **not** in `typography.css` or `tokens-extras.css` —
  verified. They are deck-scoped, so declare them on `.spell-deck` in `spell-cards.css`, not in the
  global token files.
- **Do not implement round 4's root-font-size media query globally.** `styles.css:13` sets
  `html { font-size: 18px }` site-wide; dropping it to 17px below a 400px viewport would resize
  **every page** and move every existing 320/390px screenshot baseline in the suite. Scope the
  step-down to the deck: `font-size: 17px` on `.spell-deck` under the media query, with the deck's
  own type authored in `em` (a 1:1 substitution from the design's rem values, since the deck root is
  1rem at rest). Apply `em` only on leaf text elements so nothing compounds.
- **ModelsBuilder is `SourceCodeManual` with committed models** — schema changes need an explicit
  regenerate (Settings → ModelsBuilder → Generate models, or
  `POST /umbraco/management/api/v1/models-builder/build`), then `git diff` and commit the
  `*.generated.cs` alongside the `.uda`. See [AGENTS.md → ModelsBuilder](../../AGENTS.md#modelsbuilder).
- **Never stage unintended `.uda` churn** — Umbraco rewrites `.uda` on every local startup. Verify
  before staging; `git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/` to discard.
- **Screenshot baselines are Linux-only.** Generate them via the `update-snapshots.yml` GitHub
  workflow; never commit `*-darwin.png`, and never regenerate a baseline to make a diff pass.
- **`<TreatWarningsAsErrors>` is on for all four projects** and Cloud's runtime Razor compile honours
  it while ignoring csproj `<NoWarn>` — if any obsolete API is unavoidable in the `.cshtml`, suppress
  per-call-site with `#pragma warning disable` inside a `@{}` block.
- **Judge the flip and the sigil tinting in a real browser.** Both render incorrectly under
  DOM-cloning screenshot tools — backs appear mirrored and face-up, accent shapes appear black. A
  captured image showing either is a tooling artefact, not a defect.
  **Step 1 extended this to Playwright's WebKit build**, which does not paint
  `backface-visibility: hidden` at all — it shows the mirrored back over the front at rest, for every
  structure including the canonical MDN flip card, so it is a paint-pipeline limitation of that build
  rather than a Safari bug or anything to do with our markup. Chromium paints it correctly and
  `playwright.config.ts` runs a Chromium-only `e2e` project, so no baseline can bake it in. **Safari
  layout is verified; Safari paint is not** — eyeball the flip in real Safari once during Step 6.

### Assumption flagged for the user

**Card and stack nodes get a redirect template** (Step 5). Decision 6 keeps cards in site search, and
`SearchService` only excludes by document-type alias
([SearchService.cs:40](../../src/UmbracoProject.Features/Services/Search/SearchService.cs#L40)) — so
cards *will* appear as results. A template-less node 404s, which would make every card result a dead
link. A ~5-line template that redirects to the deck page's card deep link fixes it and gives each card
a real shareable URL. **The cheap alternative, if you would rather not**: add `spellCardSpell` and
`spellCardReference` to `DocTypesToIgnore` — but that contradicts Decision 6. Proceeding with the
redirect. Note that this is only needed *because* cards stay searchable — see the exposure table above.

### Commands

| Purpose | Command |
|---|---|
| Local build | `cd src/UmbracoProject && dotnet build` |
| CI parity | `dotnet build -c Release` (repo root) |
| Unit tests | `dotnet test umbraco-17-demo-site.sln --no-build -c Release` (**repo root** — never from `src/UmbracoProject`, which runs zero tests and still exits 0) |
| E2E | `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test <spec>` |
| Site | must be serving on `https://localhost:44367` before any E2E or MCP work |

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new session.

---

### Step 1 — Spike: does `grid-auto-rows: 1fr` equalise an auto-height grid?

> **Prompt**: Run Step 1 of `_work/spell-cards/plan.md`. This is a throwaway spike that settles the
> spec's Open Question 5 and gates Decision 4 — write no production code. Create a single
> self-contained HTML file in the scratchpad directory that reproduces the spell-card section grid in
> miniature: a `display: grid` container with `grid-template-columns: repeat(auto-fill, minmax(min(400px,
> 100%), 1fr))`, `grid-auto-rows: 1fr`, **no** `align-items: start`, and six child "cards" of
> deliberately unequal text length (one card carrying roughly three times the copy of the shortest —
> the AC 14 case). Each card is a `<button>` containing a plain `<div>` with `perspective`, whose inner
> element holds two faces at `grid-area: 1 / 1` inside their own `display: grid`, with
> `transform-style: preserve-3d`, `backface-visibility: hidden`, **no** `position: absolute`, **no**
> `overflow: hidden`, and **no** `aspect-ratio`. Give the card `container-type: inline-size` and one
> `clamp(min, N cqi, max)` interior padding so you can confirm container queries still resolve. Open it
> in a real browser (Chrome and Safari at minimum) and measure with a short Playwright script or
> `getBoundingClientRect` in the console. Then record the outcome in the **Key Decisions → OQ5** entry of
> the plan file itself, and delete the spike file.

**What to build**:
- `<scratchpad>/grid-auto-rows-spike.html` — the miniature grid described above (delete after).
- Optionally `<scratchpad>/measure-spike.mjs` — a Playwright script reading every card's
  `offsetHeight` and `scrollHeight`.

**Test first**: this step *is* the test. The four questions it must answer, each with an explicit
observation:
1. Do **all six** cards report the same `offsetHeight`, equal to the tallest card's natural content
   height — not just the two in the same row?
2. Is the tallest card's content **fully visible** — `scrollHeight <= offsetHeight` on every card,
   nothing clipped, nothing spilling (AC 14 / AC 18)?
3. Does the card's height track the **taller of its two faces**, so flipping never clips? Flip one card
   whose reverse is longer than its front and re-measure.
4. Does the `cqi` clamp still resolve against the card's own width once `aspect-ratio` is gone?
5. Same four answers in **Safari**, where `1fr` auto-rows have a history of bugs.

**Validation**:
- [Manual]: all four answers are yes in both browsers → Decision 4 stands as written.
- [Manual]: any answer is no → the fallback is **per-row equality** (drop `grid-auto-rows: 1fr`, keep
  everything else). Say so explicitly in the plan file, and note that AC 18 then reads "equal within a
  row", which Step 6's test and the feature doc must both follow.
- Either way, the OQ5 entry in this plan is edited to record what was seen, and the spike file is
  deleted.

---

### Step 2 — Schema: document types, element types, data types, palette membership

> **Prompt**: Implement Step 2 of `_work/spell-cards/plan.md`. Author the spell-card schema in the
> Umbraco backoffice (or via the `umbraco-mcp` tools — the site must be serving on
> `https://localhost:44367` first), then regenerate ModelsBuilder models and commit the `.uda` diff
> alongside them. Create: a composition `spellCardFields`; two card document types `spellCardSpell` and
> `spellCardReference`; a stack document type `spellCardStack`; a `spellbook` page document type
> modelled on the existing `content` type; a block content element type `spellCardDeck` plus its
> settings element `spellCardDeckSettings`; and two new dropdown data types. Read the plan's **The
> content tree** section first — the Spellbook page is a normal page that needs no new palette, and the
> only reason it gets its own document type is allowed-children. Add `spellCardDeck` to the shared
> `[BlockList] Main Content` palette
> (`umb://data-type/b5922818d8d843df88ed4582a24c0fa6`). The full field list, the folder targets and the
> reusable data-type UDIs are all in the plan's **Key Decisions**; use those identifiers rather than
> looking them up again. Then regenerate models (Settings → ModelsBuilder → Generate models, or
> `POST /umbraco/management/api/v1/models-builder/build`), `git diff` the `*.generated.cs` under
> `src/UmbracoProject.Features/Models/Generated/`, and confirm `cd src/UmbracoProject && dotnet build`
> is clean. Expect `BlockRenderCoverageTests` to be RED at the end of this step — that is correct, and
> Step 5 turns it green.

**What to build**:

New data types (folder: alongside the existing `[Dropdown] *` types):
- `[Dropdown] Spell Card Mark` — `Umbraco.DropDown.Flexible`, single-select, values:
  `explore`, `spec`, `plan`, `implement-step`, `feature`, `code-review`, `commit-message`, `retrofit`,
  `setup`, `update-toolkit`, `block`, `guide`, `umbraco-edit`, `check-uda`.
- `[Dropdown] Spell Card Footer Label` — `Umbraco.DropDown.Flexible`, single-select: `Then`,
  `Pairs with`.

Composition `spellCardFields` (Compositions folder `3503b89f-…`), group **Card**:
| Alias | Data type | Notes |
|---|---|---|
| `cardTitle` | Textstring | falls back to node Name in the view |
| `cardDoes` | Textarea | |
| `cardModes` | Textarea | optional — omitted when empty |
| `cardWatchFor` | Textstring | optional — omitted when empty |
| `cardFooterLabel` | `[Dropdown] Spell Card Footer Label` | optional |
| `cardFooterValue` | Textstring | optional |

Document type `spellCardSpell` (name **Spell**, Pages folder `a2c71960-…`, **no template yet**,
composition: `spellCardFields` only), group **Spell**:
`cardCast` (Textstring), `cardNeeds` (Textstring), `cardLeaves` (Textstring),
`cardMark` (`[Dropdown] Spell Card Mark`, optional — blank falls back to the pack sigil).
**No Visibility Controls** — cards are two levels below the Spellbook page and nothing enumerates
them; see the exposure table in Key Decisions.

Document type `spellCardReference` (name **Reference**, same folder/composition, **no template yet**),
group **Reference**: `cardTriggers` (Textstring), `cardHolds` (Textstring).
**No `cardMark`** — that absence is what satisfies AC 16's third scenario.

Document type `spellCardStack` (name **Spell Card Stack**, Pages folder, no template, composition:
Visibility Controls `7cebdc47-…` — this is the **one** level that needs it), group **Stack**:
`stackTitle` (Textstring, falls back to Name), `stackBlurb` (Textarea), `stackNote` (Textstring),
`stackPack` (Textstring — description must list the shipped keys: `core`, `umbraco-17`,
`umbraco-cloud`, `dotnet`, and state that an unknown key falls back to the neutral accent and the
monogram), `stackMonogram` (Textstring, optional, ≤3 characters).
Allowed children: `spellCardSpell`, `spellCardReference`.

Document type `spellbook` (name **Spellbook**, Pages folder). No own properties. Compositions, the
same set the generic `content` type uses minus the two it does not need (Section Row Controls, Main
Image Controls): **Content Controls** `b1c27e8c-…` (this is what supplies `contentRows`, i.e. the
page-body block palette — no new palette is created), **Visibility Controls** `7cebdc47-…`,
**SEO Controls** `9090575e-…`, **Header Controls** `d690c8cb-…`, **Page Head Pattern Controls**
`d03e1062-…`, **Section Navigation Controls** `ef741d00-…`.
Allowed children: `spellCardStack` — **this is the only reason the type exists**; reusing `content`
would let editors add stacks under any page.
**Also add `spellbook` to Home's own allowed children** (`home`, `a95360e8-ff04-40b1-8f46-7aa4b5983096`),
appended last. Allowed-children is a two-way wiring and it is easy to set only the downward half: without
this, creating the Spellbook page in Step 3 fails with `operationStatus: NotAllowed`. Editing Home writes
one dependency entry with `"Mode": "Exist"`, matching its twelve siblings.
Template `spellbook.cshtml`: a thin near-copy of
[content.cshtml](../../src/UmbracoProject/Views/content.cshtml) typed to `ContentModels.Spellbook` —
page head partial, optional section nav, `@Html.GetBlockListHtml(Model.ContentRows)`. Drop
`content.cshtml`'s `sectionRows` block; the Spellbook page does not use it.

Element type `spellCardDeck` (name **Spell Card Deck**, Elements → Content Models `1645b9b1-…`),
group **Deck**:
`deckHeading` (Textstring), `deckLede` (Textarea), `deckNote` (Textstring, optional),
`deckSource` (Content Picker `fd1e0da5-…` — the Spellbook page; **optional**, and when empty the view
falls back to the page the block is on, so placing the deck on the Spellbook page is zero-config),
`deckDefaultStack` (Content Picker — the stack open on arrival; the view validates it is a child of
the resolved source and falls back to the first stack if not).

Element type `spellCardDeckSettings` (name **Spell Card Deck Settings**, Elements → Setting Models
`a3274987-…`), composing **Spacing Properties** `2e1a4fd4-…` and **Hide Property** `02180d87-…` —
mirroring the `LatestArticlesRowSettings` pair.

Palette: add the `spellCardDeck` / `spellCardDeckSettings` pair to `[BlockList] Main Content` with a
label in the house style, e.g.
`**Spell Card Deck**: {umbValue: deckHeading | fallback:[No heading]} ${$settings.hide == '1' ? '[HIDDEN]' : ''}`.

**Test first**:
- No new test file. The existing
  [BlockRenderCoverageTests.cs](../../tests/UmbracoProject.Tests/BlockRenderCoverageTests.cs) *is* the
  test for palette membership, and adding `spellCardDeck` to the palette makes it **RED** with
  `[BlockList] Main Content → 'spellCardDeck': expected shared view blocks/Components/spellCardDeck.cshtml`.
- Run `dotnet test umbraco-17-demo-site.sln --no-build -c Release` from the repo root and **confirm
  that exact failure** before moving on. A different failure means the alias or the palette edit is
  wrong.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` is clean and warning-free.
- [Automated]: `dotnet test …` fails on `EveryOfferedBlockResolvesAView` and nothing else.
- [Manual]: `git diff` on `src/UmbracoProject.Features/Models/Generated/` shows exactly the new models
  (`SpellCardFields`, `SpellCardSpell`, `SpellCardReference`, `SpellCardStack`, `Spellbook`,
  `SpellCardDeck`, `SpellCardDeckSettings`) with the properties above — no unrelated churn.
- [Manual]: `git status` on `src/UmbracoProject/umbraco/Deploy/Revision/` shows only the intended
  artifacts. Discard incidental startup churn with `git checkout --` on that directory.

---

### Step 3 — Content: the Spellbook page and its stacks and cards

> **Prompt**: Implement Step 3 of `_work/spell-cards/plan.md`. Author the deck's content — read the
> plan's **The content tree** section first for the shape. The 30-unit roster with its real copy is the
> `UNITS` array in `_work/spell-cards/assets/design-v5/Spell Cards.dc.html` (from roughly line 630) and
> the four stack blurbs are verbatim in
> `_work/spell-cards/assets/design-v5/README-round-2.md` → *Stack copy (four stacks)*. Create a
> `spellbook` page named **Spellbook** under Home. Under it, four `spellCardStack` nodes — Core
> (`stackPack: core`, monogram `C`), umbraco-17 (`umbraco-17`, `17`), umbraco-cloud (`umbraco-cloud`,
> `UC`), dotnet (`dotnet`, `.N`). Under each stack, its `spellCardSpell` and `spellCardReference`
> children in the design's order, with `cardMark` set to the matching sigil key for every spell. Counts
> must be Core 16, umbraco-17 9, umbraco-cloud 2, dotnet 3. **Tick `umbracoNaviHide` and
> `hideFromSectionNavigation` on the four stack nodes only** — not on the cards, which nothing
> enumerates, and emphatically not on the Spellbook page, which must stay visible. Read the label trap
> in Key Decisions first: `umbracoNaviHide` is labelled "Hide From Search" here but is not what the
> site search keys on. Finally add a Spell Card Deck block to the Spellbook page's Main Content, leave
> `deckSource` empty (it falls back to the current page) and point `deckDefaultStack` at Core. Publish
> everything. Use the `/umbraco-edit` skill or the `umbraco-mcp` tools; the site must be serving on
> `https://localhost:44367`.

**What to build**: content only — no files. One `spellbook` page carrying the block, four
`spellCardStack` nodes beneath it, 30 card nodes beneath those.

**Test first**: no automated test — this is content, and the spec is explicit that content-shaped
assertions ("does a card exist, is its text right") are content, not behaviour. The concrete manual
check is below.

**Validation**:
- [Manual]: the backoffice tree shows Spellbook → four stacks → 16 / 9 / 2 / 3 cards, all published.
- [Manual]: `/spellbook` returns 200. It will render unstyled until Step 5 — that is expected; you are
  only confirming the page and block exist.
- [Manual]: **Spellbook itself is present** in the header navigation. **The header nav is a 60-minute
  cached partial** (`master.cshtml:34` wraps `_SiteHead.cshtml` in `Html.CachedPartialAsync`), so on a
  warm site a newly added top-level page can be absent for up to an hour. Restart the site before
  concluding the page is missing — a stale nav looks exactly like a content problem. The four stacks are **absent**
  from the section-navigation sidebar on that page, and no stack or card appears in
  `/sitemap.xml` — the sitemap stops descending at a hidden node, which is why the cards need no flag
  of their own.
- [Manual]: search the site for a distinctive phrase from one card's `cardDoes`. It **must** return a
  hit — that is Decision 6, and it is the assertion that proves the `umbracoNaviHide` label trap was
  navigated correctly. The result link will 404 until Step 5 adds the redirect template.

---

### Step 4 — The sigil sprite partial

> **Prompt**: Implement Step 4 of `_work/spell-cards/plan.md`. Create
> `src/UmbracoProject/Views/Partials/_SpellSigils.cshtml` holding the 20 `<symbol>` definitions lifted
> **verbatim** from the `<defs>` sprite at the top of
> `_work/spell-cards/assets/design-v5/Spell Cards.dc.html`: the 14 spell marks (`sig-explore`,
> `sig-spec`, `sig-plan`, `sig-implement-step`, `sig-feature`, `sig-code-review`,
> `sig-commit-message`, `sig-retrofit`, `sig-setup`, `sig-update-toolkit`, `sig-block`, `sig-guide`,
> `sig-umbraco-edit`, `sig-check-uda`), the shared `sig-tome`, the four pack marks (`sig-spellbook`,
> `sig-umbraco17`, `sig-cloud`, `sig-dotnet`) and `sig-reference`. Wrap them in one hidden
> `<svg id="sig-sprite" aria-hidden="true" focusable="false">`. Preserve the colour mechanism exactly:
> structure and texture stay the literal `#F0EDE8`, and the **single** accent shape per mark stays
> `fill="currentColor"`. Do not convert either to a CSS custom property — it will not reach the `<use>`
> shadow tree. Do not add the partial to any view yet; Step 5 renders it.

**What to build**:
- `src/UmbracoProject/Views/Partials/_SpellSigils.cshtml` — 20 `<symbol>` elements, each
  `viewBox="0 0 120 120"`, inside one hidden sprite `<svg>`.
- A short header comment recording the two mechanisms that do **not** work (a `--sig-accent` custom
  property on the consuming `<svg>`, and `fill` on the consuming `<svg>`) so nobody re-tries them.

**Test first**: no automated test — this is static art with no behaviour. The concrete manual check
is the throwaway harness below.

**Validation**:
- [Manual]: create a throwaway HTML file in the scratchpad that includes the partial's markup and
  twenty `<svg><use href="#sig-…"></svg>` consumers, four of them with `style="color: #E0674E"` /
  `#7FAFB3` / `#BDB6AC` / `#C39A6B`. Open it in **a real browser** — Chrome, not a screenshot tool.
  Every mark draws; the accent shape in each of the four takes its host's `color`; the structure stays
  `#F0EDE8` throughout. Delete the harness.
- [Manual]: the sprite is roughly 15KB and contains no gradients, filters, `<image>` or `<script>`.
- [Automated]: `cd src/UmbracoProject && dotnet build` is clean (Razor parses the partial).

---

### Step 5 — The block view: stacks, panels, sections, card faces and reverses

> **Prompt**: Implement Step 5 of `_work/spell-cards/plan.md`. Write the shared block view at
> `src/UmbracoProject/Views/Partials/blocks/Components/spellCardDeck.cshtml`, bound to
> `IBlockReference<IPublishedElement, IPublishedElement>`, reading spacing via `ISpacingProperties` /
> `SpacingHelper` and honouring `Settings.Hide` — copy the opening shape from
> `Views/Partials/blocks/Components/latestArticlesRow.cshtml`. It renders the intro, the stack row, and
> **all four stack panels** with `hidden` on the three that are not the default-open stack. Also add a
> `spellCardRedirect.cshtml` template, allowed on `spellCardSpell`, `spellCardReference` and
> `spellCardStack`, that redirects a direct hit on a card or stack URL to the deck page's deep link
> (`<deck page url>#deck/<stack-slug>/<card-slug>`) — read the assumption note in the plan's Key
> Decisions first. **Resolve every stack and card in one `@{ }` block at the top of the view** — see
> *Keep content resolution in one place* in Key Decisions; do not call `Children<…>()` inline through
> the markup. No CSS and no JavaScript in this step: the deck will render unstyled, and that is the
> correct end state. Write the E2E structural spec described below **first** and confirm it is RED.

**What to build**:

`spellCardDeck.cshtml`, emitting:
- Root `<section class="spell-deck" data-sigil-motion="continuous">`, plus the spacing classes. Render
  `_SpellSigils.cshtml` once inside it.
- Intro: `deckHeading`, `deckLede`, optional `deckNote`.
- `<div class="spell-deck__row" role="group" aria-label="Card stacks">` holding one
  `<button type="button" class="spell-deck__stack spell-deck__stack--@packKey">` per stack, each with
  `aria-expanded`, `aria-controls="spell-deck-panel-<slug>"`, the three paper-edge layers and the top
  face as decorative children (`aria-hidden="true"`, `pointer-events: none` where they would
  intercept), the pack sigil (or `stackMonogram`, or the first character of the name, in that order),
  the stack name, and the card count in words (`16 cards`).
- One `<div class="spell-deck__panel" id="spell-deck-panel-<slug>">` per stack, immediately after the
  row, `hidden` unless it is the default-open stack. Each panel: a header (eyebrow, `stackTitle` as
  `<h2>`, accent rule, `stackBlurb`, `stackNote`, the count, a **Show all backs** toggle and a
  **Close stack** button); then the Spells section and the References section, **each rendered only if
  it holds cards**, each with its heading, its `n of m` count, its gloss, and a
  `<div class="spell-deck__card-row">` of cards; each section also gets a
  `<div class="spell-deck__carousel-nav">` with 44×44 prev/next `<button>`s carrying CSS-drawn
  chevrons (two borders on a rotated square — **not** a Unicode arrow, **not** an icon font) and
  `aria-label`s as their accessible names.
- Each card: `<button type="button" class="spell-card" aria-pressed="false" data-card="<slug>">`
  containing a plain `<div class="spell-card__perspective">` (this is where `perspective` will go —
  **never on the button**), whose inner element holds the face and the reverse. The reverse carries
  `aria-hidden="true"` at rest, the face carries it when flipped. `aria-label` states the name, the
  kind, and how to turn the card.
- Face: sigil (`cardMark` → `#sig-<key>`, blank → the pack sigil, references → `#sig-tome`), title
  (mono for a spell, display face for a reference), kind badge (filled for a spell, outlined for a
  reference).
  **The consuming `<svg>` carries `aria-hidden="true"` and nothing else** — no `role="img"`, no
  `aria-label`, no `<title>` or `<desc>`. The card button's `aria-label` is the sole accessible name;
  a second name source inside the `<use>` shadow tree would compete with it across all thirty cards.
  The mark is decorative reinforcement of text that is already visible.
  **`#sig-tome` has no accent shape** — the shared reference mark is monochrome by design, so setting
  `color` on a tome consumer does nothing. That is correct, not a bug to chase.
- Reverse, in the design's order: header row (kind badge + stack name) → title → derived subtitle
  (`<Stack> · Spell n of m`) → stat block (`Cast` or `Triggers` full-width, then `Needs`+`Leaves` or
  `Holds`) → `cardDoes` → optional `cardModes` → optional `cardWatchFor` → optional footer.
  **Every optional region is wrapped in a non-empty guard** — no empty row, label or gap (AC 10).
- Below each card, the caption: two-digit index within its section plus `Cast by name` (spells) /
  `Loads itself` (references).

`spellCardRedirect.cshtml` — walks up to the ancestor `spellbook` page and issues a redirect to
`<spellbook url>#deck/<stack-slug>/<card-slug>` (a stack node redirects to `#deck/<stack-slug>`).

**Test first**:
- Write `tests/e2e/blocks/spellCardDeck.spec.ts`. It asserts **structure only** — no styling, no
  interaction, since neither exists yet:
  - the stack row shows four stacks, each with a name and a card count, and Core reads `16 cards`;
  - the Core panel is present and not `hidden`; the other three are `hidden`;
  - the Core panel has a **Spells** heading and a **References** heading;
  - the **dotnet** panel has a References heading and **no Spells heading** (the references-only
    regression the spec calls out);
  - a card with no `cardWatchFor` renders no *Watch for* label and no empty row (the empty-optional
    regression);
  - a spell with `cardMark` blank renders a `<use>` pointing at its **pack** sigil, not an empty
    `<use>` (the sigil-fallback regression);
  - a spell card front and a reference card front are distinguishable by their kind badge text and by
    their `<use href>`.
- Run `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/blocks/spellCardDeck.spec.ts`
  and confirm **RED** before writing the view.

**Validation**:
- [Automated]: `dotnet test umbraco-17-demo-site.sln --no-build -c Release` from the repo root —
  `BlockRenderCoverageTests` is now **GREEN**; it was RED at the end of Step 2.
- [Automated]: the new E2E spec passes.
- [Automated]: `cd src/UmbracoProject && dotnet build` is clean and warning-free.
- [Manual]: `/spellbook` renders every stack and the Core panel's 16 cards as unstyled markup, with no
  Razor error and no missing-view message.
- [Manual]: visiting a card's own URL directly redirects to `/spellbook#deck/core/<slug>`, and the
  search result from Step 3 now lands there instead of 404ing.

---

### Step 6 — The deck stylesheet

> **Prompt**: Implement Step 6 of `_work/spell-cards/plan.md`. Create
> `src/UmbracoProject/wwwroot/assets/css/spell-cards.css` and link it from `master.cshtml` after
> `blocks.css`. Build the whole visual system from the design reference — read `README.md` §*The card*,
> then rounds 2, 3, 4 and 5 in order, each superseding the last where they disagree. Honour the two
> deliberate deviations in the plan's Key Decisions: the equal-height mechanism is
> `grid-auto-rows: 1fr` with both faces in one grid cell (or the per-row fallback, if Step 1 said so —
> check the OQ5 entry before you start), and there is **no** `aspect-ratio` on the card. Scope the
> root-font-size step-down to `.spell-deck` rather than to `html`. Write the equal-height and
> no-clipping E2E assertions **first** and confirm they are RED.

**What to build** in `spell-cards.css`:
- Deck-scoped custom properties on `.spell-deck`: the four pack accent triples
  (`--sc-accent-ink`, `--sc-accent-dark`, `--sc-on-accent`) under
  `.spell-deck__stack--core` / `--umbraco-17` / `--umbraco-cloud` / `--dotnet` and their panel and card
  descendants, plus a neutral default for an unknown pack key; the three paper-edge values; and the
  existing `--dc-*`, `--text-*`, `--surface-*`, `--border-*` tokens by reference, never by literal.
- **Stack tile**: `aspect-ratio: 224/404`, `max-width: 224px`, `container-type: inline-size`, three
  warm paper edges stepping down-and-right in 5px increments, and every interior offset a
  `clamp(min, N cqi, max)` resolving at its design value at 224px.
- **Stack row**: `grid-template-columns: repeat(auto-fit, minmax(min(176px, 45%), 1fr))`, gap
  `28px 26px`, capped at four tile-widths. The floor is a **percentage** — a flat 176px floor plus the
  gap exceeds a phone's content width and would silently collapse the row to one-up (AC 20).
- **Open-stack signalling on seven axes**, all on the one element: accent strip, corner mark, base
  rule, pointer, sigil ink and motion, plane value, lift. Closed stacks: paused sigil regardless of
  `data-sigil-motion`, `#9A948D` at 0.5 opacity, `#1A1A1E` plane, no pointer.
- **Panel**: 26px top margin, one 250ms fade-and-rise on the panel as a whole (never per card), header
  and section headers per round 2. Panel header count and buttons wrap onto their own row rather than
  compressing; every interactive control keeps a **44px minimum hit height at every width**.
- **Section grid**: `repeat(auto-fill, minmax(min(400px, 100%), 1fr))`, gap `44px 32px`,
  `grid-auto-rows: 1fr`, and **no** `align-items: start`.
- **Card**: `container-type: inline-size`, `max-width: 400px`, every interior clamp recomputed against
  400px (`N = max / 4.00`), radius 0, one shadow value. `perspective: 1400px` on
  `.spell-card__perspective`, never on the button. Inner element `transform-style: preserve-3d`,
  `transition: transform 550ms cubic-bezier(.4,0,.2,1)`, `rotateY(0deg | 180deg)`. Both faces at
  `grid-area: 1 / 1` with `backface-visibility: hidden` and **no** `position: absolute`, **no**
  `overflow: hidden`.
- **Face and reverse** per round 1 §*The card* as amended by round 2's face table and round 3 §5 (the
  kind rule is **gone** from both kinds). The reverse's stat grid is
  `repeat(auto-fit, minmax(min(130px, 100%), 1fr))`.
- **Never set `display` on `.spell-deck__panel` without pairing it with `[hidden]`.** The three closed
  panels rely *solely* on the UA stylesheet's `[hidden] { display: none }` — there is no `is-closed`
  class. A rule like `.spell-deck__panel { display: block }` beats the UA rule on specificity and
  blows all four panels open, silently defeating the single-open guarantee the E2E asserts. Write
  `.spell-deck__panel[hidden] { display: none }` alongside any such rule. Flagged independently by the
  Step 5 implementer and the Step 5 accessibility review.
- **One breakpoint at 700px**, switching `.spell-deck__card-row` from a scroll-snap flex row to a grid
  **and** hiding `.spell-deck__carousel-nav` in the *same* rule. Carousel items are
  `clamp(240px, 82vw, 360px)` — a viewport floor, so no card can exceed the viewport (AC 21) — and the
  row is `align-items: stretch` so equal height comes for free in carousel mode.
- **Motion gate**: `--sig-play`, with all three cascade traps from `README.md` honoured (declare the
  gate **after** every `animation` shorthand; use explicit resting values, not a `var()` fallback;
  scope the sprite's paused default **by id**, not by attribute). `prefers-reduced-motion: reduce` sets
  every sigil to `paused`, `animation: none` on the panel reveal, and `transition: none` on the flip's
  inner element — state still changes, nothing animates.

- **Six constraints the Step 4 review surfaced. All are cheap here and expensive after the keyframes
  are written.**
  1. **Never `!important` on an animation property in `spell-cards.css`.** A global reduced-motion
     reset at `styles.css:11845` sets `animation-duration`/`transition-duration` to `0.01ms
     !important` on `*`. `spell-cards.css` loads *after* `styles.css`, so an `!important` here would
     **win** against that reset and silently break AC 13.
  2. **That reset collapses duration; it does not disable animation.** Under reduced motion each mark
     still runs, near-instantly, and lands on its **terminal keyframe**. So every mark's intended
     resting geometry must equal its terminal keyframe, or reduced-motion visitors see a different
     drawing from the static one. Design each keyframe set to end where the mark should rest.
  3. **`sig-blink` must stay under 3Hz** with a soft opacity ramp rather than a hard 0↔1 cut. Fifteen
     blink shapes across eight symbols, with up to sixteen marks animating at once in an open Core
     stack, is an aggregate flashing area that could otherwise approach **WCAG 2.3.1 Three Flashes
     (Level A)**. Keep the sprite's existing per-shape `animation-delay` stagger — it is what stops
     instances phase-locking into a synchronised strobe.
  4. **`sig-spin` / `sig-spin-rev` shapes sit off-origin** inside the 120×120 viewBox with no
     recentring `<g>`. A CSS `rotate()` will pivot around the wrong point without
     `transform-box: fill-box` (or an explicit `transform-origin`).
  5. **Prefer `transform` and `opacity` over `width` and `stroke-dashoffset`.** The `sig-scan` rects
     and `sig-draw` paths are shaped to invite animating paint-triggering properties directly; with
     sixteen marks live at once that is a lot of concurrent paint invalidation. `transform: scaleX()`
     with `transform-origin: left` is the cheap equivalent.
  6. **`sig-trace` circles are authored at `cx="0" cy="0"`** (three of them, in `sig-dotnet`), which
     only makes sense as an `offset-path` traversal — main-thread bound in current engines. Transform
     keyframes would be cheaper but need different base coordinates. Decide before locking the
     technique in.
- **Page gutter** `clamp(36px, 7vw, 64px) clamp(16px, 5vw, 40px)`; the deck's own `font-size: 17px`
  under `@media (max-width: 399px)`, with the deck's type in `em`.

Also: `master.cshtml` gains one `<link>` after `blocks.css`.

**Test first**:
- Extend `tests/e2e/blocks/spellCardDeck.spec.ts` with the equal-height behaviour, which is the one
  criterion the design's own mechanism could not hold and so deserves a real assertion, not a
  screenshot:
  - every spell card in the open Core stack reports the **same** `offsetHeight`;
  - every reference card reports the same height as each other, and the two groups **need not match**;
  - for every card, `scrollHeight <= offsetHeight` — nothing clipped (AC 14/18);
  - flip the longest card and re-assert: still no clipping.
- Add a guard to
  [tests/UmbracoProject.Tests/BlockCssPortabilityTests.cs](../../tests/UmbracoProject.Tests/BlockCssPortabilityTests.cs)
  in the house style: `spell-cards.css` contains the `.spell-deck` and `.spell-card` base rules, is
  never scoped under a page selector, and `master.cshtml` links it — so the block's CSS cannot later
  be trapped on one page.
- Run both and confirm **RED** before writing any CSS.

**Validation**:
- [Automated]: the E2E equal-height assertions and the CSS-portability guard both pass;
  `dotnet test umbraco-17-demo-site.sln --no-build -c Release` from the repo root is green.
- [Manual, and this one matters]: open `/spellbook` **in a real browser**. Judge the flip and the
  sigil tinting there and nowhere else — DOM-cloning screenshot tools render backs mirrored and
  face-up and accent shapes black, and that is a tooling artefact, not a defect. Confirm: three warm
  paper edges under each tile; only the open stack carries its pack accent, full-ink sigil and motion;
  the flip reads as one box turning, not two mirrored layers.
- [Manual]: resize from 1400px to 320px continuously. The stack row never drops below two columns; no
  card exceeds the viewport; the card row becomes a scroll-snap row below 700px and the arrows appear
  in the same moment.

---

### Step 7 — Deck state: open/close, flip, flip-all

> **Prompt**: Implement Step 7 of `_work/spell-cards/plan.md`. Create
> `src/UmbracoProject/wwwroot/assets/js/spell-cards.js` and link it from `master.cshtml` after
> `carousel.js`. It opens with an early return when no `.spell-deck` is on the page. Implement three
> behaviours and nothing else — URL state and the carousel are Steps 8 and 9. **Single-open stacks**:
> activating a closed stack opens it and closes the previously open one; activating the open stack
> closes it, leaving the row alone; `aria-expanded` and the panel's `hidden` attribute both track the
> state; focus **stays on the stack button that was activated** and never falls to `<body>`. **Per-card
> flip**: toggles `aria-pressed`, swaps `aria-hidden` between the two faces, updates the `aria-label`
> to say the card is showing details, and does not move focus. Because all four panels stay in the DOM,
> flip state survives a stack round-trip with no bookkeeping — do not add any. **Flip all**: the panel
> header's toggle turns every card in the open stack and inverts its own label; it does not move focus.
> Reuse the conventions from `carousel.js`, not Bootstrap Carousel or Swiffy Slider. Write the E2E spec
> first and confirm it is RED.

**What to build**:
- `spell-cards.js` — a single IIFE in the repo's existing style (`'use strict'`, `var`, feature-guarded,
  `DOMContentLoaded` fallback), with a documented header comment listing its behaviours the way
  `carousel.js` does.
- One `<script>` line in `master.cshtml`.

**Test first**:
- Write `tests/e2e/blocks/spellCardDeckState.spec.ts` covering exactly the behaviours in this step:
  - Core is open on arrival and its cards are visible;
  - opening umbraco-17 hides Core's cards and shows umbraco-17's; `aria-expanded` moves with it;
  - activating the open stack closes it, all four stacks remain, and no cards are visible;
  - flipping `/plan` shows its reverse and leaves `/spec` on its front;
  - a flipped `/plan` is **still flipped** after opening dotnet and reopening Core;
  - **Show all backs** in the dotnet stack turns all three cards and the control's label inverts.
- Run it and confirm **RED**.

**Validation**:
- [Automated]: `npx playwright test tests/e2e/blocks/spellCardDeckState.spec.ts` passes.
- [Automated]: the Step 5 and Step 6 specs still pass.
- [Manual]: with JavaScript **disabled**, `/spellbook` still shows the Core panel open and readable —
  the server render is the baseline, not a placeholder.

---

### Step 8 — URL state and scroll-into-view

> **Prompt**: Implement Step 8 of `_work/spell-cards/plan.md`, extending
> `src/UmbracoProject/wwwroot/assets/js/spell-cards.js`. Add hash-based deep linking using the
> namespaced form `#deck/<stack-slug>` and `#deck/<stack-slug>/<card-slug>` — read the OQ4 entry in the
> plan's Key Decisions for why the `deck/` prefix is load-bearing. Write the hash with
> `history.replaceState` on open, close and flip (**never** `pushState` — thirty flips must not fill
> the back button). Read it on load and on `hashchange`, so browser back/forward and a pasted link both
> work. An unknown stack key leaves the server-rendered default open; an unknown card key still opens
> its stack. Closing every stack clears the hash to `#deck`. Then implement scroll-on-open (Decision
> 14, flagged by the design since round 3 and never built): opening a stack scrolls its panel into
> view, and arriving on a link to a stack or a card scrolls that target into view — using
> `behavior: 'smooth'` normally and `'auto'` when `prefers-reduced-motion` matches. Write the E2E spec
> first and confirm it is RED.

**What to build**:
- Hash read/write/parse in `spell-cards.js`, plus a `hashchange` listener.
- `scrollIntoView` on open and on load, reduced-motion aware.

**Test first**:
- Write `tests/e2e/blocks/spellCardDeckLinks.spec.ts`:
  - opening umbraco-17 rewrites the URL to `…#deck/umbraco-17`;
  - flipping `/code-review` in Core rewrites it to `…#deck/core/code-review`, and the browser history
    length has **not** grown by one entry per flip;
  - loading `…#deck/core/code-review` in a fresh page opens Core, shows `/code-review` flipped, and
    scrolls it into view;
  - loading `…#deck/sitecore` leaves the default Core stack open and does not error;
  - loading `…#deck/core/not-a-card` opens Core with every card on its front;
  - closing the open stack leaves `#deck`.
- Run it and confirm **RED**.

**Validation**:
- [Automated]: the new spec passes; Steps 5–7 specs still pass.
- [Manual]: copy the URL after flipping a card, open it in a new window, and confirm the deck arrives
  in that state with the card in view. Do this on a phone-width window too, where the panel starts
  below the fold — that is the case Decision 14 exists for.

---

### Step 9 — Narrow viewport: the scroll-snap carousel and its arrows

> **Prompt**: Implement Step 9 of `_work/spell-cards/plan.md`, extending
> `src/UmbracoProject/wwwroot/assets/js/spell-cards.js`. Wire the prev/next controls Step 5 already
> emitted and Step 6 already styled. Scroll distance is **measured, not guessed**: read the rendered
> width of the row's first `.spell-deck__card-item` at click time and `scrollBy` that plus the gap, so
> one press advances exactly one card at any viewport. Both arrows stay enabled; a press at either end
> is a no-op because the browser clamps `scrollLeft` — do not add a disabled state. Do not initialise
> Bootstrap Carousel or Swiffy Slider; do not manage focus or `aria-hidden` on off-screen cards, which
> would fight the per-face `aria-hidden` contract each card already carries. Write the E2E spec first
> and confirm it is RED. End the step by looking at Core's 16 cards on a 390px screen and recording an
> answer to the spec's Open Question 1.

**What to build**:
- `scrollSection(row, dir)` in `spell-cards.js`, plus the prev/next click handlers, resolved per
  section.
- **Two different "nothing happens" cases, and they resolve differently.**
  - **At either end of a row that CAN scroll** — both arrows stay **enabled**. The browser clamps
    `scrollLeft`, so the press is a harmless no-op, and disabling on reaching an end means recomputing
    on every scroll event for a signal the visitor gets from the row itself. This is the design's
    "no disabled state at the ends".
  - **A section with nowhere to go** gets `disabled` on both arrows. Offering a live control that can
    never do anything is the case the Step 6 review flagged, and it is a different case from being at
    an end. **`umbraco-cloud` is the live fixture**: it holds one spell and one reference, so both its
    sections have exactly one card.
    **Count travel in CARDS, not pixels.** `scrollWidth <= clientWidth` looks like the test and is
    not: a single card is `clamp(240px, 82vw, 360px)` in a scrollport narrower than that, so at 390px
    a one-card section measures `scrollWidth 330` against `clientWidth 307` and reads as scrollable
    when it holds nothing to scroll to. Verified on the live page. The condition that holds is
    `items.length > 1 && scrollWidth - clientWidth > 1`.

**Test first**:
- Write `tests/e2e/blocks/spellCardDeckNarrow.spec.ts`:
  - at **390px**, the open stack's cards are a single scrollable row, prev/next controls are visible,
    and no card is wider than the viewport;
  - pressing next moves `scrollLeft` by exactly one card width plus the gap;
  - pressing next at the last card moves nothing and throws nothing;
  - pressing prev at the first card moves nothing and throws nothing;
  - at **1200px**, the cards are a grid and no prev/next control is visible;
  - at **320px**, the stack row still shows two stacks per row and a flipped card's content is fully
    readable.
- Run it and confirm **RED**.

**Validation**:
- [Automated]: the new spec passes; Steps 5–8 specs still pass.
- [Manual]: on a real 390px window, swipe the Core spells with a trackpad and confirm the next card
  peeks in from the right rather than snapping to a full-bleed slide.
- [Manual, and this is Open Question 1]: scroll Core's 16 cards on a phone width and judge whether the
  carousel is enough on its own or whether the section wants a collapse. Write the answer into the
  feature doc's Increments section — as a follow-on increment if the answer is "it wants one".

---

### Step 10 — Keyboard, screen reader, reduced motion, and the visual baselines

> **Prompt**: Implement Step 10 of `_work/spell-cards/plan.md`. This step closes the accessibility
> contract and lays down the screenshot baselines. Write the two specs described below **first**,
> confirm RED, then fix whatever they surface in the view, CSS or JS from Steps 5–9. Do **not**
> generate screenshot baselines locally — this repo's baselines are Linux-only and are produced by the
> `update-snapshots.yml` GitHub workflow. Commit the screenshot specs with no `-darwin.png` files, and
> never regenerate a baseline to make a diff pass.

**What to build**: fixes only — no new production files. Expect the surfaced work to be in
`aria-label` wording, focus handling, the `--sig-play` gate's cascade, and the reduced-motion rules.

**Test first**:
- `tests/e2e/accessibility/spellCardDeck.spec.ts`:
  - keyboard only: Tab to the umbraco-17 stack, activate it, and assert the stack **opens** and
    **focus stays on the stack button** — this is a deliberate design decision and the intuitive
    alternative (moving focus into the panel) is wrong, so assert it rather than assuming it;
  - from there, Tab to a card and activate it; the card flips and focus does not move;
  - the reverse carries `aria-hidden="true"` while the card shows its front, and the face carries it
    once flipped — so a screen reader is offered only the facing side;
  - the card's accessible name states its name, its kind, and how to turn it, and changes when flipped;
  - the prev/next buttons have accessible names from their `aria-label`s;
  - run the repo's existing axe helper over `/spellbook` with the Core stack open and with a card
    flipped;
  - with `prefers-reduced-motion: reduce` emulated: open a stack, flip a card, and assert **every
    state change still happens** while no sigil animates, the panel does not animate in, and the flip
    has no transition.
- Add one **sitemap regression assertion** to `tests/e2e/blocks/spellCardDeck.spec.ts`: fetch
  `/sitemap.xml` and assert it contains **no** stack or card URL. This is cheap and it closes a real
  gap the Step 2 review surfaced. `IsVisible()` returns **true** when `umbracoNaviHide` is absent, and
  the card types deliberately do not compose Visibility Controls — so the only thing keeping thirty
  card URLs out of the sitemap is the tick on the four stack nodes, which the sitemap partial then
  never descends past. That protection is **content state, not schema**: a fifth stack added later
  without the tick silently leaks its cards. The assertion turns a silent leak into a failing test.
- `tests/e2e/pages/spellbook.screenshot.spec.ts` — three captures **at real card counts**, since
  sample-size content is precisely what hid the scale problem in the first design round: the resting
  stack row with every stack closed; the Core stack open; and one at phone width. Follow the existing
  `prepareForScreenshot` / `screenshotOptions` conventions from
  [tests/e2e/pages/home.screenshot.spec.ts](../../tests/e2e/pages/home.screenshot.spec.ts).
  **Every capture includes the header, which is a 60-minute cached partial** (`master.cshtml:34`).
  A baseline taken against a warm cache can bake in a nav that predates the Spellbook page — and
  because baselines are generated on CI against Dev, that is a stale-content bug nobody would think
  to look for. Confirm the nav shows Spellbook before accepting the baselines.

**Validation**:
- [Automated]: the accessibility spec passes; every earlier spec still passes;
  `dotnet build -c Release` and `dotnet test umbraco-17-demo-site.sln --no-build -c Release` from the
  repo root are both green (the pre-push hook runs exactly these).
- [Automated]: the screenshot spec runs and produces baselines **on CI via `update-snapshots.yml`** —
  not locally.
- [Manual]: turn on the OS reduced-motion setting and use the deck by hand. Nothing moves; everything
  still works.
- [Manual]: run `/code-review` — it dispatches `code-reviewer`, `accessibility-reviewer` and
  `perf-reviewer` over the diff.

---

### Final — Record the durable behaviour *(a spell you cast, not an implement-step)*

**Do not number this as an implementation step.** Cast it directly once the implement-step loop
finishes; dispatching a code worker to run a spell is the wrong mechanism.

> **Prompt**: Run `/feature update spell-card-deck` to verify the living behavioural doc reflects the
> actual implementation. Review each scenario in `_work/spell-cards/spec.md` → *Scenarios (Draft)*
> against the code and the test results. Update any scenario where the implementation diverged from the
> draft — in particular, check AC 18's wording against what Step 1's spike actually settled ("equal
> within a section" vs. the per-row fallback), and record the one-deck-per-page hash constraint and the
> Open Question 1 answer from Step 9. Fill in the test coverage table with real test paths and line
> numbers. Remove the "Draft" banner.
>
> Then add one entry to the doc's **Increments** section, as the migration this capability should take
> when the site moves to Umbraco 18: *move stacks and cards from content-tree nodes to **Elements**.*
> Elements live in a Library rather than the content tree, are not routable and carry no template, and
> are consumed through an Element Picker — which is what this data always wanted to be. It would delete
> `spellCardRedirect.cshtml`, both visibility ticks on the stacks, the sitemap reasoning, and most of
> the reason `spellbook` is its own document type. Note the two open questions with it: whether a
> Library supports editor-controlled ordering (if not, invert the relationship so a stack holds an
> Element Picker of its cards and picker order is the order), and whether elements are indexed for site
> search (if not, Decision 6 must be re-made — which also removes the only reason the redirect template
> exists). Cross-reference *Keep content resolution in one place* in this plan, which is the seam that
> keeps the migration to a schema change plus one `@{ }` block. Commit the verified doc.
>
> **Validation**: Every scenario matches observable behaviour; the coverage table has no unexpected
> "Not covered" gaps.

---

## File Summary

| Action | File |
|--------|------|
| Create (delete after running) | `<scratchpad>/grid-auto-rows-spike.html` + its measuring script |
| Create (delete after running) | `<scratchpad>/sigil-tint-harness.html` |
| Modify | `src/UmbracoProject/umbraco/Deploy/Revision/*.uda` (new doc types, element types, data types, palette + template artifacts) |
| Modify | `src/UmbracoProject.Features/Models/Generated/*.generated.cs` (regenerated; new models committed) |
| Create | `src/UmbracoProject/Views/Partials/_SpellSigils.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blocks/Components/spellCardDeck.cshtml` |
| Create | `src/UmbracoProject/Views/spellbook.cshtml` (thin near-copy of `content.cshtml`) |
| Create | `src/UmbracoProject/Views/spellCardRedirect.cshtml` |
| Create | `src/UmbracoProject/wwwroot/assets/css/spell-cards.css` |
| Create | `src/UmbracoProject/wwwroot/assets/js/spell-cards.js` |
| Modify | `src/UmbracoProject/Views/master.cshtml` (one `<link>`, one `<script>`) |
| Modify | `tests/UmbracoProject.Tests/BlockCssPortabilityTests.cs` (deck stylesheet guard) |
| Create | `tests/e2e/blocks/spellCardDeck.spec.ts` |
| Create | `tests/e2e/blocks/spellCardDeckState.spec.ts` |
| Create | `tests/e2e/blocks/spellCardDeckLinks.spec.ts` |
| Create | `tests/e2e/blocks/spellCardDeckNarrow.spec.ts` |
| Create | `tests/e2e/accessibility/spellCardDeck.spec.ts` |
| Create | `tests/e2e/pages/spellbook.screenshot.spec.ts` (baselines generated on CI only) |
| _(work type: `new-capability`)_ Create/Update | `_features/spell-card-deck.md` |
