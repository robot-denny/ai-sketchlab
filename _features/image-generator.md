# Feature: Image Generator

CMS editors and developers can generate unique abstract featured images for blog articles using the article's own metadata -- title, word count, and categories -- as creative input. Each image is a deterministic flow-field pattern: the same article always produces the same image, and different articles produce visibly different images. Images can be generated one at a time or in batch, from a CLI tool or from the Umbraco backoffice. Category color palettes are managed as CMS content so they transfer between environments with standard Umbraco Deploy.

**Source spec**: `_specs/image-generator/image-generator.md`
**Last verified**: 2026-04-09

---

## Behaviors

### Rule: Each article produces a unique, deterministic flow-field image

```scenario
Scenario: Same article always produces the same image
  Given an article titled "Retaining Humanity in AI-Generated Content"
  And the article has 500 words and category "AI & Machine Learning"
  When the image is generated twice
  Then both generated PNGs are byte-identical
```

```scenario
Scenario: Different titles produce different images
  Given an article titled "Retaining Humanity in AI-Generated Content"
  And another article titled "The Future of Sustainable Tech"
  When images are generated for both articles
  Then the two PNGs are visibly different
```

```scenario
Scenario: Different article IDs produce different spawn patterns
  Given two articles with the same title "Duplicate Title"
  But with different Umbraco document IDs
  When images are generated for both articles
  Then the two PNGs are visibly different because particle spawn positions differ
```

```scenario
Scenario: Generated images are sized for social sharing
  Given any article
  When its image is generated
  Then the output is a 1200x630 pixel PNG
  And it has a dark background (#0F141E) with colored flow lines
```

### Rule: Article metadata drives the image parameters

```scenario
Scenario: Title seeds the flow field pattern
  Given an article titled "Retaining Humanity in AI-Generated Content"
  When the image is generated
  Then the flow field direction vectors are derived from a hash of the title
```

```scenario
Scenario: Word count controls image density
  Given an article with 100 words
  When the image is generated
  Then the image has approximately 100 particles with shorter trails

  Given an article with 900 words
  When the image is generated
  Then the image has approximately 300 particles with longer trails
```

```scenario
Scenario: Word count is bounded to prevent extremes
  Given an article with 2000 words
  When the image is generated
  Then the particle count is capped at 300 and trail length at 250 steps

  Given an article with 0 words
  When the image is generated
  Then the particle count is floored at 100 and trail length at 150 steps
```

### Rule: Category determines the color palette

```scenario
Scenario: AI & Machine Learning article uses cyan/blue tones
  Given an article with category "AI & Machine Learning"
  When the image is generated
  Then the flow lines use cyan and blue tones (primary #008cc8, mid #14b4dc, deep #0064b4)
```

```scenario
Scenario: Ethics article uses coral/orange tones
  Given an article with category "Ethics"
  When the image is generated
  Then the flow lines use coral and orange tones (primary #dc643c, mid #f08c50, deep #c85028)
```

```scenario
Scenario: Sustainability article uses green tones
  Given an article with category "Sustainability"
  When the image is generated
  Then the flow lines use green tones (primary #28b464, mid #3cc878, deep #148c50)
```

```scenario
Scenario: Agentic Coding article uses purple tones
  Given an article with category "Agentic Coding"
  When the image is generated
  Then the flow lines use purple tones (primary #a050b4, mid #c878c8, deep #78288c)
```

### Rule: Multiple categories merge all matching palettes into a combined color pool

```scenario
Scenario: Article with two categories gets a merged 6-color palette
  Given an article with categories "Ethics" and "Sustainability"
  When the image is generated
  Then the flow lines cycle through 6 colors: the 3 coral/orange tones followed by the 3 green tones
```

```scenario
Scenario: Article with three categories gets a merged 9-color palette
  Given an article with categories "AI & Machine Learning", "Ethics", and "Sustainability"
  When the image is generated
  Then the flow lines cycle through 9 colors from all three palettes
```

```scenario
Scenario: One known category and one unknown category uses only the known palette
  Given an article with categories "Sustainability" and "Cooking"
  And no palette is configured for "Cooking"
  When the image is generated
  Then the flow lines use only the 3 green tones from "Sustainability"
```

### Rule: Unknown or missing categories fall back to the default palette

