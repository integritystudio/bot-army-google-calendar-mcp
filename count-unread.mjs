import { createGmailClient } from './lib/gmail-client.mjs';

const gmail = createGmailClient();
const result = await gmail.users.messages.list({
  userId: 'me',
  q: 'is:unread'
});

console.log('Total unread (is:unread):', result.data.resultSizeEstimate);
console.log('Messages in first page:', result.data.messages?.length || 0);
