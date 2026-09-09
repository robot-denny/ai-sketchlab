# Spell Card Sync

Keeps the site's public [spell card deck](../_features/spell-card-deck.md) in step with Cantrip's
published card document. A developer-run CLI at [`scripts/spell-card-sync/`](../scripts/spell-card-sync/)
— read-only by default, one approval per card when it writes.

**When you need it:** Cantrip has changed a spell card's copy, or gained a unit the deck does not
carry. Built during the [`cantrip-toolkit-refresh`](../_work/cantrip-toolkit-refresh/) increment
(which archives to `_work/shipped/` once it ships) and kept rather than thrown away, because it is
the only repeatable way to check the deck field-by-field against the toolkit.

---

## The two commands

Both need the site serving locally and `UMBRACO_CLIENT_ID` / `UMBRACO_CLIENT_SECRET` in `.env`.
`--source` points at a **clone of the Cantrip repo**, which lives outside this one.

```bash
# What differs, and nothing else. Writes nothing.
npm run spellcards:report -- --source /path/to/cantrip/docs/spell-cards.md

# The same diff, one `[y/N]` per card, PUT only on y.
npm run spellcards:apply -- --source /path/to/cantrip/docs/spell-cards.md
```

Node is managed by nvm, so prefix both with
`PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"` if `npm` is not already on your path.

`report` is safe to run as often as you like — the module contains no write helper at all, so the
mode is read-only by construction rather than by discipline. `apply` has **no** `--yes` or `--force`
flag, deliberately: the per-card prompt is the safety mechanism and there is no way round it.

## Reading the report

```
summary  2 field edits across 1 cards, 0 cards missing, 33 cards untouched, 1 field clears
```

Four numbers, and the last two are the interesting ones.

- **field edits** — a card's stored copy differs from Cantrip's.
- **cards missing** — Cantrip publishes a unit with no card on the site. `apply` **never creates
  one**: a new card needs a stack and a tree position, and the card document says nothing about
  either. Create it by hand, then re-run.
- **cards untouched** — already matching. Never written.
- **field clears** — Cantrip is *silent* on a field the card fills. Reported apart from the edits,
  and listed again in its own section at the end, because approving one **deletes copy**.

**A clear is not evidence of staleness.** Cantrip being silent may mean the sentence is this
project's own writing. That is exactly the case on `dotnet-conventions.cardWatchFor` — Cantrip has
never published a *Watch for* there, so the clear is declined every run and the report carries
`1 field clears` permanently. **That is the steady state, not unfinished work.**

Approval is **per card, not per field**, so declining a card to protect a clear also declines its
genuine edits. The prompt says how many it is costing you. Apply those by hand in the backoffice if
you want them.

## Markdown never reaches a stored value

Cantrip's card document is markdown — `` `code` ``, `**bold**`, `*emphasis*`. The deck's view
renders field values **HTML-encoded**, so a backtick carried through would reach a visitor as a
literal glyph and a screen reader would announce the punctuation.

So [`normalize.ts`](../scripts/spell-card-sync/src/normalize.ts) strips markup **before** a value is
stored, and sits on **both sides of every comparison** — without that, an already-clean field would
report as an edit for ever.

Its rules are empirical, not stylistic: each one is there because the deck's original hand-authored
cards show the author applying it. Two constructs are deliberately left alone, and the module
records why — underscores, because Cantrip's only underscores are file paths like `_features/`, and
link syntax, because the card document contains none.

**If a rule ever changes, the report is the check:** after applying, it must return to zero edits.
Anything else means the normalizer and the site's stored convention disagree.

## Things worth knowing before you write

- **Writes are serialised and re-fetch first.** Each approved card is fetched immediately before it
  is written, because the API's update is a full replace and arbitrary time passes at the prompt.
  Every other stored value, the template and the variant name pass through untouched.
- **Publishing is conditional.** A card already published is re-published; a draft stays a draft.
  Pushing an editor's unreleased draft live as a side effect of a copy sync is not this tool's call.
- **A publish failure is loud, and it has to be.** If the values land but the publish fails, the
  card holds the new copy *as a draft* — and the tool compares against draft values, so a later run
  would find it matching, call it unchanged, and never mention that it is not live. That case gets
  its own red section: `WRITTEN BUT NOT PUBLISHED — publish these by hand`.
- **One card's failure does not end the run.** Each write is isolated; failures are listed in the
  summary and the remaining cards still get offered.
- **Re-running is safe.** After a partial or abandoned run, only what still differs is offered again.

## After the deck changes

Card content is **content**, so it follows the project's normal path — see
[docs/content-transfer-workflow.md](content-transfer-workflow.md). local → Dev → Live, and
**Dev → Live per-item** rather than root-level.

Two consequences specific to the deck:

1. **The screenshot baselines shift**, and they can only be regenerated *after* the content reaches
   Dev — `update-snapshots.yml` runs Playwright against Dev. Scope the run
   (`-f testFilter=tests/e2e/pages/spellbook.screenshot.spec.ts`) rather than accepting its
   `tests/e2e/` default, which would regenerate every baseline in the repo.
2. **The behavioural specs must pass unedited.** `tests/e2e/_spellDeckFixture.ts` reads the roster
   from the Management API precisely so a content edit cannot turn a deck spec red. If a spec needs
   changing to go green, something structural moved that a content sync had no business moving.

**Two fields narrate the roster in prose** and no test guards them: the Spellbook page's `deckLede`
and each stack's `stackBlurb` state counts in words ("eighteen references", "nineteen skills"). They
are not card fields, so the tool does not see them. Check them by eye whenever the roster changes —
this is how they went stale once already.

## Recording what you verified

The deck's feature doc carries a **Last verified** line. Anchor it to the commit that last changed
Cantrip's `docs/spell-cards.md`, **not** the clone's `HEAD` — a clone advances for unrelated reasons,
and naming its HEAD makes the line stale without anything being wrong:

```bash
git -C /path/to/cantrip log -1 --format='%h %ad' --date=short origin/main -- docs/spell-cards.md
```