```scenario
Scenario: Unknown category uses the default palette
  Given an article with category "Cooking"
  And no palette entry exists for "Cooking"
  When the image is generated
  Then the flow lines use the default palette colors (neutral tones: #b5aea6, #d9c5b4, #9c7373)
```

```scenario
Scenario: Article with no categories uses the default palette
  Given an article with no categories assigned
  When the image is generated
  Then the flow lines use the default palette colors
```

---

## CLI Generation

### Rule: The CLI generates a single article image by name or ID

```scenario
Scenario: Generate image by article name
  Given the Umbraco instance is running
  When I run "npx tsx scripts/image-generator/src/cli.ts --name 'Retaining Humanity'"
  Then the CLI finds the matching article
  And generates a PNG, uploads it to the "Generated Images" media folder
  And assigns it as the article's mainImage property
  And reports "Done: 1 generated, 0 skipped, 0 errors"
```

```scenario
Scenario: Generate image by article UUID
  Given the Umbraco instance is running
  And an article exists with document ID "550e8400-e29b-41d4-a716-446655440000"
  When I run the CLI with "--id 550e8400-e29b-41d4-a716-446655440000"
  Then the CLI generates and uploads the image for that specific article
```

### Rule: Batch mode generates images for all articles missing a featured image

```scenario
Scenario: Batch generates only for articles without images
  Given 5 articles exist, 3 already have a mainImage and 2 do not
  When I run "npx tsx scripts/image-generator/src/cli.ts --batch"
  Then images are generated for the 2 articles without images
  And the 3 articles with existing images are skipped
  And the CLI reports "Done: 2 generated, 3 skipped, 0 errors"
```

### Rule: The --force flag regenerates even when an image exists

```scenario
Scenario: Force regenerates an article that already has an image
  Given an article that already has a mainImage assigned
  When I run the CLI with "--name 'Article Title' --force"
  Then a new image is generated, uploaded, and assigned
  And the previous image is replaced
```

```scenario
Scenario: Force batch regenerates all articles
  Given 5 articles, all with existing images
  When I run "npx tsx scripts/image-generator/src/cli.ts --batch --force"
  Then all 5 articles receive newly generated images
  And the CLI reports "Done: 5 generated, 0 skipped, 0 errors"
```

### Rule: Local-only mode saves to disk without uploading

```scenario
Scenario: Generate a preview image locally
  Given the Umbraco instance is running (for metadata)
  When I run the CLI with "--name 'Article Title' --local-only --output ./preview.png"
  Then the PNG is saved to ./preview.png
  And no image is uploaded to the media library
  And the article's mainImage property is not changed
```

### Rule: The CLI reports errors clearly and continues in batch mode

```scenario
Scenario: Umbraco not running produces a clear error
  Given the Umbraco instance is not running
  When I run the CLI
  Then it exits with "Error: Cannot connect to Umbraco"
```

```scenario
Scenario: Upload failure in batch mode does not halt processing
  Given 3 articles need images
  And the media upload fails for the second article
  When I run the CLI in batch mode
  Then the first and third articles are processed successfully
  And the second article is counted as an error
  And the CLI reports "Done: 2 generated, 0 skipped, 1 errors"
```

---

## Palette Configuration

### Rule: Palette settings are stored as CMS content for environment transfer

```scenario
Scenario: Palette configuration lives in a settings document
  Given the CMS is set up
  Then an "Image Generator Settings" document exists under Home > Site Settings
  And it contains a Block List of category palette entries
  And it contains default palette color properties (primary, mid, deep)
```

```scenario
Scenario: Palette changes transfer between environments via Umbraco Deploy
  Given a CMS editor changes the "AI & Machine Learning" palette to red tones
  And publishes the Image Generator Settings document
  When content is transferred to the staging environment
  Then the staging environment's Image Generator Settings shows the updated red tones
```

### Rule: Editors manage palettes through the standard content editor

```scenario
Scenario: Editor adds a new category palette
  Given a CMS editor opens the Image Generator Settings document
  When they add a new Block List entry for category "Robotics"
  And set the primary color to "#ff0000", mid to "#cc0000", deep to "#990000"
  And publish the document
  Then articles with category "Robotics" will use the red palette on next generation
```

```scenario
Scenario: Editor deletes a category palette
  Given a palette entry exists for "Sustainability"
  When the CMS editor removes the "Sustainability" block from the Block List
  And publishes the document
  Then articles with category "Sustainability" fall back to the default palette on next generation
```

