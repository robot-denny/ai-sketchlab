import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// URL-stability for the consolidated guides (Step 4 → Step 5).
//
// GuideRedirectMiddleware (src/UmbracoProject.Features/Infrastructure/) 301s the
// legacy Styleguide/Component-Guide URLs to their new /guides/ homes. These
// assertions are GREEN now — the middleware shipped in Step 4 and is independent
// of the Step 6 content authoring.
//
//   /styleguide            → /guides/styleguide
//   /styleguide/components → /guides/component-guide
//
// Match is exact, case-insensitive, trailing-slash tolerant, query preserved.
// ---------------------------------------------------------------------------

test.describe('Legacy guide URLs 301 to /guides/', () => {
  test('/styleguide → 301 /guides/styleguide', async ({ request }) => {
    const resp = await request.get('/styleguide', { maxRedirects: 0 });
    expect(resp.status()).toBe(301);
    expect(resp.headers()['location']).toBe('/guides/styleguide');
  });

  test('/styleguide/ (trailing slash) → 301 /guides/styleguide', async ({ request }) => {
    const resp = await request.get('/styleguide/', { maxRedirects: 0 });
    expect(resp.status()).toBe(301);
    expect(resp.headers()['location']).toBe('/guides/styleguide');
  });

  test('/styleguide/components → 301 /guides/component-guide', async ({ request }) => {
    const resp = await request.get('/styleguide/components', { maxRedirects: 0 });
    expect(resp.status()).toBe(301);
    expect(resp.headers()['location']).toBe('/guides/component-guide');
  });

  test('/styleguide/components/ (trailing slash) → 301 /guides/component-guide', async ({
    request,
  }) => {
    const resp = await request.get('/styleguide/components/', { maxRedirects: 0 });
    expect(resp.status()).toBe(301);
    expect(resp.headers()['location']).toBe('/guides/component-guide');
  });

  test('Redirect is case-insensitive', async ({ request }) => {
    const resp = await request.get('/StyleGuide', { maxRedirects: 0 });
    expect(resp.status()).toBe(301);
    expect(resp.headers()['location']).toBe('/guides/styleguide');
  });

  test('Query string is preserved through the redirect', async ({ request }) => {
    const resp = await request.get('/styleguide?foo=bar&baz=1', { maxRedirects: 0 });
    expect(resp.status()).toBe(301);
    expect(resp.headers()['location']).toBe('/guides/styleguide?foo=bar&baz=1');
  });

  test('Longest-match wins: /styleguide/components does not redirect to /guides/styleguide', async ({
    request,
  }) => {
    const resp = await request.get('/styleguide/components', { maxRedirects: 0 });
    expect(resp.status()).toBe(301);
    // The distinguishing assertion: the shorter /styleguide rule must NOT capture the
    // longer /styleguide/components path (that's the whole point of longest-first ordering).
    expect(resp.headers()['location']).not.toBe('/guides/styleguide');
    expect(resp.headers()['location']).toBe('/guides/component-guide');
  });
});
