/**
 * Group the inbox by Gmail's own category tabs, marking unread with *.
 *
 * A report-messages.mjs preset.
 *
 * Usage: node list-inbox.mjs
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { report } from './report-messages.mjs';

const LIMIT = 200;

const gmail = await createGmailClient();
await report(gmail, [{ name: `Inbox (newest ${LIMIT})`, query: 'in:inbox' }], {
  columns: ['unread', 'sender', 'subject'],
  format: 'list',
  groupBy: 'category',
  max: LIMIT,
});
