import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { parseAgentSseStream } from '../src/agentClient.js';

/** Build a Readable stream from an array of SSE-formatted string chunks. */
function streamOf(chunks: string[]): Readable {
  return Readable.from(chunks.map((c) => Buffer.from(c, 'utf8')));
}

/** Format a single SSE event with `data: <json>` followed by `\n\n`. */
function evt(payload: object): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

describe('parseAgentSseStream', () => {
  it('concatenates TEXT_MESSAGE_CHUNK deltas in order', async () => {
    const stream = streamOf([
      evt({ type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' }),
      evt({ type: 'TEXT_MESSAGE_CHUNK', messageId: 'm1', role: 'assistant', delta: 'Hello ' }),
      evt({ type: 'TEXT_MESSAGE_CHUNK', messageId: 'm1', role: 'assistant', delta: 'world' }),
      evt({ type: 'TEXT_MESSAGE_END', messageId: 'm1' }),
    ]);

    const text = await parseAgentSseStream(stream);
    assert.equal(text, 'Hello world');
  });

  it('handles deltas split across multiple network chunks', async () => {
    // Single SSE event, but split mid-delta across two read chunks
    const event = evt({ type: 'TEXT_MESSAGE_CHUNK', messageId: 'm1', role: 'assistant', delta: 'Stitched together' });
    const half = Math.floor(event.length / 2);
    const stream = streamOf([
      event.slice(0, half),
      event.slice(half),
      evt({ type: 'TEXT_MESSAGE_END', messageId: 'm1' }),
    ]);

    const text = await parseAgentSseStream(stream);
    assert.equal(text, 'Stitched together');
  });

  it('ignores non-text event types', async () => {
    const stream = streamOf([
      evt({ type: 'RUN_STARTED', threadId: 't1', runId: 'r1' }),
      evt({ type: 'TEXT_MESSAGE_START', messageId: 'm1' }),
      evt({ type: 'TEXT_MESSAGE_CHUNK', messageId: 'm1', delta: 'kept' }),
      evt({ type: 'TOOL_CALL_START', toolCallId: 't' }),
      evt({ type: 'TOOL_CALL_END', toolCallId: 't' }),
      evt({ type: 'TEXT_MESSAGE_END', messageId: 'm1' }),
      evt({ type: 'RUN_FINISHED', threadId: 't1', runId: 'r1' }),
    ]);

    const text = await parseAgentSseStream(stream);
    assert.equal(text, 'kept');
  });

  it('throws when the stream ends before TEXT_MESSAGE_END', async () => {
    const stream = streamOf([
      evt({ type: 'TEXT_MESSAGE_START', messageId: 'm1' }),
      evt({ type: 'TEXT_MESSAGE_CHUNK', messageId: 'm1', delta: 'partial' }),
    ]);

    await assert.rejects(() => parseAgentSseStream(stream), /TEXT_MESSAGE_END/);
  });

  it('throws on an ERROR event', async () => {
    const stream = streamOf([
      evt({ type: 'TEXT_MESSAGE_START', messageId: 'm1' }),
      evt({ type: 'TEXT_MESSAGE_CHUNK', messageId: 'm1', delta: 'oops' }),
      evt({ type: 'ERROR', message: 'Something went wrong' }),
    ]);

    await assert.rejects(() => parseAgentSseStream(stream), /Something went wrong/);
  });

  it('skips comment lines and malformed data lines without crashing', async () => {
    const malformed = ': keepalive\n\n' +
      'data: not-json\n\n' +
      evt({ type: 'TEXT_MESSAGE_CHUNK', messageId: 'm1', delta: 'ok' }) +
      evt({ type: 'TEXT_MESSAGE_END', messageId: 'm1' });
    const stream = streamOf([malformed]);

    const text = await parseAgentSseStream(stream);
    assert.equal(text, 'ok');
  });
});
