import { createGmailClient } from './lib/gmail-client.mjs';

const gmail = createGmailClient();

const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
const allLabels = labelsResponse.data.labels || [];

console.log('Custom Labels:\n');
allLabels
  .filter(l => !l.name.startsWith('['))
  .filter(l => !['INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD', 'IMPORTANT'].includes(l.name))
  .slice(0, 30)
  .forEach(l => {
    console.log(`${l.name}: ${l.id}`);
  });
