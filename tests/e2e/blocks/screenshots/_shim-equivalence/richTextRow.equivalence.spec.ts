import { test, expect } from '@playwright/test';
import { shotOf } from './_shimHelpers';

// richTextRow is the most heavily exercised shim. It renders in both contexts:
//   - blocklist: /styleguide/components/ (.richtext, multiple instances)
//   - blockgrid: /experiments/ ([data-content-element-type-alias="richTextRow"])
//
// The blockgrid shim delegates to the blocklist partial via Html.PartialAsync,
// so the inner .richtext element should be byte-identical when the same
// content data is passed through.
//
// As with imageRow.equivalence: this fails if the two surfaces hold different
// Tiptap content. The test is still useful in that case -- it catches the
// authoring drift; the fix is to align the showcase content or scope the
// equivalence selector tighter.

test.describe('Shim equivalence: richTextRow (blocklist == blockgrid)', () => {
  test('blocklist and blockgrid render byte-identically', async ({ page }) => {
    const blocklistShot = await shotOf(
      page,
      '/styleguide/components/',
      '.richtext',
    );
    const blockgridShot = await shotOf(
      page,
      '/experiments/',
      '[data-content-element-type-alias="richTextRow"] .richtext',
    );

    expect(blocklistShot.equals(blockgridShot)).toBe(true);
  });
});
