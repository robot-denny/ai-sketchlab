# Discovery: Cantrip Toolkit Refresh

_Discovery input for `/spec` — produced by `/explore` on 2026-09-08. Scope: medium — toolkit and
documentation, with the public spell-card deck folded back in once it emerged as the priority._

## Problem framing

**Who is affected.** Two audiences share one surface, and a third is downstream:

- **Public visitors and the team using Cantrip.** The spellbook deck is both a showcase and the
  team's cheatsheet reference. It currently describes a Cantrip that no longer exists.
- **The maintainer, on a future client project.** `/styleguide` and `/guide` shipped in Cantrip but
  have never been cast. No output has been reviewed and no backoffice path has been manually tested.

**What the current situation costs — measured, not assumed.** Against the deck's verified snapshot
(Cantrip `d74789a`, 2026-09-02, 32 units), Cantrip `main` (`6f38942`) is at **34 units**:

| | Count | Which |
|---|---|---|
| Added | 2 | `prose-discipline`, `security-review-rules` |
| Copy re-voiced | 27 | **all 16 spells**, plus 11 of the 17 references — by `65aec71`, the `prose-discipline` rewrite |
| Unchanged | 5 | `workflow`, `tdd-principles`, `umbraco-17-starter-facts`, `umbraco-17-review-rules`, `umbraco-deploy-facts` — all references |

**29 of 34 cards need work.** The Core stack goes from 17 cards to 19. A card in the old voice is
worse than a missing one, because it looks correct.

**What is worth keeping.** The tailored `/guide` capability works — a generator CLI, a backoffice AI
agent, and a `howToGuidePage` section whose *component guide* is fleshed out. The tailored reviewers
carry calibrated memory. And the ai-sketchlab-unique skills (`canvas-design`, `algorithmic-art`,
`cms-image`, `check-uda`, `block`, `umbraco-edit`) have no Cantrip equivalent worth taking.

**Observed versus assumed.**

- **Measured during discovery:** the 29-card delta; the 5-skill toolkit delta; three absent config
  slots; `security-review-rules` unreachable from this repo's tailored reviewer.
- **Explicitly not a risk:** future drift. Cantrip is at the tail end of build-out and core is
  complete. Drift detection stays out of scope — a decision already recorded in this feature's
  parking lot and re-affirmed here.
- **Two things discovery corrected.** `/guide` and `/styleguide` are *not* greenfield-targeted; they
  are deliberately reserved for human casting once a project's conventions, styles and blocks exist,
  which this site has. And switching reviewers does *not* orphan the calibrated memory — both agents
  are `name: code-reviewer` with `memory: project`, so the binding is identical.

**The problem in one sentence.** The site's public spellbook and its documentation describe a Cantrip
that no longer exists — 29 of 34 cards stale or missing — while two never-cast spells need a first
real run before a client project depends on them.

## Outcomes sought

- The deck is accurate against Cantrip `main` as of today: 34 units, current voice, inside the deck's
  own field caps.
- The documents that state a toolkit roster no longer lie.
- `/styleguide` and `/guide` have each been cast at least once here, their output reviewed and their
  backoffice path manually tested — so a client project does not hit unplanned skill remediation.
- Nothing unique to ai-sketchlab is lost.
- **No drift guard is built.** Success includes *not* having built one.

## Options considered

### Sequencing — content first, or skills first

The deck has **zero dependency** on this repo's install: it documents all of Cantrip regardless of
what is installed here, and its source of truth is Cantrip's `docs/spell-cards.md`. A 33-versus-34
fork existed briefly and collapsed when `security-review-rules` shipped with its card on 2026-09-08.

**Chosen: content first, against a stable 34** — with one cheap exception, below under second-order
effects. Rejected: skills-first, which leaves the public deck wrong longest for the least visible
gain.

### Content mechanism — hand-edit, script, or generator

