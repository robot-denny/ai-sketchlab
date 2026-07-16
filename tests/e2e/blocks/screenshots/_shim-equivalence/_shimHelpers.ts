/**
 * Render-equivalence helpers.
 *
 * Originally added for the four blockgrid->blocklist shims (Step 5 of
 * `_plans/arch-safety-net.md`). Those shims were removed by
 * `_plans/block-editor-parity-and-reuse-readiness.md`: the four blocks
 * (alertBanner, iconLinkRow, imageRow, richTextRow) now render from ONE shared
 * view under `Views/Partials/blocks/Components/{alias}.cshtml`, dispatched by
 * both `blocklist/default.cshtml` and `blockgrid/items.cshtml`. The equivalence
 * assertion is therefore even stronger now: the identical shared partial is
 * rendered in both editors, so the output should be pixel-identical across the
 * blocklist (/styleguide/components/) and blockgrid (/experiments/) contexts --
 * if it isn't, either a dispatcher wrapper has diverged or the two surfaces hold
 * different authored content.
 *
 * Strategy: capture both screenshots into Buffers and compare byte-for-byte
 * with `.equals()`. This avoids Playwright's shared-baseline file-path semantics
 * (easy to misuse, dependent on snapshot directory resolution) and stays
 * platform-independent -- it compares two live renders against each other, not
 * against a committed Linux baseline.
 *
 * Tolerance: zero. Any difference indicates a real divergence between the two
 * editors' render of the same shared view.
 */

import { Page, Locator, expect } from '@playwright/test';
import { prepareForScreenshot } from '../../../_helpers';

export async function shotOf(
  page: Page,
  path: string,
  selector: string,
): Promise<Buffer> {
  const resp = await page.goto(path);
  expect(resp?.ok(), `navigation to ${path} should succeed`).toBeTruthy();
  await prepareForScreenshot(page);
  const block: Locator = page.locator(selector).first();
  await expect(
    block,
    `selector "${selector}" should exist on ${path}`,
  ).toBeVisible({ timeout: 10_000 });
  await block.scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle').catch(() => {});
  return await block.screenshot({ animations: 'disabled', caret: 'hide' });
}
