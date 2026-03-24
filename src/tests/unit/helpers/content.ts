export function getTextContent(result: { content: Array<{ type: string; text?: string }> }): string {
  const item = result.content[0];
  if (item.type !== 'text' || item.text === undefined) throw new Error('Expected text content');
  return item.text;
}