```scenario
Scenario: Editor changes the default palette
  Given the default palette is neutral tones
  When the CMS editor changes the default palette colors to bright blue tones
  And publishes the document
  Then articles with unmatched categories use the new bright blue palette on next generation
```

### Rule: The CLI reads palettes from multiple sources with a priority chain

```scenario
Scenario: CLI uses --palette-json when provided
  Given the CLI is run with "--palette-json '{"entries":{},"default":[[255,0,0],[0,255,0],[0,0,255]]}'"
  When the image is generated
  Then the red/green/blue default palette is used regardless of CMS settings or config file
```

```scenario
Scenario: CLI fetches from CMS API when --palette-from-api is specified
  Given the CMS has palette settings published
  When the CLI is run with "--palette-from-api"
  Then palettes are fetched from the Image Generator Settings document
```

```scenario
Scenario: CLI falls back to config file when no flag is provided
  Given no --palette-json or --palette-from-api flag is provided
  When the CLI is run
  Then palettes are loaded from scripts/image-generator/config/palettes.json
```

```scenario
Scenario: CLI falls back to hardcoded defaults when config file is missing
  Given the palettes.json file does not exist
  And no --palette-json or --palette-from-api flag is provided
  When the CLI is run
  Then the hardcoded cyan default palette is used
```

---

## Backoffice Integration

### Rule: The Image Generator dashboard provides generation controls in the Settings section

```scenario
Scenario: Dashboard appears in the Settings section
  Given a CMS editor navigates to the Settings section of the backoffice
  Then an "Image Generator" tab is visible
  And it shows a "Palette Settings" info box directing to the content tree
  And it shows a "Generate for Article" section
  And it shows a "Batch Generation" section
```

```scenario
Scenario: Dashboard palette editor has been removed in favor of content-based management
  Given a CMS editor opens the Image Generator dashboard
  Then there is no "Category Colors" section with color pickers
  And the info box reads "Category color palettes are managed in the content tree: Home > Site Settings > Image Generator Settings"
```

### Rule: Single-article generation works from the dashboard

```scenario
Scenario: Editor generates an image for one article from the dashboard
  Given a CMS editor selects "Retaining Humanity" from the article dropdown
  And leaves the Force toggle off
  When they click "Generate Image"
  Then the dashboard shows a loading state
  And on completion shows the CLI output
  And a success notification confirms the image was generated
```

```scenario
Scenario: Force toggle regenerates even when an image exists
  Given a CMS editor selects an article that already has a mainImage
  And turns on the Force toggle
  When they click "Generate Image"
  Then a new image is generated and assigned, replacing the existing one
```

### Rule: Batch generation processes all articles from the dashboard

```scenario
Scenario: Generate missing images in batch
  Given some articles lack a mainImage
  When the CMS editor clicks "Generate Missing"
  Then images are generated for all articles without a mainImage
  And the dashboard shows the CLI output with per-article status
```

```scenario
Scenario: Regenerate all images in batch with force
  Given all articles already have images
  When the CMS editor clicks "Regenerate All"
  Then all articles receive newly generated images
  And a completion notification is shown
```

### Rule: A property action lets editors generate images directly from the article editor

```scenario
Scenario: Generate Image action appears on the mainImage media picker
  Given a CMS editor is editing an article in the backoffice
  Then a "Generate Image" property action with a wand icon is available on the mainImage media picker field
```

```scenario
Scenario: Triggering the property action generates and assigns an image
  Given a CMS editor clicks the "Generate Image" property action on an article
  Then a "Generating image..." notification appears
  And when generation completes, a success notification says "Reload the page to see the new image"
  And the article's mainImage is set to the newly generated image
```

```scenario
Scenario: Property action reports errors inline
  Given the generation server is unavailable
  When the CMS editor clicks "Generate Image"
  Then a danger notification shows "Generation failed" with the error details
```

---

## Image Upload

### Rule: Generated images are uploaded to a dedicated media folder

```scenario
Scenario: Images go to the "Generated Images" folder in the media library
  Given the CLI or backoffice generates an image
  When the image is uploaded
  Then it appears under the "Generated Images" folder in the Umbraco media library
  And the file name is derived from the article name (e.g., "retaining-humanity-in-ai-generated-content.png")
```

