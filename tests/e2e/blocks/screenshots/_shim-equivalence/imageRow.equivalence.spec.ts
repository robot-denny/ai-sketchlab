import { test, expect } from '@playwright/test';
import { shotOf } from './_shimHelpers';

// imageRow renders in both contexts:
//   - blocklist: /styleguide/components/ (.image)
//   - blockgrid: /experiments/ ([data-content-element-type-alias="imageRow"])
//
// The blockgrid shim wraps the blocklist partial via Html.PartialAsync, so
// the inner .image markup should be byte-identical. The blockgrid layout-item
// wrapper sits OUTSIDE the .image element, so capturing only the .image element
// inside each context strips the wrapper from comparison.
//
// NOTE: The actual image src may differ between contexts (different media
// assigned by content authors). If this fails purely because the rendered
// image is different content, the test is still valuable: it caught a
// content-authoring divergence that screenshots-as-equivalence would have
// missed. Adjust by ensuring both contexts reference the same media item.

test.describe('Shim equivalence: imageRow (blocklist == blockgrid)', () => {
  test('blocklist and blockgrid render byte-identically', async ({ page }) => {
    const blocklistShot = await shotOf(
      page,
      '/styleguide/components/',
      '.image',
    );
    const blockgridShot = await shotOf(
      page,
      '/experiments/',
      '[data-content-element-type-alias="imageRow"] .image',
    );

    expect(blocklistShot.equals(blockgridShot)).toBe(true);
  });
});
