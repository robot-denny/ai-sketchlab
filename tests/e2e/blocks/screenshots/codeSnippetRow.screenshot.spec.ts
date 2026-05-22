import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from './_helpers';

// Canonical surface: /styleguide/components/ contains the JavaScript example
// `console.log("hello, style guide")` rendered via the Code Snippet Row block.
// Selector targets the first `<pre>` that wraps a `<code>` -- tighter than a
// bare `pre`, which would silently shift if a future page edit adds another
// pre-formatted element (keyboard shortcuts, etc.) above the snippet.

test.describe('Screenshot: Block List codeSnippetRow', () => {
  test('renders codeSnippetRow matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/styleguide/components/',
      'pre:has(code)',
    );
    await expect(block).toHaveScreenshot('codeSnippetRow.png', screenshotOptions());
  });
});
