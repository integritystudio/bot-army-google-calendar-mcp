import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_INBOX, LABEL_MONITORING } from './lib/constants.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const gmail = createGmailClient();
const labelId = await ensureLabelExists(gmail, LABEL_MONITORING);
const filterId = await createGmailFilter(gmail,
  { query: 'from:alertmanager@signoz.cloud' },
  { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] },
);
console.log(filterId ? `Filter created: ${filterId}` : 'Filter already exists');
const count = await searchAndModify(gmail, 'from:alertmanager@signoz.cloud',
  { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] }, 200);
console.log(`SigNoz: labeled and archived ${count} existing emails`);
