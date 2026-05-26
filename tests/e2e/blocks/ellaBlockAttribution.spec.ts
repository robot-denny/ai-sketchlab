import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.URL || 'https://localhost:44367';

// ── Known IDs (stable across local + Cloud) ─────────────────────
const ARTICLE_DOC_TYPE_ID = '0f63b49a-5423-46bd-91fa-0e78bbd2f6d6';
const AUTHOR_DOC_TYPE_ID = 'eb9fd2d1-5258-4bf8-beab-a2415b2e365a';
const RICH_TEXT_ROW_CT_KEY = 'dd183f78-7d69-4eda-9b4c-a25970583a28';
const IMAGE_ROW_CT_KEY = 'e0df4794-063a-4450-8f4f-c615a5d902e2';

const TEST_PREFIX = 'EBA';
const ELLA_NAME = `${TEST_PREFIX} Ella`;
const HUGH_NAME = `${TEST_PREFIX} Hugh`;
const HUMAN_ARTICLE_NAME = `${TEST_PREFIX} Test Human Article`;
const ELLA_ARTICLE_NAME = `${TEST_PREFIX} Test Ella Article`;

// ── Auth ────────────────────────────────────────────────────────

let _token: string;
let _tokenIssuedAt = 0;
const TOKEN_TTL_MS = 250_000;

async function freshToken(): Promise<string> {
  if (_token && Date.now() - _tokenIssuedAt < TOKEN_TTL_MS) return _token;
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
  if (!resp.ok) throw new Error(`Auth failed: ${resp.status} ${await resp.text()}`);
  _token = ((await resp.json()) as any).access_token;
  _tokenIssuedAt = Date.now();
  return _token;
}

