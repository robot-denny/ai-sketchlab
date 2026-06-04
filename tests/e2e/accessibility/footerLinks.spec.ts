/**
 * Footer link accessibility — focus indicator + WCAG 2.5.8 target spacing
 * (FR4 non-colour affordance / FR6 target size & spacing).
 *
 * Asserts two objectively-measurable contracts on the v2 footer
 * (<footer class="foot">, rendered only by Views/Partials/v2/_Footer.cshtml):
 *
 *   (a) a footer link shows a VISIBLE focus indicator on keyboard focus
 *       (the computed focus-visible style differs from the unfocused style),
 *   (b) adjacent footer links meet the WCAG 2.5.8 (AAA) "spacing" target
 *       requirement — each link's interactive box is >= 24px, OR the gap
 *       between adjacent links' boxes is >= 24px — at BOTH a desktop (1200px,
 *       three-column) and a mobile (375px, single-column) viewport.
 *
 * RED before Step 4: footer links today are `display:block` with no extra
 * padding, so two stacked 13px/1.6 links sit ~20.8px tall with a 0px gap —
 * below 24px. There is also no persistent underline (FR4). GREEN after the
 * site-chrome.css footer rule gains a persistent `text-decoration: underline`
 * and >= 24px interactive height (padding-block) at both breakpoints.
 *
 * The spacing test console.logs the measured per-link box height and the
 * adjacent-link gap at each viewport so the reviewer can watch the number
 * cross 24px (the RED -> GREEN signal), not just a pass/fail.
 *
 * Resilience (CLAUDE.md "E2E Test Resilience Rules"): the footer-hosting page
 * (Home) is looked up dynamically via the Management API (rules #1/#2 — no
 * hardcoded UUIDs or slugs); token/lookup helpers come from
 * tests/e2e/_umbracoApi.ts (apiFetch auto-refreshes — rule #4). Spacing is
 * compared as numeric box geometry with a sub-pixel tolerance rather than by
 * matching exact CSS strings (rule #5); focus is asserted on rendered computed
 * style rather than on .cshtml file content (rule #6).
 */

import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';

import { findHomeDocId, getDocumentPath } from '../_umbracoApi';

// WCAG 2.5.8 (AAA) target-size "spacing" exception: a target smaller than
// 24x24 CSS px is OK if a 24px-diameter circle centred on it does not
// intersect any adjacent target — i.e. effectively a >= 24px effective box
// per link or a >= 24px centre-to-centre stride. We assert the simplest
// robust proxy: each link's interactive box height >= 24px (stacked links).
const MIN_TARGET = 24;
const TOL = 0.6; // sub-pixel rounding tolerance (rule #5)

let homeUrl: string;

test.beforeAll(async () => {
  const homeId = await findHomeDocId();
  homeUrl = await getDocumentPath(homeId);
});

/** All footer links inside the v2 contentinfo footer. */
function footerLinks(page: Page): Locator {
  // The brand wordmark (.fm a) and the nav/social link lists are all <a> under
  // footer.foot; we measure the stacked nav/social list links specifically,
  // since those are the ones the FR6 spacing requirement targets.
  return page.locator('footer.foot .col li a');
}

