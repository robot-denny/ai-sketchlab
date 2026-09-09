# Spec for cantrip-toolkit-refresh

> This spec captures initial requirements and design rationale. For **current system
> behavior**, see the doc named on the **Work type** line below — a new feature doc for a new
> capability, an existing feature doc for a change, or a `docs/` runbook for a fix.

branch: claude/feature/cantrip-toolkit-refresh
design reference (if any): none — no visual change; the deck's design is unchanged from
`_work/shipped/spell-cards/`

**Work type**: change-to spell-card-deck
**Feature doc**: spell-card-deck
<!--
  change-to, not new-capability: the deck exists and ships. This increment changes what its
  cards say and how many there are. The acceptance criteria read as a transition from a
  32-unit roster to a 34-unit one, which is the tell.
-->

## Summary

Bring the site's public spell card deck from Cantrip's **32-unit snapshot** (verified 2026-09-02)
to its **current 34-unit roster**, so the deck is accurate as both a public showcase and the
team's cheatsheet reference.

**This is increment 2 of the seven in [discovery.md](discovery.md).** Increment 1 — the toolkit
refresh — shipped as PR #69 and is what makes the five-status coverage vocabulary available to
this increment's feature-doc update. Increments 3–7 (reconciling old and new skills, the guides
foundation, styleguide adoption, the `/guide` trial, and the regeneration) are **out of scope
here** and will earn their own increment bundles.

The work is smaller than discovery assumed, because measurement replaced two assumptions:
**there is no schema change**, and **the field caps are a non-issue**. What remains is content,
three screenshot baselines, and the feature doc.

## Measured Scope

> Measured 2026-09-08 against Cantrip `origin/main` (`6f38942`), with the CMS's current state
> taken as Cantrip `d74789a` — the snapshot the feature doc records as verified field-by-field on
> 2026-09-02. Recorded here so `/plan` and any later reader do not re-derive it.

### The roster delta

| | Count | Which |
|---|---|---|
| Added | 2 | `prose-discipline`, `security-review-rules` — **both `Reference`, both Core** |
| Copy re-voiced | 27 | all 16 spells + 11 of 17 references, by Cantrip `65aec71` (the `prose-discipline` rewrite) |
| Unchanged | 5 | `workflow`, `tdd-principles`, `umbraco-17-starter-facts`, `umbraco-17-review-rules`, `umbraco-deploy-facts` — all references |

### Per-stack counts, before and after

| Stack | Now | Target | Change |
|---|---|---|---|
| Core | 17 (11 spells, 6 references) | **19 (11 spells, 8 references)** | +2 references |
| umbraco-17 | 10 (4 spells, 6 references) | 10 | copy only |
| umbraco-cloud | 2 (1 spell, 1 reference) | 2 | copy only |
| dotnet | 3 (0 spells, 3 references) | 3 | copy only |
| **Total** | **32** | **34** | |

**Only the Core stack's count changes.** The other three keep their counts and change only copy.

### The edit job: 46 fields, not ~290

| Field | Edits |
|---|---|
| `Does` | 17 |
| `Watch for` | 11 |
| `Cast` | 4 |
| `Needs` | 4 |
| `Leaves` | 4 |
| `Holds` | 2 |
| `Triggers` | 2 |
| `Modes` | 1 |
| `Then` | 1 |
| **Total** | **46** across 27 cards |

Most cards need one or two fields. The heaviest are `/spec`, `/feature`, `/commit-message` and
`/retrofit` at three each. Plus the two new cards, authored from scratch.

### The caps are a non-issue — this is transcription, not adjudication

Discovery left this open. Measured:

- **`Does`: 0 of 34 over cap.** Every card is within Cantrip's stated 2 sentences / ≤40 words.
- **Single-line growth is negligible.** 17 single-line fields changed; the largest growth is
  **+10 characters** (`/commit-message` → `Cast`, 40 → 50). Most are ±1 from punctuation.
- **No `Watch for` exceeds 170 characters.**
- **Nothing would reject over-long copy anyway.** Every card field is `Umbraco.TextBox` or
  `Umbraco.TextArea` with configuration `{}` — no `maxChars`. Over-long copy would not error, it
  would render badly. That is *why* measuring mattered even though the answer came back clean.

