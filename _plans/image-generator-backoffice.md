# Plan: Image Generator Backoffice Integration

**Spec**: `_specs/image-generator/image-generator.md`
**Branch**: `claude/feature/metadata-image-generator` (existing)

## Context

The CLI-based image generator is fully implemented (Steps 1–7 of the original plan, all files in `scripts/image-generator/src/`). This plan adds the backoffice-facing features described in the updated spec: a property action on the article's `mainImage` field to generate an image in-place, an Image Generator dashboard in the Settings section for category color management and batch operations, and persisted palette configuration so editors — not code — control category colors. It also fixes the multi-category behavior from "first match wins" to "merge all matching palettes."

---

## Key Decisions

- **Palette config storage**: JSON file at `scripts/image-generator/config/palettes.json`. CLI reads it directly at runtime; C# controller reads/writes it for backoffice API calls. No Umbraco document type needed.
- **Generation trigger from backoffice**: C# controller spawns `npx tsx scripts/image-generator/src/cli.ts --id {id}` as a child process. Reuses all existing CLI logic without code duplication. Local-only limitation (requires Node.js on the server) is acceptable for this demo.
- **Multi-category palettes**: Merge all matching category palettes into one combined pool instead of first-match. An article in "AI & Machine Learning" + "Ethics of AI" gets 6 colors cycling through the flow trails.
- **Generate action**: Property action on `Umbraco.MediaPicker3` editor (appears directly in the `mainImage` row). Gets current document ID from workspace context.
- **Dashboard location**: Settings section, new tab labeled "Image Generator."
- **Extension home**: Add to existing `src/HelloWorld/` extension rather than creating a new project.

---

## Critical Files

| File | Status | Purpose |
|------|--------|---------|
| `scripts/image-generator/src/palette.ts` | Modify | Merge palettes, load from config file |
| `scripts/image-generator/src/generator.ts` | Modify | Pass loaded palette config to `getCategoryPalette` |
| `scripts/image-generator/config/palettes.json` | Create | Persistent palette config (initially seeded from hardcoded defaults) |
| `tests/image-generator/palette.test.ts` | Modify | Add merge and config-loading tests |
| `_specs/image-generator/image-generator.md` | Modify | Update multi-category edge case to "merge" |
| `src/HelloWorld/ImageGeneratorController.cs` | Create | C# API: palette CRUD + generation trigger + article list |
| `src/HelloWorld/Client/src/imageGenerator/dashboard.element.ts` | Create | Lit dashboard component (palette editor + generators) |
| `src/HelloWorld/Client/src/imageGenerator/manifest.ts` | Create | Dashboard manifest (Settings section) |
| `src/HelloWorld/Client/src/propertyActions/generateImage.element.ts` | Create | Property action Lit component |
| `src/HelloWorld/Client/src/propertyActions/manifest.ts` | Create | Property action manifest (MediaPicker3) |
| `src/HelloWorld/Client/src/bundle.manifests.ts` | Modify | Import new manifest arrays |

---

## Implementation Steps

Each step is an independent prompt for a new context window.

---

### Step 0 — Update spec + fix multi-category edge case in palette.ts

> **Prompt**: Implement Step 0 of `_plans/image-generator-backoffice.md`. (1) In `_specs/image-generator/image-generator.md`, change the edge case line "Article has multiple categories — use the first matching palette" to "Article has multiple categories — merge all matching palettes into a single combined color pool; the renderer cycles through all merged colors." (2) In `scripts/image-generator/src/palette.ts`, update `getCategoryPalette()` to merge all matching palettes (concatenate them) instead of returning the first match. Update `tests/image-generator/palette.test.ts` to cover merge behavior. Run `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx --test tests/image-generator/palette.test.ts` to confirm GREEN.

**Changes to `palette.ts`**:
```typescript
// Before: return on first match
export function getCategoryPalette(categories: string[], config?: PaletteConfig): Palette {
  const palettes = config?.entries ?? PALETTES;
  const matching = categories
    .map(cat => palettes[cat])
    .filter((p): p is Palette => Boolean(p));
  if (matching.length === 0) return config?.default ?? DEFAULT_PALETTE;
  return matching.flat() as Palette;  // merge all matching palettes
}
```

