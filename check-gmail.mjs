import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';

async function checkUnreadEmails() {
  try {
    const gmail = createGmailClient();

    const response = await gmail.users.messages.list({
      userId: USER_ID,
      q: 'is:unread',
      maxResults: 1
    });

    const unreadCount = response.data.resultSizeEstimate || 0;
    console.log(`\nUnread messages: ${unreadCount}`);

  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.message.includes('insufficient permissions')) {
      console.error('\nYour OAuth tokens need Gmail scope. Authenticate again with:');
      console.error('npm run auth');
    }
    process.exit(1);
  }
}

checkUnreadEmails().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});