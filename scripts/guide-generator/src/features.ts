/**
 * Canonical feature registry for the How-To Guide system.
 *
 * Two sources are merged:
 *   - Auto-discovered block features — one per `*.cshtml` file under
 *     `src/UmbracoProject/Views/Partials/blocks/Components/`.
 *   - A hand-curated list of named global features (site header, footer,
 *     site-settings, search, article list). Adding a new global feature is a
 *     single PR — add an entry to {@link CURATED_GLOBAL_FEATURES}.
 *
 * Every feature exposes a stable `alias`, an editor-friendly `displayName`,
 * a `kind` (`block` | `global`) used to bucket the audit report, and a list
 * of `sources` — files whose contents feed the source-signature SHA-256 for
 * that feature (used by `sourceSignature.ts`).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export type FeatureKind = 'block' | 'global';

export interface Feature {
  /** Stable identifier — for blocks this matches the partial filename without `.cshtml`. */
  alias: string;
  /** Editor-friendly display name. Pages are named "How to use the {displayName}". */
  displayName: string;
  /** `block` for partials under blocks/Components; `global` for hand-curated entries. */
  kind: FeatureKind;
  /**
   * Files feeding the SHA-256 source signature for this feature.
   * For block features this is a single partial path; for global features it
   * is a curated list of partials/views/doc-type-property carriers.
   */
  sources: string[];
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const BLOCK_COMPONENTS_DIR = path.join(
  'src',
  'UmbracoProject',
  'Views',
  'Partials',
  'blocks',
  'Components',
);

/**
 * Curated registry of named global features.
 *
 * Each entry is a feature that is not a block but still warrants a how-to
 * guide. Sources are absolute repo-relative paths — files that will be hashed
 * into the source signature. `sources` may include doc-type alias references
 * (resolved at signature time via the Management API) when the feature is
 * driven by a composition or document type rather than just files.
 */
const CURATED_GLOBAL_FEATURES: ReadonlyArray<Feature> = [
  {
    alias: 'siteHeader',
    displayName: 'Site Header',
    kind: 'global',
    sources: [
      'src/UmbracoProject/Views/Partials/v2/_SiteHead.cshtml',
      'doc-type:headerControls',
    ],
  },
  {
    alias: 'siteFooter',
    displayName: 'Site Footer',
    kind: 'global',
    sources: ['src/UmbracoProject/Views/Partials/v2/_Footer.cshtml'],
  },
  {
    alias: 'siteSettings',
    displayName: 'Site Settings',
    kind: 'global',
    sources: ['doc-type:siteSettings'],
  },
  {
    alias: 'search',
    displayName: 'Search',
    kind: 'global',
    sources: ['src/UmbracoProject/Views/search.cshtml'],
  },
  {
    alias: 'articleList',
    displayName: 'Article List',
    kind: 'global',
    sources: [
      'src/UmbracoProject/Views/articleList.cshtml',
      'doc-type:articleList',
    ],
  },
];

/** Convert a camelCase / PascalCase alias to a friendly title-case display name. */
function toDisplayName(alias: string): string {
  const spaced = alias
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Auto-discover block features by listing `*.cshtml` files under blocks/Components. */
function discoverBlockFeatures(): Feature[] {
  const dir = path.join(REPO_ROOT, BLOCK_COMPONENTS_DIR);
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: Feature[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.cshtml')) continue;
    if (entry.name.startsWith('_')) continue; // partial-of-partial helpers
    const alias = entry.name.replace(/\.cshtml$/, '');
    out.push({
      alias,
      displayName: toDisplayName(alias),
      kind: 'block',
      sources: [path.posix.join(BLOCK_COMPONENTS_DIR.replaceAll(path.sep, '/'), entry.name)],
    });
  }
  return out.sort((a, b) => a.alias.localeCompare(b.alias));
}

/**
 * Returns the merged canonical feature list (auto-discovered blocks + curated
 * globals). Block features come first (alphabetical), followed by globals
 * (registry order).
 */
export async function listFeatures(): Promise<Feature[]> {
  const blocks = discoverBlockFeatures();
  return [...blocks, ...CURATED_GLOBAL_FEATURES];
}

/** Find a single feature by alias — null when not present in the canonical list. */
export async function findFeature(alias: string): Promise<Feature | null> {
  const all = await listFeatures();
  return all.find((f) => f.alias === alias) ?? null;
}
