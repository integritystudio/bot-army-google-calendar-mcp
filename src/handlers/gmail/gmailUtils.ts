import { gmail_v1 } from 'googleapis';
import { formatErrorMessage } from '../core/errorFormatting.js';

export function getErrorMessage(error: unknown): string {
  return formatErrorMessage(error);
}

export async function fetchMessageDetails(
  gmail: gmail_v1.Gmail,
  messageId: string,
  headers: string[] = ['Subject', 'From', 'Date']
) {
  try {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: headers,
    });

    const payloadHeaders = msg.data.payload?.headers || [];
    const headerMap = Object.fromEntries(
      payloadHeaders.map((h) => [h.name, h.value])
    );

    return {
      id: msg.data.id,
      threadId: msg.data.threadId,
      snippet: msg.data.snippet,
      headers: headerMap,
    };
  } catch (error) {
    throw new Error(`Failed to fetch message ${messageId}: ${getErrorMessage(error)}`);
  }
}

export function buildGmailModifyRequest(
  action: Record<string, any>
): Record<string, any> {
  const request: Record<string, any> = {};

  if (action.addLabelIds?.length > 0) {
    request.addLabelIds = action.addLabelIds;
  }

  if (action.removeLabelIds?.length > 0) {
    request.removeLabelIds = action.removeLabelIds;
  }

  // Handle derived actions
  if (action.archive) {
    const ids = request.removeLabelIds || [];
    if (!ids.includes('INBOX')) {
      ids.push('INBOX');
    }
    request.removeLabelIds = ids;
  }

  if (action.markAsSpam) {
    const ids = request.addLabelIds || [];
    if (!ids.includes('SPAM')) {
      ids.push('SPAM');
    }
    request.addLabelIds = ids;
  }

  if (action.markAsTrash) {
    const ids = request.addLabelIds || [];
    if (!ids.includes('TRASH')) {
      ids.push('TRASH');
    }
    request.addLabelIds = ids;
  }

  return request;
}

export function buildSearchQuery(criteria: Record<string, any>): string {
  const parts: string[] = [];

  if (criteria.from) {
    parts.push(`from:${escapeSearchQuery(criteria.from)}`);
  }
  if (criteria.to) {
    parts.push(`to:${escapeSearchQuery(criteria.to)}`);
  }
  if (criteria.subject) {
    parts.push(`subject:${escapeSearchQuery(criteria.subject)}`);
  }
  if (criteria.query) {
    parts.push(`(${criteria.query})`);
  }
  if (criteria.hasAttachment) {
    parts.push('has:attachment');
  }

  return parts.join(' ');
}

export function escapeSearchQuery(text: string): string {
  return `"${text.replace(/"/g, '\\"')}"`;
}

export function validateInput(data: Record<string, any>, field: string): void {
  if (!data || Object.keys(data).length === 0) {
    throw new Error(`At least one ${field} is required`);
  }
}