- **Hand-edit in the backoffice** — roughly 290 field edits across 29 cards. Where mistakes live.
- **Chosen: a script that proposes and a human who approves.** Adapted from
  `scripts/guide-generator/src/`, which already has `diff.ts` (coloured unified diff),
  `umbracoApi.ts` (OAuth + request) and a `[y/N]` apply flow proven against this site. It keeps the
  card prose out of the agent's context entirely — the transcription-error surface of this job — makes
  the field caps mechanical by flagging only violators, gives one reviewable diff before any write,
  and is idempotent across local → Dev → Live.
  **Worse at:** it is a throwaway. If Cantrip grows a pack later, it gets written again.
- **Umbraco MCP for the writes** — rejected. Every field value would pass through the agent's
  context, and its env-var dependency is less reliable than the script's `.env` read. **Kept for
  reconnaissance**: locating the stack and card nodes and confirming the `spellCardFields` aliases.
- **A generator plus a signature** (the guide-generator pattern in full) — rejected, because it builds
  the drift detection deliberately declined.

### Guides and styleguide — adopt wholesale, run alongside, or styleguide only

- **Chosen: a fresh section alongside, as an instrument rather than a destination.** Build Cantrip's
  four `editorGuide*` document types in a new section, cast `/guide` against two or three components
  that already have hand-written guides, and **compare the generated page against the existing
  component guide**. That answers the question actually being asked — will this need unplanned
  remediation on a client project — with evidence rather than a guess, and cannot damage the
  fleshed-out component guide while doing so.
  **Worse at:** two guides sections coexist, one of them publicly visible, until the comparison
  decides.
- **Adopt wholesale and retire the tailored `/guide`** — rejected *for now*, not on principle: it
  commits before the output has been seen, which is the exact risk being retired. Remains the likely
  destination once the comparison lands.
- **`/styleguide` is separable and cheap** and is taken immediately: no name collision (there is no
  `.claude/commands/styleguide.md`), it scaffolds its own showcase element types under scoped
  approval, and it needs two slots filled.
- **Context that shapes this:** Cantrip merges the component guide and the how-to guide into a single
  `editorGuide`, where this site keeps them separate. No real how-to-guides are published yet, so the
  fleshed-out *component* guide is what a migration would absorb.

### Reviewer — graft the security reference, or switch to Cantrip's

