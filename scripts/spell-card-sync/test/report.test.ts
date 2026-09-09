import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { UnitRecord } from '../src/parse.js';
import { diffCard, summarize } from '../src/diff.js';

/**
 * Units are fabricated rather than parsed, and live values are plain objects
 * rather than Management-API responses — the classifier is what is under test,
 * so neither the parser nor the network takes part.
 */
const retrofit: UnitRecord = {
  name: '/retrofit',
  type: 'Spell',
  group: 'Core spellbook',
  fields: {
    Cast: '`/retrofit [what you changed]`',
    Needs: 'a change that skipped spec → plan → implement',
    Leaves: 'only what you confirm: tests, docs, feature-doc updates',
    Does: 'The easy button for work that skipped the flow.',
    Modes: '`uncommitted` (default) is `git diff` plus staged.',
    'Watch for': 'run it before you commit.',
    Then: 'a fresh `/code-review`',
  },
};

const retrofitLive: Record<string, string> = {
  cardTitle: 'Retrofit',
  cardCast: '`/retrofit [what you changed]`',
  cardNeeds: 'a change that skipped spec → plan → implement',
  cardLeaves: 'only what you confirm: tests, docs, feature-doc updates',
  cardDoes: 'The easy button for work that skipped the flow.',
  cardModes: '`uncommitted` (default) is `git diff` plus staged.',
  cardWatchFor: 'run it before you commit.',
  cardFooterLabel: 'Then',
  cardFooterValue: 'a fresh `/code-review`',
  cardMark: 'retrofit',
};

const securityReviewRules: UnitRecord = {
  name: 'security-review-rules',
  type: 'Reference',
  group: 'Core reference',
  fields: {
    Triggers: 'reviewing a change for security defects',
    Holds: 'the OWASP Top 10 category table',
    Does: 'The standard the quality reviewer checks security against.',
    'Pairs with': '`reviewer-discipline`, `/code-review`',
  },
};

