/**
 * Strips Cantrip's markdown markup out of a card field value.
 *
 * Cantrip's card document is markdown: it writes `` `code` `` and `*emphasis*`
 * expecting a renderer to turn them into markup. The site's card fields are
 * `Umbraco.TextBox` / `Umbraco.TextArea`, and `spellCardDeck.cshtml` renders
 * them HTML-encoded — so a backtick carried verbatim reaches the visitor as a
 * literal glyph. The markup therefore has to come off before a value is stored.
 *
 * **These rules are empirical, not stylistic.** The deck's original 32 cards
 * were transcribed by hand from Cantrip `d74789a`, and each rule below is here
 * because the site's stored copy shows the author applying it. Two rules were
 * *rejected* for the same reason — no evidence:
 *
 * - **Underscores are left alone.** The only underscores Cantrip writes are file
 *   paths (`_work/<slug>/plan.md`, `_features/<area>.md`), so treating `_x_` as
 *   emphasis would corrupt a path rather than clean up markup.
 * - **Link syntax is left alone.** Cantrip's 245 field values contain no
 *   markdown links, so a rule for them could not be checked against anything.
 * - **Headings, list markers and autolinks are left alone.** Checked the same
 *   way on 2026-09-09: none of `# `, a line-leading `- ` or `1. `, or `<https://…>`
 *   appears in any of the 205 mapped field values. A card field is one line of
 *   prose, so none of them has anywhere to occur.
 * - **A closing delimiter never inserts a space.** `` `git diff`then `` strips to
 *   `git diffthen`, which looks like gluing but is a typo in the source. Every
 *   real occurrence is followed by punctuation — `` `/spec`, `` — where a space
 *   would be wrong, so guessing at the author's intent would break 19 correct
 *   values to repair a hypothetical one.
 *
 * `normalize` sits on **both sides of the comparison** in `diff.ts` as well as
 * on the write path, which is what lets the report reach its floor: comparing a
 * normalized source against a raw stored value would report every already-clean
 * field as an edit for ever.
 */

/**
 * Emphasis, and only where it really is emphasis.
 *
 * Markdown flanks an emphasis span with whitespace or punctuation on the
 * *outside*, and that flanking is the whole rule: without it, any two bare
 * asterisks in one value get read as a span and everything between them is
 * eaten. `roll 3*4*5` became `roll 345` — a different number, silently, with
 * nothing for a reviewer to notice at the approval prompt. A glob path inside a
 * code span failed the same way, because the backtick pass runs first and
 * exposes its asterisks to this one. (The glob is spelled out in
 * `test/normalize.test.ts` rather than here: a literal one closes this comment.)
 */
const EMPHASIS = /(?<=^|[\s(["'])\*([^*\s][^*]*?)\*(?=$|[\s.,;:!?)\]"'])/g;

/**
 * Unwrap `` `code` ``, `**bold**` and `*emphasis*`, and trim the edges.
 *
 * **Applied to a fixed point, not once.** The bold pattern cannot match a span
 * containing an asterisk, so `**bold *and emph* text**` is invisible to it until
 * the inner emphasis has been removed — one pass left `*bold and emph* text**`,
 * stray delimiters and all, and a second pass on that result changed it again,
 * so the function was not even idempotent. Looping until the value stops
 * changing resolves nesting at any depth and makes re-running a no-op, which
 * matters because this sits on both sides of every comparison.
 *
 * Trimming is applied here rather than at the call site so that both sides of a
 * comparison get it: one stored value ends in a stray space, and edge
 * whitespace alone is not a difference worth writing a card for.
 */
export function normalize(value: string): string {
  let current = value;
  let previous: string;
  do {
    previous = current;
    current = current
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(EMPHASIS, '$1');
  } while (current !== previous);

  return current.trim();
}
