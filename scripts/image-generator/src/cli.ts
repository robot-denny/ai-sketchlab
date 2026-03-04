#!/usr/bin/env tsx
/**
 * CLI entry point for the metadata-driven image generator.
 *
 * Usage:
 *   npx tsx scripts/image-generator/src/cli.ts --name "Article Title"
 *   npx tsx scripts/image-generator/src/cli.ts --id "uuid-..."
 *   npx tsx scripts/image-generator/src/cli.ts --batch
 *   npx tsx scripts/image-generator/src/cli.ts --batch --force
 *   npx tsx scripts/image-generator/src/cli.ts --name "Title" --local-only --output ./preview.png
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateImage } from './generator.js';
import {
  authenticate,
  freshToken,
  fetchArticles,
  fetchArticleById,
  findArticleByName,
  hasMainImage,
  ensureMediaFolder,
  uploadImage,
  assignMainImage,
} from './umbraco-api.js';
import type { ArticleMetadata } from './types.js';

// ── Arg parsing ─────────────────────────────────────────────────

interface CliArgs {
  name?: string;
  id?: string;
  batch: boolean;
  force: boolean;
  localOnly: boolean;
  output?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { batch: false, force: false, localOnly: false };
  let i = 2; // skip node + script path

  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case '--name':
        args.name = argv[++i];
        break;
      case '--id':
        args.id = argv[++i];
        break;
      case '--batch':
        args.batch = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '--local-only':
        args.localOnly = true;
        break;
      case '--output':
        args.output = argv[++i];
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      default:
        console.error(`Unknown argument: ${arg}`);
        printUsage();
        process.exit(1);
    }
    i++;
  }

  return args;
}

function printUsage(): void {
  console.log(`
Usage: npx tsx scripts/image-generator/src/cli.ts [options]

Options:
  --name <title>    Generate image for article matching this name
  --id <uuid>       Generate image for article with this document ID
  --batch           Generate images for all articles without a featured image
  --force           Regenerate even if article already has an image
  --local-only      Save PNG locally without uploading to Umbraco
  --output <path>   Output path for --local-only (default: ./generated-<name>.png)
  --help, -h        Show this help message

Examples:
  npx tsx scripts/image-generator/src/cli.ts --name "Retaining Humanity"
  npx tsx scripts/image-generator/src/cli.ts --batch --force
  npx tsx scripts/image-generator/src/cli.ts --name "Article" --local-only --output ./preview.png
`);
}

function validateArgs(args: CliArgs): void {
  const modes = [args.name, args.id, args.batch].filter(Boolean).length;
  if (modes === 0) {
    console.error('Error: Specify one of --name, --id, or --batch');
    printUsage();
    process.exit(1);
  }
  if (modes > 1) {
    console.error('Error: Specify only one of --name, --id, or --batch');
    printUsage();
    process.exit(1);
  }
}

// ── Processing ──────────────────────────────────────────────────

interface ProcessResult {
  generated: number;
  skipped: number;
  errors: number;
}

async function processArticle(
  article: ArticleMetadata,
  args: CliArgs,
  token: string | null,
  folderId: string | null,
): Promise<'generated' | 'skipped' | 'error'> {
  // Check if article already has an image (skip unless --force)
  if (!args.force && !args.localOnly && token) {
    const t = await freshToken();
    const has = await hasMainImage(t, article.id);
    if (has) {
      console.log(`  Skipping: "${article.name}" — already has image`);
      return 'skipped';
    }
  }

  // Generate image
  console.log(`  Generating: "${article.name}" (${article.wordCount} words, [${article.categories.join(', ')}])`);
  const pngBuffer = generateImage(article);

  if (args.localOnly) {
    // Save locally
    const sanitizedName = article.name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase();
    const outputPath = args.output || `./generated-${sanitizedName}.png`;
    fs.writeFileSync(outputPath, pngBuffer);
    console.log(`  Saved: ${outputPath} (${(pngBuffer.length / 1024).toFixed(1)} KB)`);
    return 'generated';
  }

  // Upload and assign
  if (!token || !folderId) {
    console.error('  Error: No token or folder — cannot upload');
    return 'error';
  }

  const t = await freshToken();
  const fileName = `${article.name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase()}.png`;
  const mediaId = await uploadImage(t, folderId, fileName, pngBuffer);

  const t2 = await freshToken();
  await assignMainImage(t2, article.id, mediaId);

  console.log(`  Done: "${article.name}" → media ${mediaId}`);
  return 'generated';
}

// ── Main ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  validateArgs(args);

  let token: string | null = null;
  let folderId: string | null = null;

  // Authenticate (unless local-only)
  if (!args.localOnly) {
    try {
      token = await authenticate();
    } catch (err) {
      console.error('Error: Authentication failed. Check UMBRACO_CLIENT_ID/SECRET in .env');
      console.error((err as Error).message);
      process.exit(1);
    }
    console.log('Authenticated with Umbraco');

    // Ensure media folder exists
    folderId = await ensureMediaFolder(token);
    console.log(`Media folder: ${folderId}`);
  }

  const result: ProcessResult = { generated: 0, skipped: 0, errors: 0 };

  try {
    if (args.batch) {
      // Batch mode: process all articles
      const t = await freshToken();
      console.log('Fetching articles...');
      const articles = await fetchArticles(t);
      console.log(`Found ${articles.length} articles\n`);

      for (const article of articles) {
        try {
          const status = await processArticle(article, args, token, folderId);
          result[status]++;
        } catch (err) {
          console.error(`  Error processing "${article.name}": ${(err as Error).message}`);
          result.errors++;
        }
      }
    } else if (args.name) {
      // Single article by name
      if (args.localOnly) {
        // For local-only, we still need metadata — authenticate temporarily
        let t: string;
        try {
          t = await authenticate();
        } catch {
          console.error('Error: --local-only still needs Umbraco access to fetch article metadata.');
          console.error('Start Umbraco or provide metadata via --id with a running instance.');
          process.exit(1);
        }
        const match = await findArticleByName(t, args.name);
        if (!match) {
          console.error(`Error: No article found matching "${args.name}"`);
          process.exit(1);
        }
        const t2 = await freshToken();
        const article = await fetchArticleById(t2, match.id);
        const status = await processArticle(article, args, null, null);
        result[status]++;
      } else {
        const t = await freshToken();
        const match = await findArticleByName(t!, args.name);
        if (!match) {
          console.error(`Error: No article found matching "${args.name}"`);
          process.exit(1);
        }
        console.log(`Found: "${match.name}" (${match.id})\n`);

        const t2 = await freshToken();
        const article = await fetchArticleById(t2, match.id);
        try {
          const status = await processArticle(article, args, token, folderId);
          result[status]++;
        } catch (err) {
          console.error(`  Error: ${(err as Error).message}`);
          result.errors++;
        }
      }
    } else if (args.id) {
      // Single article by ID
      if (args.localOnly) {
        let t: string;
        try {
          t = await authenticate();
        } catch {
          console.error('Error: --local-only still needs Umbraco access to fetch article metadata.');
          process.exit(1);
        }
        const article = await fetchArticleById(t, args.id);
        const status = await processArticle(article, args, null, null);
        result[status]++;
      } else {
        const t = await freshToken();
        const article = await fetchArticleById(t, args.id!);
        console.log(`Found: "${article.name}" (${article.id})\n`);
        try {
          const status = await processArticle(article, args, token, folderId);
          result[status]++;
        } catch (err) {
          console.error(`  Error: ${(err as Error).message}`);
          result.errors++;
        }
      }
    }
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('ECONNREFUSED') || msg.includes('connect ECONNREFUSED')) {
      console.error(`\nError: Cannot connect to Umbraco. Is it running?`);
    } else {
      console.error(`\nError: ${msg}`);
    }
    process.exit(1);
  }

  // Summary
  console.log(`\nDone: ${result.generated} generated, ${result.skipped} skipped, ${result.errors} errors`);
  if (result.errors > 0) process.exit(1);
}

main();
