/**
 * Client for the Umbraco AI Agent SSE endpoint.
 *
 * `runAgent` POSTs a thread/run request to `/umbraco/ai/management/api/v1/agents/{idOrAlias}/run`
 * and assembles the agent's reply text from the SSE event stream.
 *
 * The SSE parser is exposed separately (`parseAgentSseStream`) for unit testing
 * with a mock readable stream.
 */

import * as https from 'node:https';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

// ── .env loading (lazy, mirrors umbracoApi.ts) ────────────────

interface AgentEnv {
  baseUrl: string;
}

let cachedEnv: AgentEnv | null = null;

function loadEnv(): AgentEnv {
  if (cachedEnv) return cachedEnv;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(__dirname, '..', '..', '..', '.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const envContents = fs.readFileSync(envPath, 'utf8');
    for (const line of envContents.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) env[match[1].trim()] = match[2].trim();
    }
  }
  cachedEnv = {
    baseUrl: process.env.UMBRACO_BASE_URL || env.UMBRACO_BASE_URL || 'https://localhost:44367',
  };
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  return cachedEnv;
}

// ── SSE parser ─────────────────────────────────────────────────

/**
 * Parse a server-sent-events stream produced by the AI Agent endpoint.
 * Returns the concatenation of every `TEXT_MESSAGE_CHUNK.delta` value seen
 * before a terminal `TEXT_MESSAGE_END` event.
 *
 * Throws if:
 *  - an `ERROR` event is emitted
 *  - the stream ends before any `TEXT_MESSAGE_END`
 */
export async function parseAgentSseStream(stream: Readable): Promise<string> {
  let buffer = '';
  let assembled = '';
  let sawTextEnd = false;
  let errorMessage: string | null = null;

  function processBlock(block: string): void {
    // SSE blocks may have multiple `data:` lines or comment lines starting with `:`
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const field = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).replace(/^ /, '');
      if (field === 'data') dataLines.push(value);
    }
    if (dataLines.length === 0) return;

    const raw = dataLines.join('\n');
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      // Tolerate malformed events — agent should not crash the run.
      return;
    }

    switch (json.type) {
      case 'TEXT_MESSAGE_CHUNK':
        if (typeof json.delta === 'string') assembled += json.delta;
        break;
      case 'TEXT_MESSAGE_END':
        sawTextEnd = true;
        break;
      case 'ERROR':
        errorMessage = json.message ?? json.error ?? 'agent error';
        break;
      default:
        // RUN_STARTED, TEXT_MESSAGE_START, TOOL_CALL_*, RUN_FINISHED, etc.
        break;
    }
  }

  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    let separatorIdx: number;
    // SSE event blocks are separated by a blank line (\n\n or \r\n\r\n)
    while ((separatorIdx = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const block = buffer.slice(0, separatorIdx);
      const match = buffer.slice(separatorIdx).match(/^\r?\n\r?\n/);
      buffer = buffer.slice(separatorIdx + (match ? match[0].length : 2));
      processBlock(block);
      if (errorMessage) throw new Error(`Agent stream error: ${errorMessage}`);
    }
  }

  // Flush any trailing block that didn't end with a blank line.
  if (buffer.trim().length > 0) {
    processBlock(buffer);
    if (errorMessage) throw new Error(`Agent stream error: ${errorMessage}`);
  }

  if (!sawTextEnd) {
    throw new Error('Agent stream ended before TEXT_MESSAGE_END.');
  }
  return assembled;
}

// ── JSON envelope parser ──────────────────────────────────────

/**
 * Pull the assistant's text out of a non-streaming agent response.
 *
 * The Umbraco AI Agent endpoint can return a single JSON envelope shaped like:
 *   { messages: [{ role: 'assistant', contents: [{ $type: 'text', text: '<p>…' }] }] }
 *
 * This helper walks both that shape and the looser variants (delta arrays,
 * `output_text`, `content` strings) so callers don't have to special-case.
 */
export function extractAssistantText(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Agent response body was empty.');

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(
      `Agent response was neither SSE nor valid JSON. First 200 chars: ${trimmed.slice(0, 200)}`,
    );
  }

  const collected: string[] = [];

  function walkContents(contents: any): void {
    if (!Array.isArray(contents)) return;
    for (const c of contents) {
      if (typeof c === 'string') collected.push(c);
      else if (c && typeof c === 'object') {
        if (typeof c.text === 'string') collected.push(c.text);
        else if (typeof c.delta === 'string') collected.push(c.delta);
      }
    }
  }

  if (Array.isArray(parsed.messages)) {
    for (const m of parsed.messages) {
      if (!m) continue;
      if (m.role && m.role !== 'assistant') continue;
      if (typeof m.content === 'string') collected.push(m.content);
      walkContents(m.contents);
      walkContents(m.content);
    }
  } else if (typeof parsed.text === 'string') {
    collected.push(parsed.text);
  } else if (typeof parsed.content === 'string') {
    collected.push(parsed.content);
  } else if (typeof parsed.output_text === 'string') {
    collected.push(parsed.output_text);
  }

  const out = collected.join('').trim();
  if (!out) {
    throw new Error(
      `Agent response had no extractable assistant text. Body: ${trimmed.slice(0, 400)}`,
    );
  }
  return out;
}

// ── runAgent ──────────────────────────────────────────────────

export interface RunAgentOptions {
  token: string;
  threadId?: string;
  /** Optional client-side timeout (ms). Defaults to 120_000. */
  timeoutMs?: number;
  /** Override base URL for testing. */
  baseUrl?: string;
}

export async function runAgent(
  idOrAlias: string,
  message: string,
  opts: RunAgentOptions,
): Promise<string> {
  const baseUrl = opts.baseUrl ?? loadEnv().baseUrl;
  const url = new URL(
    `/umbraco/ai/management/api/v1/agents/${encodeURIComponent(idOrAlias)}/run`,
    baseUrl,
  );

  const body = JSON.stringify({
    threadId: opts.threadId ?? randomUUID(),
    runId: randomUUID(),
    messages: [
      { id: randomUUID(), role: 'user', content: message },
    ],
  });

  return new Promise<string>((resolve, reject) => {
    const requestOpts: https.RequestOptions = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${opts.token}`,
        'Content-Length': Buffer.byteLength(body).toString(),
      },
      rejectUnauthorized: false,
    };

    const req = https.request(requestOpts, (res) => {
      if ((res.statusCode ?? 0) >= 400) {
        let errBody = '';
        res.on('data', (c: Buffer) => (errBody += c));
        res.on('end', () => {
          reject(new Error(`Agent request failed: ${res.statusCode}\n${errBody}`));
        });
        return;
      }

      const contentType = String(res.headers['content-type'] ?? '').toLowerCase();
      if (contentType.includes('text/event-stream')) {
        parseAgentSseStream(res).then(resolve, reject);
        return;
      }

      // Some Umbraco AI builds return a single JSON envelope instead of SSE
      // (typically `application/json`). Buffer the body and extract the assistant text.
      let buffer = '';
      res.on('data', (c: Buffer) => (buffer += c.toString('utf8')));
      res.on('end', () => {
        try {
          resolve(extractAssistantText(buffer));
        } catch (err) {
          reject(err);
        }
      });
      res.on('error', reject);
    });

    const timeout = opts.timeoutMs ?? 120_000;
    req.setTimeout(timeout, () => {
      req.destroy(new Error(`Agent request timed out after ${timeout}ms.`));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
