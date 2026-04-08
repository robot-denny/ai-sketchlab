/**
 * Reads palette configuration from the Umbraco "Image Generator Settings" document.
 * Parses the Management API document response into a PaletteConfig.
 */

import type { RGBColor, Palette, PaletteConfig } from './types.js';
import { DEFAULT_PALETTE } from './palette.js';

/**
 * Convert a hex color string like "#008cc8" to an RGB tuple [0, 140, 200].
 * Throws on invalid input to surface bad CMS data immediately.
 */
export function hexToRgb(hex: string): RGBColor {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Parse an Umbraco Management API document response for "Image Generator Settings"
 * into a PaletteConfig. Returns hardcoded defaults if the document is null/undefined.
 */
export function parsePaletteFromDocument(doc: any): PaletteConfig {
  if (!doc) {
    return { entries: {}, default: DEFAULT_PALETTE };
  }

  const values = doc.values ?? [];
  const getValue = (alias: string) => values.find((v: any) => v.alias === alias)?.value;

  // Parse default palette from Eye Dropper properties
  const defaultPrimary = getValue('defaultPrimary');
  const defaultMid = getValue('defaultMid');
  const defaultDeep = getValue('defaultDeep');

  const defaultPalette: Palette =
    defaultPrimary && defaultMid && defaultDeep
      ? [hexToRgb(defaultPrimary), hexToRgb(defaultMid), hexToRgb(defaultDeep)]
      : DEFAULT_PALETTE;

  // Parse category palette entries from Block List
  const blockListValue = getValue('categoryPalettes');
  const entries: Record<string, { name: string; colors: Palette }> = {};

  if (blockListValue?.contentData) {
    for (const block of blockListValue.contentData) {
      const blockValues = block.values ?? [];
      const getBlockValue = (alias: string) => blockValues.find((v: any) => v.alias === alias)?.value;

      // Category picker value: [{ type: "document", unique: "uuid" }]
      const categoryPickerValue = getBlockValue('paletteCategory');
      const categoryId = Array.isArray(categoryPickerValue) && categoryPickerValue.length > 0
        ? categoryPickerValue[0].unique
        : null;

      if (!categoryId) continue;

      const primary = getBlockValue('palettePrimary');
      const mid = getBlockValue('paletteMid');
      const deep = getBlockValue('paletteDeep');

      if (primary && mid && deep) {
        entries[categoryId] = {
          name: '', // Names come from the CMS category nodes, not stored on the palette entry
          colors: [hexToRgb(primary), hexToRgb(mid), hexToRgb(deep)],
        };
      }
    }
  }

  return { entries, default: defaultPalette };
}

/**
 * Fetch palette configuration from the live Umbraco instance.
 * Walks the content tree: Home → Site Settings → Image Generator Settings.
 * Falls back to defaults if the settings document is missing or unpublished.
 */
export async function fetchPaletteConfigFromApi(token: string): Promise<PaletteConfig> {
  const { request } = await import('./umbraco-api.js');

  function assertOk(res: { status: number; body: string }, label: string) {
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`API returned ${res.status} for ${label}`);
    }
  }

  // Find Home
  const rootRes = await request('GET', '/umbraco/management/api/v1/tree/document/root?skip=0&take=100', null, token);
  assertOk(rootRes, 'document root');
  const rootItems = JSON.parse(rootRes.body).items;
  const home = rootItems.find((i: any) => i.variants?.[0]?.name === 'Home');
  if (!home) return { entries: {}, default: DEFAULT_PALETTE };

  // Find Site Settings under Home
  const homeChildrenRes = await request(
    'GET',
    `/umbraco/management/api/v1/tree/document/children?parentId=${home.id}&skip=0&take=100`,
    null,
    token,
  );
  assertOk(homeChildrenRes, 'Home children');
  const homeChildren = JSON.parse(homeChildrenRes.body).items;
  const siteSettings = homeChildren.find((i: any) => i.variants?.[0]?.name === 'Site Settings');
  if (!siteSettings) return { entries: {}, default: DEFAULT_PALETTE };

  // Find Image Generator Settings under Site Settings
  const settingsChildrenRes = await request(
    'GET',
    `/umbraco/management/api/v1/tree/document/children?parentId=${siteSettings.id}&skip=0&take=100`,
    null,
    token,
  );
  assertOk(settingsChildrenRes, 'Site Settings children');
  const settingsChildren = JSON.parse(settingsChildrenRes.body).items;
  const imgGenSettings = settingsChildren.find((i: any) =>
    i.variants?.[0]?.name === 'Image Generator Settings',
  );
  if (!imgGenSettings) return { entries: {}, default: DEFAULT_PALETTE };

  // Fetch the full document
  const docRes = await request(
    'GET',
    `/umbraco/management/api/v1/document/${imgGenSettings.id}`,
    null,
    token,
  );
  assertOk(docRes, 'Image Generator Settings document');
  const doc = JSON.parse(docRes.body);

  return parsePaletteFromDocument(doc);
}