- **Chosen: switch to Cantrip's `code-reviewer`.** It reaches installed stack packs generically
  (*"If an installed stack pack or project skill offers review guidance for the technology in play,
  consult…"*) and reads `security-review-rules` before reporting — so both umbraco packs and the new
  reference wire up with no edit. The calibrated memory carries over untouched.
- **Accepted cost, deliberately.** Cantrip's reviewer is generic prose where the tailored one carries
  Razor, `Html.CachedPartialAsync`, Playwright, `.uda` and RCL-split specificity. The
  `.agents/config/reviewer-rules/code.md` slot — which Cantrip's reviewer declares and which
  `_shared.md` says was left empty pending exactly this decision — is to be **backfilled
  opportunistically, not as a precondition**. The consequence is named: reviews run shallower for a
  while, and a review that got shallower looks identical to one that found nothing.
- **Rejected:** grafting the reference into the tailored reviewer. One edit now, but re-paid every
  time upstream adds review substance.

## Trade-offs & second-order effects

- **Run `/update-toolkit` before rewriting this feature doc, or write the doc twice.** The `feature`
  skill update takes the coverage vocabulary from three states to five, adding
  `Ruled out — <reason>`. This doc carries the row that state was invented for — *"The toolkit gains a
  spell the deck does not know about | — | Not covered — accepted limitation, drift detection
  deferred"* — which becomes `Ruled out — drift detection deliberately deferred`, recording a decision
  rather than looking like a gap. The update is cheap and safe: 5 files (`feature`, `plan`,
  `retrofit`, `spec`, `tdd-principles`), verified byte-for-byte against `main` with **zero local
  tailorings at risk**, because no vendored skill in this repo has ever been hand-edited.
- **The site will document a bigger toolkit than it runs** — 34 cards against roughly two dozen
  installed units. This is *correct*: the deck showcases Cantrip, not this install. Recorded as
  deliberate so the 15 uninstalled units do not later read as a gap somebody should close.
- **`/guide` and `/styleguide` need three slots, and this repo has none of them.**
  `stack.md` → `## Schema serialization` auto-detects from the `.uda` files, so it is free.
  `conventions.md` → `## Editor guides` carries the guides node key, the aliases actually used, and
  the showcase palette. `stack.md` → `## Design tokens` is needed because this site has a styleguide.
  The `## Editor guides` slot handles alias *renaming*, **not** the structural gap between Cantrip's
  seven `guide*` properties and this repo's `description` + `generationMetadata`.
- **The scaffolding reference names seven document types, not four.** The four in the runbook are the
  base section (`editorGuidePropertyRow`, `editorGuide`, `editorGuideGroup`, `editorGuideIndex`) and
  are what must pre-exist; the other three are the showcase element types `/styleguide` scaffolds
  itself under scoped approval. Only the four are increment 4's job.
- **A known-broken guard upstream, and a two-way benefit.** Cantrip ADR 0017 records that the guides
  slot's `**If empty:**` clause "describes two states where there are three." As the pilot, this
  project hits it. Cantrip's roadmap `Next` also says the `/guide` first-run branch is *waiting on the
  pilot's one question* — so casting `/guide` here feeds an open upstream decision rather than only
  rehearsing.
- **Runbooks do not ship.** `docs/runbooks/umbraco-17-guides-section.md` is subpath-excluded from
  installs and must be copied by hand.
- **Deck cards are content, not schema.** They flow local → Dev → Live and transfers are additive.
  Only the 2 new cards create nodes, so the "(1)" duplicate-slug hazard is limited to those two.
- **Two halves of a card's mark must move together.** A new card needs a `<symbol>` in
  `_SpellSigils.cshtml` *and* a key in the `cardMark` data type; `SpellSigilRosterTests.cs` guards the
  seam, and a key with no symbol renders nothing and throws nothing.
- **Stale roster claims to sweep:** `_features/spell-card-deck.md:10` and `:24` (the 32-unit
  snapshot), and `CLAUDE.md:38` ("seven kept" tailored commands).

## Direction

Content first against a stable 34, preceded only by the cheap `/update-toolkit` run that improves the
feature doc it is about to rewrite. Then the documentation sweep. Then the guides work as an
instrument: `/styleguide` cast cheaply, `/guide` cast into a fresh section and compared against the
existing component guide before anything is retired. The reviewer switches to Cantrip's, with the
slot backfilled opportunistically. No drift guard.

**The tailored-versus-upstream question is settled per case by least effort, not as a policy.**
`check-uda`, `block`, `umbraco-edit`, `cms-image`, `canvas-design` and `algorithmic-art` stay
tailored — none is needed for these objectives and several have no Cantrip equivalent worth taking.
`code-reviewer` switches. `/guide` is decided by the comparison rather than up front.

### Seven increments, in this order

Settled during discovery. Each is `/spec`-able on its own; the dependency column is why the order is
not arbitrary.

| # | Increment | Work type | Depends on |
|---|---|---|---|
| 1 | **Toolkit update** — refresh the 5 changed skills via `/update-toolkit` | fix-infra | — |
| 2 | **Spellbook content** — 29 cards to the 34-unit roster, script-proposes/human-approves | change-to-existing | 1, for the 5-state coverage vocabulary |
| 3 | **Reconcile old and new skills** — the installs, the reviewer switch, tailored-vs-upstream per case | fix-infra | 1 |
| 4 | **Guides foundation** — the four base document types, two templates, the index node, and its key recorded in `## Editor guides` | new-capability | 3 |
| 5 | **Styleguide adoption** — cast `/styleguide` | new-capability | 4, plus `## Design tokens` |
| 6 | **`/guide` trial** — cast against two or three components and compare against the existing component guide | new-capability | 4 |
| 7 | **Regenerate them all** with the new tooling | change-to-existing | 6, **and conditional on it finding nothing blocking** |

**Why the foundation is its own increment rather than the front half of the styleguide one.**
`/styleguide` does not merely need slots filled — it writes a guide page *into* a Cantrip-model
guides section, resolved by the recorded key, where *"the node at that key is the index page itself…
an `editorGuideIndex`"* and the kind containers beneath it are `editorGuideGroup` **matched on
document type, never on name**. This repo's existing `howToGuidePage` section therefore cannot stand
in. Increments 5 and 6 both need that foundation, so it earns a boundary rather than living inside
one of them.

**Increment 7 is deliberately conditional.** It exists to be cancelled if increment 6 uncovers
something blocking — which is the whole reason 6 is framed as an instrument.

### Two reviewer findings for increment 3, observed while running increments 1–3

Recorded here because increment 3 is where the reviewer switch happens, and both of these become
actionable there rather than now.

**1. Our tailored reviewer defines its own severity scale — the switch fixes it.**
`.claude/agents/code-reviewer.md` never references `reviewer-discipline` and declares its own
vocabulary (`🔵 LOW`, `Approve with fixes`). So across three reviews it reported `MEDIUM` and
`HIGH/MEDIUM/LOW` rather than Blocker/Major/Minor/Nit — faithfully following the scale this project
gave it. Cantrip's reviewer opens by deferring to `reviewer-discipline` for exactly this. **Not an
upstream defect**, and one more thing the increment-3 switch buys beyond reaching
`security-review-rules`.

**2. A gap worth reporting upstream: severity rated on failure mode rather than reachability.**
Three findings across increments 1 and 3 were filed Blocker or Major on the shape of the bug, and a
one-command check against the real input corpus showed none could fire: a missing-`Group` guard (0
of 34 cards lack it), paired bare asterisks corrupting a value (0 corpus values contain one — the
reviewer's example was constructed), and nested bold+emphasis (0 of 259 `**` occurrences nested).
Every one is a genuine bug; none degraded anything yet.

`reviewer-discipline`'s over-reporting rule covers findings you *cannot confirm*. It says nothing
about confirmed findings whose trigger the change's inputs cannot reach — and since the severity
definitions are written in terms of impact ("degrades all users measurably"), a reviewer rating
shape lands on the wrong row. **The sharper half of the observation:** the diff-only scope rule
("treat the diff as the entire universe of code under review") can be read as *forbidding* the
corpus check that would settle reachability, because reachability lives in the data rather than the
diff. That tension is a design question for the toolkit, not a reviewer failing.

## Open questions for /spec

- **Which of the 15 uninstalled units to install.** The objectives imply `testify`, `styleguide`,
  `guide`, `umbraco-17-guide-scaffolding`, `prose-discipline` and `security-review-rules`;
  `design-system-authoring` and `setup` are plausible; the `dotnet` pack and
  `umbraco-17-audit-patterns` are not implied. Installing any of `block`, `guide`, `umbraco-edit` or
  `check-uda` by pack would silently shadow a tailored command — install by single-skill subpath, as
  commit `47f6119` did.
- **Do any of the 27 re-voiced cards exceed the deck's field caps** (`Does` ≤ 2 sentences / 40 words,
  `Watch for` one line, `Modes` ≤ 2 lines)? Unmeasured. This determines how many of the 29 need
  judgment rather than transcription.
- **Does the component guide's content migrate into `editorGuide`, or get regenerated by `/guide`?**
  The hope is that regeneration is low-effort; the comparison step is what answers it.
- **What the `## Editor guides` slot records** — the fresh section's node key, and whether Cantrip's
  default aliases or project-specific ones are used.
