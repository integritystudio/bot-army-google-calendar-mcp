import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';
import { getHeader } from './lib/email-utils.mjs';

async function listRemaining() {
  const gmail = createGmailClient();

  console.log('📧 REMAINING UNREAD EMAILS IN INBOX\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const response = await gmail.users.messages.list({
      userId: USER_ID,
      q: 'is:unread is:inbox',
      maxResults: 100
    });

    const messageIds = response.data.messages || [];
    console.log(`Total remaining: ${messageIds.length} unread emails\n`);

    if (messageIds.length === 0) {
      console.log('✅ INBOX CLEAR! No unread emails remaining.\n');
      console.log('═'.repeat(80) + '\n');
      return;
    }

    const messages = await Promise.all(
      messageIds.map(async (msg) => {
        const fullMsg = await gmail.users.messages.get({
          userId: USER_ID,
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date']
        });

        const headers = fullMsg.data.payload?.headers || [];
        return {
          id: msg.id,
          subject: getHeader(headers, 'Subject', '(No subject)'),
          from: getHeader(headers, 'From', '(Unknown)'),
          date: getHeader(headers, 'Date'),
          snippet: fullMsg.data.snippet || ''
        };
      })
    );

    messages.forEach((email, idx) => {
      console.log(`${idx + 1}. 👤 ${email.from.substring(0, 50)}`);
      console.log(`   📌 ${email.subject.substring(0, 65)}`);
      console.log(`   📝 ${email.snippet.substring(0, 70)}...`);
      console.log(`   📅 ${email.date.substring(0, 30)}\n`);
    });

    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listRemaining().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