```scenario
Scenario: The media folder is created automatically if it does not exist
  Given no "Generated Images" folder exists in the media library
  When the first image is generated and uploaded
  Then the folder is created automatically
  And the image is placed inside it
```

### Rule: The generated image is assigned as the article's mainImage

```scenario
Scenario: Image is assigned in MediaPicker3 format
  Given a generated PNG has been uploaded with media ID "abc-123"
  When the article's mainImage is assigned
  Then the mainImage property value contains a MediaPicker3 entry referencing "abc-123"
```

---

## Edge Cases

### Rule: Extreme metadata values produce valid images without errors

```scenario
Scenario: Article with zero word count still generates a valid image
  Given an article with 0 words
  When the image is generated
  Then a valid PNG is produced using the minimum particle count (100)
```

```scenario
Scenario: Article with empty title still generates a valid image
  Given an article with an empty title string
  When the image is generated
  Then the hash of the empty string produces a valid seed
  And a valid PNG is produced
```

```scenario
Scenario: Article with very short title still produces well-distributed patterns
  Given an article titled "AI"
  When the image is generated
  Then the hash produces a well-distributed seed
  And the flow field pattern fills the canvas
```

### Rule: Palette configuration edge cases are handled gracefully

```scenario
Scenario: Settings document does not exist
  Given the "Image Generator Settings" document has not been created
  When the generator reads palette configuration
  Then it falls back to hardcoded defaults without error
```

```scenario
Scenario: Settings document exists but is not published
  Given the "Image Generator Settings" document exists in draft state only
  When the generator reads palette configuration
  Then it falls back to hardcoded defaults without error
```

```scenario
Scenario: Block List is empty with only default palette colors
  Given the "Image Generator Settings" document has no category palette entries
  But the default palette colors are configured
  When an image is generated for any article
  Then all articles use the default palette
```

```scenario
Scenario: Category is renamed in the CMS
  Given a palette block references the category "Vibe Coding" by content picker
  When the category is renamed to "Agentic Coding" in the CMS
  Then the content picker reference survives the rename
  And palette resolution continues to work
```

```scenario
Scenario: Category referenced in palette is deleted from the CMS
  Given a palette block references a category that has been deleted
  When the generator resolves palettes
  Then the orphaned palette entry never matches
  And affected articles fall back to the default palette
```

### Rule: Authentication failures are handled clearly

