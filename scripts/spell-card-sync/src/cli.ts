/**
 * spell-card-sync — reconciles the site's spell card deck against Cantrip's
 * published card document.
 *
 *   npm run spellcards:report -- --source /path/to/cantrip/docs/spell-cards.md
 *   npm run spellcards:apply  -- --source /path/to/cantrip/docs/spell-cards.md
 *
 * Two modes over one comparison:
 * - **`report`** is read-only. It authenticates, GETs the deck, and prints.
 * - **`apply`** renders the same per-field diffs and then asks, card by card,
 *   before writing. There is deliberately no flag that answers for you: the
 *   prompts exist because some of them delete copy, and a switch that skipped
 *   them would remove the only thing standing between a bulk sync and a
 *   sentence nobody meant to lose. A declined card is left exactly as it is.
 *
 * Neither mode creates a card. A unit the site has no node for is reported and
 * skipped — authoring a new card means choosing a document type, a parent stack
 * and a position in tree order, none of which the card document says.
 *
 * Cards are matched to units by node name, which is the `###` heading in the
 * card document (`/retrofit`, `security-review-rules`). Anything the site holds
 * that Cantrip does not publish is reported separately rather than silently
 * ignored: an unmatched live card is either a rename or a retired unit, and both
 * want a human's attention.
 */

import * as fs from 'node:fs';
import { createInterface, type Interface } from 'node:readline';
import { parseUnits, type UnitRecord } from './parse.js';
import { diffCard, summarize, unifiedColoredDiff, colorize, type CardDiff } from './diff.js';
import { baseUrl, getToken, readDeckCards, writeCardValues, type LiveCard } from './umbracoApi.js';

const USAGE =
  'Usage: tsx scripts/spell-card-sync/src/cli.ts <report|apply> --source <path to spell-cards.md>';

const MODES = ['report', 'apply'] as const;
type Mode = (typeof MODES)[number];

interface Args {
  mode: Mode;
  source: string;
}

function parseArgs(argv: readonly string[]): Args {
  const [mode, ...rest] = argv;
  let source = '';

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--source') {
      source = rest[++i] ?? '';
    } else if (arg.startsWith('--source=')) {
      source = arg.slice('--source='.length);
    } else {
      throw new Error(`Unrecognised argument "${arg}".\n${USAGE}`);
    }
  }

  if (!MODES.includes(mode as Mode)) {
    throw new Error(
      `Unknown mode "${mode ?? ''}" — expected one of ${MODES.join(', ')}.\n${USAGE}`,
    );
  }
  if (!source) {
    throw new Error(`--source is required: Cantrip's docs/spell-cards.md.\n${USAGE}`);
  }
  return { mode: mode as Mode, source };
}

// ── The shared comparison ──────────────────────────────────────

interface Comparison {
  units: UnitRecord[];
  cards: LiveCard[];
  byName: Map<string, LiveCard>;
  diffs: CardDiff[];
  kindMismatches: string[];
}

/**
 * Read both sides and classify every unit. Both modes run this identically —
 * `apply` decides nothing `report` did not already print, which is what makes
 * the report a trustworthy preview of the apply.
 */
async function compare(source: string): Promise<Comparison> {
  const units = parseUnits(fs.readFileSync(source, 'utf8'));
  const token = await getToken();
  const cards = await readDeckCards(token);

  // A card is matched to its unit by name, so two cards sharing one name would
  // make the match arbitrary — last write wins, and the other card is compared
  // against nothing. Fail rather than pick.
  const byName = new Map<string, LiveCard>();
  for (const card of cards) {
    const clash = byName.get(card.name);
    if (clash) {
      throw new Error(
        `Two cards on the site are both named "${card.name}" ` +
          `(in ${clash.stack} and ${card.stack}). Names are how a card is matched ` +
          'to its source, so rename one before syncing.',
      );
    }
    byName.set(card.name, card);
  }

  const diffs: CardDiff[] = [];
  const kindMismatches: string[] = [];
  for (const unit of units) {
    const live = byName.get(unit.name);
    diffs.push(diffCard(unit, live?.values));
    if (live && live.kind !== unit.type) {
      kindMismatches.push(`${unit.name}: site says ${live.kind}, Cantrip says ${unit.type}`);
    }
  }

  return { units, cards, byName, diffs, kindMismatches };
}