### No schema change, and no new sigil

Discovery assumed the two new cards would need a `<symbol>` in `_SpellSigils.cshtml` and a key in
the `cardMark` data type. **They do not**, because both new cards are references:

- `spellCardReference` has **no `cardMark` property** — only `cardTriggers` and `cardHolds`, plus
  the `spellCardFields` composition.
- The deck assigns `SigilId = referenceSigil` for every reference card — one shared mark — where
  spells resolve a per-spell mark through `SigilFor`.

So: no `.uda` edit, no sprite edit, and `SpellSigilRosterTests` is not in play.

### Field mapping, Cantrip card → site property

| Cantrip field | Site property | Editor | Applies to |
|---|---|---|---|
| `Type` | the document type itself (`spellCardSpell` / `spellCardReference`) | — | both |
| `Group` | the parent stack node | — | both |
| — | `cardTitle` | TextBox | both |
| `Cast` | `cardCast` | TextBox | spells |
| `Needs` | `cardNeeds` | TextBox | spells |
| `Leaves` | `cardLeaves` | TextBox | spells |
| `Triggers` | `cardTriggers` | TextBox | references |
| `Holds` | `cardHolds` | TextBox | references |
| `Does` | `cardDoes` | TextArea | both |
| `Modes` | `cardModes` | TextArea | both |
| `Watch for` | `cardWatchFor` | TextBox | both |
| `Then` / `Pairs with` | `cardFooterLabel` (dropdown) + `cardFooterValue` | Dropdown + TextBox | both |
| — | `cardMark` | Dropdown | **spells only** |

### The behavioural tests need no changes

`tests/e2e/_spellDeckFixture.ts` reads the roster from the Management API at test time, and says
why: *"Sourcing that from the Management API rather than hardcoding it is what lets the specs
assert BEHAVIOUR ('every stack shows its own count') instead of CONTENT ('Core shows 16'), so a
content edit in the backoffice cannot turn a deck spec red without a deck change."*

Confirmed by inspection: every `toHaveCount(N)` in the deck specs is structural (`0` or `1`) —
panels visible, cards turned. **No spec asserts a card count.** The concrete counts live in the
*feature doc's* scenarios, which is what this increment updates.

The three screenshot baselines **will** shift, because Core's count badge and panel both change.

## Functional Requirements

- The deck presents **34 cards** across the four existing stacks, with Core holding **19** (11
  spells then 8 references), umbraco-17 **10**, umbraco-cloud **2**, dotnet **3**.
- Two new **reference** cards exist under Core — `prose-discipline` and `security-review-rules` —
  each carrying every field Cantrip's published card defines for it, and each drawing the shared
  reference mark rather than one of its own.
- The 27 re-voiced cards carry Cantrip's current wording across all 46 changed fields.
- The 5 unchanged cards are **not** edited.
- No document type, data type, template, sigil sprite or `.uda` artifact is modified.
- Every card's copy renders inside its card, at desktop width and at 390px, without overflow or
  clipping beyond what the deck already does.
- The existing behavioural deck specs pass **unchanged**; the three screenshot baselines are
  regenerated deliberately.
- The capability doc records the new roster and re-states the deferred-drift limitation using the
  coverage vocabulary increment 1 introduced.
- The content reaches Live along the project's authoring direction — local → Dev → Live.

## Design Reference (only if one exists)

- Source: none. This increment changes card *content* only. The deck's stacks, card geometry,
  flip behaviour, marks and pack accents are unchanged from `_work/shipped/spell-cards/`.
- The one visual consequence is Core's count badge (17 → 19) and two more cards in the Core panel.

## Possible Edge Cases

- **Tree order decides section order.** The view renders spells then references, and within a
  section it uses *editor tree order*. The two new references must be positioned deliberately, or
  they land wherever creation put them and the deck's order stops matching Cantrip's published
  order.
- **A partially-applied run.** 46 edits across 27 nodes is long enough to be interrupted. Half the
  deck in the new voice and half in the old is worse than all-old, because the inconsistency is
  invisible per-card — each one looks fine alone.