**New test cases** (add to existing `palette.test.ts`):
- Two matching categories → palette length = 6 (3 + 3 merged)
- Three matching categories → palette length = 9
- One matching + one unknown → palette length = 3 (only the matched one)

**Also add `PaletteConfig` interface to `scripts/image-generator/src/types.ts`**:
```typescript
export interface PaletteConfig {
  entries: Record<string, Palette>;  // category name → palette
  default: Palette;
}
```

---

### Step 1 — Create palette config file and update CLI to load it

> **Prompt**: Implement Step 1 of `_plans/image-generator-backoffice.md`. Create `scripts/image-generator/config/palettes.json` seeded from the hardcoded defaults. Add `loadPaletteConfig(configPath)` to `palette.ts` that reads and parses this file, falling back to hardcoded defaults if the file doesn't exist. Update `generator.ts` to load the config at call time and pass it to `getCategoryPalette`. Update `cli.ts` to pass the config path (derived from the script's `__dirname`). Run unit tests to confirm everything still passes.

**`scripts/image-generator/config/palettes.json`** (initial seed):
```json
{
  "entries": {
    "AI & Machine Learning": [[0,140,200],[20,180,220],[0,100,180]],
    "Ethics of AI": [[220,100,60],[240,140,80],[200,80,40]],
    "Sustainability": [[40,180,100],[60,200,120],[20,140,80]],
    "Vibe Coding": [[160,80,180],[200,120,200],[120,40,140]]
  },
  "default": [[0,140,200],[20,180,220],[0,100,180]]
}
```

**`loadPaletteConfig` in `palette.ts`**:
```typescript
import { readFileSync } from 'node:fs';

export function loadPaletteConfig(configPath: string): PaletteConfig {
  try {
    const raw = readFileSync(configPath, 'utf8');
    return JSON.parse(raw) as PaletteConfig;
  } catch {
    return { entries: PALETTES, default: DEFAULT_PALETTE };
  }
}
```

**Update `generator.ts`**:
```typescript
// Accept optional config; if not provided, load from default path
export function generateImage(metadata: ArticleMetadata, options?: GeneratorOptions, config?: PaletteConfig): Buffer {
  const palette = getCategoryPalette(metadata.categories, config);
  // rest unchanged
}
```

**Update `cli.ts`**: Load config from `path.join(import.meta.dirname, '../../config/palettes.json')` before generating.

**Test**: `npm run test:unit` — all existing tests still pass.

---

### Step 2 — C# API Controller

> **Prompt**: Implement Step 2 of `_plans/image-generator-backoffice.md`. Add `ImageGeneratorController.cs` to `src/HelloWorld/`. It must be an Umbraco API controller with backoffice authorization. Implement four endpoints: GET/PUT palettes (reads/writes `scripts/image-generator/config/palettes.json`), GET articles (returns name+id for all "article" document type content), and POST generate/{documentId}?force=true + POST generate/batch (both spawn the CLI). Build with `dotnet build src/UmbracoProject` and verify the endpoints are reachable at `https://localhost:44367/umbraco/api/image-generator/palettes`.

**File**: `src/HelloWorld/ImageGeneratorController.cs`

```csharp
[Route("umbraco/api/image-generator")]
[Authorize(Policy = AuthorizationPolicies.BackOfficeAccess)]
public class ImageGeneratorController : Controller
{
    private readonly IWebHostEnvironment _env;
    private readonly IContentService _contentService;

    private string PalettesPath => Path.GetFullPath(
        Path.Combine(_env.ContentRootPath, "..", "..", "scripts", "image-generator", "config", "palettes.json"));

    [HttpGet("palettes")]
    public IActionResult GetPalettes() { /* read JSON */ }

    [HttpPut("palettes")]
    public IActionResult SavePalettes([FromBody] JsonElement config) { /* write JSON */ }

    [HttpGet("articles")]
    public IActionResult GetArticles() {
        // _contentService.GetContentOfType("article") → name + Key (GUID)
    }

    [HttpPost("generate/{documentId}")]
    public async Task<IActionResult> Generate(string documentId, [FromQuery] bool force = false) {
        // Spawn: tsx scripts/image-generator/src/cli.ts --id {documentId} [--force]
        // Return: { success, output }
    }

    [HttpPost("generate/batch")]
    public async Task<IActionResult> GenerateBatch([FromBody] BatchRequest req) {
        // Spawn: tsx scripts/image-generator/src/cli.ts --batch [--force]
        // Return when done: { output }
    }
}
```

