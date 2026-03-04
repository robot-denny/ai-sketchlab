import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractWordCount } from '../../scripts/image-generator/src/word-count.js';

describe('extractWordCount', () => {
  it('counts words in HTML string', () => {
    assert.equal(extractWordCount('<p>Hello world</p>'), 2);
  });

  it('counts words in complex HTML', () => {
    const html = '<p>This is a <strong>test</strong> with <em>multiple</em> tags.</p>';
    assert.equal(extractWordCount(html), 7);
  });

  it('counts words in Tiptap JSON with text nodes', () => {
    const tiptap = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello world from Tiptap' }
          ]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Another paragraph here' }
          ]
        }
      ]
    };
    assert.equal(extractWordCount(tiptap), 7);
  });

  it('returns 0 for null input', () => {
    assert.equal(extractWordCount(null), 0);
  });

  it('returns 0 for undefined input', () => {
    assert.equal(extractWordCount(undefined), 0);
  });

  it('returns 0 for empty string', () => {
    assert.equal(extractWordCount(''), 0);
  });

  it('counts only text nodes in mixed blocks', () => {
    const tiptap = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Three words here' }
          ]
        },
        {
          type: 'image',
          attrs: { src: 'test.png' }
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Two more' }
          ]
        }
      ]
    };
    assert.equal(extractWordCount(tiptap), 5);
  });
});
