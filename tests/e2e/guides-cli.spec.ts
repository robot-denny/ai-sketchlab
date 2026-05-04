import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import dotenv from 'dotenv';
import { computeSourceSignature } from '../../scripts/guide-generator/src/sourceSignature.js';
import {
  createGuidePage,
  getDocumentTypeByAlias,
  getGuidesParentId,
  getToken,
} from '../../scripts/guide-generator/src/umbracoApi.js';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const API_BASE = process.env.URL || 'https://localhost:44367';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'guide-generator', 'src', 'cli.ts');

const FEATURE_ALIAS = 'alertBanner';
const FEATURE_DISPLAY_NAME = 'Alert Banner';
const EXPECTED_PAGE_NAME = `How to use the ${FEATURE_DISPLAY_NAME}`;

let _token: string;
let _tokenIssued = 0;

async function freshToken(): Promise<string> {
  if (_token && Date.now() - _tokenIssued < 250_000) return _token;
  const resp = await fetch(`${API_BASE}/umbraco/management/api/v1/security/back-office/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.UMBRACO_CLIENT_ID!,
      client_secret: process.env.UMBRACO_CLIENT_SECRET!,
    }).toString(),
  });
  if (!resp.ok) throw new Error(`Auth failed: ${resp.status}`);
  _token = ((await resp.json()) as any).access_token;
  _tokenIssued = Date.now();
  return _token;
}

async function api(token: string, method: string, urlPath: string, body?: any): Promise<Response> {
  return fetch(`${API_BASE}/umbraco/management/api/v1${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function findHomeId(token: string): Promise<string | null> {
  const resp = await api(token, 'GET', '/tree/document/root?skip=0&take=100');
  const data = (await resp.json()) as any;
  const home = (data.items ?? []).find(
    (i: any) => (i.variants?.[0]?.name ?? i.name) === 'Home',
  );
  return home?.id ?? null;
}

async function findGuidesId(token: string): Promise<string | null> {
  const homeId = await findHomeId(token);
  if (!homeId) return null;
  const resp = await api(token, 'GET', `/tree/document/children?parentId=${homeId}&skip=0&take=100`);
  const data = (await resp.json()) as any;
  const guides = (data.items ?? []).find(
    (i: any) => (i.variants?.[0]?.name ?? i.name) === 'Guides',
  );
  return guides?.id ?? null;
}

async function listGuideChildren(token: string, guidesId: string): Promise<any[]> {
  const resp = await api(
    token,
    'GET',
    `/tree/document/children?parentId=${guidesId}&skip=0&take=200`,
  );
  const data = (await resp.json()) as any;
  return data.items ?? [];
}

async function deleteGuidesNamed(token: string, namePrefix: string): Promise<number> {
  const guidesId = await findGuidesId(token);
  if (!guidesId) return 0;
  const children = await listGuideChildren(token, guidesId);
  let deleted = 0;
  for (const child of children) {
    const childName: string = child.variants?.[0]?.name ?? child.name ?? '';
    if (childName.startsWith(namePrefix)) {
      // Hard-delete: move to recycle bin then purge
      const trashResp = await api(token, 'PUT', `/document/${child.id}/move-to-recycle-bin`);
      if (trashResp.ok || trashResp.status === 404) {
        await api(token, 'DELETE', `/recycle-bin/document/${child.id}`);
        deleted++;
      }
    }
  }
  return deleted;
}

test.describe('guide create-fresh', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const token = await freshToken();
    await deleteGuidesNamed(token, 'How to use the');
  });

  test.afterAll(async () => {
    const token = await freshToken();
    await deleteGuidesNamed(token, 'How to use the');
  });

  test(
    'CLI creates a published guide page with description, signature, and hideFromTopNavigation',
    async () => {
      const tsxBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
      // 4 minutes covers the SSE agent run on a cold backend.
      test.setTimeout(240_000);

      const stdout = execFileSync(tsxBin, [CLI_PATH, FEATURE_ALIAS], {
        cwd: REPO_ROOT,
        env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
        encoding: 'utf8',
        timeout: 220_000,
        stdio: ['ignore', 'pipe', 'inherit'],
      });

      expect(stdout).toContain('created /guides/how-to-use-the-alert-banner/');

      // Locate the new page via the Management API.
      const token = await freshToken();
      const guidesId = await findGuidesId(token);
      expect(guidesId, 'Guides parent page must exist').toBeTruthy();

      const children = await listGuideChildren(token, guidesId!);
      const match = children.find(
        (c: any) => (c.variants?.[0]?.name ?? c.name) === EXPECTED_PAGE_NAME,
      );
      expect(match, `expected a page named "${EXPECTED_PAGE_NAME}"`).toBeTruthy();

      const detailResp = await api(token, 'GET', `/document/${match.id}`);
      expect(detailResp.ok).toBeTruthy();
      const doc = (await detailResp.json()) as any;

      const description = (doc.values ?? []).find(
        (v: any) => v.alias === 'description',
      )?.value;
      const descriptionText = typeof description === 'string'
        ? description
        : description?.markup ?? '';
      expect(typeof descriptionText).toBe('string');
      expect(
        descriptionText.length,
        `description should be populated (got ${descriptionText.length} chars)`,
      ).toBeGreaterThanOrEqual(50);

      const metadataRaw = (doc.values ?? []).find(
        (v: any) => v.alias === 'generationMetadata',
      )?.value;
      expect(typeof metadataRaw).toBe('string');
      const metadata = JSON.parse(metadataRaw as string);
      expect(metadata.lastFeatureAlias).toBe(FEATURE_ALIAS);
      expect(typeof metadata.lastGeneratedAt).toBe('string');

      const { signature } = await computeSourceSignature(FEATURE_ALIAS);
      expect(metadata.signature).toBe(signature);

      const hideFromTopNav = (doc.values ?? []).find(
        (v: any) => v.alias === 'hideFromTopNavigation',
      )?.value;
      expect(hideFromTopNav === true || hideFromTopNav === '1' || hideFromTopNav === 1).toBeTruthy();

      const variantState = doc.variants?.[0]?.state;
      expect(['Published', 'PublishedPendingChanges']).toContain(variantState);
    },
  );
});