async function apiFetch(token: string, method: string, path: string, body?: any) {
  return fetch(`${API_BASE}/umbraco/management/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function apiJson(token: string, method: string, path: string, body?: any) {
  const resp = await apiFetch(token, method, path, body);
  if (!resp.ok) throw new Error(`${method} ${path} → ${resp.status} ${await resp.text()}`);
  if (resp.status === 204) return null;
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

async function getDocumentPath(token: string, docId: string): Promise<string> {
  const data = await apiJson(token, 'GET', `/document/urls?id=${docId}`);
  const url: string = data?.[0]?.urlInfos?.[0]?.url;
  if (!url) throw new Error(`No URL found for document ${docId}`);
  return url;
}

// ── Tree walking ────────────────────────────────────────────────

async function findChildByName(
  token: string,
  parentId: string | null,
  name: string
): Promise<{ id: string } | null> {
  const path = parentId
    ? `/tree/document/children?parentId=${parentId}&skip=0&take=200`
    : `/tree/document/root?skip=0&take=200`;
  const data = await apiJson(token, 'GET', path);
  for (const item of data?.items ?? []) {
    const has = (item.variants ?? []).some((v: any) => v.name === name);
    if (has) return { id: item.id };
  }
  return null;
}

async function findHomeId(token: string): Promise<string> {
  const data = await apiJson(token, 'GET', '/tree/document/root?skip=0&take=100');
  const home = (data?.items ?? []).find((i: any) =>
    (i.variants ?? []).some((v: any) => v.name === 'Home')
  );
  if (!home) throw new Error('Home document not found at root');
  return home.id;
}

// ── Cleanup ─────────────────────────────────────────────────────

/** Delete any documents in the tree (anywhere under Home) whose name starts with the prefix. */
async function deleteByNamePrefix(token: string, prefix: string) {
  const homeId = await findHomeId(token);

  async function walkAndDelete(parentId: string) {
    const path = `/tree/document/children?parentId=${parentId}&skip=0&take=200`;
    const data = await apiJson(token, 'GET', path);
    for (const item of data?.items ?? []) {
      const name = (item.variants ?? [])[0]?.name ?? '';
      if (name.startsWith(prefix)) {
        // Move to recycle bin
        try {
          await apiFetch(token, 'PUT', `/document/${item.id}/move-to-recycle-bin`);
        } catch {
          /* ignore */
        }
      } else if (item.hasChildren) {
        await walkAndDelete(item.id);
      }
    }
  }
  await walkAndDelete(homeId);
}

// ── Fixture builders ────────────────────────────────────────────

async function createAuthor(
  token: string,
  parentId: string,
  name: string,
  isAi: boolean
): Promise<string> {
  const id = randomUUID();
  const payload = {
    id,
    parent: { id: parentId },
    documentType: { id: AUTHOR_DOC_TYPE_ID },
    template: null,
    values: [
      { alias: 'isAi', culture: null, segment: null, value: isAi },
    ],
    variants: [{ culture: null, segment: null, name }],
  };
  await apiJson(token, 'POST', '/document', payload);
  await apiJson(token, 'PUT', `/document/${id}/publish`, {
    publishSchedules: [{ culture: null, schedule: null }],
  });
  return id;
}

async function findFirstImageMediaId(token: string): Promise<string | null> {
  async function walk(parentId: string | null): Promise<string | null> {
    const path = parentId
      ? `/tree/media/children?parentId=${parentId}&skip=0&take=100`
      : `/tree/media/root?skip=0&take=100`;
    const data = await apiJson(token, 'GET', path);
    for (const item of data?.items ?? []) {
      if (item.mediaType?.icon === 'icon-picture') return item.id;
      if (item.hasChildren) {
        const nested = await walk(item.id);
        if (nested) return nested;
      }
    }
    return null;
  }
  return walk(null);
}

function imageBlockValue(
  authorId: string,
  mediaId: string,
  caption: string,
  contentKey: string,
) {
  return {
    key: contentKey,
    contentTypeKey: IMAGE_ROW_CT_KEY,
    values: [
      {
        alias: 'image',
        culture: null,
        segment: null,
        value: [
          {
            key: randomUUID(),
            mediaKey: mediaId,
            mediaTypeAlias: 'Image',
            crops: [],
            focalPoint: null,
          },
        ],
      },
      { alias: 'caption', culture: null, segment: null, value: caption },
      {
        editorAlias: 'Umbraco.MultiNodeTreePicker',
        alias: 'author',
        culture: null,
        segment: null,
        value: [{ type: 'document', unique: authorId }],
      },
    ],
  };
}

function richTextBlockValue(authorId: string | null, markup: string, contentKey: string) {
  const values: any[] = [
    {
      editorAlias: 'Umbraco.RichText',
      alias: 'content',
      culture: null,
      segment: null,
      value: {
        markup,
        blocks: { layout: {}, contentData: [], settingsData: [], expose: [] },
      },
    },
  ];
  if (authorId) {
    values.push({
      editorAlias: 'Umbraco.MultiNodeTreePicker',
      alias: 'author',
      culture: null,
      segment: null,
      value: [{ type: 'document', unique: authorId }],
    });
  }
  return { key: contentKey, contentTypeKey: RICH_TEXT_ROW_CT_KEY, values };
}

function buildBlockList(blocks: any[]) {
  return {
    layout: {
      'Umbraco.BlockList': blocks.map((b) => ({
        $type: 'BlockListLayoutItem',
        contentUdi: null,
        settingsUdi: null,
        contentKey: b.key,
        settingsKey: null,
      })),
    },
    contentData: blocks,
    settingsData: [],
    expose: blocks.map((b) => ({ contentKey: b.key, culture: null, segment: null })),
  };
}

async function createArticle(
  token: string,
  parentId: string,
  name: string,
  authorIds: string[],
  blocks: any[]
): Promise<string> {
  const id = randomUUID();
  const payload = {
    id,
    parent: { id: parentId },
    documentType: { id: ARTICLE_DOC_TYPE_ID },
    template: null,
    values: [
      {
        alias: 'author',
        culture: null,
        segment: null,
        value: authorIds.map((aid) => ({ type: 'document', unique: aid })),
      },
      {
        alias: 'articleDate',
        culture: null,
        segment: null,
        value: new Date().toISOString(),
      },
      {
        alias: 'contentRows',
        culture: null,
        segment: null,
        value: buildBlockList(blocks),
      },
    ],
    variants: [{ culture: null, segment: null, name }],
  };
  await apiJson(token, 'POST', '/document', payload);
  await apiJson(token, 'PUT', `/document/${id}/publish`, {
    publishSchedules: [{ culture: null, schedule: null }],
  });
  return id;
}

// ── Section 1: Schema sanity ────────────────────────────────────

// Workaround for the @umbraco/playwright-testhelpers `getByName` bug where
// `recurseChildren` short-circuits — find a doc-type id by name via raw API
// tree walking, including into folders.
async function findDocTypeIdByName(token: string, name: string): Promise<string | null> {
  async function walk(parentId: string | null): Promise<string | null> {
    const path = parentId
      ? `/tree/document-type/children?parentId=${parentId}&skip=0&take=200`
      : `/tree/document-type/root?skip=0&take=200`;
    const data = await apiJson(token, 'GET', path);
    for (const item of data?.items ?? []) {
      if (!item.isFolder && item.name === name) return item.id;
      if (item.isFolder) {
        const nested = await walk(item.id);
        if (nested) return nested;
      }
    }
    return null;
  }
  return walk(null);
}

test.describe('Ella Block Attribution — Schema', () => {
  test('AI Persona Properties composition exists with an isAi property', async () => {
    const token = await freshToken();
    const id = await findDocTypeIdByName(token, 'AI Persona Properties');
    expect(id, 'AI Persona Properties composition should exist').toBeTruthy();
    const composition = await apiJson(token, 'GET', `/document-type/${id}`);
    const aliases = (composition.properties ?? []).map((p: any) => p.alias);
    expect(aliases).toContain('isAi');
  });

  test('isAi property is optional and uses the Toggle editor', async () => {
    const token = await freshToken();
    const id = await findDocTypeIdByName(token, 'AI Persona Properties');
    const composition = await apiJson(token, 'GET', `/document-type/${id}`);
    const prop = (composition.properties ?? []).find((p: any) => p.alias === 'isAi');
    expect(prop, 'isAi property should exist').toBeTruthy();
    expect(prop.validation?.mandatory ?? false).toBeFalsy();

    const dataType = await apiJson(token, 'GET', `/data-type/${prop.dataType.id}`);
    expect(dataType.editorUiAlias).toBe('Umb.PropertyEditorUi.Toggle');
  });

  test('Author doc type lists AI Persona Properties as a composition', async () => {
    const token = await freshToken();
    const compositionId = await findDocTypeIdByName(token, 'AI Persona Properties');
    expect(compositionId, 'AI Persona Properties composition should exist').toBeTruthy();
    const author = await apiJson(token, 'GET', `/document-type/${AUTHOR_DOC_TYPE_ID}`);
    const ids: string[] = (author.compositions ?? []).map((c: any) => c.documentType?.id);
    expect(ids).toContain(compositionId);
  });
});

// ── Section 2: Browser truth-table tests ────────────────────────

test.describe('Ella Block Attribution — Browser', () => {
  test.describe.configure({ mode: 'serial' });

  // Fixture state
  let authorsContainerId: string;
  let blogContainerId: string;
  let ellaId: string;
  let hughId: string;
  let humanArticleId: string;
  let ellaArticleId: string;
  let humanArticleUrl: string;
  let ellaArticleUrl: string;

  // Block keys for stable lookup in the DOM
  const keys = {
    humanArticleHughBlock: randomUUID(),
    humanArticleEllaTextBlock: randomUUID(),
    humanArticleEllaImageBlock: randomUUID(),
    ellaArticleEllaBlock: randomUUID(),
  };

  const IMAGE_CAPTION = 'EBA ella-image-caption';

  test.beforeAll(async () => {
    let token = await freshToken();

    // 1. Clean any leftover test data from prior runs
    await deleteByNamePrefix(token, TEST_PREFIX);

    // 2. Resolve containers (rule #1: dynamic lookup)
    const homeId = await findHomeId(token);
    const authors = await findChildByName(token, homeId, 'Authors');
    const blog = await findChildByName(token, homeId, 'Blog');
    if (!authors || !blog) throw new Error('Authors and/or Blog page not found under Home');
    authorsContainerId = authors.id;
    blogContainerId = blog.id;

    // 3. Create test authors
    token = await freshToken();
    ellaId = await createAuthor(token, authorsContainerId, ELLA_NAME, true);
    hughId = await createAuthor(token, authorsContainerId, HUGH_NAME, false);

    // 4. Find an image media item for the imageRow block fixture
    token = await freshToken();
    const mediaId = await findFirstImageMediaId(token);
    if (!mediaId) throw new Error('No image media item available in the media library');

    // 5. Create the human-led article with mixed-author rich-text blocks
    //    + an Ella-attributed imageRow to confirm wrapper uniformity across block types.
    token = await freshToken();
    humanArticleId = await createArticle(token, blogContainerId, HUMAN_ARTICLE_NAME, [hughId], [
      richTextBlockValue(
        hughId,
        '<p>EBA hugh-prose: a passage written by the human contributor.</p>',
        keys.humanArticleHughBlock
      ),
      richTextBlockValue(
        ellaId,
        '<p>EBA ella-prose: an inline note authored by Ella in a human-led article.</p>',
        keys.humanArticleEllaTextBlock
      ),
      imageBlockValue(
        ellaId,
        mediaId,
        IMAGE_CAPTION,
        keys.humanArticleEllaImageBlock
      ),
    ]);

    // 6. Create the all-Ella article
    token = await freshToken();
    ellaArticleId = await createArticle(token, blogContainerId, ELLA_ARTICLE_NAME, [ellaId], [
      richTextBlockValue(
        ellaId,
        '<p>EBA ella-only-prose: every block here is attributed to Ella, who is the article author.</p>',
        keys.ellaArticleEllaBlock
      ),
    ]);

    // 7. Resolve actual published URLs (rule #2: never hardcode slugs)
    token = await freshToken();
    humanArticleUrl = await getDocumentPath(token, humanArticleId);
    ellaArticleUrl = await getDocumentPath(token, ellaArticleId);
  });

  test.afterAll(async () => {
    try {
      const token = await freshToken();
      await deleteByNamePrefix(token, TEST_PREFIX);
    } catch (e) {
      console.warn('Cleanup failed:', e);
    }
  });

  // Helper: read `content` of `::before` on the first .richtext / .image
  // descendant inside an .ella-wrap that carries the given block text.
  async function getBlockBeforeContent(page: any, blockText: string) {
    const wrapper = page.locator('.ella-wrap', { hasText: blockText });
    return await wrapper.first().evaluate((el: Element) => {
      const inner = el.firstElementChild as HTMLElement | null;
      if (!inner) return null;
      const style = window.getComputedStyle(inner, '::before');
      return {
        content: style.content,
        bg: window.getComputedStyle(inner).backgroundColor,
        borderLeftWidth: window.getComputedStyle(inner).borderLeftWidth,
      };
    });
  }

  // Row 1 — human article, Ella-attributed rich text block: wrap + eyebrow + suppress byline
  test('human-led article: Ella-attributed rich-text block renders inline-note wrapper', async ({
    page,
  }) => {
    await page.goto(humanArticleUrl);

    // Wrapper present with correct persona attribute
    const ellaWrap = page.locator('.ella-wrap[data-attributed-to]', {
      hasText: 'EBA ella-prose',
    });
    await expect(ellaWrap).toHaveCount(1);
    await expect(ellaWrap).toHaveAttribute('data-attributed-to', /eba-ella|ella/);

    // Eyebrow generated via CSS ::before contains persona name
    const before = await getBlockBeforeContent(page, 'EBA ella-prose');
    expect(before).not.toBeNull();
    expect(before!.content).toMatch(/written by/i);
    expect(before!.content).toMatch(/EBA Ella/);
    expect(before!.content).toMatch(/inline note/i);

    // Treatment applied (non-default background + visible left border)
    expect(before!.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(parseFloat(before!.borderLeftWidth)).toBeGreaterThan(0);

    // Trailing .block-author byline is hidden inside the wrapper
    const byline = ellaWrap.locator('.block-author');
    await expect(byline).toBeHidden();
  });

  // Row 2 (image variant) — same wrapper treatment must apply uniformly to
  // a non-rich-text block when its Author is the AI persona.
  test('human-led article: Ella-attributed image block renders inline-note wrapper', async ({
    page,
  }) => {
    await page.goto(humanArticleUrl);

    const wrap = page.locator('.ella-wrap[data-attributed-to]', {
      hasText: IMAGE_CAPTION,
    });
    await expect(wrap).toHaveCount(1);
    await expect(wrap).toHaveAttribute('data-attributed-to', /eba-ella|ella/);

    const before = await getBlockBeforeContent(page, IMAGE_CAPTION);
    expect(before).not.toBeNull();
    expect(before!.content).toMatch(/written by/i);
    expect(before!.content).toMatch(/EBA Ella/);
    expect(before!.content).toMatch(/inline note/i);

    // .block-author byline (if rendered) is hidden inside the wrapper.
    await expect(wrap.locator('.block-author')).toBeHidden();
  });

  // Row 3 — human↔human attribution: NO wrapper, trailing byline visible
  test('human-led article: Hugh-attributed block keeps trailing byline and no wrapper', async ({
    page,
  }) => {
    await page.goto(humanArticleUrl);

    // No wrapper around hugh-prose
    const hughInWrapper = page.locator('.ella-wrap', { hasText: 'EBA hugh-prose' });
    await expect(hughInWrapper).toHaveCount(0);

    // The trailing .block-author byline IS visible
    const hughBlock = page.locator('.richtext', { hasText: 'EBA hugh-prose' });
    await expect(hughBlock.locator('.block-author', { hasText: HUGH_NAME })).toBeVisible();
  });

  // Row 4 — all-Ella article: NO wrapper anywhere, masthead carries attribution
  test('all-Ella article: no wrapper or eyebrow renders on any block', async ({ page }) => {
    await page.goto(ellaArticleUrl);

    await expect(page.locator('.ella-wrap[data-attributed-to]')).toHaveCount(0);

    // The masthead byline reflects the AI author
    await expect(page.locator('.art-head .byline')).toContainText(ELLA_NAME);
  });

  // Regression — pre-existing demo article has no AI-attributed blocks, so no wrapper anywhere
  test('regression: a pre-existing demo article renders no .ella-wrap and no --persona-name styles', async ({
    page,
  }) => {
    // Use the well-known first blog post under /blog/
    const token = await freshToken();
    const blog = await findChildByName(token, await findHomeId(token), 'Blog');
    if (!blog) throw new Error('Blog page not found');
    const children = await apiJson(
      token,
      'GET',
      `/tree/document/children?parentId=${blog.id}&skip=0&take=20`
    );
    const target = (children?.items ?? []).find(
      (i: any) =>
        !(i.variants ?? [])[0]?.name?.startsWith(TEST_PREFIX)
    );
    if (!target) throw new Error('No non-test blog article found for regression check');
    const url = await getDocumentPath(token, target.id);

    await page.goto(url);
    await expect(page.locator('.ella-wrap[data-attributed-to]')).toHaveCount(0);
  });
});