**Process spawn helper** (for both generate endpoints):
```csharp
private async Task<(int exitCode, string output)> RunCli(string args)
{
    // Resolve node/npx from PATH or appsettings "ImageGenerator:NodePath"
    var psi = new ProcessStartInfo("npx")
    {
        Arguments = $"tsx {Path.Combine("..", "..", "scripts", "image-generator", "src", "cli.ts")} {args}",
        WorkingDirectory = _env.ContentRootPath,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
    };
    // add PATH env var to ensure node is found
    psi.Environment["PATH"] = Environment.GetEnvironmentVariable("PATH") + ":/Users/dkardys/.nvm/versions/node/v18.19.0/bin";
    // start, wait, read stdout+stderr, return
}
```

**Note**: Add `"ImageGenerator": { "NodeBinPath": "/Users/dkardys/.nvm/versions/node/v18.19.0/bin" }` to `appsettings.Development.json` so the path isn't hardcoded in C#.

**Validation**: `curl -sk -X GET https://localhost:44367/umbraco/api/image-generator/palettes -H "Authorization: Bearer {token}"` returns the JSON palette config.

---

### Step 3 — Image Generator Dashboard (Lit component)

> **Prompt**: Implement Step 3 of `_plans/image-generator-backoffice.md`. Before writing code, invoke the `umbraco-dashboard` skill for the correct Umbraco 17 dashboard patterns. Then create `src/HelloWorld/Client/src/imageGenerator/dashboard.element.ts` and `manifest.ts`. The dashboard has three `<uui-box>` sections: Category Palette Editor, Single Article Generator, and Batch Generator. Register it in the Settings section. Update `bundle.manifests.ts`. Run `cd src/HelloWorld/Client && npm run build` then `dotnet build src/UmbracoProject`.

**`manifest.ts`**:
```typescript
export const manifests: Array<UmbExtensionManifest> = [{
  name: "Image Generator Dashboard",
  alias: "ImageGenerator.Dashboard",
  type: "dashboard",
  js: () => import("./dashboard.element.js"),
  meta: { label: "Image Generator", pathname: "image-generator" },
  conditions: [{ alias: "Umb.Condition.SectionAlias", match: "Umb.Section.Settings" }],
}];
```

**`dashboard.element.ts`** structure (Lit + UUI):
```typescript
@customElement('image-generator-dashboard')
class ImageGeneratorDashboard extends UmbElementMixin(LitElement) {
  // State
  @state() palettes: PaletteConfig = { entries: {}, default: [] };
  @state() articles: Array<{id: string, name: string}> = [];
  @state() selectedArticleId = '';
  @state() forceRegenerate = false;
  @state() generating = false;
  @state() batchResult = '';

  async connectedCallback() {
    // Fetch palettes and articles from C# API using UMB_AUTH_CONTEXT token
  }

  render() {
    return html`
      <uui-box headline="Category Colors">
        <!-- Table of category entries with <input type="color"> for each color slot -->
        <!-- Add row + Save button -->
      </uui-box>
      <uui-box headline="Generate for Article">
        <!-- <uui-select> or search for articles, Force checkbox, Generate button -->
      </uui-box>
      <uui-box headline="Batch Generation">
        <!-- Generate Missing + Regenerate All (with confirmation) + progress output -->
      </uui-box>
    `;
  }
}
```

**Auth pattern** — use existing pattern from `entrypoint.ts` to get the auth token for fetch calls:
```typescript
this.consumeContext(UMB_AUTH_CONTEXT, (authContext) => {
  this._authContext = authContext;
});
// Then in fetch calls:
const token = await this._authContext?.getLatestToken();
fetch('/umbraco/api/image-generator/palettes', {
  headers: { Authorization: `Bearer ${token}` }
});
```

**Color input → RGB array conversion**:
```typescript
// hex "#00c800" → [0, 200, 0]
const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// RGB → hex for <input type="color">
const rgbToHex = ([r, g, b]: number[]) =>
  '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
```

---

### Step 4 — Property Action on mainImage