```scenario
Scenario: Invalid credentials produce a clear error
  Given the UMBRACO_CLIENT_ID or UMBRACO_CLIENT_SECRET is wrong
  When the CLI is run
  Then it exits with "Error: Authentication failed. Check UMBRACO_CLIENT_ID/SECRET in .env"
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Same article always produces the same image | `tests/image-generator/generator.test.ts:L21` | Covered |
| Different titles produce different images | `tests/image-generator/generator.test.ts:L27` | Covered |
| Different article IDs produce different images | `tests/image-generator/generator.test.ts:L32` | Covered |
| Zero word count produces valid image | `tests/image-generator/generator.test.ts:L38` | Covered |
| Empty title produces valid image | `tests/image-generator/generator.test.ts:L44` | Covered |
| No categories produces valid image | `tests/image-generator/generator.test.ts:L49` | Covered |
| AI & Machine Learning uses cyan/blue palette | `tests/image-generator/palette.test.ts:L39` | Covered |
| Ethics uses coral/orange palette | `tests/image-generator/palette.test.ts:L44` | Covered |
| Sustainability uses green palette | `tests/image-generator/palette.test.ts:L49` | Covered |
| Vibe Coding uses purple palette | `tests/image-generator/palette.test.ts:L54` | Covered |
| Unknown category uses default palette | `tests/image-generator/palette.test.ts:L59` | Covered |
| Empty categories use default palette | `tests/image-generator/palette.test.ts:L64` | Covered |
| Multiple categories merge all matching palettes (6 colors) | `tests/image-generator/palette.test.ts:L69` | Covered |
| One known + one unknown category uses only known palette | `tests/image-generator/palette.test.ts:L78` | Covered |
| Word count 100 returns at least 100 particles | `tests/image-generator/palette.test.ts:L91` | Covered |
| Word count 2000 caps at 300 particles | `tests/image-generator/palette.test.ts:L96` | Covered |
| Word count 0 returns minimum particle count | `tests/image-generator/palette.test.ts:L107` | Covered |
| Seed determinism | `tests/image-generator/seed.test.ts:L5` | Covered |
| PRNG same seed same sequence | `tests/image-generator/seed.test.ts:L25` | Covered |
| Noise value range [-1, 1] | `tests/image-generator/flow-field.test.ts:L14` | Covered |
| Flow field determinism | `tests/image-generator/flow-field.test.ts:L71` | Covered |
| Particle spawn determinism | `tests/image-generator/flow-field.test.ts:L141` | Covered |
| Renderer PNG magic bytes | `tests/image-generator/renderer.test.ts:L23` | Covered |
| Renderer determinism | `tests/image-generator/renderer.test.ts:L38` | Covered |
| hexToRgb conversion | `tests/image-generator/palette-reader.test.ts:L9` | Covered |
| parsePaletteFromDocument extracts entries | `tests/image-generator/palette-reader.test.ts:L91` | Covered |
| parsePaletteFromDocument null returns defaults | `tests/image-generator/palette-reader.test.ts:L116` | Covered |
| Empty Block List returns only default | `tests/image-generator/palette-reader.test.ts:L130` | Covered |
| Integration: fetchArticles returns valid metadata | `tests/image-generator/integration.test.ts:L105` | Covered |
| Integration: determinism with real articles | `tests/image-generator/integration.test.ts:L135` | Covered |
| Integration: distinctness with real articles | `tests/image-generator/integration.test.ts:L142` | Covered |
| Integration: upload and assign mainImage | `tests/image-generator/integration.test.ts:L152` | Covered |
| Integration: CMS palette fetch returns valid config | `tests/image-generator/integration.test.ts:L204` | Covered |
| Integration: generation succeeds with CMS palettes | `tests/image-generator/integration.test.ts:L219` | Covered |
| Dashboard does NOT contain palette editor | `tests/e2e/imageGenerator/dashboard.spec.ts:L83` | Covered |
| Dashboard contains Palette Settings info box | `tests/e2e/imageGenerator/dashboard.spec.ts:L89` | Covered |
| Dashboard contains single-article generation controls | `tests/e2e/imageGenerator/dashboard.spec.ts:L95` | Covered |
| Dashboard contains batch generation controls | `tests/e2e/imageGenerator/dashboard.spec.ts:L105` | Covered |
| Articles API endpoint returns data | `tests/e2e/imageGenerator/dashboard.spec.ts:L112` | Covered |
| Palettes API returns CMS-sourced config | `tests/e2e/imageGenerator/dashboard.spec.ts:L123` | Covered |
| Editor generates an image for one article from the dashboard | `tests/e2e/imageGenerator/dashboard.spec.ts:L142` | Covered |
| Generate endpoint returns structured error on CLI failure | `tests/e2e/imageGenerator/dashboard.spec.ts:L174` | Covered |
| Palette transfer between environments | -- | Not covered (manual) |
| Batch mode skips articles with existing images | -- | Not covered |
| --force regenerates existing images | -- | Not covered |
| --local-only saves to disk without uploading | -- | Not covered |
| Umbraco not running produces clear error | -- | Not covered |
| Property action triggers generation from editor | -- | Not covered |
| Category rename survives via content picker | -- | Not covered |

---

## Revision Notes

- 2026-04-09: Initial feature doc synthesized from 2 specs, 3 plans, and implemented code. **Conflict resolved**: The original spec (`image-generator.md`) initially said "first match wins" for multi-category palette handling, while the backoffice plan (`image-generator-backoffice.md`) specified "merge all matching palettes." The implemented code in `scripts/image-generator/src/palette.ts` uses the **merge** strategy -- it concatenates all matching category palettes into a single combined color pool and the renderer cycles through all merged colors. The test suite (`tests/image-generator/palette.test.ts:L69`) explicitly verifies that two matching categories produce a 6-color merged palette. The spec was also updated (per backoffice plan Step 0) to reflect the merge behavior. This feature doc records the merge behavior as authoritative. Additionally, the palette storage migration from JSON file to CMS content (per `palette-storage.md`) is fully implemented: palettes are stored as a Block List in the "Image Generator Settings" document, the dashboard palette editor was removed, and the CLI supports a priority chain (--palette-json > --palette-from-api > config file > hardcoded defaults). The "Vibe Coding" category was renamed to "Agentic Coding" in the live CMS data but the behavior is unchanged.