test.describe('Accessibility — footer link focus + target spacing (FR4/FR6)', () => {
  test('a footer link is underlined and shows a visible focus ring on keyboard focus (FR4/2.4.7)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeUrl);

    const links = footerLinks(page);
    const count = await links.count();
    expect(count, 'expected at least one footer list link').toBeGreaterThan(0);

    const link = links.first();
    await expect(link).toBeVisible();

    // FR4: persistent underline (a non-colour affordance), independent of focus.
    const decoration = await link.evaluate((el) => getComputedStyle(el).textDecorationLine);
    expect(decoration, 'footer links should be underlined').toContain('underline');

    const read = () =>
      link.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          outlineStyle: cs.outlineStyle,
          outlineWidth: cs.outlineWidth,
          outlineColor: cs.outlineColor,
          boxShadow: cs.boxShadow,
        };
      });

    // Baseline guard: the link must have NO resting ring, so the focused
    // comparison below can't pass vacuously on a UA-default outline.
    const resting = await read();
    expect(resting.outlineStyle, 'footer link should have no resting outline').toBe('none');

    // Engage the focus ring via a REAL keyboard event: programmatic focus()
    // alone doesn't reliably set Chromium's keyboard-modality flag that gates
    // :focus-visible. Position on the link, then Shift+Tab→Tab so the link is
    // re-entered by keyboard (O(1); avoids Tabbing through the whole page).
    await link.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const reached = await link.evaluate((el) => el === document.activeElement);
    expect(reached, 'keyboard Tab should land on the footer link').toBe(true);

    const focused = await read();
    const hasVisibleRing =
      (focused.outlineStyle !== 'none' && parseFloat(focused.outlineWidth) > 0) ||
      (focused.boxShadow !== 'none' && focused.boxShadow !== resting.boxShadow);

    expect(
      hasVisibleRing,
      `footer link should show a visible :focus-visible ring (got ${JSON.stringify(focused)})`
    ).toBe(true);
  });

  test('footer link groups are labelled navigation landmarks (FR6)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeUrl);

    // Each populated footer link group is a <nav aria-labelledby> pointing at its
    // <h4> heading; the brand column has no <nav>. Assert each nav landmark
    // resolves to a non-empty accessible name so a broken id/aria-labelledby
    // pairing (the core FR6 change) can't regress unnoticed.
    const navs = page.locator('footer.foot nav');
    const navCount = await navs.count();
    expect(navCount, 'footer should expose at least one navigation landmark').toBeGreaterThan(0);

    for (let i = 0; i < navCount; i++) {
      const name = await navs.nth(i).evaluate((el) => {
        const id = el.getAttribute('aria-labelledby');
        return id ? document.getElementById(id)?.textContent?.trim() ?? '' : '';
      });
      expect(
        name.length,
        `footer nav #${i + 1} should have a non-empty accessible name via aria-labelledby`
      ).toBeGreaterThan(0);
    }
  });

  for (const vp of [
    { name: 'desktop', width: 1200, height: 800 },
    { name: 'mobile', width: 375, height: 800 },
  ]) {
    test(`adjacent footer links meet the 24px target-spacing requirement (${vp.name} ${vp.width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(homeUrl);

      const links = footerLinks(page);
      const count = await links.count();
      expect(count, 'expected at least one footer list link').toBeGreaterThan(0);

      const boxes: { x: number; y: number; w: number; h: number }[] = [];
      for (let i = 0; i < count; i++) {
        const b = await links.nth(i).boundingBox();
        expect(b, `footer link #${i + 1} should have a bounding box`).toBeTruthy();
        boxes.push({ x: b!.x, y: b!.y, w: b!.width, h: b!.height });
      }

      const minHeight = Math.min(...boxes.map((b) => b.h));
      // eslint-disable-next-line no-console
      console.log(
        `[footer spacing][${vp.name} ${vp.width}px] link box heights = [${boxes
          .map((b) => b.h.toFixed(1))
          .join(', ')}]  min=${minHeight.toFixed(1)}px (target >= ${MIN_TARGET}px)`
      );

      // Group links that stack in the same column (same x, within rounding),
      // sort by y, and check each adjacent vertical pair. The primary guarantee
      // is the per-link box-height assertion below; this stride check reinforces
      // it. NOTE: centre-to-centre stride is an exact proxy for WCAG 2.5.8's
      // edge-gap geometry only when adjacent boxes share the same height — true
      // here because every `.foot .col li a` gets identical CSS. Don't reuse this
      // proxy on a mixed-height list without revisiting the maths.
      const columns = new Map<number, typeof boxes>();
      for (const b of boxes) {
        const key = Math.round(b.x / 8) * 8; // bucket by x to group columns
        if (!columns.has(key)) columns.set(key, []);
        columns.get(key)!.push(b);
      }

      const gaps: number[] = [];
      for (const col of columns.values()) {
        col.sort((a, b) => a.y - b.y);
        for (let i = 1; i < col.length; i++) {
          const prev = col[i - 1];
          const cur = col[i];
          const stride = cur.y + cur.h / 2 - (prev.y + prev.h / 2);
          gaps.push(stride);
        }
      }

      if (gaps.length) {
        // eslint-disable-next-line no-console
        console.log(
          `[footer spacing][${vp.name} ${vp.width}px] adjacent centre-to-centre strides = [${gaps
            .map((g) => g.toFixed(1))
            .join(', ')}]px (target >= ${MIN_TARGET}px)`
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `[footer spacing][${vp.name} ${vp.width}px] no two links share a column to measure a stride`
        );
      }

      // Primary assertion: each link's interactive box is >= 24px tall.
      expect(
        minHeight,
        `every footer link's interactive box should be >= ${MIN_TARGET}px tall (min was ${minHeight.toFixed(
          1
        )}px)`
      ).toBeGreaterThanOrEqual(MIN_TARGET - TOL);

      // Reinforcing assertion: every adjacent vertical pair clears the 24px stride.
      for (const stride of gaps) {
        expect(
          stride,
          `adjacent footer links should be >= ${MIN_TARGET}px centre-to-centre (got ${stride.toFixed(
            1
          )}px)`
        ).toBeGreaterThanOrEqual(MIN_TARGET - TOL);
      }
    });
  }
});
