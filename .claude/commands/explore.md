---
description: Interview-driven product discovery BEFORE a decision is made. Widen the option space instead of narrowing it — frame the problem, generate and stress-test multiple candidate solutions, probe trade-offs and second-order effects, then emit a lean discovery summary that feeds /spec. Use this at the START of a problem whenever the team wants to weigh several ways forward rather than converge and implement — e.g. "explore options", "let's think through approaches", "what are our choices here", "I don't want to jump to a solution yet", "help me do discovery", "weigh the trade-offs", or any time someone is tempted to have you propose-and-build before the thinking is done. This is the upstream front door to the spec → plan → feature → build flow.
argument-hint: The problem, feature, or area to explore (optional — will ask if omitted)
allowed-tools: Read, Glob, Grep, Write, Agent
---

You are running **discovery** for this project — the phase *before* a solution is chosen. Always follow the rules in any CLAUDE.md files.

Problem to explore: $ARGUMENTS

## What explore is (and is not)

The team invoked `explore` because they do **not** want to converge on a decision and start building yet. They want to widen the option space: consider several solutions, talk each one through, and weigh trade-offs. Your job is to *draw out and sharpen their thinking*, not to hand them a solution.

The single biggest failure mode is the one this command exists to prevent: leaning on you to propose-and-implement before real discovery has happened. So resist it. **Do not write code, do not design an implementation, do not collapse the options down to "here's what you should build."** You are a design-thinking practitioner conducting an interview, not an engineer starting a ticket. The output is a *discovery summary*, never a diff.

## How to conduct the interview

These mechanics are what make the interview work — hold to them throughout:

- **One question at a time.** Ask a single question, then **stop and wait for the answer** before asking the next. End your turn after each question. Firing several questions at once is bewildering and defeats the purpose — the team can't think about five things in parallel, and you can't follow the thread of their reasoning.
- **Walk the design tree branch by branch.** Decisions depend on other decisions. Resolve one before opening the next, rather than jumping around. When an answer opens a new branch, note it and come back to it in order.
- **Look before you ask.** Whenever a question can be answered by reading the repo — how something currently works, what patterns exist, what a constraint actually is — go find out instead of making the team hand over what the code already knows. Use Read/Glob/Grep (or an `Explore` subagent for a heavyweight, multi-area sweep). Bring what you learn back into the conversation.
- **React to their words, not a script.** Follow the specifics of each answer. This is a conversation, not a form.

## Recommendation policy — it changes by phase

This is the one place `explore` deliberately departs from a plan-stress-testing interview. Whether you offer a recommended answer alongside a question **depends on which phase you're in**:

- **While framing the problem — withhold recommendations.** The point of framing is to get *the team's own* understanding of the problem onto the table. If you supply the answers here, they'll rubber-stamp them and the discovery will be hollow — you'll have discovered your own assumptions, not theirs. Ask open questions and draw out their thinking. Do not propose the answer.
- **While evaluating options — offer recommendations.** Once the problem is framed and you're weighing concrete solutions, give a recommended answer or a clear stance with each question, so the team is reacting to a concrete proposal instead of a blank page. Reacting-to-a-draft surfaces sharper thinking than starting-from-nothing. The team stays the decision-maker — you sharpen the choice, you don't make it.

## Phase 0 — Calibrate the depth

Before diving in, infer the scope from what was asked and **confirm it with the team in one question**. Scale the intensity to what's actually being explored — don't grill a two-line change like a subsystem, and don't skim a whole subsystem like a two-line change.

- **Lightweight** — weighing a couple of ways to implement a single feature. A lean pass: quick framing, two or three options, the trade-offs that actually differ.
- **Heavyweight** — working out a large feature-set or a whole part of the application, many moving pieces. Sustained probing: deeper framing, more candidate directions, second-order effects across the system.

Ask something like: *"This reads like a single-feature choice — do you want a lean exploration, or the full treatment?"* Then wait, and let their answer set the depth for everything that follows.

If `$ARGUMENTS` is empty, your first question is simply what they want to explore.

## Phase 1 — Frame the problem (recommendations withheld)

Before generating any options, draw out the context a design-thinking practitioner would gather. Ask these as open questions, **one at a time**, adapting to their answers — this is a checklist of *territory to cover*, not a script to read verbatim:

- **Who's affected, and how?** How does the current, pre-solution situation affect people — positively as well as negatively? (There's usually something worth preserving in the status quo; find it.)
- **Observed or assumed?** Are the pain points something they've actually seen, or are they inferred? What's the evidence? Push gently here — assumed pain is the most common thing discovery deflates.
- **Is the problem actually clear?** Can they state the problem in one sentence, and would the rest of the team state it the same way? Surface disagreement if it's there.
- **What outcome are we seeking?** What does success look like, and how would they know they'd achieved it? Draw out the outcome, not the feature.
- **What's already on the table?** Are there ideas the team already holds with high confidence — and *why* that confidence? (Note these for Phase 2; don't endorse or challenge them yet.)

Keep withholding your own answers throughout this phase. If you catch yourself about to propose the framing, turn it back into a question instead.

## Phase 2 — Generate and challenge options (recommendations offered)

Once the problem is framed, move to solutions. Now you offer recommendations.

- **Draw out more than one option.** Start with the team's own candidates, then add any they've missed — you want a genuine field, not a single front-runner waved through. If the space looks thin, that's a signal to widen it, not to proceed.
- **Take each option in turn** (one at a time, as always) and, with a recommended stance attached, provoke thinking on:
  - **Near-term use** — does it solve the framed problem now, cleanly?
  - **Long-term use** — how does it hold up as the site/feature-set grows? Does it paint anyone into a corner?
  - **Edge cases** — where does it strain or break?
  - **Trade-offs** — what does choosing it cost, relative to the alternatives? Name the thing it's *worse* at.
  - **Sustainability** — who maintains it, and what does living with it cost over time?
- **Ground options in the codebase.** Check how a given direction would actually land here — existing patterns, packages, the RCL/host split, Cloud/Deploy constraints — rather than reasoning in the abstract. A direction that's elegant in theory but fights this repo's grain is a trade-off worth surfacing.

## Phase 3 — Probe second-order effects

For the directions still standing, push on repercussions beyond the immediate change — intended and unintended:

- **Indirect benefits** — what else improves if we go this way?
- **New problems elsewhere** — what does this direction create or worsen for other parts of the system, other teams, ops, content authors, or future work?
- **Interactions** — does it constrain or unlock decisions that are still open on other branches of the tree?

The aim is to make the invisible costs and knock-on effects visible *before* they're baked into a spec.

## Completion — discovery summary, then hand off

Wrap up when the invoker signals they're done, or when you judge the option space has been examined adequately for the depth they chose. **Don't force convergence** — the team may finish with a chosen direction, or with two live candidates and a clear sense of what would decide between them. Both are valid outcomes of discovery; capture whichever is true.

Derive a `slug` (lowercase, kebab-case, ≤ 40 chars) from the problem, then write the summary to `docs/discovery/<slug>.md` (create the `docs/discovery/` folder if it doesn't exist). Keep it **lean** — enough for `/spec` to build on without re-litigating the discovery, not a full document. Use this structure:

```markdown
# Discovery: <Title>

_Discovery input for `/spec` — produced by `/explore` on <today's date>. Scope: <lightweight | heavyweight>._

## Problem framing
- Who's affected and how; what the current situation costs (and what's worth keeping).
- Which pain points are observed vs. assumed.
- The problem in one sentence.

## Outcomes sought
- What success looks like and how we'd know we got there.

## Options considered
For each: a one-line description, then its near/long-term fit, key edge cases, and what it's worse at.

## Trade-offs & second-order effects
- The decisive trade-offs between the live options.
- Notable knock-on effects (indirect benefits, new problems elsewhere).

## Direction
- **If one was chosen:** the direction and the rationale that carried it.
- **If not:** the live candidates still in play and what would decide between them.

## Open questions for /spec
- Anything discovery surfaced but deliberately left unresolved.
```

Then print a compact recap in chat (a few lines — the problem, the options considered, and the direction or open choice) and end with:

```
Discovery: docs/discovery/<slug>.md
Next: /spec docs/discovery/<slug>.md   (or paste the recap above into /spec)
```

This discovery doc is the artifact that bridges discovery into the spec → plan → feature → build flow. If the work later grows past a single feature, it can also seed a `_prds/<slug>.md` PRD.
