import { expect, test } from '@playwright/test';
import { resolveExperimentsUrl } from './_helpers';

let experimentsUrl: string;

test.beforeAll(async () => {
  experimentsUrl = await resolveExperimentsUrl();
});

test('reduced motion: no <iframe> is ever mounted inside .exp-sketch', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(experimentsUrl);

  const sketch = page.locator('main.experiments .exp-sketch').first();
  await expect(sketch).toBeVisible();

  // Scroll the sketch into view in case the JS uses IntersectionObserver
  // and somehow ignores the media query — give it every chance to misbehave.
  await sketch.scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  // Give the IO callbacks a generous window to fire.
  await page.waitForTimeout(1500);

  const iframeCount = await page.locator('main.experiments .exp-sketch iframe').count();
  expect(iframeCount, 'no iframe should be mounted under reduced motion').toBe(0);

  // Poster must still be visible.
  await expect(page.locator('main.experiments .exp-sketch__poster').first()).toBeVisible();
});

test('motion allowed: scrolling sketch into view mounts an iframe with the configured src', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(experimentsUrl);

  const slot = page.locator('main.experiments .exp-sketch__slot').first();
  await expect(slot).toBeVisible();

  // Confirm seed configured a sketch URL pointing at a static sketch HTML file.
  const sketchUrl = await slot.getAttribute('data-sketch-url');
  expect(sketchUrl).toMatch(/^\/experiments\/sketches\/.+\.html$/);

  // Scroll the sketch into view so the IntersectionObserver fires.
  await slot.scrollIntoViewIfNeeded();

  // Wait for the iframe to mount and load.
  const iframe = slot.locator('iframe');
  await expect(iframe).toHaveCount(1, { timeout: 10_000 });
  await expect(iframe).toHaveAttribute(
    'src',
    /\/experiments\/sketches\/v1\.html$/,
  );
});

test('iframe error (bad sketch URL) is cleaned up — no <iframe> remains mounted', async ({
  page,
}) => {
  // Transient test: load the page, then mutate one sketch's data-sketch-url
  // to a 404 path BEFORE the IntersectionObserver fires, scroll into view,
  // and assert that the iframe gets removed when it fails to load.
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Intercept the JS so we can swap data-sketch-url before the script runs.
  await page.addInitScript(() => {
    // Patch the IntersectionObserver to invoke its callback synchronously,
    // skipping the wait for scroll, AND swap the data URL on document load.
    const original = window.IntersectionObserver;
    (window as any).IntersectionObserver = class {
      private _cb: IntersectionObserverCallback;
      private _targets: Element[] = [];
      constructor(cb: IntersectionObserverCallback) {
        this._cb = cb;
      }
      observe(el: Element) {
        this._targets.push(el);
        // Rewrite the sketch URL to a 404 before the first callback fires.
        if (el instanceof HTMLElement && el.dataset.sketchUrl) {
          el.dataset.sketchUrl = '/experiments/sketches/does-not-exist.html';
        }
        // Fire the entering-viewport callback on the next tick.
        setTimeout(() => {
          this._cb(
            [
              {
                isIntersecting: true,
                target: el,
                intersectionRatio: 1,
                boundingClientRect: el.getBoundingClientRect(),
                intersectionRect: el.getBoundingClientRect(),
                rootBounds: null,
                time: performance.now(),
              } as IntersectionObserverEntry,
            ],
            this as any,
          );
        }, 0);
      }
      unobserve() {
        /* noop */
      }
      disconnect() {
        /* noop */
      }
      takeRecords() {
        return [];
      }
      // Mimic real IO shape just enough.
      root: null = null;
      rootMargin = '';
      thresholds: ReadonlyArray<number> = [];
    };
    (window as any).__originalIO = original;
  });

  await page.goto(experimentsUrl);

  const slot = page.locator('main.experiments .exp-sketch__slot').first();
  await expect(slot).toBeVisible();

  // The patched observer fires immediately, the iframe is attempted, then
  // its onerror handler runs once the bad src 404s. Allow a window for both.
  await page.waitForTimeout(2500);

  const iframeCount = await slot.locator('iframe').count();
  expect(iframeCount, 'failed-load iframe must be removed by the error fallback').toBe(0);

  // Poster stays visible after the failure.
  await expect(slot.locator('.exp-sketch__poster')).toBeVisible();
});
