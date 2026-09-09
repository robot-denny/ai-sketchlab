# Plan: Cantrip Toolkit Refresh: Spellbook Content

**Spec**: `_work/cantrip-toolkit-refresh/spec.md`
**Branch**: claude/feature/cantrip-toolkit-refresh
**Work type**: change-to spell-card-deck
**Feature doc**: spell-card-deck

## Context

Bring the public spell card deck from Cantrip's 32-unit snapshot to its current 34-unit roster:
two new Core reference cards, plus **56 field edits across 28 existing cards** once Cantrip's
markdown markup is normalized away. The spec's **Measured Scope** section settles the delta, the
field mapping, the markup policy, and the fact that **no schema changes** — both new cards are
references, and references carry no `cardMark`.

The unit of work here is not a vertical code slice. It is **a content migration with a throwaway
tool**: build the tool, prove its report against numbers already measured, apply, verify the
deck's existing behavioural specs still pass untouched, then walk the content local → Dev → Live.
The deck itself — views, CSS, schema, artwork — is not edited at any point.

---

## Key Decisions

- **The tool lives at `scripts/spell-card-sync/`, mirroring `scripts/guide-generator/`** (`src/` +
  `test/`, run through `tsx`). That sibling already solves this exact shape — read a source of
  truth, walk content via the Management API, render a unified diff, prompt `[y/N]`, PUT — so this
  is an adaptation of `diff.ts` and `umbracoApi.ts`, not a new invention.
- **The Cantrip source is a `--source` argument, never a hardcoded clone path.** The clone lives
  outside the repo at `/Users/dkardys/Sites/cantrip`, which is a machine-specific fact. Unit tests
  read a **committed fixture** instead, so they are hermetic and do not require the clone.
- **`npm run test:unit` uses explicit globs, not a wildcard.** It currently names
  `tests/image-generator/**/*.test.ts` and `scripts/guide-generator/test/**/*.test.ts`. A new
  script's tests **must be added to that glob in `package.json`** or they silently never run —
  a green suite that tested nothing. *Recommend recording this in
  `.agents/config/conventions.md` → `## Planning gotchas`; it is a standing constraint, not a
  fact about this increment.*
- **Tree order for the two new cards is settled, not left to creation order.** Within a section
  the deck renders in editor tree order. Cantrip's published Core-reference order is:
  `workflow, bdd-principles, tdd-principles, reviewer-discipline, `**`security-review-rules`**`,
  memory-discipline, design-system-authoring, `**`prose-discipline`**. So `security-review-rules`
  inserts at **position 5** and `prose-discipline` lands **last at position 8** — the first needs a
  sort after creation, the second does not.
- **The report's gate was wrong, and Step 2 found out — as intended.** The gate asked for *46 field
  edits across 27 cards*. That figure measures **Cantrip's delta between its own snapshots**, not the
  distance from the site, and the site never held Cantrip `d74789a` verbatim. Step 2 proved the
  classifier correct by feeding it `d74789a` as if it were live and reproducing the 46 exactly, then
  reported the real distance: **111–112 differing fields across 32 cards**. Corrected numbers are in
  the spec's *The actual write set* section; the gate below is restated.
- **Markdown markup is normalized away on write (decided 2026-09-09).** Cantrip's backticks and
  `**bold**` are markdown, not literal text, and `spellCardDeck.cshtml` HTML-encodes field values —
  so carried verbatim they reach the visitor as glyphs. Normalizing keeps the write set at **56
  fields across 28 cards** instead of 111, and it is what the original author already did by hand.
  **The normalizer must sit in the comparison path as well as the write path**, or the report can
  never return to zero and Step 3's gate becomes unreachable.
  Rendering the markup properly — `<code>` and emphasis on the card — is a follow-up for the
  capability doc's parking lot, because this increment does not touch the deck's views.
- **Matching Cantrip beats leaving cards alone.** The spec's original AC4 asked that the six cards
  Cantrip did not re-voice stay byte-for-byte untouched. Measurement showed the site diverges from
  Cantrip on some of them anyway, so that requirement is withdrawn: the goal is a deck that matches
  what Cantrip publishes, and any card is written if it differs.
