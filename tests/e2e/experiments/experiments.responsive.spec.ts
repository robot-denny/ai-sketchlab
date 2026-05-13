import { expect, test } from '@playwright/test';
import { resolveExperimentsUrl } from './_helpers';

let experimentsUrl: string;

test.beforeAll(async () => {
  experimentsUrl = await resolveExperimentsUrl();
});

// Group cards by their visual row (rounded top coordinate, 2px tolerance).
async function rowCount(page: import('@playwright/test').Page): Promise<number> {
  return await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('main.experiments .exp-card'),
    );
    if (cards.length === 0) return 0;
    const tops = cards.map((c) => Math.round(c.getBoundingClientRect().top / 2) * 2);
    return new Set(tops).size;
  });
}

async function cardCount(page: import('@playwright/test').Page): Promise<number> {
  return page.locator('main.experiments .exp-card').count();
}

test('1440 viewport: feature-card row renders at 3 columns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(experimentsUrl);
  await expect(page.locator('main.experiments .exp-card').first()).toBeVisible();

  const cards = await cardCount(page);
  expect(cards, 'seed should expose exactly 3 feature cards').toBe(3);

  // 3 cards on 1 row → 1 distinct top coordinate.
  expect(await rowCount(page)).toBe(1);
});

test('768 viewport: feature-card row renders at 2 columns', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(experimentsUrl);
  await expect(page.locator('main.experiments .exp-card').first()).toBeVisible();

  // 3 cards laid out as 2-up + 1 → 2 distinct top coordinates.
  expect(await rowCount(page)).toBe(2);
});

test('390 viewport: all multi-column rows collapse to 1 column', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(experimentsUrl);
  await expect(page.locator('main.experiments .exp-card').first()).toBeVisible();

  // 3 cards stacked → 3 distinct top coordinates.
  expect(await rowCount(page)).toBe(3);

  // Command badges (6 of them) must also stack to 1 column.
  const cmdRows = await page.evaluate(() => {
    const cmds = Array.from(
      document.querySelectorAll<HTMLElement>('main.experiments .exp-cmd'),
    );
    const tops = cmds.map((c) => Math.round(c.getBoundingClientRect().top / 2) * 2);
    return new Set(tops).size;
  });
  const cmdTotal = await page.locator('main.experiments .exp-cmd').count();
  expect(cmdRows, 'every command badge should sit on its own row').toBe(cmdTotal);
});

test('390 viewport: pull quote has no negative left margin and a visible left-border accent', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(experimentsUrl);

  const pullQuote = page.locator('main.experiments .exp-pullquote').first();
  await expect(pullQuote).toBeVisible();

  const { marginLeft, borderLeftWidth, borderLeftStyle } = await pullQuote.evaluate(
    (el) => {
      const cs = getComputedStyle(el);
      return {
        marginLeft: cs.marginLeft,
        borderLeftWidth: cs.borderLeftWidth,
        borderLeftStyle: cs.borderLeftStyle,
      };
    },
  );

  // No negative margin — parse "Npx" and assert ≥ 0.
  const marginPx = parseFloat(marginLeft);
  expect(marginPx, `pull quote should not pull left at 390 (got ${marginLeft})`).toBeGreaterThanOrEqual(0);

  // Visible left-border accent.
  expect(parseFloat(borderLeftWidth)).toBeGreaterThan(0);
  expect(borderLeftStyle).not.toBe('none');
});

test('390 viewport: page has no horizontal scrollbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(experimentsUrl);
  // Wait for fonts/images to settle so layout has stabilised.
  await page.waitForLoadState('networkidle');

  const { bodyWidth, innerWidth, docWidth } = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    docWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(
    bodyWidth,
    `body.scrollWidth (${bodyWidth}) should not exceed window.innerWidth (${innerWidth})`,
  ).toBeLessThanOrEqual(innerWidth);
  expect(
    docWidth,
    `documentElement.scrollWidth (${docWidth}) should not exceed window.innerWidth (${innerWidth})`,
  ).toBeLessThanOrEqual(innerWidth);
});
