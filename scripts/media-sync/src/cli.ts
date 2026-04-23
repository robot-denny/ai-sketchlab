/**
 * media-sync — heal missing local media binaries by pulling them from a
 * source Umbraco environment (Live by default).
 *
 * See CLAUDE.md → "Media files" for the workflow this supports.
 */

import * as https from 'node:https';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Paths & env ────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const MEDIA_ROOT = path.join(REPO_ROOT, 'src', 'UmbracoProject', 'wwwroot');

const envPath = path.join(REPO_ROOT, '.env');
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
}

const LOCAL_URL = env.UMBRACO_BASE_URL || env.URL || 'https://localhost:44367';
const CLIENT_ID = env.UMBRACO_CLIENT_ID;
const CLIENT_SECRET = env.UMBRACO_CLIENT_SECRET;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ── Args ───────────────────────────────────────────────────────

interface Args {
  dryRun: boolean;
  source: string;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    source: env.UMBRACO_LIVE_URL ?? '',
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--source') args.source = argv[++i] ?? '';
    else if (a.startsWith('--source=')) args.source = a.slice('--source='.length);
  }
  return args;
}

function printHelp(): void {
  console.log(`media-sync — heal missing local media binaries from a source Umbraco env

Usage:
  npm run media:sync                       Heal using $UMBRACO_LIVE_URL
  npm run media:sync -- --dry-run          Report what would change
  npm run media:sync -- --source=<url>     Use a different source env

Reads local media records from ${LOCAL_URL}, finds records whose
umbracoFile points to a file not present on disk under
src/UmbracoProject/wwwroot/media, and downloads each missing binary
from the source environment at the same path.

Required env (.env):
  UMBRACO_CLIENT_ID, UMBRACO_CLIENT_SECRET    local backoffice OAuth client
  UMBRACO_LIVE_URL                            default source environment
  URL or UMBRACO_BASE_URL                     local site (default: https://localhost:44367)
`);
}

// ── HTTP ───────────────────────────────────────────────────────

interface HttpResponse {
  status: number;
  body: string;
}

function httpRequest(
  urlStr: string,
  opts: https.RequestOptions = {},
  body?: string,
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request(
      {
        method: opts.method ?? 'GET',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: opts.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.on('data', (c: Buffer) => (data += c.toString()));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function downloadToFile(urlStr: string, destPath: string): Promise<{ status: number; bytes: number }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request(
      {
        method: 'GET',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        rejectUnauthorized: false,
      },
      (res) => {
        if ((res.statusCode ?? 0) >= 400) {
          res.resume();
          return resolve({ status: res.statusCode ?? 0, bytes: 0 });
        }
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        const out = fs.createWriteStream(destPath);
        let bytes = 0;
        res.on('data', (c: Buffer) => (bytes += c.length));
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve({ status: res.statusCode ?? 0, bytes })));
        out.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// ── Local auth + media tree walk ───────────────────────────────

async function authenticate(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('UMBRACO_CLIENT_ID / UMBRACO_CLIENT_SECRET missing from .env');
  }
  const body = `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;
  const res = await httpRequest(
    `${LOCAL_URL}/umbraco/management/api/v1/security/back-office/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    body,
  );
  if (res.status >= 400) throw new Error(`Local auth failed (${res.status}): ${res.body}`);
  return JSON.parse(res.body).access_token as string;
}

interface MediaRef {
  id: string;
  name: string;
  src: string;
}

async function walkMediaTree(token: string): Promise<MediaRef[]> {
  const refs: MediaRef[] = [];
  const headers = { Authorization: `Bearer ${token}` };

  async function pageThrough(parentQuery: string): Promise<Array<{ id: string; name: string; hasChildren: boolean }>> {
    const all: Array<{ id: string; name: string; hasChildren: boolean }> = [];
    let skip = 0;
    const take = 100;
    while (true) {
      const res = await httpRequest(
        `${LOCAL_URL}/umbraco/management/api/v1/tree/media/${parentQuery}skip=${skip}&take=${take}`,
        { headers },
      );
      if (res.status >= 400) throw new Error(`Tree walk failed (${res.status}): ${res.body}`);
      const data = JSON.parse(res.body);
      for (const i of data.items ?? []) {
        all.push({
          id: i.id,
          name: i.variants?.[0]?.name ?? '?',
          hasChildren: Boolean(i.hasChildren),
        });
      }
      if ((data.items?.length ?? 0) < take) break;
      skip += take;
    }
    return all;
  }

  async function visit(parentId: string | null): Promise<void> {
    const query = parentId ? `children?parentId=${parentId}&` : 'root?';
    const items = await pageThrough(query);
    for (const it of items) {
      const detailRes = await httpRequest(
        `${LOCAL_URL}/umbraco/management/api/v1/media/${it.id}`,
        { headers },
      );
      if (detailRes.status < 400) {
        const m = JSON.parse(detailRes.body);
        const uf = (m.values ?? []).find((v: any) => v.alias === 'umbracoFile');
        const src = uf?.value?.src;
        if (typeof src === 'string' && src.startsWith('/media/')) {
          refs.push({ id: it.id, name: it.name, src });
        }
      }
      if (it.hasChildren) await visit(it.id);
    }
  }

  await visit(null);
  return refs;
}

// ── Main ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.source) {
    console.error('ERROR: no --source provided and UMBRACO_LIVE_URL is not set in .env');
    process.exit(1);
  }

  console.log(`media-sync`);
  console.log(`  local:  ${LOCAL_URL}`);
  console.log(`  source: ${args.source}`);
  if (args.dryRun) console.log(`  mode:   DRY RUN (no files will be written)`);
  console.log();

  console.log('Authenticating with local Umbraco...');
  const token = await authenticate();

  console.log('Walking media tree...');
  const refs = await walkMediaTree(token);
  console.log(`  ${refs.length} media records with umbracoFile.src`);

  const missing = refs.filter((r) => !fs.existsSync(path.join(MEDIA_ROOT, r.src)));
  const present = refs.length - missing.length;
  console.log(`  ${present} present on disk, ${missing.length} missing`);
  console.log();

  if (missing.length === 0) {
    console.log('All media present. Nothing to sync.');
    return;
  }

  let healed = 0;
  let stillMissing = 0;
  for (let i = 0; i < missing.length; i++) {
    const r = missing[i];
    const label = `[${i + 1}/${missing.length}]`;
    if (args.dryRun) {
      console.log(`${label} WOULD PULL ${r.src}  (${r.name})`);
      continue;
    }
    const dest = path.join(MEDIA_ROOT, r.src);
    try {
      const result = await downloadToFile(`${args.source}${r.src}`, dest);
      if (result.status >= 400 || result.bytes === 0) {
        console.log(`${label} MISS     ${r.src}  (source returned ${result.status})`);
        stillMissing++;
      } else {
        console.log(`${label} healed   ${r.src}  (${result.bytes} bytes)`);
        healed++;
      }
    } catch (err) {
      console.log(`${label} ERROR    ${r.src}  (${(err as Error).message})`);
      stillMissing++;
    }
  }

  console.log();
  if (args.dryRun) {
    console.log(`Summary: ${present} present, ${missing.length} would heal (dry run)`);
  } else {
    console.log(`Summary: ${present} present, ${healed} healed, ${stillMissing} still missing`);
  }

  if (stillMissing > 0) process.exit(2);
}

main().catch((err) => {
  console.error('media-sync failed:', err.message);
  process.exit(1);
});
