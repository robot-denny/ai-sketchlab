#!/usr/bin/env tsx
/**
 * `guide-generator` CLI.
 *
 * - Step 6: create-fresh path (no existing guide page for the feature).
 * - Step 7: skip-no-change + amend-with-approval paths (existing guide page).
 *
 * Usage:
 *   tsx scripts/guide-generator/src/cli.ts <feature-alias>
 *   tsx scripts/guide-generator/src/cli.ts <feature-alias> --auto-apply
 *   tsx scripts/guide-generator/src/cli.ts <feature-alias> --dry-run
 *   tsx scripts/guide-generator/src/cli.ts --audit              (Step 8)
 */

import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import {
  createGuidePage,
  findGuidePageByFeatureAlias,
  getDocumentTypeByAlias,
  getGuidesParentId,
  getToken,
  publishDocument,
  request,
  updateGuidePage,
} from './umbracoApi.js';
import { computeSourceSignature } from './sourceSignature.js';
import { runAgent } from './agentClient.js';
import { generateAmendPrompt, generatePrompt } from './prompts.js';
import { unifiedColoredDiff } from './diff.js';
import { listFeatures, type Feature } from './features.js';

// ── Arg parsing ────────────────────────────────────────────────

interface CliArgs {
  featureAlias?: string;
  audit: boolean;
  autoApply: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { audit: false, autoApply: false, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--audit':
        args.audit = true;
        break;
      case '--auto-apply':
        args.autoApply = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
      default:
        if (a.startsWith('--')) {
          console.error(`unknown flag: ${a}`);
          process.exit(2);
        }
        if (!args.featureAlias) args.featureAlias = a;
        else {
          console.error(`unexpected positional argument: ${a}`);
          process.exit(2);
        }
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`Usage:
  tsx scripts/guide-generator/src/cli.ts <feature-alias>
  tsx scripts/guide-generator/src/cli.ts <feature-alias> --dry-run
  tsx scripts/guide-generator/src/cli.ts --audit
  tsx scripts/guide-generator/src/cli.ts --auto-apply <feature-alias>
`);
}

// ── Display helpers ────────────────────────────────────────────