- **Baselines can only be regenerated after the content reaches Dev.** `update-snapshots.yml`
  runs Playwright against the Dev `URL` and commits the PNGs back to the branch. That inverts the
  intuitive order: content to Dev *first*, baselines second. Baselines are **Linux-only** —
  regenerate via the workflow and never commit `*-darwin.png`.
- **Dev → Live is per-item selective.** That is the runbook's default, and it sidesteps the
  root-transfer hazard entirely: a root-level promotion is only safe just after a green CI run
  with no stray published `[E2E]` fixtures on Dev.
- **No schema step, and that is an assertion to verify rather than an assumption to hold.** Any
  `.uda` appearing in the working tree during this increment is local startup churn (the
  `umbraco-ai-context__*.uda` `Resources[].Id` rewrite) and must be discarded, never committed.
- **Commands used** (from `.agents/config/stack.md`): xUnit is
  `dotnet test umbraco-17-demo-site.sln --no-build -c Release` **from the repo root** — running it
  after `cd src/UmbracoProject` runs zero tests and still exits 0. Playwright is
  `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test`, targeting
  `https://localhost:44367` unless `UMBRACO_URL` overrides it.

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new session.

---

### Step 1 — Parse Cantrip's card source and map it to site properties

> **Prompt**: Implement Step 1 of `_work/cantrip-toolkit-refresh/plan.md`. Create
> `scripts/spell-card-sync/src/parse.ts` (turns Cantrip's `docs/spell-cards.md` into unit records:
> name, `Type`, `Group`, and each `- **Field:** value` line) and
> `scripts/spell-card-sync/src/map.ts` (turns one unit record into the site's property aliases per
> the field-mapping table in `_work/cantrip-toolkit-refresh/spec.md`). Write the tests FIRST at
> `scripts/spell-card-sync/test/parse.test.ts` against a committed fixture at
> `scripts/spell-card-sync/test/fixtures/spell-cards.sample.md` holding one spell and one
> reference — do not read the cantrip clone from a test. Add
> `scripts/spell-card-sync/test/**/*.test.ts` to the `test:unit` glob in `package.json`, or the
> tests will never run. Run `npm run test:unit` and confirm RED, then implement to GREEN.

**What to build**:
- `scripts/spell-card-sync/test/fixtures/spell-cards.sample.md` — one spell (with `Cast`, `Needs`,
  `Leaves`, `Then`) and one reference (with `Triggers`, `Holds`, `Pairs with`)
- `scripts/spell-card-sync/test/parse.test.ts`
- `scripts/spell-card-sync/src/parse.ts` — `parseUnits(markdown): UnitRecord[]`
- `scripts/spell-card-sync/src/map.ts` — `toProperties(unit): Record<string, string>`, emitting
  `cardCast` / `cardNeeds` / `cardLeaves` for spells, `cardTriggers` / `cardHolds` for references,
  and `cardDoes` / `cardModes` / `cardWatchFor` / `cardFooterLabel` / `cardFooterValue` for both
- `package.json` — extend the `test:unit` glob

**Test first**:
- Write `parse.test.ts` before either source file
- It should assert that the fixture yields two units; that the spell carries `Cast`/`Needs`/
  `Leaves` and the reference carries `Triggers`/`Holds`; that `Type` and `Group` are read; and
  that mapping a reference produces **no** `cardCast` and **no** `cardMark`
- Assert on the parsed values, not on the parser's internals — the mapping table in the spec is
  the contract, not the implementation
- Run `npm run test:unit` and confirm RED before implementing

**Validation**:
- [Automated]: `npm run test:unit` — the new `parse.test.ts` cases pass and the existing
  guide-generator and image-generator tests still run (confirm the count went **up**, proving the
  glob edit took effect)

---

### Step 2 — Report the diff against live content, and check it against the measured numbers

