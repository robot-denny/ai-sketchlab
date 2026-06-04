/**
 * Accessibility (axe-core) scan — the FIRST semantic/a11y spec in the suite.
 *
 * The rest of the E2E bundle (tests/e2e/blocks/**, tests/e2e/pages/**) is
 * VISUAL REGRESSION + behavioural only; ARIA, contrast, link names, landmark
 * roles, and keyboard focus are explicitly OUT OF SCOPE there (see the header
 * of tests/e2e/_helpers.ts). This spec COMPLEMENTS — does not replace — that
 * suite by adding semantic coverage via @axe-core/playwright.
 *
 * SCOPE — Batch 1 only (see _plans/accessibility-fixes.md / _specs/accessibility-fixes.md):
 * each scan is filtered to the rule families this batch is meant to fix, so an
 * unrelated pre-existing violation outside Batch 1 doesn't gate the work:
 *
 *   - color-contrast        (WCAG 1.4.3 — text/link contrast on all surfaces)
 *   - aria-hidden-focus     (no focusable node inside an aria-hidden subtree — card thumbnail links)
 *   - link-name             (every link has an accessible name)
 *   - link-in-text-block    (links distinguishable from surrounding text by more than colour)
 *   - landmark / list hygiene (footer contentinfo landmark + <nav>/<ul>/<li> structure):
 *       landmark-contentinfo-is-top-level, landmark-no-duplicate-contentinfo,
 *       landmark-unique, list, listitem
 *
 * (axe has no single rule literally named "landmark-contentinfo"; the spec's
 * "landmark-contentinfo" family maps to the five landmark/list rules above.)
 *
 * A separate keyboard-focus test asserts a VISIBLE focus indicator on a footer
 * link and a site-nav link — axe cannot fully verify :focus-visible styling,
 * so we read computed outline/box-shadow directly.
 *
 * VERIFICATION CONTRACT: this spec is RED before Batch 1 fixes land and GREEN
 * after. A green run on an unfixed tree would mean the Live audit findings
 * aren't reproducible locally — investigate before trusting it.
 *
 * Resilience (CLAUDE.md "E2E Test Resilience Rules"): home + article URLs are
 * looked up dynamically via the Management API (rules #1/#2 — no hardcoded
 * UUIDs or slugs); tokens refresh per rule #4. Mirrors the token/lookup helper
 * pattern in tests/e2e/footer/updatedFooter.spec.ts.
 */

import fs from 'node:fs';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import dotenv from 'dotenv';

import { apiFetch, findHomeDocId, getDocumentPath } from '../_umbracoApi';

dotenv.config();

const API_BASE = process.env.URL || 'https://localhost:44367';

// Viewport used for both the scans and the diagnostic reporter — also the clamp
// bound for screenshot clip regions (keeps clipped shots inside the frame).
const REPORT_VIEWPORT = { width: 1200, height: 800 };

// Where the human-readable diagnostic artifacts land. test-results/ is a
// Playwright output dir and is gitignored — artifacts are NOT committed.
const A11Y_OUT_DIR = path.resolve(process.cwd(), 'test-results', 'a11y');

// Per-rule screenshot cap. If a rule has more offending nodes than this, the
// extra ones are noted in the report rather than silently dropped
// (CLAUDE.md: "no silent caps").
const MAX_SCREENSHOTS_PER_RULE = 5;

// Batch 1 rule families — the only violations this spec gates on.
const BATCH1_RULES = [
  'color-contrast',
  'aria-hidden-focus',
  'link-name',
  'link-in-text-block',
  // Footer contentinfo landmark + <nav>/<ul>/<li> list hygiene (FR6).
  'landmark-contentinfo-is-top-level',
  'landmark-no-duplicate-contentinfo',
  'landmark-unique',
  'list',
  'listitem',
];

// ==============================
// Lookup helpers
// freshToken / apiFetch / findHomeDocId / getDocumentPath live in
// tests/e2e/_umbracoApi.ts (apiFetch auto-refreshes the token — rule #4).
// Only the article-discovery walk below is specific to this spec.
// ==============================

