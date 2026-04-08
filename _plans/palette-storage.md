# Plan: Image Generator Palette Storage

**Spec**: `_specs/image-generator/palette-storage.md`
**Branch**: `claude/feature/metadata-image-generator` (existing)

## Context

The image generator currently stores category-to-color palette configuration in `scripts/image-generator/config/palettes.json`, a flat JSON file on disk. This causes problems: palette changes don't transfer between Umbraco Cloud environments, git deployments can overwrite editor customizations, and there's no content workflow (save/publish/audit trail). This plan moves palette configuration into Umbraco CMS content — a dedicated "Image Generator Settings" document type with a Block List of category palette entries — so palettes travel with Umbraco Deploy's standard content transfer and editors manage them through the familiar content editor.

The existing generator pipeline (CLI in `scripts/image-generator/`, backoffice dashboard in `src/HelloWorld/Client/src/imageGenerator/`, C# controller in `src/HelloWorld/ImageGeneratorController.cs`) is fully functional. This plan replaces the palette storage layer without changing the generation algorithm.

---

## Key Decisions

- **Settings document location**: New "Site Settings" node under Home (using a new "Site Settings" doc type as a container). Future site-wide settings can live alongside the palette config. Home's allowed children will include the new Site Settings type.
- **Site Settings doc type**: General-purpose settings container — no template, no properties, acts as a folder for any site-wide settings pages. Initially allows Image Generator Settings as a child; additional settings doc types (e.g., SEO Defaults, Analytics Config) can be added to its allowed children list later without modifying the container itself.
- **Eye Dropper color picker**: Create a new `[EyeDropper] Palette Color` data type (`Umb.PropertyEditorUi.EyeDropper` / `Umbraco.Plain.String`). Returns hex strings like `"#008cc8"`. No pre-existing Eye Dropper data type exists in this instance.
- **Category picker in palette block**: Create `[ContentPicker] Single Category` data type — same dynamic root config as `[MNTP] Categories` (`9a426393-b2c8-4403-a85f-00b7a51ebe69`) but with `maxNumber: 1`. Uses `Umb.PropertyEditorUi.ContentPicker` / `Umbraco.MultiNodeTreePicker` with start node scoped to Categories list under Home.
- **Three-color model**: Each palette block has `palettePrimary`, `paletteMid`, `paletteDeep` — three Eye Dropper properties. Matches the current 3-color-per-category model in `palettes.json`.
- **Duplicate prevention**: Only one "Image Generator Settings" document should exist. Since Umbraco doesn't natively enforce max-children-per-type, duplication is prevented at runtime: the C# service reads the first published instance it finds. The Site Settings container itself is not restricted — it can hold multiple different settings child types, just not multiple instances of the same one.
- **Palette data flow**: C# controller reads the settings document via `IPublishedContentCache` (no HTTP overhead), serializes to `PaletteConfig` JSON, passes to CLI via `--palette-json` argument. CLI standalone mode reads from the Umbraco Management API directly.
- **Hex-to-RGB conversion**: Done at read time in both the C# service and TypeScript reader. Generator continues to receive `RGBColor[]` arrays.
- **Fallback chain**: CLI priority: `--palette-json` arg > API fetch > `palettes.json` file > hardcoded defaults. Generation never fails due to missing config.
- **palettes.json retention**: Kept as a static fallback/reference after migration. Not deleted.

### IDs Discovered from Live Instance

| Entity | ID | Notes |
|--------|----|-------|
| Home doc type | `a95360e8-ff04-40b1-8f46-7aa4b5983096` | Needs allowed children updated |
| Home document | `dcf18a51-6919-4cf8-89d1-36b94ce4d963` | Parent for Site Settings node |
| Category doc type | `e33a8f18-ae71-4a7d-bc2c-76ceb9fd9e97` | No properties, just named nodes |
| Category List doc type | `539869ea-4f0d-4c3b-80b1-aaa80a1c16e6` | Used in MNTP dynamic root |
| Categories document | `5756eed9-c96d-42ee-96e9-bccc5d1dd655` | Start node for category picker |
| Content Picker data type | `fd1e0da5-5606-4862-b679-5d0cf3a52a59` | `Umbraco.ContentPicker` / `Umb.PropertyEditorUi.DocumentPicker` |
| [MNTP] Categories data type | `9a426393-b2c8-4403-a85f-00b7a51ebe69` | Template for single category picker config |
| Elements folder (doc types) | `5dde5b35-b5f9-4d61-aaf1-158368a1b0fb` | Parent for new element type |
| Content Models subfolder | `1645b9b1-459b-40e7-90a5-ea194afda61d` | Where block element types live |
| Pages folder (doc types) | `a2c71960-9678-4b56-9828-c1d8f8f7df40` | Where page doc types live |

### Seed Data (from `scripts/image-generator/config/palettes.json`)

| Category | UUID | Primary | Mid | Deep |
|----------|------|---------|-----|------|
| AI & Machine Learning | `873247f4-2b3d-4e6a-acc8-dbe80407da94` | `#008cc8` | `#14b4dc` | `#0064b4` |
| Ethics | `e2e52e38-c98d-4f59-9dbb-f608d06ce90b` | `#dc643c` | `#f08c50` | `#c85028` |
| Sustainability | `b9c7db5b-0902-4939-aa73-757138b586c4` | `#28b464` | `#3cc878` | `#148c50` |
| Agentic Coding | `f12d1275-e839-48af-8f8b-4c06594b214f` | `#a050b4` | `#c878c8` | `#78288c` |
| **Default** | — | `#b5aea6` | `#d9c5b4` | `#9c7373` |

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Schema Setup via Management API Script

> **Prompt**: Implement Step 1 of `_plans/palette-storage.md`. Create a Node.js Management API script at `scripts/setup-palette-storage.mjs` that creates the Umbraco schema for CMS-based palette storage and seeds the initial content. The script must authenticate via `.env` credentials, then:
>
> 1. Create an `[EyeDropper] Palette Color` data type (`Umb.PropertyEditorUi.EyeDropper` / `Umbraco.Plain.String`)
> 2. Create a `[ContentPicker] Single Category` data type — `Umbraco.MultiNodeTreePicker` / `Umb.PropertyEditorUi.ContentPicker` with `maxNumber: 1` and a dynamic root start node scoped to the Categories list (Home `dcf18a51-6919-4cf8-89d1-36b94ce4d963` → NearestDescendantOrSelf of `CategoryList` `539869ea-4f0d-4c3b-80b1-aaa80a1c16e6`)
> 3. Create a `[BlockList] Category Palettes` data type
> 4. Create a "Category Palette Entry" element type (in Elements/Content Models folder `1645b9b1-459b-40e7-90a5-ea194afda61d`) with properties: `paletteCategory` (Single Category picker), `palettePrimary`, `paletteMid`, `paletteDeep` (all Eye Dropper Color)
> 5. Configure the Block List data type to allow the Category Palette Entry element type as a block
> 6. Create a "Site Settings" document type (in Pages folder `a2c71960-9678-4b56-9828-c1d8f8f7df40`, no template, icon `icon-settings`, not allowed as root)
> 7. Create an "Image Generator Settings" document type (in Pages folder, no template, icon `icon-palette`, not allowed as root) with: a "Category Palettes" group containing a `categoryPalettes` Block List property, and a "Default Palette" group containing `defaultPrimary`, `defaultMid`, `defaultDeep` Eye Dropper properties
> 8. Set Site Settings' allowed children to include Image Generator Settings (as the initial child type — the container is designed to accept additional settings types in the future)
> 9. Update Home doc type (`a95360e8-ff04-40b1-8f46-7aa4b5983096`) to add Site Settings as an allowed child type
> 10. Create a "Site Settings" content node under Home (`dcf18a51-6919-4cf8-89d1-36b94ce4d963`)
> 11. Create an "Image Generator Settings" content node under Site Settings, seeded with palette data from `scripts/image-generator/config/palettes.json` (4 category entries + default colors, hex values from the seed data table in the plan)
> 12. Publish both documents
>
> Use the `.env` file for `UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET`, `UMBRACO_BASE_URL`. Follow the patterns in `scripts/image-generator/src/umbraco-api.ts` for HTTP helpers and auth. Run with: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" node scripts/setup-palette-storage.mjs`

**What to build**:
- `scripts/setup-palette-storage.mjs` — one-shot setup script (delete after running)

**Validation**:
- [Automated]: Run the script — should output success for each step
- [Manual]: Open Umbraco backoffice → Content tree → Home → Site Settings → Image Generator Settings. Verify: Block List shows 4 palette entries with correct colors, default palette group has 3 colors.
- [Manual]: Settings → Document Types → verify "Site Settings" and "Image Generator Settings" types exist with correct properties

---

### Step 2 — TypeScript Palette Reader (TDD)

> **Prompt**: Implement Step 2 of `_plans/palette-storage.md`. Write unit tests first, then implement a TypeScript module that reads palette configuration from the Umbraco "Image Generator Settings" document (created in Step 1). The module goes in `scripts/image-generator/src/palette-reader.ts` with tests in `tests/image-generator/palette-reader.test.ts`.
>
> **Test first** — write tests covering:
> - `hexToRgb("#008cc8")` returns `[0, 140, 200]`, edge cases like `"#000000"`, `"#ffffff"`
> - `parsePaletteFromDocument(doc)` extracts Block List `contentData` entries and default color properties into a `PaletteConfig` object (entries keyed by category UUID, colors as RGB arrays)
> - Returns hardcoded defaults when doc is null/undefined
> - Returns hardcoded defaults when Block List is empty but default colors exist
> - Handles a palette entry where the category content picker value is `[{ type: "document", unique: "uuid" }]`
>
> **Then implement**:
> - `hexToRgb(hex: string): RGBColor` — converts `"#rrggbb"` to `[r, g, b]`
> - `parsePaletteFromDocument(doc: any): PaletteConfig` — takes a raw Management API document response, extracts `categoryPalettes` Block List value and `defaultPrimary`/`defaultMid`/`defaultDeep` values, returns a `PaletteConfig`
> - `fetchPaletteConfigFromApi(token: string): Promise<PaletteConfig>` — walks content tree to find "Image Generator Settings" document under Home → Site Settings, GETs the document, calls `parsePaletteFromDocument()`
>
> The Block List value structure from the API looks like: `{ contentData: [{ values: [{ alias, value }...] }...] }`. Category picker values are `[{ type: "document", unique: "uuid" }]`. Eye Dropper values are hex strings like `"#008cc8"`.
>
> Run tests: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx --test tests/image-generator/palette-reader.test.ts`

**What to build**:
- Create: `scripts/image-generator/src/palette-reader.ts`
- Create: `tests/image-generator/palette-reader.test.ts`

**Test first**:
- Write `tests/image-generator/palette-reader.test.ts` with tests for `hexToRgb` and `parsePaletteFromDocument`
- Run: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx --test tests/image-generator/palette-reader.test.ts` — confirm RED (module not found)
- Implement `scripts/image-generator/src/palette-reader.ts` — confirm GREEN

**Validation**:
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npm run test:unit` — all image-generator tests pass (both existing and new)

---

### Step 3 — CLI Integration

> **Prompt**: Implement Step 3 of `_plans/palette-storage.md`. Modify the CLI entry point (`scripts/image-generator/src/cli.ts`) to support palette configuration from the CMS instead of only from a JSON file. Changes:
>
> 1. Add a `--palette-json <json>` CLI argument that accepts a JSON string in `PaletteConfig` format. When provided, this is the palette source (used when the C# controller invokes the CLI).
> 2. Add a `--palette-from-api` CLI flag that fetches the palette from the Umbraco Management API using `fetchPaletteConfigFromApi()` from `scripts/image-generator/src/palette-reader.ts`.
> 3. Palette priority: `--palette-json` > `--palette-from-api` > file (`config/palettes.json`) > hardcoded defaults.
> 4. Update `parseArgs()` to handle the new arguments. Update `printUsage()` help text.
> 5. In `main()`, replace the single `loadPaletteConfig(configPath)` call with the priority chain.
>
> Also update `scripts/image-generator/src/palette.ts` to export the `DEFAULT_PALETTE` constant so `palette-reader.ts` can import it for its fallback.
>
> Test manually: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx scripts/image-generator/src/cli.ts --name "Retaining Humanity" --palette-from-api --local-only --output ./test-palette.png` (requires running Umbraco with the settings document from Step 1). Verify the generated image uses colors from the CMS settings, not from `palettes.json`.

**What to build**:
- Modify: `scripts/image-generator/src/cli.ts` — new args, palette priority chain
- Modify: `scripts/image-generator/src/palette.ts` — export `DEFAULT_PALETTE`

**Validation**:
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npm run test:unit` — existing tests still pass
- [Manual]: Run CLI with `--palette-from-api` flag against running Umbraco. Verify the generated PNG is created without errors.
- [Manual]: Run CLI with `--palette-json '{"entries":{},"default":[[255,0,0],[0,255,0],[0,0,255]]}'` and `--local-only`. Verify the image uses red/green/blue colors (visibly different from normal output).

---

### Step 4 — C# Palette Service and Controller Refactor

> **Prompt**: Implement Step 4 of `_plans/palette-storage.md`. Create a C# service that reads palette configuration from Umbraco content, and update `ImageGeneratorController` to use it instead of `palettes.json`.
>
> **Create `src/HelloWorld/PaletteService.cs`**:
> - Injectable service registered in DI
> - `GetPaletteConfigJson(): string` — reads the published "Image Generator Settings" document via `IPublishedContentCache` (from `IUmbracoContextAccessor`), extracts the `categoryPalettes` Block List and `defaultPrimary`/`defaultMid`/`defaultDeep` properties, converts to the `PaletteConfig` JSON format (`{ entries: { uuid: { name, colors: [[r,g,b]...] } }, default: [[r,g,b]...] }`)
> - Hex-to-RGB conversion: `"#008cc8"` → `[0, 140, 200]`
> - Falls back to hardcoded defaults if the settings document is missing or unpublished
> - Find the settings doc by walking published content: Home → find child of type "imageGeneratorSettings" (or "siteSettings" → child of type "imageGeneratorSettings")
> - For Block List values, use `IPublishedContent.Value<BlockListModel>("categoryPalettes")` and iterate blocks. Each block's content has properties: `paletteCategory` (returns `IPublishedContent` via content picker), `palettePrimary`, `paletteMid`, `paletteDeep` (return strings from Eye Dropper)
>
> **Modify `src/HelloWorld/ImageGeneratorController.cs`**:
> - Inject `PaletteService`
> - Update `RunCli()` to pass `--palette-json` argument with the JSON from `PaletteService.GetPaletteConfigJson()`. Shell-escape the JSON properly.
> - Update `GetPalettes()` endpoint to return palette config read from content (not file). This makes the dashboard's article generation work with CMS palettes.
> - Remove `SavePalettes()` endpoint (PUT /palettes) — palettes are now saved through the content editor, not the API
> - Remove `PalettesPath` property
>
> **Register in DI** — add `PaletteService` registration in `src/HelloWorld/HelloWorldComposer.cs` or equivalent startup/composer file.
>
> Build: `cd src/UmbracoProject && dotnet build`

**What to build**:
- Create: `src/HelloWorld/PaletteService.cs`
- Modify: `src/HelloWorld/ImageGeneratorController.cs`
- Modify: DI registration (composer/startup)

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` — builds without errors
- [Manual]: Start the site, open the backoffice dashboard, trigger a single-article generation. Check the CLI output includes `--palette-json` in the process arguments (visible in debug output or logs). Verify the generated image reflects the CMS palette colors.
- [Manual]: Call `GET /umbraco/api/image-generator/palettes` — should return palette config read from the settings document, not from `palettes.json`.

---

### Step 5 — Dashboard Simplification

> **Prompt**: Implement Step 5 of `_plans/palette-storage.md`. Simplify the Image Generator dashboard (`src/HelloWorld/Client/src/imageGenerator/dashboard.element.ts`) by removing the palette editor section. Palette management is now done through the "Image Generator Settings" content node in the Umbraco content tree.
>
> **Remove from the dashboard**:
> - The entire `#renderPaletteEditor()` method and the `<uui-box headline="Category Colors">` section
> - All palette-related state: `_palettes`, `_categories`, `_savingPalettes`, `_selectedNewCategoryId`
> - All palette action methods: `#onColorChange()`, `#onDefaultColorChange()`, `#addColorToCategory()`, `#removeColorFromCategory()`, `#removeCategory()`, `#addCategory()`, `#onSavePalettes()`, `#syncCategoryNames()`
> - The `#unassignedCategories` getter and `#isCategoryOrphaned()` method
> - The `/categories` API call from `#loadData()`
> - The `Category` type and `PaletteConfig`/`PaletteEntry`/`RgbColor` types (if no longer used)
> - Palette-related CSS (`.category-name`, `.orphan-badge`, `.color-cells`, `.color-slot`, `input[type="color"]`, `.default-palette`, `.add-category`)
> - The `hexToRgb` and `rgbToHex` helper functions
>
> **Add to the dashboard**:
> - An info box at the top: `<uui-box headline="Palette Settings"><p>Category color palettes are managed in the content tree: <strong>Home &rarr; Site Settings &rarr; Image Generator Settings</strong>. Open the settings document to add, edit, or remove category palette entries.</p></uui-box>`
>
> **Keep intact**:
> - Single-article generator (`#renderSingleGenerator()`)
> - Batch generator (`#renderBatchGenerator()`)
> - Output display (`#renderOutput()`)
> - Article loading and generation API calls
> - All generation-related state and methods
>
> Build the extension: `cd src/HelloWorld/Client && npm run build`

**What to build**:
- Modify: `src/HelloWorld/Client/src/imageGenerator/dashboard.element.ts`

**Validation**:
- [Automated]: `cd src/HelloWorld/Client && npm run build` — builds without errors
- [Manual]: Open the Image Generator dashboard in the backoffice Settings section. Verify:
  - No palette editor / color picker table visible
  - Info box with "Palette Settings" text and content tree path is shown
  - Single-article and batch generation controls still work
  - Generating an image still succeeds

---

### Step 6 — Tests and Cleanup

> **Prompt**: Implement Step 6 of `_plans/palette-storage.md`. Add E2E and integration tests for the palette storage feature, and clean up any remaining references.
>
> **Unit tests** (`tests/image-generator/palette-reader.test.ts` — extend if needed from Step 2):
> - Verify `fetchPaletteConfigFromApi()` returns correct data when hitting a running Umbraco instance (integration test, marked with a skip flag for CI)
>
> **E2E tests** — Create `tests/e2e/imageGenerator/dashboard.spec.ts`:
> - Dashboard loads without errors
> - Dashboard does NOT contain a "Category Colors" section or color picker inputs
> - Dashboard contains a "Palette Settings" info box with text mentioning "Site Settings"
> - Single-article generation controls are visible (article select, generate button)
> - Batch generation controls are visible (Generate Missing, Regenerate All buttons)
>
> **Integration test** (`tests/image-generator/integration.test.ts` — update):
> - Update the existing integration test to use `--palette-from-api` instead of file-based palettes
> - Verify generation succeeds with CMS-based palettes
>
> **Cleanup**:
> - Remove `scripts/setup-palette-storage.mjs` if it still exists (one-shot script)
> - Update `scripts/image-generator/README.md` to document the new palette source (CMS content instead of JSON file)
>
> Run E2E: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/imageGenerator/dashboard.spec.ts`
> Run unit: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npm run test:unit`

**What to build**:
- Create: `tests/e2e/imageGenerator/dashboard.spec.ts`
- Modify: `tests/image-generator/integration.test.ts`
- Modify: `scripts/image-generator/README.md`
- Delete: `scripts/setup-palette-storage.mjs` (if still present)

**Test first**:
- Write `tests/e2e/imageGenerator/dashboard.spec.ts` — should pass GREEN since the dashboard changes are already in place from Step 5
- Run: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/imageGenerator/dashboard.spec.ts`

**Validation**:
- [Automated]: All E2E tests pass
- [Automated]: All unit tests pass
- [Manual]: Verify in backoffice: change a palette color in the Image Generator Settings doc, publish, regenerate the affected article — the new image should reflect the updated color

---

## File Summary

| Action | File |
|--------|------|
| Create (delete after running) | `scripts/setup-palette-storage.mjs` |
| Create | `scripts/image-generator/src/palette-reader.ts` |
| Create | `tests/image-generator/palette-reader.test.ts` |
| Create | `tests/e2e/imageGenerator/dashboard.spec.ts` |
| Create | `src/HelloWorld/PaletteService.cs` |
| Modify | `scripts/image-generator/src/cli.ts` |
| Modify | `scripts/image-generator/src/palette.ts` |
| Modify | `scripts/image-generator/README.md` |
| Modify | `src/HelloWorld/ImageGeneratorController.cs` |
| Modify | `src/HelloWorld/Client/src/imageGenerator/dashboard.element.ts` |
| Modify | DI registration (composer/startup) |
| Modify | `tests/image-generator/integration.test.ts` |
