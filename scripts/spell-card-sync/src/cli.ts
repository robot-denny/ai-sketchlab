/**
 * spell-card-sync — reports how the site's spell card deck differs from
 * Cantrip's published card document.
 *
 *   npm run spellcards:report -- --source /path/to/cantrip/docs/spell-cards.md
 *
 * `report` is the only mode, and it is **read-only**: it authenticates, GETs the
 * deck, and prints. Applying the diff is a separate step with its own approval
 * flow, so nothing here may write — `umbracoApi.ts` exposes no write helper to
 * call by accident.
 *
 * Cards are matched to units by node name, which is the `###` heading in the
 * card document (`/retrofit`, `security-review-rules`). Anything the site holds
 * that Cantrip does not publish is reported separately rather than silently
 * ignored: an unmatched live card is either a rename or a retired unit, and both
 * want a human's attention.
 */

import * as fs from 'node:fs';
import { parseUnits, type UnitRecord } from './parse.js';
import { diffCard, summarize, unifiedColoredDiff, colorize, type CardDiff } from './diff.js';
import { baseUrl, getToken, readDeckCards, type LiveCard } from './umbracoApi.js';

const USAGE = 'Usage: tsx scripts/spell-card-sync/src/cli.ts report --source <path to spell-cards.md>';

interface Args {
  mode: string;
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

  if (mode !== 'report') {
    throw new Error(`Unknown mode "${mode ?? ''}" — only "report" exists.\n${USAGE}`);
  }
  if (!source) {
    throw new Error(`--source is required: Cantrip's docs/spell-cards.md.\n${USAGE}`);
  }
  return { mode, source };
}

/** Report one card's changed fields as a unified diff per field. */
function printCard(diff: CardDiff, live: LiveCard): void {
  const heading = `${diff.name}  ${colorize(`(${live.stack} · ${live.kind})`, 'dim')}`;
  console.log(`\n${colorize('~', 'yellow')} ${heading}`);
  for (const field of diff.changedFields) {
    const label =
      field.kind === 'clear'
        ? `${field.alias}  ${colorize('[CLEAR — the source publishes no value for this]', 'yellow')}`
        : field.alias;
    console.log(unifiedColoredDiff(field.live, field.source, label));
  }
}

async function report({ source }: Args): Promise<void> {
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

  console.log(`source  ${source} — ${units.length} units`);
  console.log(`site    ${baseUrl()} — ${cards.length} cards`);

  const diffs: CardDiff[] = [];
  const kindMismatches: string[] = [];

  for (const unit of units) {
    const live = byName.get(unit.name);
    const diff = diffCard(unit, live?.values);
    diffs.push(diff);
    if (live && live.kind !== unit.type) {
      kindMismatches.push(`${unit.name}: site says ${live.kind}, Cantrip says ${unit.type}`);
    }
    if (diff.status === 'changed' && live) printCard(diff, live);
  }

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
    console.log(`\n${colorize('=', 'dim')} already matching: ${untouched.map((d) => d.name).join(', ')}`);
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

  // Clears are listed again, together, on purpose. Each one already appeared in
  // its card's diff, but a destructive write is exactly what gets waved past in a
  // long run of approvals — so it also gets a section of its own at the end.
  const clears = diffs.flatMap((d) =>
    d.changedFields.filter((f) => f.kind === 'clear').map((f) => ({ card: d.name, field: f })),
  );
  if (clears.length > 0) {
    console.log(`\n${colorize('!', 'yellow')} would DELETE copy the source does not publish:`);
    for (const { card, field } of clears) {
      console.log(`    ${card}.${field.alias}`);
      console.log(`      ${colorize(JSON.stringify(field.live), 'dim')}`);
    }
    console.log(
      colorize(
        '    The source being silent is not evidence the copy is stale — it may be',
        'dim',
      ),
    );
    console.log(colorize('    a sentence only this project ever wrote. Check each one.', 'dim'));
  }

  const summary = summarize(diffs);
  console.log(
    `\n${colorize('summary', 'bold')}  ${summary.fieldEdits} field edits across ` +
      `${summary.changedCards} cards, ${summary.missingCards} cards missing, ` +
      `${summary.untouchedCards} cards untouched` +
      (summary.fieldClears > 0
        ? `, ${colorize(`${summary.fieldClears} field clears`, 'yellow')}`
        : '') +
      (orphans.length > 0 ? `, ${orphans.length} unmatched on the site` : ''),
  );
  console.log(colorize('nothing was written — report mode is read-only', 'dim'));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await report(args);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
