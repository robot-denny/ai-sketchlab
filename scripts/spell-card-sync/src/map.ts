/**
 * Maps one parsed Cantrip unit onto the site's spell-card property aliases,
 * per the field-mapping table in `_work/cantrip-toolkit-refresh/spec.md`.
 *
 * Two rules the table encodes and this module enforces:
 * - the stat block is kind-specific — spells carry Cast/Needs/Leaves, references
 *   carry Triggers/Holds, and neither borrows the other's aliases;
 * - `cardMark` is never emitted. It is a spell-only property with no source in
 *   the card document, so it is authored in the backoffice and left alone here.
 *
 * Copy is carried exactly as authored, inline code spans and all — the site's
 * fields are plain-text editors, and the markup is part of the text.
 */

import type { UnitType, UnitRecord } from './parse.js';

/** Card fields both kinds share. */
const SHARED_FIELDS: ReadonlyArray<readonly [field: string, alias: string]> = [
  ['Does', 'cardDoes'],
  ['Modes', 'cardModes'],
  ['Watch for', 'cardWatchFor'],
];

/** The stat block, which differs by kind. */
const STAT_BLOCK: Record<UnitType, ReadonlyArray<readonly [field: string, alias: string]>> = {
  Spell: [
    ['Cast', 'cardCast'],
    ['Needs', 'cardNeeds'],
    ['Leaves', 'cardLeaves'],
  ],
  Reference: [
    ['Triggers', 'cardTriggers'],
    ['Holds', 'cardHolds'],
  ],
};

/**
 * The footer label is the field's own name, stored as the dropdown's value —
 * `Then` for a spell, `Pairs with` for a reference — with the copy in
 * `cardFooterValue`.
 */
const FOOTER_FIELD: Record<UnitType, string> = {
  Spell: 'Then',
  Reference: 'Pairs with',
};

/**
 * Returns the properties this card defines, keyed by site alias. A field the
 * card omits is left out entirely rather than mapped to an empty string, so a
 * caller can tell "Cantrip says nothing here" apart from "Cantrip says blank".
 */
export function toProperties(unit: UnitRecord): Record<string, string> {
  const properties: Record<string, string> = {};

  for (const [field, alias] of [...STAT_BLOCK[unit.type], ...SHARED_FIELDS]) {
    const value = unit.fields[field];
    if (value !== undefined) properties[alias] = value;
  }

  const footerField = FOOTER_FIELD[unit.type];
  const footerValue = unit.fields[footerField];
  if (footerValue !== undefined) {
    properties.cardFooterLabel = footerField;
    properties.cardFooterValue = footerValue;
  }

  return properties;
}