function printHeader(source: string, comparison: Comparison): void {
  console.log(`source  ${source} — ${comparison.units.length} units`);
  console.log(`site    ${baseUrl()} — ${comparison.cards.length} cards`);
}

function clearsIn(diff: CardDiff): CardDiff['changedFields'] {
  return diff.changedFields.filter((f) => f.kind === 'clear');
}

/**
 * Report one card's changed fields as a unified diff per field.
 *
 * The CLEAR annotation goes on its own line above the diff rather than into the
 * diff's label. A unified-diff header is quoted and escape-encoded when it holds
 * anything unusual, so a label carrying an em dash — or, with color on, ANSI
 * codes — comes back mangled in the very place a human is meant to read it.
 */
function printCard(diff: CardDiff, live: LiveCard): void {
  const heading = `${diff.name}  ${colorize(`(${live.stack} · ${live.kind})`, 'dim')}`;
  console.log(`\n${colorize('~', 'yellow')} ${heading}`);
  for (const field of diff.changedFields) {
    if (field.kind === 'clear') {
      console.log(
        colorize(`[CLEAR — the source publishes no value for ${field.alias}]`, 'yellow'),
      );
    }
    console.log(unifiedColoredDiff(field.live, field.source, field.alias));
  }
}

/** The trailing sections both modes print: what is missing, matching, orphaned. */
function printRoster(comparison: Comparison): void {
  const { units, cards, diffs, kindMismatches } = comparison;

  const missing = diffs.filter((d) => d.status === 'missing');
  if (missing.length > 0) {
    console.log(`\n${colorize('+', 'green')} missing from the site:`);
    for (const diff of missing) {
      const unit = units.find((u: UnitRecord) => u.name === diff.name)!;
      console.log(`    ${diff.name}  ${colorize(`(${unit.group} · ${unit.type})`, 'dim')}`);
    }
  }

  const untouched = diffs.filter((d) => d.status === 'unchanged');
  if (untouched.length > 0) {
    console.log(
      `\n${colorize('=', 'dim')} already matching: ${untouched.map((d) => d.name).join(', ')}`,
    );
  }

  const sourceNames = new Set(units.map((u) => u.name));
  const orphans = cards.filter((c) => !sourceNames.has(c.name));
  if (orphans.length > 0) {
    console.log(
      `\n${colorize('?', 'yellow')} on the site but not in the source: ${orphans
        .map((c) => `${c.name} (${c.stack})`)
        .join(', ')}`,
    );
  }

  if (kindMismatches.length > 0) {
    console.log(`\n${colorize('!', 'red')} card kind disagrees:`);
    for (const line of kindMismatches) console.log(`    ${line}`);
  }
}

function countOrphans(comparison: Comparison): number {
  const sourceNames = new Set(comparison.units.map((u) => u.name));
  return comparison.cards.filter((c) => !sourceNames.has(c.name)).length;
}

// ── report ─────────────────────────────────────────────────────

