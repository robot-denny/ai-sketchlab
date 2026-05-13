import { expect, test } from '@playwright/test';
import { resolveExperimentsUrl } from './_helpers';

// Project's signal-red design token (--accent-primary = #C23D2E).
const SIGNAL_RED = 'rgb(194, 61, 46)';
// Inherited purple from some legacy theme defaults — links must never resolve to this.
const INHERITED_PURPLE = 'rgb(136, 89, 182)';

let experimentsUrl: string;

test.beforeAll(async () => {
  experimentsUrl = await resolveExperimentsUrl();
});

test('the accent-toned pillar resolves to the signal-red token', async ({ page }) => {
  await page.goto(experimentsUrl);
  const accent = page.locator('.exp-pillar--accent').first();
  await expect(accent).toBeVisible();
  const bg = await accent.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe(SIGNAL_RED);
});

test('no constructivist component on the page has rounded corners', async ({ page }) => {
  await page.goto(experimentsUrl);
  // Sample a representative set of design-system surfaces & controls.
  const selectors = [
    'main.experiments',
    '.exp-hero',
    '.exp-pillar--light',
    '.exp-pillar--dark',
    '.exp-pillar--accent',
    '.exp-card',
    '.exp-cmd',
    '.exp-cta',
    '.exp-stat',
    '.exp-sketch',
  ];
  const radii = await page.evaluate((sels) => {
    return sels
      .map((s) => {
        const el = document.querySelector(s) as HTMLElement | null;
        if (!el) return { selector: s, found: false, radius: null as string | null };
        return {
          selector: s,
          found: true,
          radius: getComputedStyle(el).borderRadius,
        };
      })
      .filter((r) => r.found);
  }, selectors);
  // Every sampled element must exist (we know the page seeds them) and have a 0px corner.
  expect(radii.length).toBeGreaterThanOrEqual(8);
  for (const r of radii) {
    expect(r.radius, `${r.selector} should have sharp corners`).toBe('0px');
  }
});

test('no descendant element inside .experiments has a non-zero border-radius', async ({
  page,
}) => {
  await page.goto(experimentsUrl);
  const offenders = await page.evaluate(() => {
    const main = document.querySelector('main.experiments');
    if (!main) return ['main.experiments not found'];
    const bad: string[] = [];
    main.querySelectorAll<HTMLElement>('*').forEach((el) => {
      const r = getComputedStyle(el).borderRadius;
      // Normalize: "0px" or "0px 0px 0px 0px" — all zeros.
      const allZero = r
        .split(/\s+/)
        .every((p) => p === '0px' || p === '0' || p === '0%');
      if (!allZero) {
        const tag = el.tagName.toLowerCase();
        const cls = el.className && typeof el.className === 'string' ? `.${el.className.split(/\s+/).join('.')}` : '';
        bad.push(`${tag}${cls} → ${r}`);
      }
    });
    return bad;
  });
  expect(offenders, `Found rounded corners: ${offenders.join(', ')}`).toEqual([]);
});

test('no anchor inside .experiments resolves to the inherited purple link color', async ({
  page,
}) => {
  await page.goto(experimentsUrl);
  const purpleLinks = await page.evaluate((purple) => {
    const main = document.querySelector('main.experiments');
    if (!main) return ['main.experiments not found'];
    const bad: string[] = [];
    main.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
      const color = getComputedStyle(a).color;
      if (color === purple) {
        bad.push(`${a.textContent?.trim() ?? '(empty)'} → ${a.href}`);
      }
    });
    return bad;
  }, INHERITED_PURPLE);
  expect(purpleLinks, `Purple-coloured links: ${purpleLinks.join(', ')}`).toEqual([]);
});
