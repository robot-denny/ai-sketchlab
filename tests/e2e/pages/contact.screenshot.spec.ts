import { test } from '@umbraco/playwright-testhelpers';
import { expect, findNavLinkForTemplate, prepareForScreenshot, screenshotOptions } from '../_helpers';

// Page-template screenshot (Step 6, _plans/arch-safety-net.md).
//
// Canonical surface: the Contact document type (contact.cshtml). The page
// renders the page-head pattern, an instruction message, and the
// Umbraco.Forms-driven contact form.
//
// URL is discovered by walking header/nav/footer anchors for a link whose
// destination contains `main form[method="post"]` -- contact.cshtml's
// fingerprint. This honours the resilience rule against hardcoded slugs.
//
// Dynamic regions to mask:
//   - The form's anti-CSRF and request-verification fields are `<input
//     type="hidden">`, so they're not visible and don't need masking.
//   - The form's `id="form<guid>"` is regenerated per request but it lives
//     on the `<form>` element attribute, not the rendered text. No mask.
//   - Defensive `time, .post-meta, .article-meta` mask in case future
//     additions add a timestamp anywhere in the contact-page chrome.

test.describe('Screenshot: contact page template', () => {
  test('renders contact page matching baseline', async ({ page }) => {
    const contactUrl = await findNavLinkForTemplate(page, 'main form[method="post"]');
    await page.goto(contactUrl);
    await prepareForScreenshot(page);

    // Sanity check: confirm we landed on the contact page (the form should
    // render unless we hit the submitted state, which we shouldn't on a GET).
    await expect(page.locator('form[method="post"]'), 'contact form should be present').toBeVisible({
      timeout: 10_000,
    });

    await expect(page).toHaveScreenshot(
      'contact.png',
      screenshotOptions({
        fullPage: true,
        mask: [
          page.locator('time, .post-meta, .article-meta'),
        ],
      }),
    );
  });
});
