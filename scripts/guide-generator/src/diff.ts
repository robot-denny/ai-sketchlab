/**
 * Colored unified-diff renderer for the amend-with-approval flow.
 *
 * Wraps the `diff` npm package's `createPatch` and decorates each output line
 * with ANSI escape codes so the operator can visually scan additions vs.
 * deletions before approving the change.
 */

import { createPatch } from 'diff';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};

function shouldColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return process.stdout.isTTY === true;
}

function colorize(text: string, color: string): string {
  if (!shouldColor()) return text;
  return `${color}${text}${ANSI.reset}`;
}

/**
 * Build a unified diff of `before` → `after`, attribute it to the given file
 * label, and decorate it with ANSI colors for stdout.
 */
export function unifiedColoredDiff(
  before: string,
  after: string,
  label = 'description',
): string {
  const patch = createPatch(label, before ?? '', after ?? '', '', '');
  const lines = patch.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      out.push(colorize(line, ANSI.bold));
    } else if (line.startsWith('@@')) {
      out.push(colorize(line, ANSI.cyan));
    } else if (line.startsWith('+')) {
      out.push(colorize(line, ANSI.green));
    } else if (line.startsWith('-')) {
      out.push(colorize(line, ANSI.red));
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}
