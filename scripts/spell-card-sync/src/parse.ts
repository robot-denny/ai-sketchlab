/**
 * Parses Cantrip's `docs/spell-cards.md` into one record per unit.
 *
 * The source is a flat markdown document: each unit is a `###` heading followed
 * by a run of `- **Field:** value` bullets, grouped under `#` stack headings that
 * carry no information the `Group` field does not already hold. Everything that
 * is not a card heading or a field bullet — the preamble, the deck-divider
 * bullets, the rules — is ignored.
 *
 * Two things the source guarantees rather than this parser enforcing them, both
 * checked against Cantrip's 34-card document on 2026-09-09:
 * - **A field's value is one physical line.** A value wrapped onto a second line
 *   would have its continuation dropped, because a continuation matches neither a
 *   heading nor a field bullet. No card wraps today; the only non-matching lines
 *   inside a card are the `---` rules between stacks, which are correctly ignored.
 * - **`Type` and `Group` are present on every card.** Both are required here and
 *   throw when missing, so a card the source malforms fails loudly rather than
 *   arriving mis-typed or unplaced.
 */

/** Which kind of card a unit is. Decides which stat-block fields it carries. */
export type UnitType = 'Spell' | 'Reference';

export interface UnitRecord {
  /** The `###` heading: a spell's invocation (`/retrofit`) or a reference's name. */
  name: string;
  type: UnitType;
  /** The `Group` field — Cantrip's stack, e.g. `Core reference`. */
  group: string;
  /**
   * Every other `- **Field:** value` line, keyed by the field's label as written
   * (`Watch for`, `Pairs with`). A field the card omits is absent, never blank:
   * some cards deliberately leave `Watch for` and `Modes` empty.
   */
  fields: Record<string, string>;
}

const CARD_HEADING = /^###\s+(.+?)\s*$/;
const OTHER_HEADING = /^#{1,6}\s/;
const FIELD = /^[-*]\s+\*\*(.+?):\*\*\s*(.*?)\s*$/;

/** Parse the whole document. Units come back in source order. */
export function parseUnits(markdown: string): UnitRecord[] {
  const units: UnitRecord[] = [];
  let current: { name: string; fields: Record<string, string> } | null = null;

  const flush = () => {
    if (!current) return;
    const { Type: type, Group: group, ...rest } = current.fields;
    units.push({
      name: current.name,
      type: asType(type, current.name),
      group: requireGroup(group, current.name),
      fields: rest,
    });
    current = null;
  };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = CARD_HEADING.exec(line);
    if (heading) {
      flush();
      current = { name: heading[1], fields: {} };
      continue;
    }
    if (OTHER_HEADING.test(line)) {
      flush();
      continue;
    }
    const field = FIELD.exec(line);
    if (field && current) {
      current.fields[field[1]] = field[2];
    }
  }
  flush();

  return units;
}

function asType(value: string | undefined, name: string): UnitType {
  if (value === 'Spell' || value === 'Reference') return value;
  throw new Error(`Card "${name}" has no usable Type field (got ${JSON.stringify(value)}).`);
}

function requireGroup(value: string | undefined, name: string): string {
  if (value) return value;
  throw new Error(`Card "${name}" has no usable Group field (got ${JSON.stringify(value)}).`);
}