async function report({ source }: Args): Promise<void> {
  const comparison = await compare(source);
  printHeader(source, comparison);

  for (const diff of comparison.diffs) {
    const live = comparison.byName.get(diff.name);
    if (diff.status === 'changed' && live) printCard(diff, live);
  }

  printRoster(comparison);

  // Clears are listed again, together, on purpose. Each one already appeared in
  // its card's diff, but a destructive write is exactly what gets waved past in a
  // long run of approvals — so it also gets a section of its own at the end.
  const clears = comparison.diffs.flatMap((d) =>
    clearsIn(d).map((f) => ({ card: d.name, field: f })),
  );
  if (clears.length > 0) {
    console.log(`\n${colorize('!', 'yellow')} would DELETE copy the source does not publish:`);
    for (const { card, field } of clears) {
      console.log(`    ${card}.${field.alias}`);
      console.log(`      ${colorize(JSON.stringify(field.live), 'dim')}`);
    }
    console.log(
      colorize('    The source being silent is not evidence the copy is stale — it may be', 'dim'),
    );
    console.log(colorize('    a sentence only this project ever wrote. Check each one.', 'dim'));
  }

  const summary = summarize(comparison.diffs);
  const orphans = countOrphans(comparison);
  console.log(
    `\n${colorize('summary', 'bold')}  ${summary.fieldEdits} field edits across ` +
      `${summary.changedCards} cards, ${summary.missingCards} cards missing, ` +
      `${summary.untouchedCards} cards untouched` +
      (summary.fieldClears > 0
        ? `, ${colorize(`${summary.fieldClears} field clears`, 'yellow')}`
        : '') +
      (orphans > 0 ? `, ${orphans} unmatched on the site` : ''),
  );
  console.log(colorize('nothing was written — report mode is read-only', 'dim'));
}

// ── apply ──────────────────────────────────────────────────────

/**
 * Ask yes/no questions over one readline interface, reading answers from a queue
 * of lines rather than through `rl.question`.
 *
 * The queue is what makes the flow work when stdin is a pipe as well as when it
 * is a terminal, and that matters for more than convenience: piping `n` to every
 * prompt is how this mode gets exercised end to end **without writing
 * anything**. A non-TTY stdin is drained in one burst, so `rl.question` catches
 * only the first line or two and the interface is closed before the third card
 * is offered. Queueing every `line` event instead keeps each answer paired with
 * the card it was given for.
 *
 * End-of-input answers *no* for every remaining card. A run that stalls half way
 * through the deck is the one outcome worse than declining everything.
 */
function openPrompter(): { ask(question: string): Promise<boolean>; close(): void } {
  const rl: Interface = createInterface({ input: process.stdin, output: process.stdout });
  const answers: string[] = [];
  let waiting: ((answer: string | null) => void) | null = null;
  let ended = false;

  rl.on('line', (line: string) => {
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(line);
    } else {
      answers.push(line);
    }
  });
  rl.on('close', () => {
    ended = true;
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(null);
    }
  });

  const nextAnswer = (): Promise<string | null> => {
    if (answers.length > 0) return Promise.resolve(answers.shift()!);
    if (ended) return Promise.resolve(null);
    return new Promise((resolve) => {
      waiting = resolve;
    });
  };

  return {
    async ask(question: string): Promise<boolean> {
      process.stdout.write(question);
      const answer = await nextAnswer();
      if (answer === null) {
        process.stdout.write('\n');
        return false;
      }
      return answer.trim().toLowerCase() === 'y';
    },
    close(): void {
      rl.close();
    },
  };
}

