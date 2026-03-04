/**
 * Extract word count from Umbraco content values.
 * Handles HTML strings, Tiptap JSON, and null/empty input.
 */
export function extractWordCount(input: unknown): number {
  if (input == null) return 0;

  if (typeof input === 'string') {
    return countWordsInHTML(input);
  }

  if (typeof input === 'object') {
    return countWordsInTiptap(input as TiptapNode);
  }

  return 0;
}

function countWordsInHTML(html: string): number {
  if (!html) return 0;
  // Strip HTML tags, then count whitespace-separated words
  const text = html.replace(/<[^>]*>/g, ' ').trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
}

function countWordsInTiptap(node: TiptapNode): number {
  let count = 0;

  if (node.text) {
    const words = node.text.trim().split(/\s+/).filter(Boolean);
    count += words.length;
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      count += countWordsInTiptap(child);
    }
  }

  return count;
}
