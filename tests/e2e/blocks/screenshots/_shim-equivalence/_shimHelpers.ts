/**
 * Shim-equivalence helpers (Step 5 of `_plans/arch-safety-net.md`).
 *
 * The four blockgrid shims (alertBanner, iconLinkRow, imageRow, richTextRow)
 * delegate to the blocklist partial via `Html.PartialAsync`. This means the
 * rendered output should be pixel-identical across blocklist and blockgrid
 * contexts -- if it isn't, the shim is doing something wrong (or the wrapper
 * markup has diverged).
 *
 * Strategy: capture both screenshots into Buffers and compare byte-for-byte
 * with `toEqual`. The plan offers two implementation choices; this is the
 * "compare-buffers" alternative because it avoids Playwright's shared-baseline
 * file-path semantics (which are easy to misuse and rely on snapshot directory
 * resolution).
 *
 * Tolerance: zero. Any difference indicates a real divergence between the
 * shim and the canonical blocklist render.
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
