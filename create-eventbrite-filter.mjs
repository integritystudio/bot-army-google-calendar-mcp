import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_INBOX, LABEL_EVENTS } from './lib/constants.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const gmail = createGmailClient();
const labelId = await ensureLabelExists(gmail, LABEL_EVENTS);
const filterId = await createGmailFilter(gmail,
  { query: 'from:noreply@reminder.eventbrite.com' },
  { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] },
);
console.log(filterId ? `Filter created: ${filterId}` : 'Filter already exists');
const count = await searchAndModify(gmail, 'is:unread from:noreply@reminder.eventbrite.com',
  { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] });
console.log(`Eventbrite: applied to ${count} existing unread emails`);
