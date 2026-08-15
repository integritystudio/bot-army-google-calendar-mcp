import { gmail_v1 } from 'googleapis';
import { formatErrorMessage } from '../core/errorFormatting.js';
import type { GmailLabelChange } from '../../shared/gmail-core.js';

export const GMAIL_LABEL_INBOX = 'INBOX';
export const GMAIL_LABEL_SPAM = 'SPAM';
export const GMAIL_LABEL_TRASH = 'TRASH';
export const GMAIL_LABEL_UNREAD = 'UNREAD';

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

/**
 * Gmail has no "archive" or "mark as read" primitive — both the Filter action
 * resource and messages.modify express every such action purely as a label
 * change, accepting only addLabelIds/removeLabelIds (plus forward, on filters).
 * A field the API does not recognise is dropped without error, so a filter
 * carrying one is created and then does nothing.
 */
const LABEL_FLAGS: Record<string, { add?: string; remove?: string }> = {
  archive: { remove: GMAIL_LABEL_INBOX },
  markAsRead: { remove: GMAIL_LABEL_UNREAD },
  markAsSpam: { add: GMAIL_LABEL_SPAM },
  markAsTrash: { add: GMAIL_LABEL_TRASH },
  neverMarkAsSpam: { remove: GMAIL_LABEL_SPAM },
};

/**
 * Fold the boolean convenience flags into explicit label IDs, preserving any
 * addLabelIds/removeLabelIds the caller supplied directly.
 */
export function buildLabelChange(action: Record<string, any>): GmailLabelChange {
  const addLabelIds = [...(action.addLabelIds ?? [])];
  const removeLabelIds = [...(action.removeLabelIds ?? [])];

  for (const [flag, { add, remove }] of Object.entries(LABEL_FLAGS)) {
    if (!action[flag]) continue;
    if (add && !addLabelIds.includes(add)) addLabelIds.push(add);
    if (remove && !removeLabelIds.includes(remove)) removeLabelIds.push(remove);
  }

  const change: GmailLabelChange = {};
  if (addLabelIds.length) change.addLabelIds = addLabelIds;
  if (removeLabelIds.length) change.removeLabelIds = removeLabelIds;
  return change;
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
