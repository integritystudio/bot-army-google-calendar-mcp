import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';
import { getHeader } from './lib/email-utils.mjs';

const gmail = createGmailClient();

console.log('📧 REMAINING UNREAD EMAILS (201 total)\n');
console.log('═'.repeat(80) + '\n');

const searchResponse = await gmail.users.messages.list({
  userId: USER_ID,
  q: 'is:unread',
  maxResults: 50
});

const messages = searchResponse.data.messages || [];

const fullMsgs = await Promise.all(
  messages.map(msg =>
    gmail.users.messages.get({
      userId: USER_ID,
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date']
    })
  )
);

for (const fullMsg of fullMsgs) {
  const headers = fullMsg.data.payload?.headers || [];
  const subject = getHeader(headers, 'Subject', '(no subject)');
  const from = getHeader(headers, 'From', '(unknown)');

  console.log(`• ${subject.substring(0, 70)}`);
  console.log(`  From: ${from.substring(0, 60)}\n`);
}

console.log(`Showing first 50 of 201 unread emails`);
console.log('═'.repeat(80) + '\n');
