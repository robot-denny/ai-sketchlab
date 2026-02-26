---
description: Create a new Umbraco block list component using TDD with Playwright E2E testing
allowed-tools: Read, Write, Edit, Glob, Bash(dotnet*), Bash(PATH*), Bash(npx playwright*), mcp__umbraco__*
argument-hint: "[Brief description of the block, its properties, and editor experience]"
---

## User Input
The user wants to create a block: **$ARGUMENTS**

## Step 1: Derive Names and Properties

From the description above, determine:
- **Block name**: PascalCase display name (e.g., "Alert Banner")
- **Element type alias**: camelCase (e.g., `alertBanner`)
- **Partial filename**: matches the element type alias exactly (e.g., `alertBanner.cshtml`). Only include "Row" if "Row" is part of the element type name itself (e.g., "Rich Text Row" → `richTextRow.cshtml`)
- **Properties**: list each with its name, alias, and Umbraco property editor
  - Common editors: `Umbraco.RichText` (RTE), `Umbraco.DropDown` (dropdown), `Umbraco.TextBox` (text), `Umbraco.MediaPicker3` (media), `Umbraco.TrueFalse` (toggle)

State the names and properties clearly before proceeding.

## Step 2: Write the E2E Test First

Create `tests/e2e/blocks/[elementTypeAlias].spec.ts`.

The test verifies:
1. The element type exists in Umbraco with `isElement: true`
2. It has all the expected property aliases

This test MUST FAIL at this point — the element type doesn't exist yet.

```typescript
import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';

const elementTypeName = '[Block Name]';
const expectedAliases = ['alias1', 'alias2'];

test('[Block Name] element type exists with correct properties', async ({ umbracoApi }) => {
  const elementType = await umbracoApi.documentType.getByName(elementTypeName);

  // getByName returns false (not null) when not found
  expect(elementType).toBeTruthy();
  expect(elementType.isElement).toBe(true);

  // Umbraco 17 API returns a flat properties array (not nested in groups)
  const aliases = (elementType.properties ?? []).map((p: any) => p.alias);

  for (const alias of expectedAliases) {
    expect(aliases).toContain(alias);
  }
});
```

### Run the test (expect RED)

```bash
PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/blocks/[elementTypeAlias].spec.ts
```

Confirm the test fails before moving on.

## Step 3: Create the Element Type in Umbraco

Use MCP tools to create the element type with:
- Name: [Block Name]
- Alias: [elementTypeAlias]
- `isElement: true`
- A property group (e.g., "Content") containing all properties

Use the Management API or MCP document-type tools. Verify the element type was created successfully.

## Step 4: Register in the Block List

The site's main block list data type is used on content pages. Use MCP to:
1. Find the main block list data type (likely named "Block List" or similar)
2. Add the new element type as an allowed block

If you need the block list data type ID, retrieve it via MCP tools.

## Step 5: Create the Razor Partial

Create `src/UmbracoProject/Views/Partials/blocklist/Components/[partialFilename]`.

Follow existing block conventions exactly:
- Model type: `IPublishedElement` (or the auto-generated typed model if available)
- Check `Hide` setting property if the block has a settings model
- Apply spacing classes via `SpacingHelper` if spacing properties exist
- Use Bootstrap classes for styling

Reference the existing blocks for patterns — especially [richTextRow.cshtml](src/UmbracoProject/Views/Partials/blocklist/Components/richTextRow.cshtml).

## Step 6: Build

```bash
cd src/UmbracoProject && dotnet build
```

Fix any build errors before proceeding.

## Step 7: Run the Test Again (expect GREEN)

```bash
PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/blocks/[elementTypeAlias].spec.ts
```

All tests must pass. If any fail, diagnose and fix before marking complete.

## Conventions

- All new blocks follow spacing + hide conventions of existing blocks
- Property aliases are camelCase
- Partial filenames are `[alias].cshtml` — matches the element type alias exactly (no "Row" suffix unless the element type name itself includes "Row")
- For rich text properties, add `@using Umbraco.Cms.Core.Strings` — `IHtmlEncodedString` is not in `_ViewImports.cshtml`
- Bootstrap 5 classes for styling (no custom CSS unless necessary)
- Do not modify `.uda` files manually — they are managed by Umbraco Deploy
