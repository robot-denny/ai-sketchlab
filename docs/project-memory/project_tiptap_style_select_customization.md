---
name: TipTap Style Select customization in Umbraco 17
description: Don't rely on TinyMCE's umb_name CSS annotations — TipTap discovers Style Select entries via a backoffice extension manifest. Override the built-in with `overwrites` so the data type config stays unchanged.
type: project
originSessionId: 1331b6e9-5156-4442-a207-0f16c39847ba
---
The TipTap rich-text editor in Umbraco 17 ignores the `/**umb_name:Label*/` CSS comment convention that TinyMCE used to populate the Style Select dropdown. Custom entries must be declared as a `tiptapToolbarExtension` manifest of `kind: 'styleMenu'`, registered through a backoffice extension bundle (e.g. `src/HelloWorld/Client/src/richtext/manifest.ts`).

**Why:** Discovered 2026-05-11 after adding `.lead`, `.overline`, `.pull-quote`, `.caption` styling to [dropdownStyles.css](/Users/dkardys/Sites/umbraco-17-demo-site/src/UmbracoProject/wwwroot/css/dropdownStyles.css) with `/**umb_name:...*/` annotations and finding they never appeared in the dropdown. Confirmed via Umbraco's TipTap source (`packages/tiptap/extensions/style-menu/`) and the docs: "Any custom stylesheets associated with the Rich Text Editor will not auto-generate a style select menu." The stylesheets array on the data type only feeds the editor iframe's preview styling.

**How to apply:**

1. Add entries by editing the manifest at `src/HelloWorld/Client/src/richtext/manifest.ts` — each item is `{ label, data: { tag?, class? }, appearance?: { icon, style } }`. Items can be nested into category groups (`Headers` / `Editorial` / `Containers` / etc.). Class-toggling entries (e.g. Lead → `<p class="lead">`) require `Umb.Tiptap.HtmlAttributeClass` in the data type's enabled extensions.
2. Use `overwrites: 'Umb.Tiptap.Toolbar.StyleSelect'` on the manifest. That replaces the built-in styleMenu in-place, so the data type's toolbar config keeps `Umb.Tiptap.Toolbar.StyleSelect` and no `.uda` edit is needed. TypeScript doesn't expose `overwrites` on the TipTap manifest type — cast to `UmbExtensionManifest & { overwrites?: string }`; the registry honors it at runtime.
3. Rebuild the HelloWorld bundle (`npm run build` under `src/HelloWorld/Client/`) — the project commits built assets to `wwwroot/App_Plugins/HelloWorld/`.
4. **Hard refresh the backoffice browser tab** (Cmd+Shift+R). Without it, the cached `hello-world.js` keeps the old manifest set and new entries don't appear.
5. To preview the styling inside the editor iframe, keep [dropdownStyles.css](/Users/dkardys/Sites/umbraco-17-demo-site/src/UmbracoProject/wwwroot/css/dropdownStyles.css) in sync with the production `wwwroot/assets/css/typography.css`. The data type's `stylesheets: ["/dropdownStyles.css"]` value is correct — TipTap prepends its `/css` root automatically (`DEFAULT_STYLESHEET_ROOT_PATH = '/css'` in `packages/tiptap/components/input-tiptap/input-tiptap.element.js`), so the iframe fetches `/css/dropdownStyles.css` (200). A URL like `/css/dropdownStyles.css` also works because TipTap detects the existing `/css` prefix and skips re-prepending.

**Editor-managed vs front-end CSS folders** — `wwwroot/css/` is the Umbraco Stylesheet manager root (visible under Settings → Templating → Stylesheets); `wwwroot/assets/css/` holds front-end-only stylesheets linked from Razor views. They're intentionally split so the backoffice stylesheet dashboard isn't cluttered with front-end files. `dropdownStyles.css` lives in `/css/` because it's an editor-only stylesheet authored through the backoffice. The front end never loads it.