function toDisplayName(featureAlias: string): string {
  // Convert camelCase → "Camel Case", capitalize first letter.
  const spaced = featureAlias
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Block-list seed builders ───────────────────────────────────

interface SeedSectionRowsInput {
  /** Element-type id for the documented block (contentTypeKey). */
  blockContentTypeKey: string;
  /** Element-type id for `contentSectionRow`. */
  sectionRowContentTypeKey: string;
  /** Element-type id for `contentSectionRowSettings`. */
  sectionRowSettingsTypeKey: string;
  /** Optional initial values to set on the seeded inner block (e.g. mandatory props). */
  blockValues?: Array<{ alias: string; value: unknown; editorAlias?: string }>;
}

function buildSectionRowsSeed(input: SeedSectionRowsInput): unknown {
  const innerBlockKey = randomUUID();
  const sectionRowKey = randomUUID();
  const sectionRowSettingsKey = randomUUID();

  const innerValues = (input.blockValues ?? []).map((v) => ({
    editorAlias: v.editorAlias ?? null,
    culture: null,
    segment: null,
    alias: v.alias,
    value: v.value,
  }));

  const sectionContentBlockList = {
    layout: {
      'Umbraco.BlockList': [
        {
          $type: 'BlockListLayoutItem',
          contentUdi: null,
          settingsUdi: null,
          contentKey: innerBlockKey,
          settingsKey: null,
        },
      ],
    },
    contentData: [
      {
        contentTypeKey: input.blockContentTypeKey,
        key: innerBlockKey,
        values: innerValues,
      },
    ],
    settingsData: [],
    expose: [{ contentKey: innerBlockKey, culture: null, segment: null }],
  };

  return {
    layout: {
      'Umbraco.BlockList': [
        {
          $type: 'BlockListLayoutItem',
          contentUdi: null,
          settingsUdi: null,
          contentKey: sectionRowKey,
          settingsKey: sectionRowSettingsKey,
        },
      ],
    },
    contentData: [
      {
        contentTypeKey: input.sectionRowContentTypeKey,
        key: sectionRowKey,
        values: [
          {
            editorAlias: 'Umbraco.TextBox',
            culture: null,
            segment: null,
            alias: 'sectionTitle',
            value: '',
          },
          {
            editorAlias: 'Umbraco.DropDown.Flexible',
            culture: null,
            segment: null,
            alias: 'sectionHeadingLevel',
            value: ['h2'],
          },
          {
            editorAlias: 'Umbraco.BlockList',
            culture: null,
            segment: null,
            alias: 'sectionContent',
            value: sectionContentBlockList,
          },
        ],
      },
    ],
    settingsData: [
      {
        contentTypeKey: input.sectionRowSettingsTypeKey,
        key: sectionRowSettingsKey,
        values: [
          {
            editorAlias: 'Umbraco.DropDown.Flexible',
            culture: null,
            segment: null,
            alias: 'sectionBackgroundColor',
            value: ['none'],
          },
          {
            editorAlias: 'Umbraco.DropDown.Flexible',
            culture: null,
            segment: null,
            alias: 'sectionBackgroundWidth',
            value: ['full-bleed'],
          },
        ],
      },
    ],
    expose: [{ contentKey: sectionRowKey, culture: null, segment: null }],
  };
}

/**
 * Pick reasonable default values for properties that are mandatory on the
 * seeded inner block, so the published guide page validates cleanly.
 */
async function defaultMandatoryValues(
  token: string,
  elementType: { properties?: any[] } | null,
): Promise<Array<{ alias: string; value: unknown; editorAlias?: string }>> {
  if (!elementType?.properties) return [];
  const out: Array<{ alias: string; value: unknown; editorAlias?: string }> = [];
  for (const p of elementType.properties) {
    if (!p?.validation?.mandatory) continue;
    const dataTypeId = p.dataType?.id;
    if (!dataTypeId) continue;
    try {
      const dtResp = await request('GET', `/umbraco/management/api/v1/data-type/${dataTypeId}`, null, token);
      const dt = JSON.parse(dtResp.body);
      const editorAlias: string | undefined = dt.editorAlias;
      if (editorAlias === 'Umbraco.DropDown.Flexible') {
        const items: string[] = (dt.values ?? []).find((v: any) => v.alias === 'items')?.value ?? [];
        if (items.length > 0) {
          out.push({ alias: p.alias, value: [items[0]], editorAlias });
        }
      } else if (editorAlias === 'Umbraco.TextBox' || editorAlias === 'Umbraco.TextArea') {
        out.push({ alias: p.alias, value: '', editorAlias });
      }
      // Other editors: leave unset; Umbraco may still publish if it can default them.
    } catch {
      // ignore — best effort
    }
  }
  return out;
}

// ── Create-fresh path ──────────────────────────────────────────

async function runCreateFresh(featureAlias: string, opts: { dryRun: boolean }): Promise<void> {
  let token = await getToken();

  // 2. Compute the source signature (this also fetches the element type).
  const { signature, payload } = await computeSourceSignature(featureAlias);

  // 3. Resolve the documented element type (for display name + id), Guides parent,
  //    the howToGuidePage doc-type + its default template.
  token = await getToken();
  const blockElementType = await getDocumentTypeByAlias(token, payload.elementType.alias);
  const featureDisplayName = blockElementType?.name ?? toDisplayName(featureAlias);

  const guidesParentId = await getGuidesParentId(token);
  if (!guidesParentId) {
    throw new Error(
      'Guides parent page not found under Home — run scripts/setup-guides-schema.mjs first.',
    );
  }
  const howToType = await getDocumentTypeByAlias(token, 'howToGuidePage');
  if (!howToType) {
    throw new Error('howToGuidePage document type not found — run setup script first.');
  }
  const templateId =
    (howToType as any).defaultTemplate?.id ??
    (howToType as any).allowedTemplates?.[0]?.id;
  if (!templateId) {
    throw new Error('howToGuidePage has no template assigned.');
  }

  // 4. Run the agent for the description text.
  if (opts.dryRun) {
    console.log(`[dry-run] would create guide for "${featureAlias}" (signature ${signature.slice(0, 12)}…)`);
    return;
  }

  const userMessage = generatePrompt({ featureDisplayName, payload });
  const description = await runAgent('how-to-guide-writer', userMessage, { token });
  if (!description || description.trim().length === 0) {
    throw new Error('Agent returned an empty description.');
  }

  // 5. Build the sectionRows seed for known block features.
  let sectionRowsSeed: unknown;
  if (blockElementType) {
    const sectionRowType = await getDocumentTypeByAlias(token, 'contentSectionRow');
    const sectionRowSettingsType = await getDocumentTypeByAlias(
      token,
      'contentSectionRowSettings',
    );
    if (sectionRowType && sectionRowSettingsType) {
      const tokenForDefaults = await getToken();
      const blockValues = await defaultMandatoryValues(tokenForDefaults, blockElementType);
      sectionRowsSeed = buildSectionRowsSeed({
        blockContentTypeKey: blockElementType.id,
        sectionRowContentTypeKey: sectionRowType.id,
        sectionRowSettingsTypeKey: sectionRowSettingsType.id,
        blockValues,
      });
    }
  }

  // 6. Create the document.
  token = await getToken();
  const featureSlug = toSlug(featureDisplayName);
  const pageName = `How to use the ${featureDisplayName}`;
  const generationMetadata = JSON.stringify({
    signature,
    lastGeneratedAt: new Date().toISOString(),
    lastFeatureAlias: featureAlias,
  });

  const docId = await createGuidePage(token, {
    parentId: guidesParentId,
    documentTypeId: howToType.id,
    templateId,
    name: pageName,
    descriptionHtml: description,
    generationMetadata,
    sectionRows: sectionRowsSeed,
    hideFromTopNavigation: true,
  });

  // 7. Publish.
  token = await getToken();
  await publishDocument(token, docId);

  console.log(`created /guides/how-to-use-the-${featureSlug}/`);
}

// ── Skip-no-change + amend-with-approval paths ─────────────────

function readDescriptionValue(doc: any): string {
  const v = (doc.values ?? []).find((x: any) => x.alias === 'description')?.value;
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && typeof v.markup === 'string') return v.markup;
  return '';
}

