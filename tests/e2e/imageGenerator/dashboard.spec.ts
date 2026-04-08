import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = process.env.URL || 'https://localhost:44367';
const PLUGIN_DIR = resolve(__dirname, '../../../src/HelloWorld/wwwroot/App_Plugins/HelloWorld');

// ==============================
// API Helpers
// ==============================

let _token: string;
let _tokenTimestamp = 0;
const TOKEN_TTL = 250_000;

async function freshToken(): Promise<string> {
  if (_token && Date.now() - _tokenTimestamp < TOKEN_TTL) return _token;
  const resp = await fetch(
    `${API_BASE}/umbraco/management/api/v1/security/back-office/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.UMBRACO_CLIENT_ID!,
        client_secret: process.env.UMBRACO_CLIENT_SECRET!,
      }).toString(),
    }
  );
  if (!resp.ok) throw new Error(`Auth failed: ${resp.status}`);
  _token = ((await resp.json()) as any).access_token;
  _tokenTimestamp = Date.now();
  return _token;
}

/**
 * Find and read the compiled dashboard element bundle.
 * The bundle filename contains a content hash (e.g., dashboard.element-CqTkmLTS.js).
 * We find the active one by checking which file is referenced from hello-world.js
 * as the `element:` import (not the old `js:` import).
 */
function readActiveDashboardBundle(): string {
  const entrypoint = readFileSync(resolve(PLUGIN_DIR, 'hello-world.js'), 'utf-8');
  // Match: element: () => import("./dashboard.element-HASH.js")
  const match = entrypoint.match(/element:\s*\(\)\s*=>\s*import\("\.\/dashboard\.element-([^"]+)\.js"\)/);
  if (!match) {
    throw new Error('Could not find active dashboard bundle reference in hello-world.js');
  }
  const bundleName = `dashboard.element-${match[1]}.js`;
  return readFileSync(resolve(PLUGIN_DIR, bundleName), 'utf-8');
}

/**
 * E2E tests for the Image Generator dashboard in the Settings section.
 *
 * The backoffice SPA requires an interactive user session (authorization code flow)
 * that cannot be established with OAuth client credentials. These tests verify
 * the compiled dashboard bundle and API endpoints instead.
 *
 * Verifies the dashboard is correctly structured after the palette storage migration:
 * - Palette editor has been removed (category colors managed in content tree)
 * - Info box directs editors to Image Generator Settings content node
 * - Single-article and batch generation controls are still present
 */
test.describe('Image Generator Dashboard', () => {
  let dashboardSource: string;

  test.beforeAll(() => {
    dashboardSource = readActiveDashboardBundle();
  });

  test('compiled bundle does NOT contain Category Colors palette editor', () => {
    // The old palette editor had a "Category Colors" headline — it should be gone
    expect(dashboardSource).not.toContain('Category Colors');
    // No color picker inputs should exist
    expect(dashboardSource).not.toMatch(/input\s*type\s*=\s*["']color["']/i);
  });

  test('compiled bundle contains Palette Settings info box mentioning Site Settings', () => {
    expect(dashboardSource).toMatch(/headline\s*=\s*["']Palette Settings["']/);
    expect(dashboardSource).toContain('Site Settings');
    expect(dashboardSource).toContain('Image Generator Settings');
  });

  test('compiled bundle contains single-article generation controls', () => {
    expect(dashboardSource).toMatch(/headline\s*=\s*["']Generate for Article["']/);
    // Article select dropdown
    expect(dashboardSource).toContain('uui-select');
    // Generate button
    expect(dashboardSource).toContain('Generate Image');
    // Force regenerate toggle
    expect(dashboardSource).toContain('uui-toggle');
    expect(dashboardSource).toContain('Force regenerate');
  });

  test('compiled bundle contains batch generation controls', () => {
    expect(dashboardSource).toMatch(/headline\s*=\s*["']Batch Generation["']/);
    expect(dashboardSource).toContain('Generate Missing');
    expect(dashboardSource).toContain('Regenerate All');
  });

  test('articles API endpoint returns data', async () => {
    const token = await freshToken();
    const resp = await fetch(`${API_BASE}/umbraco/api/image-generator/articles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok).toBeTruthy();
    const articles = await resp.json();
    expect(Array.isArray(articles)).toBeTruthy();
    expect(articles.length).toBeGreaterThan(0);
  });

  test('palettes API endpoint returns CMS-sourced config', async () => {
    const token = await freshToken();
    const resp = await fetch(`${API_BASE}/umbraco/api/image-generator/palettes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok).toBeTruthy();
    const config = (await resp.json()) as { entries: Record<string, unknown>; default: number[][] };
    // Should have default palette with 3 RGB colors
    expect(config.default).toHaveLength(3);
    for (const color of config.default) {
      expect(color).toHaveLength(3);
    }
    // Entries should be an object (may have 0+ category entries)
    expect(typeof config.entries).toBe('object');
  });
});
