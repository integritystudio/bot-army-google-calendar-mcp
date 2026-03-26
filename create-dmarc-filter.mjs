import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_INBOX, LABEL_DMARC_REPORTS } from './lib/constants.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const gmail = createGmailClient();
const labelId = await ensureLabelExists(gmail, LABEL_DMARC_REPORTS);
const filterId = await createGmailFilter(gmail,
  { query: 'subject:DMARC' },
  { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] },
);
console.log(filterId ? `Filter created: ${filterId}` : 'Filter already exists');
const count = await searchAndModify(gmail, 'subject:DMARC',
  { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] }, 100);
console.log(`DMARC: labeled and archived ${count} existing emails`);
