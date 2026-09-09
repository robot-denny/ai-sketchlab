/**
 * Shapes and renders the difference between one Cantrip unit and the card the
 * site currently stores for it.
 *
 * Two halves, both used by `cli.ts`:
 * - **classification** — `diffCard` / `summarize`, which decide what changed and
 *   count it. Pure, and deliberately fed a plain alias → value map rather than a
 *   Management-API document, so the numbers can be checked without a network.
 * - **rendering** — `unifiedColoredDiff`, adapted from
 *   `scripts/guide-generator/src/diff.ts`, which draws one field's change for a
 *   human to read before approving it.
 *
 * The comparison universe is the mapping table's aliases for the card's kind and
 * nothing else. `cardTitle` and `cardMark` are excluded because Cantrip's card
 * document carries no source for either — they are authored in the backoffice,
 * so a difference there is not drift, and reporting it would invite a write that
 * destroys editor intent.
 *
 * Both sides of every comparison go through `normalize`, so Cantrip's markdown
 * markup is not mistaken for a copy difference. `FieldDiff.source` therefore
 * carries the **normalized** value — the exact text a write would store — which
 * makes the rendered diff a truthful preview of the write rather than a preview
 * of the source file.
 */

import { createPatch } from 'diff';
import type { UnitType, UnitRecord } from './parse.js';
import { toProperties } from './map.js';
import { normalize } from './normalize.js';

/** Aliases a unit of each kind can source from Cantrip, in mapping-table order. */
const COMPARABLE_ALIASES: Record<UnitType, readonly string[]> = {
  Spell: [
    'cardCast',
    'cardNeeds',
    'cardLeaves',
    'cardDoes',
    'cardModes',
    'cardWatchFor',
    'cardFooterLabel',
    'cardFooterValue',
  ],
  Reference: [
    'cardTriggers',
    'cardHolds',
    'cardDoes',
    'cardModes',
    'cardWatchFor',
    'cardFooterLabel',
    'cardFooterValue',
  ],
};

export type CardStatus = 'unchanged' | 'changed' | 'missing';

export interface FieldDiff {
  alias: string;
  /** What the site stores, verbatim. Empty when the card leaves the field blank. */
  live: string;
  /**
   * What a write would store: Cantrip's value with its markdown markup
   * normalized away. Empty when Cantrip's card omits the field.
   */
  source: string;
  /**
   * Which of the two things this difference is, because they are not equally
   * safe to apply. An `edit` replaces one wording with another. A `clear`
   * deletes copy the site holds and the source does not publish at all — and
   * the source not publishing it is *not* evidence the copy is stale: it may be
   * a sentence only this project ever wrote. A clear is the destructive case,
   * so it is named rather than folded in with the edits.
   */
  kind: 'edit' | 'clear';
}

export interface CardDiff {
  /** The unit's name, which is also the content node's name. */
  name: string;
  status: CardStatus;
  /** Only the fields that differ. Empty for an unchanged or a missing card. */
  changedFields: FieldDiff[];
}

/**
 * Classify one unit against the live card's stored values, or against
 * `undefined` when the site has no card of that name yet.
 *
 * A field Cantrip omits compares as the empty string, so "Cantrip says nothing
 * and the card is blank" is unchanged while "Cantrip says nothing and the card
 * holds copy" is a change — the stale value would otherwise survive silently.
 *
 * That second case is reported as a **clear** rather than an edit. Both are
 * differences, but only one of them ends with copy deleted, and a caller about
 * to write needs to see which is which.
 *
 * Markup is normalized off both sides before they are compared, so a field the
 * site already stores in stripped form is unchanged rather than an edit that
 * could never be satisfied.
 */
export function diffCard(unit: UnitRecord, live: Record<string, string> | undefined): CardDiff {
  if (live === undefined) {
    return { name: unit.name, status: 'missing', changedFields: [] };
  }

  const source = toProperties(unit);
  const changedFields: FieldDiff[] = [];

  for (const alias of COMPARABLE_ALIASES[unit.type]) {
    const sourceValue = normalize(source[alias] ?? '');
    const liveValue = live[alias] ?? '';
    if (sourceValue !== normalize(liveValue)) {
      changedFields.push({
        alias,
        live: liveValue,
        source: sourceValue,
        kind: sourceValue === '' ? 'clear' : 'edit',
      });
    }
  }

  return {
    name: unit.name,
    status: changedFields.length > 0 ? 'changed' : 'unchanged',
    changedFields,
  };
}

export interface DiffSummary {
  /** Field writes that replace one wording with another. */
  fieldEdits: number;
  /** Field writes that delete copy the source does not publish. Counted apart
   *  from the edits, because this is the number worth a second look. */
  fieldClears: number;
  changedCards: number;
  missingCards: number;
  untouchedCards: number;
}

function countKind(diffs: readonly CardDiff[], kind: FieldDiff['kind']): number {
  return diffs.reduce((total, d) => total + d.changedFields.filter((f) => f.kind === kind).length, 0);
}

/** Roll a run of card diffs up into the counts the report's gate is stated in. */
export function summarize(diffs: readonly CardDiff[]): DiffSummary {
  return {
    fieldEdits: countKind(diffs, 'edit'),
    fieldClears: countKind(diffs, 'clear'),
    changedCards: diffs.filter((d) => d.status === 'changed').length,
    missingCards: diffs.filter((d) => d.status === 'missing').length,
    untouchedCards: diffs.filter((d) => d.status === 'unchanged').length,
  };
}

// ── Rendering ──────────────────────────────────────────────────

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function shouldColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return process.stdout.isTTY === true;
}

export function colorize(text: string, color: keyof typeof ANSI): string {
  if (!shouldColor()) return text;
  return `${ANSI[color]}${text}${ANSI.reset}`;
}

/**
 * Build a unified diff of `before` → `after`, attribute it to the given label,
 * and decorate it with ANSI colors for stdout.
 */
export function unifiedColoredDiff(before: string, after: string, label: string): string {
  const patch = createPatch(label, `${before ?? ''}\n`, `${after ?? ''}\n`, '', '');
  const out: string[] = [];

  for (const line of patch.split('\n')) {
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      out.push(colorize(line, 'bold'));
    } else if (line.startsWith('@@')) {
      out.push(colorize(line, 'cyan'));
    } else if (line.startsWith('+')) {
      out.push(colorize(line, 'green'));
    } else if (line.startsWith('-')) {
      out.push(colorize(line, 'red'));
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}