> **Prompt**: Implement Step 2 of `_work/cantrip-toolkit-refresh/plan.md`. Create
> `scripts/spell-card-sync/src/cli.ts` with a **read-only** `report` mode: authenticate via the
> Management API using `UMBRACO_CLIENT_ID`/`UMBRACO_CLIENT_SECRET` from `.env` the way
> `scripts/guide-generator/src/umbracoApi.ts` does, walk the Spellbook node → stacks → cards, and
> for each unit in `--source <path to cantrip>/docs/spell-cards.md` print a per-field diff against
> the live card. Write `scripts/spell-card-sync/test/report.test.ts` FIRST, asserting the
> diff-shaping function classifies a field as unchanged / changed / card-missing given fabricated
> pairs — no network in the test. The mode must write nothing. With the site running on
> `https://localhost:44367`, run it and report the summary. *(This prompt originally demanded
> **46 field edits across 27 cards, 2 missing, 5 untouched**. That gate was wrong — 46 is Cantrip's
> internal delta, not the distance from the site. The real figure is 112 across 32 cards; see Key
> Decisions. Left here as the step ran.)*

**What to build**:
- `scripts/spell-card-sync/test/report.test.ts`
- `scripts/spell-card-sync/src/umbracoApi.ts` — OAuth + request, adapted from the guide-generator
- `scripts/spell-card-sync/src/diff.ts` — unified diff rendering, adapted from the guide-generator
- `scripts/spell-card-sync/src/cli.ts` — `report` mode only; `--source` required; no writes
- `package.json` — a `spellcards:report` script entry

**Test first**:
- Write `report.test.ts` before `cli.ts`
- It should assert the classifier's output for three fabricated cases: identical values →
  unchanged; differing values → changed with both sides carried; a unit with no matching live card
  → missing. Feed it plain objects, never a live response
- Run `npm run test:unit` and confirm RED before implementing

**Validation**:
- [Automated]: `npm run test:unit` passes
- [Manual]: with the site running, `npm run spellcards:report -- --source /Users/dkardys/Sites/cantrip/docs/spell-cards.md`
  prints its summary. **This gate originally demanded 46/27/2/5 and that was wrong** — see Key
  Decisions. The run reported **112 field edits across 32 cards, 2 missing, 0 untouched**, which is
  correct: 46 was Cantrip's internal delta, not the distance from the site. The step's real output was
  the diagnosis — how much of the difference is markup versus copy — which is what settled the
  markup policy
- [Manual]: `git status` shows no content or schema files changed — this mode writes nothing

---

### Step 3 — Normalize the markup, then apply the 56 field edits with approval

> **Prompt**: Implement Step 3 of `_work/cantrip-toolkit-refresh/plan.md`. Extend
> `scripts/spell-card-sync/src/cli.ts` with an `apply` mode that renders each changed card's
> unified diff and prompts `Apply this card? [y/N]` before PUTting it, following the approval flow
> in `scripts/guide-generator/src/cli.ts`. **First add a markdown normalizer** and put it in both the
> comparison and the write path, so Cantrip's `` `code` `` and `**bold**` never reach a stored value —
> without it the report can never reach zero. It must never touch a card whose fields already match,
> and must never create a card — creation is Step 4. Run it against local and apply the **56 fields
> across 28 cards**; four existing cards should need no write. Then re-run `report` and confirm
> **0 field edits, 1 field clear, 2 cards missing**.

**What to build**:
- `scripts/spell-card-sync/src/normalize.ts` — strip markdown markup from a field value
- `scripts/spell-card-sync/test/normalize.test.ts`
- `scripts/spell-card-sync/src/diff.ts` — compare through the normalizer
- `scripts/spell-card-sync/src/cli.ts` — add `apply` mode with per-card `[y/N]`
- `package.json` — a `spellcards:apply` script entry

**Test first**: the normalizer **is** testable pure logic, so it gets a real test before the write
path. Assert it on hard-coded pairs — `` `code` `` → `code`, `**bold**` → `bold`, text with no markup
unchanged — and confirm RED via `npm run test:unit` before implementing. The write path itself gets no
unit test: a mock would only assert the mock. **Its RED→GREEN signal is the `report` re-run** — 56
edits before, 0 after.