/**
 * Find the id of the first PUBLISHED article-type document by walking the
 * document tree breadth-first from Home (rule #1: no hardcoded UUIDs/slugs).
 * "article" is identified by the document-type id, looked up by name — not by
 * assuming a "Blog" container or a particular slug.
 */
async function findPublishedArticleDocId(homeId: string): Promise<string> {
  // Resolve the "Article" document-type id by name.
  const dtRootResp = await apiFetch('GET', '/tree/document-type/root?skip=0&take=100');
  if (!dtRootResp.ok) throw new Error(`GET doc-type tree root failed: ${dtRootResp.status}`);
  const dtRootData = (await dtRootResp.json()) as any;
  const articleDt = (dtRootData.items ?? []).find(
    (i: any) => (i.name ?? '').toLowerCase() === 'article'
  );
  const articleDtId: string | undefined = articleDt?.id;

  // BFS the document tree from Home, capped, looking for a published article.
  const queue: string[] = [homeId];
  const seen = new Set<string>();
  let guard = 0;

  while (queue.length && guard < 200) {
    guard++;
    const parentId = queue.shift()!;
    if (seen.has(parentId)) continue;
    seen.add(parentId);

    const childResp = await apiFetch(
      'GET',
      `/tree/document/children?parentId=${parentId}&skip=0&take=100`
    );
    if (!childResp.ok) continue;
    const childData = (await childResp.json()) as any;

    for (const item of childData.items ?? []) {
      const variant = item.variants?.[0] ?? {};
      const isPublished = (variant.state ?? '').toLowerCase() === 'published';
      const matchesType = articleDtId
        ? item.documentType?.id === articleDtId
        : String(item.documentType?.icon ?? '').includes('icon-article');
      if (isPublished && matchesType) return item.id;
      if (item.hasChildren) queue.push(item.id);
    }
  }

  throw new Error('No published Article-type document found in the tree under Home');
}

// ==============================
// axe-core scans — Batch 1 rule families
// ==============================

let homeDocUrl: string;
let articleDocUrl: string;

test.describe('Accessibility — axe-core (Batch 1 rule families)', () => {
  test.beforeAll(async () => {
    const homeId = await findHomeDocId();
    homeDocUrl = await getDocumentPath(homeId);

    const articleId = await findPublishedArticleDocId(homeId);
    articleDocUrl = await getDocumentPath(articleId);
  });

  async function scan(page: Page, url: string, label: string) {
    await page.goto(url);
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await new AxeBuilder({ page }).withRules(BATCH1_RULES).analyze();

    const ids = results.violations.map((v: any) => v.id);
    if (ids.length) {
      // Diagnostic output so RED runs name exactly which families failed.
      console.log(`[axe ${label}] violations: ${JSON.stringify(ids)}`);
      for (const v of results.violations) {
        console.log(`[axe ${label}]   ${v.id} x${v.nodes.length} — ${v.help}`);
      }
    }

    expect(
      results.violations,
      `axe violations on ${label} (${url}): ${JSON.stringify(ids)}`
    ).toEqual([]);
  }

  test('home page has no Batch 1 axe violations', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await scan(page, homeDocUrl, 'home');
  });

  test('article page has no Batch 1 axe violations', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await scan(page, articleDocUrl, 'article');
  });
});

// ==============================
// Diagnostic reporter — human-readable artifact per page
// ==============================
//
// Unlike the assertion tests above (which gate ONLY on the families that fire
// as hard violations locally — card aria-hidden-focus / link-name), this
// reporter runs the SAME Batch 1 scan but never asserts. It serialises every
// finding the reviewer needs to eyeball each fix:
//
//   - results.violations  → "## Hard violations" (axe is confident)
//   - results.incomplete  → "## Needs human review (incomplete)" — this is
//     where color-contrast lands locally (axe punts because it can't resolve a
//     definitive bg colour), so it would be INVISIBLE in a violations-only
//     view. Surfacing it is the whole point of the reporter.
//
// Per finding it writes: rule id, impact, WCAG criterion (wcag* tags), the
// rule help/description, and per node the target selector(s), a trimmed
// outerHTML snippet, and any failureSummary. The raw axe result is written as
// a sibling .json for completeness. Each offending node also gets an annotated
// screenshot (scroll-into-view + magenta highlight box).

