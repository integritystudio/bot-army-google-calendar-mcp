import { createGmailClient } from './lib/gmail-client.mjs';
import {
  GMAIL_UNREAD,
  LABEL_EVENTS, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES,
  LABEL_SERVICES, LABEL_BILLING, LABEL_MONITORING,
} from './lib/constants.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

// Pass --archived-only to restrict to emails no longer in inbox
const archivedOnly = process.argv.includes('--archived-only');
const archiveSuffix = archivedOnly ? ' -label:INBOX' : '';

// Excludes: Sentry Alerts, Keep Important
const LABELS = [LABEL_EVENTS, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING, LABEL_MONITORING];

const gmail = createGmailClient();
let total = 0;
for (const label of LABELS) {
  const count = await searchAndModify(gmail, `label:"${label}" is:unread${archiveSuffix}`, { removeLabelIds: [GMAIL_UNREAD] });
  if (count > 0) console.log(`${label}: ${count} marked as read`);
  total += count;
}
const qualifier = archivedOnly ? 'archived ' : '';
console.log(`Total: ${total} ${qualifier}emails marked as read`);