**Validation**:
- [Automated]: `npm run test:unit` — the normalizer's cases pass
- [Automated]: `npm run spellcards:report -- --source …` after applying reports **0 field edits,
  1 field clear, 2 missing**. Zero *edits* is the proof the normalizer matches what the site already
  stores. The one clear is permanent by decision — see below
- [Manual]: open the Spellbook page locally and read the `/retrofit` card's reverse — its watch-for
  should read *"run it before you commit, or before you push if you already committed."*
- [Manual]: grep the applied values for a stray backtick or `**`; there should be none
- [Manual]: confirm the four cards that differ from Cantrip only by markup were never written — no
  approval should have been offered for them
- [Manual]: confirm `dotnet-conventions.cardWatchFor` still reads *"the guidance is broad, be sure to
  add your conventions to /.agents/config"*. **Decided 2026-09-09: the clear is declined.** Cantrip
  has never published a Watch for on that card in either snapshot, so its silence is not evidence the
  sentence is stale — it is this project's own writing. The report will therefore show 1 field clear
  permanently, and that is the correct steady state rather than an unfinished edit
- [Manual]: `git status` — discard any `umbraco-ai-context__*.uda` churn; this step changes no files

---

### Step 4 — Create the two new reference cards in Cantrip's published order

> **Prompt**: Implement Step 4 of `_work/cantrip-toolkit-refresh/plan.md`. Create two
> `spellCardReference` cards under the Core stack — `security-review-rules` and
> `prose-discipline` — populated from Cantrip's published cards, then order Core's references as
> `workflow, bdd-principles, tdd-principles, reviewer-discipline, security-review-rules,
> memory-discipline, design-system-authoring, prose-discipline`. `prose-discipline` lands last so
> creation order suffices; `security-review-rules` must be **sorted into position 5**. Do this
> through the backoffice or the Management API, whichever is quicker — this is two nodes, not a
> tooling job. Both cards get `cardFooterLabel` = `Pairs with`. Neither gets a `cardMark`:
> `spellCardReference` has no such property and every reference draws the shared reference mark.

**What to build**:
- Content node `security-review-rules` (`spellCardReference`, under Core) — `cardTriggers`,
  `cardHolds`, `cardDoes`, `cardWatchFor`, `cardFooterLabel` = `Pairs with`, `cardFooterValue`
- Content node `prose-discipline` (`spellCardReference`, under Core) — the same field set
- A sort of Core's reference children placing `security-review-rules` fifth

**Store normalized values, not Cantrip's raw markdown.** Every other card on the deck now holds
markup-stripped copy, and AC4 says no stored value may carry a backtick or `**`. So
`cardFooterValue` is `reviewer-discipline, /code-review` — **not** `` `reviewer-discipline`,
`/code-review` ``. Deriving the values through the tool's own `parseUnits` → `toProperties` →
`normalize` is the way to be sure these two match the convention the other 31 follow, and the
report is what proves it: a card created with raw markdown shows up as *changed* rather than
matching.

**Test first**: no unit test — this is content creation. The check is the deck itself, below.

**Validation**:
- [Automated]: `npm run spellcards:report -- --source …` reports **0 missing cards**, and the two
  new cards are absent from the changed list. **The floor for field edits is 2, not 0** — those are
  `dotnet-conventions`' two edits, bundled with the clear that was deliberately declined in Step 3
  (approval is per card, so declining the clear declines its edits too). Anything above 2, or either
  new card appearing as changed, means the values were stored wrong
- [Manual]: open the Spellbook page locally, open Core, and confirm it reads **19 cards**, that
  the References section lists eight in exactly the order above, and that both new cards draw the
  same mark as every other reference
- [Manual]: `git status` shows no `.uda` change — creating content must not have moved schema

---

### Step 5 — Prove the deck's behaviour is unchanged

