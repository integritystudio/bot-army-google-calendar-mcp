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