function readMetadataObject(doc: any): {
  signature?: string;
  lastGeneratedAt?: string;
  lastFeatureAlias?: string;
  signaturePayload?: unknown;
  [k: string]: unknown;
} {
  const raw = (doc.values ?? []).find((x: any) => x.alias === 'generationMetadata')?.value;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function promptYesNo(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function isInteractive(): boolean {
  if (process.env.GUIDE_FORCE_INTERACTIVE === '1') return true;
  return process.stdin.isTTY === true;
}

async function runSkipOrAmend(
  featureAlias: string,
  existing: { id: string; document: any },
  opts: { dryRun: boolean; autoApply: boolean },
): Promise<void> {
  // 1. Compute current signature.
  const { signature: currentSignature, payload: currentPayload } =
    await computeSourceSignature(featureAlias);
  const storedMeta = readMetadataObject(existing.document);

  // 2. Skip-no-change path: stored signature matches current → exit cleanly.
  if (storedMeta.signature && storedMeta.signature === currentSignature) {
    console.log(`no changes — ${featureAlias} guide is up to date`);
    return;
  }

  // 3. Drift detected — amend flow.
  // Fast-fail when we can't possibly proceed: not interactive AND not auto-apply.
  if (!opts.autoApply && !isInteractive()) {
    console.error('amend pending — re-run interactively or pass --auto-apply');
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log(
      `[dry-run] would amend guide for "${featureAlias}" (drifted from ${storedMeta.signature ?? 'unknown'} → ${currentSignature.slice(0, 12)}…)`,
    );
    return;
  }

  // 4. Resolve display name + build amend prompt.
  let token = await getToken();
  const blockElementType = await getDocumentTypeByAlias(token, currentPayload.elementType.alias);
  const featureDisplayName = blockElementType?.name ?? toDisplayName(featureAlias);

  const existingDescription = readDescriptionValue(existing.document);
  const previousSignaturePayload = storedMeta.signaturePayload ?? {
    signature: storedMeta.signature ?? null,
    lastGeneratedAt: storedMeta.lastGeneratedAt ?? null,
    lastFeatureAlias: storedMeta.lastFeatureAlias ?? featureAlias,
  };

  const userMessage = generateAmendPrompt({
    featureDisplayName,
    existingDescription,
    previousSignaturePayload,
    currentSignaturePayload: currentPayload,
  });

  // 5. Run the agent.
  token = await getToken();
  const proposedDescription = await runAgent('how-to-guide-writer', userMessage, { token });
  if (!proposedDescription || proposedDescription.trim().length === 0) {
    throw new Error('Agent returned an empty amend description.');
  }

  // 6. Render colored unified diff.
  process.stdout.write(
    unifiedColoredDiff(existingDescription, proposedDescription, `description (${featureAlias})`),
  );
  process.stdout.write('\n');

  // 7. Decide whether to apply.
  let apply = opts.autoApply;
  if (!apply) {
    apply = await promptYesNo('Apply this amend? [y/N] ');
  }

  if (!apply) {
    console.log('no changes written');
    return;
  }

  // 8. Write + publish.
  token = await getToken();
  const generationMetadata = JSON.stringify({
    signature: currentSignature,
    lastGeneratedAt: new Date().toISOString(),
    lastFeatureAlias: featureAlias,
  });
  await updateGuidePage(token, existing.id, {
    document: existing.document,
    descriptionHtml: proposedDescription,
    generationMetadata,
  });

  token = await getToken();
  await publishDocument(token, existing.id);

  console.log(`amended /guides/ guide for "${featureAlias}"`);
}

// ── Audit mode ─────────────────────────────────────────────────

interface ExistingGuide {
  id: string;
  name: string;
  lastFeatureAlias: string | null;
}

async function listExistingGuides(token: string): Promise<ExistingGuide[]> {
  const guidesId = await getGuidesParentId(token);
  if (!guidesId) return [];

  const childrenResp = await request(
    'GET',
    `/umbraco/management/api/v1/tree/document/children?parentId=${guidesId}&skip=0&take=200`,
    null,
    token,
  );
  const items: any[] = JSON.parse(childrenResp.body).items ?? [];

  const out: ExistingGuide[] = [];
  for (const item of items) {
    const detailResp = await request(
      'GET',
      `/umbraco/management/api/v1/document/${item.id}`,
      null,
      token,
    );
    const doc = JSON.parse(detailResp.body);
    // Restrict to howToGuidePage children (other doc types under Guides — if any
    // ever appear — are out of scope for the audit).
    const docTypeAlias: string | undefined = doc.documentType?.alias;
    if (docTypeAlias && docTypeAlias !== 'howToGuidePage') continue;

    const name: string =
      doc.variants?.[0]?.name ?? item.variants?.[0]?.name ?? item.name ?? '(unnamed)';

    let lastFeatureAlias: string | null = null;
    const metaRaw = (doc.values ?? []).find((v: any) => v.alias === 'generationMetadata')?.value;
    if (typeof metaRaw === 'string' && metaRaw.trim()) {
      try {
        const meta = JSON.parse(metaRaw);
        if (typeof meta?.lastFeatureAlias === 'string') {
          lastFeatureAlias = meta.lastFeatureAlias;
        }
      } catch {
        // Malformed metadata — treat as no feature alias.
      }
    }

    out.push({ id: item.id, name, lastFeatureAlias });
  }
  return out;
}

async function runAudit(): Promise<number> {
  const features = await listFeatures();
  const featureAliases = new Set(features.map((f) => f.alias));

  const token = await getToken();
  const guides = await listExistingGuides(token);
  const coveredAliases = new Set(
    guides
      .map((g) => g.lastFeatureAlias)
      .filter((a): a is string => typeof a === 'string' && a.length > 0),
  );

  const missingBlocks: Feature[] = [];
  const missingGlobals: Feature[] = [];
  for (const feature of features) {
    if (coveredAliases.has(feature.alias)) continue;
    if (feature.kind === 'block') {
      missingBlocks.push(feature);
    } else {
      missingGlobals.push(feature);
    }
  }

  const orphans = guides.filter(
    (g) => g.lastFeatureAlias != null && !featureAliases.has(g.lastFeatureAlias),
  );

  const lines: string[] = [];
  lines.push(`Missing guides — Blocks (${missingBlocks.length}):`);
  for (const f of missingBlocks) {
    lines.push(`  - ${f.alias} (${f.displayName})`);
  }
  lines.push('');
  lines.push(`Missing guides — Global (${missingGlobals.length}):`);
  for (const f of missingGlobals) {
    lines.push(`  - ${f.alias} (${f.displayName})`);
  }
  lines.push('');
  lines.push(`Orphaned guides (${orphans.length}):`);
  for (const g of orphans) {
    lines.push(`  - ${g.lastFeatureAlias} — "${g.name}"`);
  }

  process.stdout.write(lines.join('\n') + '\n');

  const allEmpty =
    missingBlocks.length === 0 && missingGlobals.length === 0 && orphans.length === 0;
  return allEmpty ? 0 : 1;
}

// ── Entry point ────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.audit) {
    const code = await runAudit();
    process.exit(code);
  }

  if (!args.featureAlias) {
    printHelp();
    process.exit(2);
  }

  const token = await getToken();
  const existing = await findGuidePageByFeatureAlias(token, args.featureAlias);
  if (existing) {
    await runSkipOrAmend(args.featureAlias, existing, {
      dryRun: args.dryRun,
      autoApply: args.autoApply,
    });
  } else {
    await runCreateFresh(args.featureAlias, { dryRun: args.dryRun });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