> **Prompt**: Implement Step 5 of `_work/cantrip-toolkit-refresh/plan.md`. With the site running
> locally, run the deck's behavioural specs **without editing them**:
> `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/blocks/spellCardDeck.spec.ts tests/e2e/blocks/spellCardDeckState.spec.ts tests/e2e/blocks/spellCardDeckLinks.spec.ts tests/e2e/blocks/spellCardDeckNarrow.spec.ts`.
> They read the roster from the Management API by design, so a content change must not turn them
> red. Also run `dotnet test umbraco-17-demo-site.sln --no-build -c Release` from the repo root and
> confirm `SpellSigilRosterTests` still passes untouched. If any spec needs an edit to go green,
> stop — something structural changed that this increment did not intend.

**What to build**: nothing. This step is a proof, and its output is the decision to proceed.

**Test first**: the tests already exist. The assertion of this step is that **they need no
changes** — that is the behaviour being verified.

**Validation**:
- [Automated]: the four deck specs pass with `git diff tests/` empty
- [Automated]: `dotnet test umbraco-17-demo-site.sln --no-build -c Release` from the **repo root**
  is green, including `SpellSigilRosterTests` — proving no mark was added
- [Manual]: view the deck at 390px and read the longest `Does` and `Watch for`. Nothing in the CMS
  enforces the field caps, so looking is the only real check

---

### Step 5b — Correct the two blurbs that narrate the roster in prose

Found while capturing Step 5's evidence, and folded in rather than parked: **the deck describes its
own size in two editor-written fields**, and adding two Core references made both wrong. Neither was
in the spec's Measured Scope, which enumerated *card* fields only — a scoping miss, not missed work.

They must land **before** Step 6, or the stale counts transfer to Dev and then to Live.

**What to change** — content only, two fields:

| Node | Property | Now | Correct |
|---|---|---|---|
| Spellbook → `contentRows` deck block | `deckLede` | "… Sixteen spells you cast by name, **sixteen references** the model reaches for on its own." | **eighteen references** (16 spells + 18 references = 34) |
| Core stack | `stackBlurb` | "**Seventeen skills**, installed with the toolkit. Eleven spells …, **six opinions** the toolkit holds …" | **Nineteen skills** … eleven spells (unchanged) …, **eight opinions** |

Numerals are spelled out in both fields; keep that. Change only the counts — the prose is the
deck's own voice and is not being rewritten.

**Not in scope:** the other three stack blurbs, which Step 5 verified still accurate — umbraco-17
"Six references and four spells", dotnet "Three references, no spells", umbraco-cloud carries no
counts.

**Note on mechanism.** `stackBlurb` is a plain top-level property. `deckLede` is nested inside the
Spellbook's `contentRows` Block List, so writing it means round-tripping that whole property with
one string replaced — prove the round-trip changes nothing else before writing it, or edit it in the
backoffice where the block editor handles the shape.

**Validation**:
- [Automated]: read both values back and confirm the new counts
- [Automated]: for `deckLede`, diff the `contentRows` object before and after — exactly one string
  may differ, and the layout, block keys and the About-Cantrip rich text must be untouched
- [Manual→evidence]: the rendered Spellbook page shows the corrected lede and Core blurb
- [Automated]: the four deck specs still pass unedited — these are content fields, so they must not
  move behaviour

---

### Step 6 — Transfer to Dev, then regenerate the screenshot baselines

> **Prompt**: Implement Step 6 of `_work/cantrip-toolkit-refresh/plan.md`. Transfer the Spellbook
> content local → Dev (a root-level queue is fine for this hop per
> `docs/content-transfer-workflow.md`). Confirm the deck reads 19 Core cards on Dev. **Then** push
> this branch and regenerate the screenshot baselines with
> `gh workflow run update-snapshots.yml --ref claude/feature/cantrip-toolkit-refresh` — it runs
> Playwright against Dev and commits the PNGs back to this branch, so the content must be on Dev
> first. Pull the resulting commit and review the three PNG diffs: the only changes should be
> Core's count badge (17 → 19) and two extra cards in the Core panel. Never commit `*-darwin.png`.

**What to build**:
- Content on Dev (transfer, not a file change)
- Regenerated `tests/e2e/pages/spellbook.screenshot.spec.ts-snapshots/*-linux.png`

