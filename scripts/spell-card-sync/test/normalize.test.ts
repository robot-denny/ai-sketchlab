import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../src/normalize.js';

/**
 * Every expectation here is a hard-coded string, and the rules they pin down are
 * empirical rather than chosen: each one reproduces what the deck's original
 * author did by hand when they transcribed Cantrip `d74789a` into the CMS. The
 * evidence is in `_work/cantrip-toolkit-refresh/spec.md` → *Markup policy*, and
 * the check that the rules are right is the report reaching its measured floor
 * rather than anything asserted in this file.
 */
describe('normalize', () => {
  it('unwraps an inline code span, because a backtick would reach the visitor as a glyph', () => {
    assert.equal(normalize('`code`'), 'code');
  });

  it('unwraps bold', () => {
    assert.equal(normalize('**bold**'), 'bold');
  });

  it('unwraps single-asterisk emphasis', () => {
    assert.equal(normalize('*emph*'), 'emph');
  });

  it('leaves text carrying no markup exactly as it is', () => {
    assert.equal(
      normalize('run it before you commit, or before you push if you already committed.'),
      'run it before you commit, or before you push if you already committed.',
    );
  });

  it('unwraps every code span in a value, not only the first', () => {
    assert.equal(
      normalize('`uncommitted` (default) is `git diff` plus staged; `branch` reviews the branch.'),
      'uncommitted (default) is git diff plus staged; branch reviews the branch.',
    );
  });

  it('keeps what a code span wrapped, punctuation and placeholders included', () => {
    assert.equal(normalize('`/explore [problem or area]`, or cast it bare and it asks'), '/explore [problem or area], or cast it bare and it asks');
  });

  it('unwraps emphasis inside a sentence without disturbing the words around it', () => {
    assert.equal(
      normalize('What a test should *assert* so it proves something and survives refactoring.'),
      'What a test should assert so it proves something and survives refactoring.',
    );
  });

  it('leaves an underscore alone — the only underscores Cantrip writes are file paths', () => {
    assert.equal(normalize('`_features/<area>.md`, one file per capability'), '_features/<area>.md, one file per capability');
  });

  it('leaves a lone asterisk alone rather than guessing at emphasis that was never opened', () => {
    assert.equal(normalize('takes * as a wildcard'), 'takes * as a wildcard');
  });

  it('trims the edges, so a stray trailing space is not a difference on its own', () => {
    assert.equal(normalize('the guidance is broad, add your own '), 'the guidance is broad, add your own');
  });

  it('passes an empty value through, which is how a field the source omits arrives', () => {
    assert.equal(normalize(''), '');
  });
});

describe('normalize — the cases two reviewers found by executing it', () => {
  it('leaves a pair of asterisks alone when neither is markdown emphasis', () => {
    // Emphasis in markdown is flanked by whitespace on the outside. A pair of
    // bare asterisks inside a token is a glob or an arithmetic operator, and
    // eating them glues the token into a different, plausible-looking string.
    assert.equal(normalize('roll 3*4*5 for damage'), 'roll 3*4*5 for damage');
    assert.equal(normalize('cast*element*type'), 'cast*element*type');
    assert.equal(normalize('`_work/*/spec/*.md`, one per slug'), '_work/*/spec/*.md, one per slug');
  });

  it('unwraps emphasis nested inside bold, leaving no stray delimiter', () => {
    assert.equal(normalize('**bold *and emph* text**'), 'bold and emph text');
    assert.equal(normalize('**nested *emph* bold**'), 'nested emph bold');
  });

  it('still strips the emphasis Cantrip actually writes', () => {
    // The live corpus shape: emphasis mid-sentence, closed before punctuation.
    assert.equal(
      normalize('the living record of what a capability does *now*: under rules'),
      'the living record of what a capability does now: under rules',
    );
    assert.equal(normalize('a rule read out of code is *not* a tested rule'), 'a rule read out of code is not a tested rule');
  });

  it('is idempotent — normalizing an already-normalized value changes nothing', () => {
    const battery = [
      '`code` and **bold** and *emph*',
      '**bold *and emph* text**',
      'roll 3*4*5 for damage',
      '`_work/<slug>/spec.md`, a working branch',
      'a fresh `/code-review`, then `/commit-message`',
      'plain prose with no markup at all',
      '   leading and trailing   ',
      '',
      '*',
      '**   **',
    ];

    for (const input of battery) {
      const once = normalize(input);
      assert.equal(normalize(once), once, `not idempotent for ${JSON.stringify(input)}`);
    }
  });
});
