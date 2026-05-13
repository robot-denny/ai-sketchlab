import { expect, test } from '@playwright/test';
import { resolveExperimentsUrl } from './_helpers';

let experimentsUrl: string;

test.beforeAll(async () => {
  experimentsUrl = await resolveExperimentsUrl();
  expect(experimentsUrl, 'seeded page should expose a URL').toMatch(/^\/[a-z0-9-/]+$/);
});

test('renders without errors and the main wrapper is present', async ({ page }) => {
  const resp = await page.goto(experimentsUrl);
  expect(resp?.status()).toBe(200);
  await expect(page.locator('main.experiments')).toBeVisible();
});

test('hero headline is visible', async ({ page }) => {
  await page.goto(experimentsUrl);
  const h1 = page.locator('main.experiments h1.exp-hero__headline');
  await expect(h1).toBeVisible();
  await expect(h1).toContainText(/What this Umbraco site has unlocked/i);
});

test('all seven pillar headlines appear in the spec order', async ({ page }) => {
  await page.goto(experimentsUrl);
  const expected = [
    'A repeatable way to ship features',
    'Custom commands that compress hours into one step',
    'AI sits inside the editing experience',
    'Human and AI, co-writing transparently',
    'The AI assistant can act on the CMS',
    'Featured images that match the article',
    'Generative art for decorative visuals',
  ];
  const headlines = await page
    .locator('main.experiments .exp-pillar__headline')
    .allTextContents();
  // First seven pillar headlines must be the spec'd seven, in order.
  // (The closing band uses pillar styling but carries a different headline.)
  const trimmed = headlines.map((t) => t.trim()).slice(0, 7);
  expect(trimmed).toEqual(expected);
});

test('closing CTA "See the full capability tracker" links to /capabilities', async ({
  page,
}) => {
  await page.goto(experimentsUrl);
  const cta = page.getByRole('link', { name: /See the full capability tracker/i });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', /\/capabilities\/?$/);
});

test('the top nav contains an Experiments link pointing at the page URL', async ({
  page,
}) => {
  // Use Home as the source-of-truth page for "any page on the site".
  await page.goto('/');
  const navLink = page.locator('header.site-head nav.site-nav a', { hasText: /^Experiments$/ });
  await expect(navLink).toBeVisible();
  // Tolerate URL slug variations like "/experiments-2" if the page got recreated;
  // assert against the resolved URL we captured in beforeAll.
  await expect(navLink).toHaveAttribute('href', new RegExp(`^${experimentsUrl}/?$`));
});