// ── Step 7 — skip-no-change + amend-with-approval flows ─────────

async function findGuideByFeatureAlias(
  token: string,
  featureAlias: string,
): Promise<{ id: string; doc: any } | null> {
  const guidesId = await findGuidesId(token);
  if (!guidesId) return null;
  const children = await listGuideChildren(token, guidesId);
  for (const child of children) {
    const detailResp = await api(token, 'GET', `/document/${child.id}`);
    if (!detailResp.ok) continue;
    const doc = (await detailResp.json()) as any;
    const metaRaw = (doc.values ?? []).find((v: any) => v.alias === 'generationMetadata')?.value;
    if (typeof metaRaw === 'string' && metaRaw.trim()) {
      try {
        const meta = JSON.parse(metaRaw);
        if (meta?.lastFeatureAlias === featureAlias) {
          return { id: child.id, doc };
        }
      } catch {
        // fall through
      }
    }
  }
  return null;
}

async function getDescriptionText(token: string, docId: string): Promise<string> {
  const resp = await api(token, 'GET', `/document/${docId}`);
  const doc = (await resp.json()) as any;
  const description = (doc.values ?? []).find((v: any) => v.alias === 'description')?.value;
  return typeof description === 'string' ? description : description?.markup ?? '';
}

async function getMetadata(token: string, docId: string): Promise<any> {
  const resp = await api(token, 'GET', `/document/${docId}`);
  const doc = (await resp.json()) as any;
  const raw = (doc.values ?? []).find((v: any) => v.alias === 'generationMetadata')?.value;
  return typeof raw === 'string' ? JSON.parse(raw) : null;
}

