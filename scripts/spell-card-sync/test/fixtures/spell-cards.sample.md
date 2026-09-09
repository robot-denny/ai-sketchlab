# Cantrip spell cards

A two-unit sample of `docs/spell-cards.md`, held here so the parser's tests never
need the Cantrip clone. Shape-faithful: the preamble, a deck-divider bullet list,
the `---` rules and the `# <stack>` headings all appear, because the parser has to
ignore every one of them.

## Deck dividers

- **Core spellbook** — Eleven spells. Nine are the workflow chain, two are configuration.
- **Core reference** — Eight opinions the toolkit holds.

---

# Core spellbook

### /retrofit

- **Type:** Spell
- **Group:** Core spellbook
- **Cast:** `/retrofit [what you changed] [git range or ref]`
- **Needs:** a change that skipped spec → plan → implement
- **Leaves:** only what you confirm: tests, docs, feature-doc updates
- **Does:** The easy button for work that skipped the flow. Reconciles what you meant against what the diff says, runs the three reviewers, and proposes the tests and docs the change would otherwise skip.
- **Modes:** `uncommitted` (default) is `git diff` plus staged. `branch` is everything since the upstream fork point.
- **Watch for:** run it before you commit, or before you push if you already committed.
- **Then:** a fresh `/code-review`, then `/commit-message`

---

# Core reference

### security-review-rules

- **Type:** Reference
- **Group:** Core reference
- **Triggers:** reviewing a change for security defects; deciding which category a defect belongs to
- **Holds:** the OWASP Top 10 category table and the revision it pins, the citation convention
- **Does:** The standard the quality reviewer checks security against. It gives every security finding a category by number and name.
- **Pairs with:** `reviewer-discipline`, `/code-review`
