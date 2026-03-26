import { createGmailClient } from './lib/gmail-client.mjs';
import {
  GMAIL_UNREAD,
  LABEL_PRODUCT_UPDATES, LABEL_MONITORING, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING,
} from './lib/constants.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const LABELS = [LABEL_PRODUCT_UPDATES, LABEL_MONITORING, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING];

const gmail = createGmailClient();
let total = 0;
for (const label of LABELS) {
  const count = await searchAndModify(gmail, `label:"${label}" is:unread -label:INBOX`, { removeLabelIds: [GMAIL_UNREAD] });
  if (count > 0) console.log(`${label}: ${count} marked as read`);
  total += count;
}
console.log(`Total: ${total} archived emails marked as read`);
