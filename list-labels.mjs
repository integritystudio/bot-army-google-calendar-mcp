import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, GMAIL_UNREAD, GMAIL_SENT, GMAIL_DRAFT, GMAIL_SPAM, GMAIL_TRASH, GMAIL_IMPORTANT } from './lib/constants.mjs';

const gmail = createGmailClient();

const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
const allLabels = labelsResponse.data.labels || [];

console.log('Custom Labels:\n');
allLabels
  .filter(l => !l.name.startsWith('['))
  .filter(l => ![GMAIL_INBOX, GMAIL_SENT, GMAIL_DRAFT, GMAIL_SPAM, GMAIL_TRASH, GMAIL_UNREAD, GMAIL_IMPORTANT].includes(l.name))
  .slice(0, 30)
  .forEach(l => {
    console.log(`${l.name}: ${l.id}`);
  });
