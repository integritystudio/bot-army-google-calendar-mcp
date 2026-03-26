import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_UNREAD } from './lib/constants.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const gmail = createGmailClient();
const count = await searchAndModify(
  gmail,
  'from:(alertmanager@signoz.cloud OR vishal@mail.signoz.io)',
  { removeLabelIds: [GMAIL_UNREAD] }
);
console.log(`Marked ${count} SigNoz emails as read`);
