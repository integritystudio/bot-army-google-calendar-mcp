import { createGmailClient } from './lib/gmail-client.mjs';

const gmail = createGmailClient();

console.log('📧 REMAINING UNREAD EMAILS (201 total)\n');
console.log('═'.repeat(80) + '\n');

const searchResponse = await gmail.users.messages.list({
  userId: 'me',
  q: 'is:unread',
  maxResults: 50
});

const messages = searchResponse.data.messages || [];

for (const msg of messages) {
  const fullMsg = await gmail.users.messages.get({
    userId: 'me',
    id: msg.id,
    format: 'metadata',
    metadataHeaders: ['Subject', 'From', 'Date']
  });

  const headers = fullMsg.data.payload?.headers || [];
  const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
  const from = headers.find(h => h.name === 'From')?.value || '(unknown)';

  console.log(`• ${subject.substring(0, 70)}`);
  console.log(`  From: ${from.substring(0, 60)}\n`);
}

console.log(`Showing first 50 of 201 unread emails`);
console.log('═'.repeat(80) + '\n');