- **Additive content transfer.** Transfers do not delete. A name collision with a stale target node
  creates a `(1)` duplicate at slug `-1`. The 27 edits update existing nodes, so the hazard is
  limited to the **two new cards** — and only if a node of that name already exists on Dev or Live.
- **`.uda` startup churn contaminating the diff.** Local startup rewrites the
  `umbraco-ai-context__*.uda` `Resources[].Id` GUIDs. This increment should change no `.uda` at
  all, so any `.uda` in the diff is churn and must be discarded, not committed.
- **Screenshot baselines regenerated by hand.** They must come from `update-snapshots.yml` after
  confirming the diff is only the count badge and the two new cards — a reproducing screenshot
  failure is a broken test, not flake.
- **An empty optional field must stay empty.** `cardWatchFor` and `cardModes` are omitted from the
  reverse when blank, and some cards deliberately exercise that. Writing a placeholder where
  Cantrip has no value would break the omit-an-empty-field behaviour.
- **Copy containing backticks or inline code.** Cantrip's card fields carry inline code spans. The
  site's fields are plain text editors; the copy must be carried as authored rather than rendered
  as markup.

## Acceptance Criteria

- **AC1** — A visitor sees 34 cards in total, with Core showing 19 and the other three stacks
  showing 10, 2 and 3.
- **AC2** — The Core stack holds two new reference cards, `prose-discipline` and
  `security-review-rules`, each with its full field set and the shared reference mark.
- **AC3** — Every one of the 27 re-voiced cards matches Cantrip's published card field-by-field.
- **AC4** — The 5 cards Cantrip did not change are byte-for-byte as they were.
- **AC5** — The change touches no schema: no `.uda`, no sprite symbol, no `cardMark` key.
- **AC6** — No card's copy overflows its card at desktop width or at 390px.
- **AC7** — The behavioural deck specs pass with no edits, and the three screenshot baselines are
  regenerated with the diff confirmed as intentional.
- **AC8** — The capability doc states the 34-unit roster, and its deferred-drift row reads
  `Ruled out — drift detection deliberately deferred` rather than `Not covered`.
- **AC9** — The new content is present on Live, with no `(1)` duplicate node and no broken card
  link.

## Scenarios (Draft)

Draft BDD scenarios derived from the acceptance criteria using Example Mapping. Each Rule maps
to an acceptance criterion; scenarios use concrete examples. These get verified and refined
after implementation — the feature doc holds the verified version.

### Rule: The deck presents the whole 34-unit toolkit, and only Core's count moved (AC1)

```scenario
Scenario: Arriving at the spellbook page after the refresh
  Given the deck has been brought to the 34-unit roster
  When a visitor opens the spellbook page on a desktop screen
  Then the "Core" stack shows "19 cards"
  And the "umbraco-17" stack shows "10 cards"
  And the "umbraco-cloud" stack shows "2 cards"
  And the "dotnet" stack shows "3 cards"
```

```scenario
Scenario: Core groups its cards with the two new references among them
  Given the "Core" stack holds 11 spells and 8 references
  When a visitor opens the "Core" stack
  Then they see a "Spells" heading above 11 cards
  And below them a "References" heading above 8 cards
```

### Rule: The two new reference cards read like every other reference (AC2)

```scenario
Scenario: Reading the security-review-rules card
  Given the "Core" stack is open
  When a visitor turns the "security-review-rules" card
  Then its reverse states what it triggers on and what it holds
  And its footer is labelled "Pairs with"
  And it is marked as a "Reference"
```

```scenario
Scenario: A new reference draws the shared reference mark
  Given the "Core" stack is open
  When a visitor looks at the "prose-discipline" card
  Then it draws the same mark as every other reference card
  And no mark of its own was added to the deck's artwork
```

### Rule: Every re-voiced card carries Cantrip's current wording (AC3, AC4)

```scenario
Scenario: A re-voiced spell reads as Cantrip publishes it
  Given Cantrip's published card for "/retrofit" says its watch-for is
        "run it before you commit, or before you push if you already committed."
  When a visitor turns the "/retrofit" card
  Then the card states exactly that
```

```scenario
Scenario: A card Cantrip did not change is left alone
  Given Cantrip did not change the "umbraco-deploy-facts" card
  When the refresh is applied
  Then the "umbraco-deploy-facts" card is not edited
```

