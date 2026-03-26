import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_UNREAD, LABEL_PRODUCT_UPDATES } from './lib/constants.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const gmail = createGmailClient();
const count = await searchAndModify(
  gmail,
  `label:"${LABEL_PRODUCT_UPDATES}" is:unread`,
  { removeLabelIds: [GMAIL_UNREAD] }
);
console.log(`Marked ${count} Product Updates as read`);
