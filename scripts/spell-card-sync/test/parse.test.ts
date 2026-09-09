import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUnits } from '../src/parse.js';
import { toProperties } from '../src/map.js';

const FIXTURE = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'spell-cards.sample.md'),
  'utf8',
);

const units = parseUnits(FIXTURE);
const spell = units.find((u) => u.name === '/retrofit')!;
const reference = units.find((u) => u.name === 'security-review-rules')!;

describe('parseUnits', () => {
  it('reads one unit per card heading, ignoring the preamble and stack headings', () => {
    assert.deepEqual(
      units.map((u) => u.name),
      ['/retrofit', 'security-review-rules'],
    );
  });

  it('reads each unit\'s Type and Group', () => {
    assert.equal(spell.type, 'Spell');
    assert.equal(spell.group, 'Core spellbook');
    assert.equal(reference.type, 'Reference');
    assert.equal(reference.group, 'Core reference');
  });

  it('reads a spell\'s stat block and footer verbatim, inline code and all', () => {
    assert.equal(spell.fields['Cast'], '`/retrofit [what you changed] [git range or ref]`');
    assert.equal(spell.fields['Needs'], 'a change that skipped spec → plan → implement');
    assert.equal(spell.fields['Leaves'], 'only what you confirm: tests, docs, feature-doc updates');
    assert.equal(spell.fields['Then'], 'a fresh `/code-review`, then `/commit-message`');
  });

  it('reads a reference\'s stat block and footer', () => {
    assert.equal(
      reference.fields['Triggers'],
      'reviewing a change for security defects; deciding which category a defect belongs to',
    );
    assert.equal(
      reference.fields['Holds'],
      'the OWASP Top 10 category table and the revision it pins, the citation convention',
    );
    assert.equal(reference.fields['Pairs with'], '`reviewer-discipline`, `/code-review`');
  });

  it('reads the body fields shared by both kinds', () => {
    assert.equal(
      spell.fields['Does'],
      'The easy button for work that skipped the flow. Reconciles what you meant against what the diff says, runs the three reviewers, and proposes the tests and docs the change would otherwise skip.',
    );
    assert.equal(
      spell.fields['Modes'],
      '`uncommitted` (default) is `git diff` plus staged. `branch` is everything since the upstream fork point.',
    );
    assert.equal(
      spell.fields['Watch for'],
      'run it before you commit, or before you push if you already committed.',
    );
    assert.equal(
      reference.fields['Does'],
      'The standard the quality reviewer checks security against. It gives every security finding a category by number and name.',
    );
  });

  it('leaves a field the card does not define absent rather than blank', () => {
    assert.equal(Object.hasOwn(reference.fields, 'Watch for'), false);
    assert.equal(Object.hasOwn(reference.fields, 'Modes'), false);
    assert.equal(Object.hasOwn(reference.fields, 'Cast'), false);
  });
});

describe('toProperties', () => {
  it('maps a spell onto the spell-side property aliases', () => {
    assert.deepEqual(toProperties(spell), {
      cardCast: '`/retrofit [what you changed] [git range or ref]`',
      cardNeeds: 'a change that skipped spec → plan → implement',
      cardLeaves: 'only what you confirm: tests, docs, feature-doc updates',
      cardDoes:
        'The easy button for work that skipped the flow. Reconciles what you meant against what the diff says, runs the three reviewers, and proposes the tests and docs the change would otherwise skip.',
      cardModes:
        '`uncommitted` (default) is `git diff` plus staged. `branch` is everything since the upstream fork point.',
      cardWatchFor: 'run it before you commit, or before you push if you already committed.',
      cardFooterLabel: 'Then',
      cardFooterValue: 'a fresh `/code-review`, then `/commit-message`',
    });
  });

  it('maps a reference onto the reference-side property aliases', () => {
    assert.deepEqual(toProperties(reference), {
      cardTriggers:
        'reviewing a change for security defects; deciding which category a defect belongs to',
      cardHolds: 'the OWASP Top 10 category table and the revision it pins, the citation convention',
      cardDoes:
        'The standard the quality reviewer checks security against. It gives every security finding a category by number and name.',
      cardFooterLabel: 'Pairs with',
      cardFooterValue: '`reviewer-discipline`, `/code-review`',
    });
  });

  it('gives a reference no cardCast and no cardMark', () => {
    const properties = toProperties(reference);
    assert.equal(Object.hasOwn(properties, 'cardCast'), false);
    assert.equal(Object.hasOwn(properties, 'cardMark'), false);
  });

  it('gives a spell no cardMark, since the mark is not carried in the card source', () => {
    assert.equal(Object.hasOwn(toProperties(spell), 'cardMark'), false);
  });
});

describe('parseUnits — input the source is not supposed to contain', () => {
  it('refuses a card that does not declare its Group', () => {
    const markdown = ['### /orphan', '', '- **Type:** Spell', '- **Cast:** `/orphan`'].join('\n');

    assert.throws(() => parseUnits(markdown), /\/orphan.*Group/);
  });

  it('treats a heading of any depth as the end of the current card', () => {
    const markdown = [
      '### /first',
      '- **Type:** Spell',
      '- **Group:** Core spellbook',
      '- **Cast:** `/first`',
      '#### an unexpected sub-heading',
      '- **Needs:** something that belongs to no card',
    ].join('\n');

    const units = parseUnits(markdown);

    assert.deepEqual(
      units.map((u) => u.name),
      ['/first'],
    );
    assert.equal(Object.hasOwn(units[0].fields, 'Needs'), false);
  });
});
