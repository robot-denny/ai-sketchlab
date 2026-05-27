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
  // Editorial copy changes over time — assert the hero headline renders and is
  // non-empty rather than pinning exact wording (E2E Rule #6).
  expect((await h1.textContent())?.trim().length ?? 0).toBeGreaterThan(0);
});

test('renders at least seven pillar headlines', async ({ page }) => {
  await page.goto(experimentsUrl);
  // The experiments page is a curated multi-pillar narrative. Assert the structure
  // (seven or more non-empty pillar headlines) rather than pinning exact editorial
  // copy, which is authored content that changes over time (E2E Rule #6).
  const headlines = (
    await page.locator('main.experiments .exp-pillar__headline').allTextContents()
  )
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  expect(
    headlines.length,
    'at least seven pillar headlines should render'
  ).toBeGreaterThanOrEqual(7);
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
