import { gmail_v1 } from 'googleapis';
import { formatErrorMessage } from '../core/errorFormatting.js';
import {
  buildLabelChange,
  GMAIL_LABEL_INBOX,
  GMAIL_LABEL_SPAM,
  GMAIL_LABEL_TRASH,
  GMAIL_LABEL_UNREAD,
} from '../../shared/gmail-core.js';

export { buildLabelChange, GMAIL_LABEL_INBOX, GMAIL_LABEL_SPAM, GMAIL_LABEL_TRASH, GMAIL_LABEL_UNREAD };

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