> **Prompt**: Implement Step 4 of `_plans/image-generator-backoffice.md`. Before writing code, invoke the `umbraco-property-action` skill for Umbraco 17 property action patterns. Create `src/HelloWorld/Client/src/propertyActions/generateImage.element.ts` and `manifest.ts`. The action appears on `Umbraco.MediaPicker3` properties. When triggered, it reads the document ID from workspace context, calls POST `/umbraco/api/image-generator/generate/{id}`, shows a loading notification, and on success shows a success notification with instructions to reload the property. Update `bundle.manifests.ts` and rebuild.

**`manifest.ts`**:
```typescript
export const manifests: Array<UmbExtensionManifest> = [{
  name: "Generate Flow Field Image",
  alias: "ImageGenerator.PropertyAction.Generate",
  type: "propertyAction",
  forPropertyEditorAlias: "Umbraco.MediaPicker3",
  js: () => import("./generateImage.element.js"),
  meta: { label: "Generate Image", icon: "icon-wand" },
}];
```

**`generateImage.element.ts`** key logic:
```typescript
async execute() {
  // 1. Get document ID from workspace context
  const workspaceCtx = await this.getContext(UMB_DOCUMENT_WORKSPACE_CONTEXT);
  const documentId = workspaceCtx.getUnique();

  // 2. Get auth token
  const token = await this._authContext?.getLatestToken();

  // 3. Show loading notification
  this._notificationContext?.peek('positive', { data: { headline: 'Generating image...' }});

  // 4. Call C# API
  const response = await fetch(`/umbraco/api/image-generator/generate/${documentId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  // 5. Show result
  if (response.ok) {
    this._notificationContext?.peek('positive', {
      data: { headline: 'Image generated', message: 'Reload the page to see the new image.' }
    });
  } else {
    this._notificationContext?.peek('danger', { data: { headline: 'Generation failed', message: await response.text() }});
  }
}
```

---

### Step 5 — Build, wire up, and verify end-to-end

> **Prompt**: Implement Step 5 of `_plans/image-generator-backoffice.md`. Update `bundle.manifests.ts` to import the new imageGenerator and propertyActions manifests. Run `cd src/HelloWorld/Client && npm run build`. Run `dotnet build src/UmbracoProject`. Start the site with `dotnet run`. Verify: (a) Settings section shows "Image Generator" tab; (b) palette editor loads and saves color changes; (c) single-article generator triggers and shows a success notification; (d) batch generator runs and shows summary; (e) on an article edit page, the mainImage property shows a "Generate Image" action that triggers generation.

**`bundle.manifests.ts`** final:
```typescript
import { manifests as entrypoints } from "./entrypoints/manifest.js";
import { manifests as dashboards } from "./dashboards/manifest.js";
import { manifests as imageGenerator } from "./imageGenerator/manifest.js";
import { manifests as propertyActions } from "./propertyActions/manifest.js";

export const manifests: Array<UmbExtensionManifest> = [
  ...entrypoints,
  ...dashboards,
  ...imageGenerator,
  ...propertyActions,
];
```

---

## Verification

1. **Unit tests** — `npm run test:unit` — all palette tests pass including merge behavior
2. **Palette config** — Edit a category color in the dashboard, save, run `npm run generate:images -- --name "..."` CLI, verify the new color appears in the generated image
3. **Property action** — Open any article in the backoffice, click the "Generate Image" action on the `mainImage` field, reload the page and verify the new image is assigned
4. **Dashboard batch** — Use "Regenerate All" with Force on, check the Umbraco media library for new images in the "Generated Images" folder
5. **New category resilience** — Add a palette entry for a new category via the dashboard, generate an image for an article with that category, verify the correct colors appear

## Known Risks

| Risk | Mitigation |
|------|-----------|
| `npx tsx` not found in C# process PATH | Read node bin path from `appsettings.Development.json` → `ImageGenerator:NodeBinPath` |
| Property action workspace context API may differ in Umbraco 17 | Invoke `umbraco-property-action` skill before implementing Step 4 |
| Batch generation timeout if many articles | Set generous `Process.WaitForExit()` timeout (300s); note this is local-dev only |
| C# ContentRootPath relative to repo root differs on cloud | Only an issue for cloud deploy; document the local-only limitation |