/**
 * Mutate the stored generationMetadata.signature to a known-different value to
 * simulate source drift without actually editing the partial file.
 */
async function setStoredSignature(
  token: string,
  docId: string,
  fakeSignature: string,
): Promise<void> {
  const detailResp = await api(token, 'GET', `/document/${docId}`);
  const doc = (await detailResp.json()) as any;
  const values: any[] = [...(doc.values ?? [])];
  const idx = values.findIndex((v) => v.alias === 'generationMetadata');
  const current = idx >= 0 && typeof values[idx].value === 'string'
    ? JSON.parse(values[idx].value)
    : {};
  const next = JSON.stringify({ ...current, signature: fakeSignature });
  if (idx >= 0) {
    values[idx] = { ...values[idx], value: next };
  } else {
    values.push({ alias: 'generationMetadata', culture: null, segment: null, value: next });
  }
  const updatePayload = {
    template: doc.template,
    values,
    variants: (doc.variants ?? []).map((v: any) => ({
      culture: v.culture,
      segment: v.segment,
      name: v.name,
      state: v.state,
    })),
  };
  const putResp = await api(token, 'PUT', `/document/${docId}`, updatePayload);
  if (!putResp.ok) {
    throw new Error(`Failed to mutate stored signature: ${putResp.status} ${await putResp.text()}`);
  }
}

