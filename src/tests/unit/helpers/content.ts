export function getTextContent(result: { content: Array<{ type: string; text?: string }> }): string {
  const item = result.content[0];
  if (item.type !== 'text' || item.text === undefined) throw new Error('Expected text content');
  return item.text;
}

export function tryGetTextContent(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as { content?: Array<{ type: string; text?: string }> };
  const item = r.content?.[0];
  if (!item || item.type !== 'text' || item.text === undefined) return null;
  return item.text;
}

/**
 * Assert that result has text content containing specified substring.
 * Used for handlers that return text results (list events, search, etc.)
 */
export function assertTextContentContains(
  result: { content: Array<{ type: string; text?: string }> },
  substring: string
): void {
  if (!result.content || result.content.length === 0) {
    throw new Error('Expected result to have content');
  }
  if (result.content[0].type !== 'text') {
    throw new Error(`Expected text content, got ${result.content[0].type}`);
  }
  const text = getTextContent(result);
  if (!text.includes(substring)) {
    throw new Error(`Expected content to contain "${substring}", got: ${text}`);
  }
}