/** Stable filename slug from a URL path (e.g. "/" → "home"; "/foo/bar/" → "foo-bar"). */
function slugFromUrl(url: string): string {
  try {
    const p = new URL(url, API_BASE).pathname;
    const trimmed = p.replace(/^\/+|\/+$/g, '');
    if (!trimmed) return 'home';
    return trimmed.replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  } catch {
    return url.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'page';
  }
}

/** WCAG criterion tags (e.g. ["wcag2aa", "wcag143"]) joined, or "(none)". */
function wcagTags(tags: string[] | undefined): string {
  const wcag = (tags ?? []).filter((t) => /^wcag\d/i.test(t));
  return wcag.length ? wcag.join(', ') : '(no wcag tag)';
}

/** Trim a node's outerHTML so the report stays readable. */
function trimHtml(html: string | undefined, max = 400): string {
  if (!html) return '(no html)';
  const oneLine = html.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

/**
 * Annotate + screenshot one offending node. axe `target` is an array of CSS
 * selectors (for nodes inside iframes/shadow DOM it's a nested array) — the
 * last string entry is usually the directly-usable selector. Resolves the
 * locator, scrolls into view, draws a magenta outline, screenshots the page,
 * then removes the highlight. Returns the screenshot filename or null.
 * Wrapped by the caller in try/catch so one bad selector never aborts a report.
 */
async function annotateAndShoot(
  page: Page,
  target: any,
  outFile: string
): Promise<string | null> {
  // Flatten axe target (handles nested arrays for shadow/iframe) to the last string.
  const flat: string[] = Array.isArray(target) ? target.flat(Infinity) : [target];
  const selector = flat.filter((s) => typeof s === 'string').pop();
  if (!selector) return null;

  const locator = page.locator(selector);
  const count = await locator.count();
  if (count === 0) return null;

  const el = locator.first();
  await el.scrollIntoViewIfNeeded({ timeout: 3000 });

  // Apply a temporary highlight via the DOM, then revert after the screenshot.
  const restored = await el.evaluate((node: any) => {
    const prev = {
      outline: node.style.outline,
      outlineOffset: node.style.outlineOffset,
      boxShadow: node.style.boxShadow,
    };
    node.style.outline = '3px solid magenta';
    node.style.outlineOffset = '2px';
    node.style.boxShadow = '0 0 0 6px rgba(255,0,255,0.25)';
    return prev;
  });

  // Bound the screenshot to the node (+ padding for the highlight ring) so the
  // artifact stays small and cheap to encode — full-page shots per finding add
  // up across two pages. Clamped to the viewport; falls back to a full-page shot
  // if the element has no resolvable box (e.g. fully offscreen).
  const box = await el.boundingBox();
  let clip: { x: number; y: number; width: number; height: number } | undefined;
  if (box) {
    const pad = 16;
    const x = Math.max(0, box.x - pad);
    const y = Math.max(0, box.y - pad);
    clip = {
      x,
      y,
      width: Math.min(REPORT_VIEWPORT.width - x, box.width + pad * 2),
      height: Math.min(REPORT_VIEWPORT.height - y, box.height + pad * 2),
    };
    if (clip.width <= 0 || clip.height <= 0) clip = undefined;
  }

  await page.screenshot({ path: outFile, ...(clip ? { clip } : {}) });

  // Revert the inline style we set so later screenshots aren't polluted.
  await el.evaluate(
    (node: any, prev: any) => {
      node.style.outline = prev.outline;
      node.style.outlineOffset = prev.outlineOffset;
      node.style.boxShadow = prev.boxShadow;
    },
    restored
  );

  return path.basename(outFile);
}

/** Build the markdown body for one section (violations | incomplete). */
function renderSection(
  title: string,
  findings: any[],
  shots: Map<string, string | null>
): string {
  const lines: string[] = [`## ${title}`, ''];
  if (!findings.length) {
    lines.push('_None._', '');
    return lines.join('\n');
  }
  for (const f of findings) {
    lines.push(`### \`${f.id}\` — ${f.impact ?? 'no-impact'}`);
    lines.push('');
    lines.push(`- **WCAG**: ${wcagTags(f.tags)}`);
    lines.push(`- **Help**: ${f.help ?? ''}`);
    if (f.description) lines.push(`- **Description**: ${f.description}`);
    if (f.helpUrl) lines.push(`- **Reference**: ${f.helpUrl}`);
    lines.push(`- **Offending nodes**: ${f.nodes.length}`);
    lines.push('');

    f.nodes.forEach((node: any, i: number) => {
      const selectors = (Array.isArray(node.target) ? node.target : [node.target])
        .map((t: any) => (Array.isArray(t) ? t.join(' >> ') : t))
        .join(', ');
      lines.push(`#### node ${i + 1}`);
      lines.push('');
      lines.push(`- **Selector**: \`${selectors}\``);
      lines.push('- **HTML**:');
      lines.push('  ```html');
      lines.push(`  ${trimHtml(node.html)}`);
      lines.push('  ```');
      if (node.failureSummary) {
        lines.push(`- **Failure summary**: ${node.failureSummary.replace(/\n/g, ' ')}`);
      }
      const shotKey = `${f.id}::${i}`;
      const shot = shots.get(shotKey);
      if (shot) {
        lines.push(`- **Screenshot**: ![${f.id} node ${i + 1}](${shot})`);
      } else if (shots.has(shotKey)) {
        lines.push('- **Screenshot**: _(selector did not resolve to a visible element)_');
      } else if (i >= MAX_SCREENSHOTS_PER_RULE) {
        lines.push(
          `- **Screenshot**: _(capped — only the first ${MAX_SCREENSHOTS_PER_RULE} nodes of this rule are captured)_`
        );
      }
      lines.push('');
    });
  }
  return lines.join('\n');
}

/**
 * Scan one page for the Batch 1 families, then write:
 *   - test-results/a11y/<slug>.json  (raw axe result)
 *   - test-results/a11y/<slug>.md    (human-readable two-section report)
 *   - test-results/a11y/<slug>-<ruleId>-<n>.png  (annotated screenshots)
 * No assertions — this is a diagnostic artifact for the reviewer.
 */
async function reportPage(page: Page, url: string, label: string) {
  fs.mkdirSync(A11Y_OUT_DIR, { recursive: true });

  await page.setViewportSize(REPORT_VIEWPORT);
  await page.goto(url);
  await page.waitForLoadState('networkidle').catch(() => {});

  const results = await new AxeBuilder({ page }).withRules(BATCH1_RULES).analyze();

  const slug = slugFromUrl(url);

  // Raw JSON for completeness.
  fs.writeFileSync(
    path.join(A11Y_OUT_DIR, `${slug}.json`),
    JSON.stringify(results, null, 2),
    'utf8'
  );

  // Screenshot every offending node (capped per rule) across both sections.
  const shots = new Map<string, string | null>();
  for (const section of [results.violations, results.incomplete]) {
    for (const finding of section) {
      for (let i = 0; i < finding.nodes.length; i++) {
        if (i >= MAX_SCREENSHOTS_PER_RULE) break;
        const file = path.join(A11Y_OUT_DIR, `${slug}-${finding.id}-${i + 1}.png`);
        try {
          const name = await annotateAndShoot(page, finding.nodes[i].target, file);
          shots.set(`${finding.id}::${i}`, name);
        } catch {
          // Un-resolvable selector — record null so the report notes it.
          shots.set(`${finding.id}::${i}`, null);
        }
      }
    }
  }

  const md: string[] = [];
  md.push(`# Accessibility findings — ${label}`);
  md.push('');
  md.push(`- **URL**: ${url}`);
  md.push(`- **Scanned**: ${new Date().toISOString()}`);
  md.push(`- **Rule families (Batch 1)**: ${BATCH1_RULES.join(', ')}`);
  md.push(`- **Hard violations**: ${results.violations.length}`);
  md.push(`- **Needs human review (incomplete)**: ${results.incomplete.length}`);
  md.push('');
  md.push(
    '> Hard violations are what axe is confident about (locally: the article-card ' +
      'thumbnail link). "Needs human review" is what axe punts on — color-contrast ' +
      'lands here because axe cannot always resolve a definitive background colour. ' +
      'Judge each by eye using the selector + screenshot.'
  );
  md.push('');
  md.push(renderSection('Hard violations', results.violations, shots));
  md.push('');
  md.push(renderSection('Needs human review (incomplete)', results.incomplete, shots));
  md.push('');

  fs.writeFileSync(path.join(A11Y_OUT_DIR, `${slug}.md`), md.join('\n'), 'utf8');

  console.log(
    `[axe report ${label}] wrote test-results/a11y/${slug}.md — ` +
      `${results.violations.length} hard violation(s), ${results.incomplete.length} incomplete; ` +
      `${[...shots.values()].filter(Boolean).length} screenshot(s)`
  );
}

test.describe('Accessibility — diagnostic reporter (Batch 1)', () => {
  test.beforeAll(async () => {
    if (!homeDocUrl || !articleDocUrl) {
      const homeId = await findHomeDocId();
      homeDocUrl = await getDocumentPath(homeId);
      const articleId = await findPublishedArticleDocId(homeId);
      articleDocUrl = await getDocumentPath(articleId);
    }
  });

  test('writes home page diagnostic report', async ({ page }) => {
    await reportPage(page, homeDocUrl, 'home');
  });

  test('writes article page diagnostic report', async ({ page }) => {
    await reportPage(page, articleDocUrl, 'article');
  });
});

// ==============================
// Keyboard focus — visible focus indicator (WCAG 2.4.7 / 1.4.11)
// axe can't fully verify :focus-visible styling, so read computed style.
// ==============================

test.describe('Accessibility — visible keyboard focus', () => {
  test.beforeAll(async () => {
    if (!homeDocUrl) {
      const homeId = await findHomeDocId();
      homeDocUrl = await getDocumentPath(homeId);
    }
  });

  /** True when the element shows a visible focus ring: a non-`none` outline with
   *  width > 0, OR a box-shadow ring. Tolerant of either treatment (rule #5). */
  async function hasVisibleFocusRing(locator: any): Promise<boolean> {
    return locator.evaluate((el: Element) => {
      const cs = window.getComputedStyle(el);
      const outlineStyle = cs.outlineStyle;
      const outlineWidth = parseFloat(cs.outlineWidth || '0');
      const hasOutline = outlineStyle !== 'none' && outlineWidth > 0;
      const boxShadow = cs.boxShadow;
      const hasBoxShadow = !!boxShadow && boxShadow !== 'none';
      return hasOutline || hasBoxShadow;
    });
  }

  test('site-nav link shows a visible focus indicator when focused', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);

    const navLink = page.locator('.site-head .site-nav a').first();
    await expect(navLink).toBeAttached();
    await navLink.focus();

    const visible = await hasVisibleFocusRing(navLink);
    expect(
      visible,
      'site-nav link should have a visible focus ring (outline or box-shadow) when focused'
    ).toBe(true);
  });

  test('footer link shows a visible focus indicator when focused', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);

    const footerLink = page.locator('footer.foot a').first();
    await expect(footerLink).toBeAttached();
    await footerLink.focus();

    const visible = await hasVisibleFocusRing(footerLink);
    expect(
      visible,
      'footer link should have a visible focus ring (outline or box-shadow) when focused'
    ).toBe(true);
  });
});
