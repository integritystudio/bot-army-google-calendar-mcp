import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_INBOX, LABEL_DMARC_REPORTS } from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const gmail = createGmailClient();
const labelCache = await buildLabelCache(gmail);
const dmarcLabelId = labelCache.get(LABEL_DMARC_REPORTS);
if (!dmarcLabelId) {
  console.error('DMARC Reports label not found');
  process.exit(1);
}

const count = await searchAndModify(
  gmail,
  'subject:DMARC',
  { addLabelIds: [dmarcLabelId], removeLabelIds: [GMAIL_INBOX] },
  100
);
console.log(`Archived ${count} DMARC emails`);
