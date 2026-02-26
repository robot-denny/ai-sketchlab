import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';

const elementTypeName = 'Alert Banner';
// Note: 'level' and 'content' are reserved property aliases in Umbraco 17
const expectedPropertyAliases = ['alertLevel', 'alertContent'];

test('Alert Banner element type exists with correct properties', async ({ umbracoApi }) => {
  const elementType = await umbracoApi.documentType.getByName(elementTypeName);

  // getByName returns false (not null) when not found
  expect(elementType, `Element type "${elementTypeName}" should exist`).toBeTruthy();
  expect(elementType.isElement, 'Should be an element type (not a page type)').toBe(true);

  // Umbraco 17 Management API returns a flat properties array (not nested in groups)
  const aliases = (elementType.properties ?? []).map((p: any) => p.alias);

  for (const alias of expectedPropertyAliases) {
    expect(aliases, `Should have a "${alias}" property`).toContain(alias);
  }
});

test('Alert Banner partial view exists at the correct path', async ({ umbracoApi }) => {
  // The blocklist renderer resolves partials by element type alias:
  //   "blocklist/Components/" + contentType.Alias
  // Element type "Alert Banner" → alias "alertBanner" → expects alertBanner.cshtml
  // This test catches the naming mismatch that causes a 500 on the front end.
  const elementType = await umbracoApi.documentType.getByName(elementTypeName);
  expect(elementType).toBeTruthy();

  const alias = elementType.alias as string;
  const expectedFileName = `${alias}.cshtml`;
  const fs = await import('fs');
  const path = await import('path');

  const partialPath = path.resolve(
    __dirname,
    '../../../src/UmbracoProject/Views/Partials/blocklist/Components',
    expectedFileName
  );

  expect(
    fs.existsSync(partialPath),
    `Partial view "${expectedFileName}" must exist at Views/Partials/blocklist/Components/ — ` +
    `the blocklist renderer maps element type alias directly to the file name`
  ).toBe(true);
});
