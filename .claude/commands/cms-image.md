---
description: Generate flow-field featured images from article metadata and publish to the CMS
allowed-tools: Bash(PATH*npx tsx scripts/image-generator/src/cli.ts*), Read
argument-hint: "[--name \"Article Title\" | --id \"uuid\" | --batch] [--force] [--local-only --output ./preview.png]"
---

## User Input

**$ARGUMENTS**

## What This Does

Runs the metadata-driven image generator CLI at `scripts/image-generator/src/cli.ts`. It fetches article metadata from the Umbraco Management API, generates a deterministic abstract flow-field PNG (1200x630), uploads it to the "Generated Images" media folder, and assigns it as the article's `mainImage`.

## Prerequisites

- Umbraco must be running locally (unless using `--local-only`)
- `.env` must have `UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET`, and `UMBRACO_BASE_URL`
- Dependencies installed (`npm install`)

## Determine the Command

Parse `$ARGUMENTS` to build the CLI command. The arguments map directly to CLI flags:

| User says | CLI flag |
|-----------|----------|
| An article name/title | `--name "Article Title"` |
| A UUID | `--id "uuid-here"` |
| "all", "batch", "all articles" | `--batch` |
| "force", "regenerate", "overwrite" | `--force` |
| "preview", "local", "don't upload" | `--local-only` |
| A file path for output | `--output ./path.png` |

If `$ARGUMENTS` is empty or unclear, ask the user what they'd like to generate. Offer these options:
1. A specific article by name
2. A specific article by ID
3. All articles missing images (batch)

## Execute

Run the command:

```bash
PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx scripts/image-generator/src/cli.ts [flags from above]
```

## Report Results

After the command completes:
1. Show the summary line (N generated, N skipped, N errors)
2. If images were uploaded, remind the user they're saved as **drafts** (not published) in the "Generated Images" media folder
3. If there were errors, explain what went wrong