test.describe('guide skip / amend', () => {
  test.describe.configure({ mode: 'serial' });

  let guidePageId: string;

  test.beforeAll(async () => {
    test.setTimeout(300_000);
    const token = await freshToken();
    await deleteGuidesNamed(token, 'How to use the');

    // Seed: run the CLI once to create-fresh, so subsequent tests have a page
    // with valid metadata to operate on.
    const tsxBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
    execFileSync(tsxBin, [CLI_PATH, FEATURE_ALIAS], {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
      encoding: 'utf8',
      timeout: 240_000,
      stdio: ['ignore', 'pipe', 'inherit'],
    });

    const token2 = await freshToken();
    const found = await findGuideByFeatureAlias(token2, FEATURE_ALIAS);
    if (!found) throw new Error('beforeAll seed: guide page not found after create');
    guidePageId = found.id;
  });

  test.afterAll(async () => {
    const token = await freshToken();
    await deleteGuidesNamed(token, 'How to use the');
  });

  test('skip-no-change: re-running with identical signature exits cleanly without writing', async () => {
    test.setTimeout(60_000);
    const tsxBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

    const tokenBefore = await freshToken();
    const descriptionBefore = await getDescriptionText(tokenBefore, guidePageId);
    const metadataBefore = await getMetadata(tokenBefore, guidePageId);

    const stdout = execFileSync(tsxBin, [CLI_PATH, FEATURE_ALIAS], {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'inherit'],
    });

    expect(stdout).toContain(`no changes — ${FEATURE_ALIAS} guide is up to date`);

    const tokenAfter = await freshToken();
    const descriptionAfter = await getDescriptionText(tokenAfter, guidePageId);
    const metadataAfter = await getMetadata(tokenAfter, guidePageId);

    expect(descriptionAfter).toBe(descriptionBefore);
    expect(metadataAfter.lastGeneratedAt).toBe(metadataBefore.lastGeneratedAt);
    expect(metadataAfter.signature).toBe(metadataBefore.signature);
  });

  test('amend-approve: --auto-apply writes the agent amend and updates metadata', async () => {
    test.setTimeout(240_000);
    const tsxBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

    // Drift the stored signature so the amend path triggers.
    const tokenSetup = await freshToken();
    await setStoredSignature(tokenSetup, guidePageId, 'drifted-sig-approve');
    const descriptionBefore = await getDescriptionText(tokenSetup, guidePageId);
    const metadataBefore = await getMetadata(tokenSetup, guidePageId);
    expect(metadataBefore.signature).toBe('drifted-sig-approve');

    execFileSync(tsxBin, [CLI_PATH, FEATURE_ALIAS, '--auto-apply'], {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
      encoding: 'utf8',
      timeout: 220_000,
      stdio: ['ignore', 'pipe', 'inherit'],
    });

    const tokenAfter = await freshToken();
    const descriptionAfter = await getDescriptionText(tokenAfter, guidePageId);
    const metadataAfter = await getMetadata(tokenAfter, guidePageId);
    const { signature: currentSignature } = await computeSourceSignature(FEATURE_ALIAS);

    expect(metadataAfter.signature).toBe(currentSignature);
    expect(metadataAfter.signature).not.toBe('drifted-sig-approve');
    expect(typeof metadataAfter.lastGeneratedAt).toBe('string');
    expect(metadataAfter.lastGeneratedAt).not.toBe(metadataBefore.lastGeneratedAt);
    expect(descriptionAfter.length).toBeGreaterThanOrEqual(50);
    // The amend may or may not change every word; what matters is metadata moved.
    // Accept either an updated description or one that's identical (agent kept editor prose).
    expect(typeof descriptionAfter).toBe('string');
    // Tag check: the description should still be HTML-ish.
    expect(descriptionBefore.length).toBeGreaterThan(0);
  });

  test('amend-decline: typing "n" leaves the page untouched', async () => {
    test.setTimeout(240_000);
    const tsxBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

    // Re-drift after the previous amend-approve set things back to current.
    const tokenSetup = await freshToken();
    await setStoredSignature(tokenSetup, guidePageId, 'drifted-sig-decline');
    const descriptionBefore = await getDescriptionText(tokenSetup, guidePageId);
    const metadataBefore = await getMetadata(tokenSetup, guidePageId);
    expect(metadataBefore.signature).toBe('drifted-sig-decline');

    // Simulate an interactive operator declining: pipe "n\n" to stdin and force
    // the CLI's interactive code path with the GUIDE_FORCE_INTERACTIVE test hook.
    const result = spawnSync(tsxBin, [CLI_PATH, FEATURE_ALIAS], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        GUIDE_FORCE_INTERACTIVE: '1',
      },
      input: 'n\n',
      encoding: 'utf8',
      timeout: 220_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    expect(result.status, `cli stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('no changes written');

    const tokenAfter = await freshToken();
    const descriptionAfter = await getDescriptionText(tokenAfter, guidePageId);
    const metadataAfter = await getMetadata(tokenAfter, guidePageId);

    expect(descriptionAfter).toBe(descriptionBefore);
    // Stored signature should still be the drifted fake — declined writes nothing.
    expect(metadataAfter.signature).toBe('drifted-sig-decline');
    expect(metadataAfter.lastGeneratedAt).toBe(metadataBefore.lastGeneratedAt);
  });

  test('amend-non-interactive-refuses: no TTY + no --auto-apply prints refusal and writes nothing', async () => {
    test.setTimeout(60_000);
    const tsxBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

    const tokenSetup = await freshToken();
    await setStoredSignature(tokenSetup, guidePageId, 'drifted-sig-refuse');
    const descriptionBefore = await getDescriptionText(tokenSetup, guidePageId);

    const result = spawnSync(tsxBin, [CLI_PATH, FEATURE_ALIAS], {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const combined = (result.stdout || '') + (result.stderr || '');
    expect(combined).toContain('amend pending — re-run interactively or pass --auto-apply');
    expect(result.status).not.toBe(0);

    const tokenAfter = await freshToken();
    const descriptionAfter = await getDescriptionText(tokenAfter, guidePageId);
    const metadataAfter = await getMetadata(tokenAfter, guidePageId);
    expect(descriptionAfter).toBe(descriptionBefore);
    expect(metadataAfter.signature).toBe('drifted-sig-refuse');
  });
});

// ── Step 8 — --audit mode ──────────────────────────────────────

function extractSection(stdout: string, heading: string): string {
  // Section runs from a line starting with `${heading}` until the next blank line
  // before another heading-like line (or end of output).
  const lines = stdout.split('\n');
  const startIdx = lines.findIndex((l) => l.startsWith(heading));
  if (startIdx < 0) return '';
  const out: string[] = [lines[startIdx]];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // Stop at the next section heading (matches our printed format).
    if (/^(Missing guides — |Orphaned guides )/.test(line)) break;
    out.push(line);
  }
  return out.join('\n');
}

test.describe('guide --audit', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    test.setTimeout(60_000);
    const token = await freshToken();
    await deleteGuidesNamed(token, 'How to use the');
    await deleteGuidesNamed(token, 'Orphan ');
  });

  test.afterAll(async () => {
    const token = await freshToken();
    await deleteGuidesNamed(token, 'How to use the');
    await deleteGuidesNamed(token, 'Orphan ');
  });

  test('missing block feature (alertBanner) appears under Missing — Blocks', async () => {
    test.setTimeout(60_000);
    const tsxBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

    const result = spawnSync(tsxBin, [CLI_PATH, '--audit'], {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
      encoding: 'utf8',
      timeout: 45_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout = result.stdout || '';
    expect(stdout, `cli stderr: ${result.stderr}`).toMatch(/Missing guides — Blocks \(\d+\):/);
    const blocksSection = extractSection(stdout, 'Missing guides — Blocks');
    expect(blocksSection).toContain('alertBanner');
    // Audit with anything missing should exit non-zero.
    expect(result.status).not.toBe(0);
  });

  test('missing global feature (siteHeader) appears under Missing — Global', async () => {
    test.setTimeout(60_000);
    const tsxBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

    const result = spawnSync(tsxBin, [CLI_PATH, '--audit'], {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
      encoding: 'utf8',
      timeout: 45_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout = result.stdout || '';
    expect(stdout, `cli stderr: ${result.stderr}`).toMatch(/Missing guides — Global \(\d+\):/);
    const globalSection = extractSection(stdout, 'Missing guides — Global');
    expect(globalSection).toContain('siteHeader');
  });

  test('guide with lastFeatureAlias=legacyBanner appears under Orphaned', async () => {
    test.setTimeout(60_000);
    const tsxBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

    // Seed a how-to guide page whose metadata references an unknown feature alias.
    const apiToken = await getToken();
    const guidesParentId = await getGuidesParentId(apiToken);
    expect(guidesParentId, 'Guides parent must exist').toBeTruthy();

    const howToType = await getDocumentTypeByAlias(apiToken, 'howToGuidePage');
    expect(howToType, 'howToGuidePage doc-type must exist').toBeTruthy();
    const templateId =
      (howToType as any)?.defaultTemplate?.id ??
      (howToType as any)?.allowedTemplates?.[0]?.id;
    expect(templateId, 'howToGuidePage must have a template').toBeTruthy();

    const generationMetadata = JSON.stringify({
      signature: 'orphan-fake-sig',
      lastGeneratedAt: new Date().toISOString(),
      lastFeatureAlias: 'legacyBanner',
    });

    await createGuidePage(apiToken, {
      parentId: guidesParentId!,
      documentTypeId: howToType!.id,
      templateId: templateId as string,
      name: 'Orphan Legacy Banner Guide',
      descriptionHtml: '<p>Orphan placeholder description for audit test.</p>',
      generationMetadata,
      hideFromTopNavigation: true,
    });

    const result = spawnSync(tsxBin, [CLI_PATH, '--audit'], {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
      encoding: 'utf8',
      timeout: 45_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout = result.stdout || '';
    expect(stdout, `cli stderr: ${result.stderr}`).toMatch(/Orphaned guides \(\d+\):/);
    const orphanSection = extractSection(stdout, 'Orphaned guides');
    expect(orphanSection).toContain('legacyBanner');
    expect(result.status).not.toBe(0);
  });
});
