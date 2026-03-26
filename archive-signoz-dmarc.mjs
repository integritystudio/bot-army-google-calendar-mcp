import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_INBOX } from './lib/constants.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const gmail = createGmailClient();
const archive = { removeLabelIds: [GMAIL_INBOX] };

const signozCount = await searchAndModify(
  gmail,
  'from:(alertmanager@signoz.cloud OR vishal@mail.signoz.io)',
  archive,
  200
);
const dmarcCount = await searchAndModify(gmail, 'subject:DMARC', archive, 200);
console.log(`Archived: ${signozCount} SigNoz, ${dmarcCount} DMARC (total: ${signozCount + dmarcCount})`);