describe('diffCard', () => {
  it('calls a card unchanged when every mapped field already holds the source value', () => {
    const diff = diffCard(retrofit, retrofitLive);

    assert.equal(diff.name, '/retrofit');
    assert.equal(diff.status, 'unchanged');
    assert.deepEqual(diff.changedFields, []);
  });

  it('reports a differing field and carries both sides of it', () => {
    const diff = diffCard(retrofit, {
      ...retrofitLive,
      cardWatchFor: 'run it before you push.',
    });

    assert.equal(diff.status, 'changed');
    assert.deepEqual(diff.changedFields, [
      {
        alias: 'cardWatchFor',
        live: 'run it before you push.',
        source: 'run it before you commit.',
        kind: 'edit',
      },
    ]);
  });

  it('reports every differing field, not only the first', () => {
    const diff = diffCard(retrofit, {
      ...retrofitLive,
      cardCast: '`/retrofit`',
      cardDoes: 'Reconciles intent against the diff.',
    });

    assert.deepEqual(
      diff.changedFields.map((f) => f.alias),
      ['cardCast', 'cardDoes'],
    );
  });

  it('calls a unit with no live card missing, and lists no field edits for it', () => {
    const diff = diffCard(securityReviewRules, undefined);

    assert.equal(diff.name, 'security-review-rules');
    assert.equal(diff.status, 'missing');
    assert.deepEqual(diff.changedFields, []);
  });

  it('ignores the properties the card source does not carry — the title and the mark', () => {
    const diff = diffCard(retrofit, {
      ...retrofitLive,
      cardTitle: 'something else entirely',
      cardMark: 'a-different-mark',
    });

    assert.equal(diff.status, 'unchanged');
  });

  it('treats a field the source omits and the live card leaves blank as unchanged', () => {
    const live: Record<string, string> = {
      cardTriggers: 'reviewing a change for security defects',
      cardHolds: 'the OWASP Top 10 category table',
      cardDoes: 'The standard the quality reviewer checks security against.',
      cardModes: '',
      cardWatchFor: '',
      cardFooterLabel: 'Pairs with',
      cardFooterValue: '`reviewer-discipline`, `/code-review`',
    };

    assert.equal(diffCard(securityReviewRules, live).status, 'unchanged');
  });

  it('reports a field the live card fills but the source omits, so a stale value is not left behind', () => {
    const diff = diffCard(securityReviewRules, {
      cardTriggers: 'reviewing a change for security defects',
      cardHolds: 'the OWASP Top 10 category table',
      cardDoes: 'The standard the quality reviewer checks security against.',
      cardWatchFor: 'a line Cantrip no longer publishes',
      cardFooterLabel: 'Pairs with',
      cardFooterValue: '`reviewer-discipline`, `/code-review`',
    });

    assert.deepEqual(diff.changedFields, [
      {
        alias: 'cardWatchFor',
        live: 'a line Cantrip no longer publishes',
        source: '',
        kind: 'clear',
      },
    ]);
  });

  it('tells a clear apart from an edit, because only one of them destroys copy', () => {
    const cleared = diffCard(securityReviewRules, {
      cardTriggers: 'reviewing a change for security defects',
      cardHolds: 'the OWASP Top 10 category table',
      cardDoes: 'The standard the quality reviewer checks security against.',
      cardWatchFor: 'a sentence only this project wrote',
      cardFooterLabel: 'Pairs with',
      cardFooterValue: '`reviewer-discipline`, `/code-review`',
    });
    const edited = diffCard(securityReviewRules, {
      cardTriggers: 'reviewing a change for security defects',
      cardHolds: 'the OWASP Top 10 category table',
      cardDoes: 'wording the source disagrees with',
      cardFooterLabel: 'Pairs with',
      cardFooterValue: '`reviewer-discipline`, `/code-review`',
    });

    assert.deepEqual(
      cleared.changedFields.map((f) => [f.alias, f.kind]),
      [['cardWatchFor', 'clear']],
    );
    assert.deepEqual(
      edited.changedFields.map((f) => [f.alias, f.kind]),
      [['cardDoes', 'edit']],
    );
  });

  it('never reports a spell-only field against a reference, or the reverse', () => {
    const diff = diffCard(securityReviewRules, {
      cardTriggers: 'reviewing a change for security defects',
      cardHolds: 'the OWASP Top 10 category table',
      cardDoes: 'The standard the quality reviewer checks security against.',
      cardFooterLabel: 'Pairs with',
      cardFooterValue: '`reviewer-discipline`, `/code-review`',
      cardCast: '`/not-a-spell`',
    });

    assert.equal(diff.status, 'unchanged');
  });
});

describe('summarize', () => {
  it('counts field edits, the cards carrying them, the missing cards and the untouched ones', () => {
    const summary = summarize([
      {
        name: '/retrofit',
        status: 'changed',
        changedFields: [
          { alias: 'cardCast', live: 'a', source: 'b', kind: 'edit' },
          { alias: 'cardDoes', live: 'c', source: 'd', kind: 'edit' },
        ],
      },
      {
        name: '/spec',
        status: 'changed',
        changedFields: [{ alias: 'cardDoes', live: 'e', source: 'f', kind: 'edit' }],
      },
      {
        name: 'dotnet-conventions',
        status: 'changed',
        changedFields: [{ alias: 'cardWatchFor', live: 'g', source: '', kind: 'clear' }],
      },
      { name: 'security-review-rules', status: 'missing', changedFields: [] },
      { name: 'prose-discipline', status: 'missing', changedFields: [] },
      { name: 'workflow', status: 'unchanged', changedFields: [] },
      { name: 'tdd-principles', status: 'unchanged', changedFields: [] },
    ]);

    assert.deepEqual(summary, {
      fieldEdits: 3,
      fieldClears: 1,
      changedCards: 3,
      missingCards: 2,
      untouchedCards: 2,
    });
  });
});