### Rule: The refresh is content only — no schema moves (AC5)

```scenario
Scenario: The change carries no schema
  Given the refresh has been applied and staged
  When a reviewer inspects what changed
  Then no document type, data type, template or deck artwork was modified
  And the only schema-shaped files in the working tree are startup churn, discarded
```

### Rule: The new copy fits the cards it was written for (AC6)

```scenario
Scenario: The longest card body still fits on a phone
  Given the card with the longest "Does" text has been updated
  When a visitor views it at 390px wide
  Then its text sits inside the card
  And nothing is clipped beyond the deck's existing edge treatment
```

### Rule: Behaviour is unchanged, so only the pictures need re-taking (AC7)

```scenario
Scenario: A content refresh does not turn a behavioural spec red
  Given only card content changed
  When the deck's behavioural specs run against the updated site
  Then they pass without any edit to the specs
```

```scenario
Scenario: The baselines are re-taken deliberately
  Given Core's count badge changed from "17 cards" to "19 cards"
  When the screenshot baselines are regenerated
  Then the accepted diff shows the count badge and two extra cards
  And nothing else in the deck's appearance changed
```

### Rule: The capability doc tells the truth about the roster and the known gap (AC8)

```scenario
Scenario: A reader learns the deck's deferred limitation was a decision
  Given drift detection remains deliberately out of scope
  When a reader opens the capability doc's coverage table
  Then the row for a toolkit gaining an unknown spell reads
       "Ruled out — drift detection deliberately deferred"
  And it is not presented as a gap nobody has reached
```

### Rule: The content reaches Live intact (AC9)

```scenario
Scenario: The two new cards arrive on Live without duplicating
  Given the two new cards have been transferred from local to Dev to Live
  When a visitor opens the spellbook page on Live
  Then both new cards are present exactly once
  And neither sits at a slug ending "-1"
```

## Open Questions

- **Where exactly do the two new references sit in Core's order?** Within a section the view uses
  editor tree order, and Cantrip's published order is the reference. Does `prose-discipline` go
  beside the other discipline references, and `security-review-rules` beside
  `reviewer-discipline`? `/plan` should settle the positions rather than leave them to creation
  order. --Keep them ordered thematically, so the prose-discipline should be beside the other discipline references.
- **Which of the three screenshot baselines actually shift?**
  `spellbook-stacks-closed` and `spellbook-core-open` certainly do. `spellbook-phone` is
  unconfirmed — it depends on whether the phone view shows Core's count or its cards.
- **Does the script apply to Dev and Live too, or only local?** Discovery chose local → Dev → Live
  by transfer. If the script can target an environment, re-running it against Dev may beat a
  content transfer for the 27 edits, while the 2 new nodes still need creating somewhere. 
- **Is a partial-run guard needed?** 46 edits is long enough to be interrupted, and half-refreshed
  is invisible per-card. Whether that earns resumability or just a single-sitting run is a
  planning call.
- **Does the card copy need any adaptation at all,** given inline code spans in Cantrip's source
  and plain-text fields on the site? Measured as within caps, but not inspected for markup.

## Testing Guidelines

Meaningful checks for a content change, without over-testing it:

- **The behavioural deck specs must pass unedited.** That is the actual assertion of this
  increment: the fixture reads the roster from the Management API, so if a spec needs editing to
  go green, something structural changed that this increment did not intend.
- **`SpellSigilRosterTests` stays green with no edit** — proving AC5's claim that no mark was
  added. It is the existing guard for the mark seam and it should have nothing to say here.
- **Screenshot baselines regenerated only via `update-snapshots.yml`**, after confirming the diff
  is the count badge plus two cards. A reproducing screenshot failure is a broken test, not flake.
- **One human read of the rendered deck at 390px**, on the longest `Does` and the longest
  `Watch for` — the caps measured clean, but nothing in the CMS enforces them, so the only real
  check is looking.
- **A field-by-field re-verification against Cantrip `origin/main`** as the closing step, the same
  way the 2026-09-02 refresh was verified. That is what lets the feature doc's "Last verified" line
  name a commit rather than a date alone.
- **No new tests are earned.** Card content is content, not behaviour — the capability doc already
  records that some coverage rows are uncovered for exactly this reason.