**Test first**: not applicable — baselines are regenerated artifacts, not authored tests.

**Validation**:
- [Automated]: the `update-snapshots` run succeeds and commits PNGs to this branch
- [Manual]: the three baseline diffs show only the count badge and the two new cards. Anything
  else is a real visual regression — investigate rather than accepting
- [Manual]: `git status` — no `*-darwin.png` staged

---

### Step 7 — Promote the content to Live

> **Prompt**: Implement Step 7 of `_work/cantrip-toolkit-refresh/plan.md`. Promote the Spellbook
> content Dev → Live **per-item / selectively**, per `docs/content-transfer-workflow.md` — a
> root-level promotion is only safe just after a green CI run with no stray published `[E2E]`
> fixtures on Dev, and selective transfer avoids that question entirely. Promote the two new cards
> and the 27 edited ones. Then open the Spellbook page on Live and confirm 34 cards, Core showing
> 19, and no card sitting at a slug ending `-1`.

**What to build**: content on Live (transfer, not a file change).

**Test first**: not applicable.

**Validation**:
- [Manual]: the Live Spellbook page shows 34 cards, Core 19, umbraco-17 10, umbraco-cloud 2,
  dotnet 3
- [Manual]: both new cards appear exactly once, and neither is at a `-1` slug — the additive
  transfer's duplicate hazard applies only to the two newly-created nodes
- [Manual]: spot-check one re-voiced card on Live against Cantrip's published wording

---

### Final — Record the durable behavior *(a spell you cast, not an implement-step)*

> **Prompt**: Run `/feature update spell-card-deck`. Fold **only** the user- or
> operator-observable behavior changes from this work into the existing capability doc — do not
> create a new feature doc. Update the concrete counts in the scenarios (Core `17 cards` → `19
> cards`), refresh the **Last verified** line to name Cantrip `origin/main` `6f38942` and today's
> date, add an Increments entry for this refresh, and change the coverage row *"The toolkit gains
> a spell the deck does not know about"* from `Not covered — accepted limitation, drift detection
> deferred` to `Ruled out — drift detection deliberately deferred`, which is the status increment
> 1 introduced for exactly this case. Leave the tooling and migration criteria in the shipped
> spec; they are point-in-time and must not appear as Rules. Add a revision note dated today.
>
> **Validation**: The capability doc describes current behavior with no transition-style
> ("goes from… to…") Rules; no new feature doc was added.

---

## File Summary

| Action | File |
|--------|------|
| Create | `scripts/spell-card-sync/src/parse.ts` |
| Create | `scripts/spell-card-sync/src/map.ts` |
| Create | `scripts/spell-card-sync/src/umbracoApi.ts` |
| Create | `scripts/spell-card-sync/src/diff.ts` |
| Create | `scripts/spell-card-sync/src/cli.ts` |
| Create | `scripts/spell-card-sync/test/parse.test.ts` |
| Create | `scripts/spell-card-sync/test/report.test.ts` |
| Create | `scripts/spell-card-sync/test/fixtures/spell-cards.sample.md` |
| Modify | `package.json` — extend the `test:unit` glob; add `spellcards:report` / `spellcards:apply` |
| Modify (regenerated) | `tests/e2e/pages/spellbook.screenshot.spec.ts-snapshots/*-linux.png` |
| _(work type: `change-to spell-card-deck`)_ Update | `_features/spell-card-deck.md` (fold observable behavior only; **no new file**) |
| Not modified — verify this holds | any `.uda`, `_SpellSigils.cshtml`, `spellCardDeck.cshtml`, `tests/e2e/blocks/spellCardDeck*.spec.ts` |

> **On the tool's lifetime.** Discovery called it a throwaway and this plan keeps it, rather than
> deleting it at the end. It cost little, it is the only repeatable way to re-verify the deck
> field-by-field against Cantrip, and Step 2's report mode is read-only — so it doubles as the
> drift *check* the increment deliberately declined to *build*. Deleting it is a decision for a
> later increment, not a step here.