async function apply({ source }: Args): Promise<void> {
  const comparison = await compare(source);
  printHeader(source, comparison);
  // The same roster `report` prints. An operator who goes straight to `apply`
  // would otherwise never see a kind mismatch or an orphaned card — signals
  // about the deck's integrity that have nothing to do with any one approval.
  printRoster(comparison);

  const summary = summarize(comparison.diffs);
  console.log(
    `\n${colorize('apply', 'bold')}  ${summary.fieldEdits} field edits and ` +
      `${summary.fieldClears} field clears across ${summary.changedCards} cards, ` +
      'one approval per card.',
  );
  console.log(
    colorize(
      '        Anything but "y" declines the card and writes nothing for it. ' +
        'Cards already matching are never touched.',
      'dim',
    ),
  );

  const prompter = openPrompter();
  let written = 0;
  let declined = 0;
  let fieldsWritten = 0;
  const skipped: string[] = [];
  const drafts: string[] = [];
  const failed: Array<{ name: string; message: string }> = [];
  const unpublished: Array<{ name: string; message: string }> = [];

  try {
    for (const diff of comparison.diffs) {
      if (diff.status === 'unchanged') continue;

      if (diff.status === 'missing') {
        // Never created here — Cantrip's card document says nothing about which
        // stack a new card belongs under or where in tree order it sits.
        skipped.push(diff.name);
        continue;
      }

      const live = comparison.byName.get(diff.name)!;
      printCard(diff, live);

      const clears = clearsIn(diff);
      if (clears.length > 0) {
        console.log(
          colorize(
            `  ! approving this card DELETES ${clears.length} field(s) the source ` +
              `does not publish: ${clears.map((f) => f.alias).join(', ')}`,
            'yellow',
          ),
        );
        console.log(
          colorize(
            '    The source being silent is not evidence the copy is stale — decline if in doubt.',
            'dim',
          ),
        );
        // Approval is per card, so declining to protect a clear also gives up
        // that card's genuine edits. State the number rather than leaving the
        // operator to count the diffs above.
        const sacrificed = diff.changedFields.length - clears.length;
        if (sacrificed > 0) {
          console.log(
            colorize(
              `    Declining also discards ${sacrificed} genuine edit(s) on this card — ` +
                'approval is per card, not per field. Apply those by hand if you want them.',
              'dim',
            ),
          );
        }
      }

      const approved = await prompter.ask(
        `Apply this card? [y/N] ${clears.length > 0 ? colorize('(includes a CLEAR) ', 'yellow') : ''}`,
      );
      if (!approved) {
        declined++;
        console.log(colorize(`  declined — ${diff.name} left as it is`, 'dim'));
        continue;
      }

      const changes = Object.fromEntries(diff.changedFields.map((f) => [f.alias, f.source]));

      // One card's failure must not end the run. Every card before this one is
      // already written, and abandoning the loop would take the summary with it,
      // leaving the operator to reconstruct what landed from a raw stack trace.
      try {
        const token = await getToken();
        const { published, publishError } = await writeCardValues(token, live.id, changes);
        written++;
        fieldsWritten += diff.changedFields.length;

        if (publishError) {
          unpublished.push({ name: diff.name, message: publishError });
          console.log(
            colorize(
              `  written — ${diff.changedFields.length} field(s), but PUBLISH FAILED: ${publishError}`,
              'red',
            ),
          );
          console.log(
            colorize(
              '    The card now holds the new copy as a draft. Publish it by hand — a later run ' +
                'reads those draft values, calls the card unchanged, and will not remind you.',
              'yellow',
            ),
          );
        } else {
          if (!published) drafts.push(diff.name);
          console.log(
            colorize(
              `  written — ${diff.changedFields.length} field(s)` +
                (published ? ' and re-published' : ', left unpublished (the card was a draft)'),
              'green',
            ),
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ name: diff.name, message });
        console.log(colorize(`  FAILED — ${diff.name} was not written: ${message}`, 'red'));
        console.log(colorize('    Continuing with the next card.', 'dim'));
      }
    }
  } finally {
    prompter.close();
  }

  console.log(
    `\n${colorize('summary', 'bold')}  ${fieldsWritten} fields written across ${written} cards, ` +
      `${declined} cards declined` +
      (skipped.length > 0 ? `, ${skipped.length} skipped as missing` : '') +
      (failed.length > 0 ? `, ${colorize(`${failed.length} FAILED`, 'red')}` : ''),
  );
  if (failed.length > 0) {
    console.log(colorize('        failed, nothing written for these:', 'red'));
    for (const { name, message } of failed) console.log(`          ${name} — ${message}`);
  }
  if (unpublished.length > 0) {
    console.log(colorize('        WRITTEN BUT NOT PUBLISHED — publish these by hand:', 'yellow'));
    for (const { name, message } of unpublished) console.log(`          ${name} — ${message}`);
  }
  if (skipped.length > 0) {
    console.log(
      colorize(
        `        not created: ${skipped.join(', ')} — a new card needs a stack and a ` +
          'tree position, so it is authored deliberately rather than here.',
        'dim',
      ),
    );
  }
  if (drafts.length > 0) {
    console.log(
      colorize(
        `        still unpublished: ${drafts.join(', ')} — they were drafts before this run.`,
        'yellow',
      ),
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'apply') {
    await apply(args);
  } else {
    await report(args);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
