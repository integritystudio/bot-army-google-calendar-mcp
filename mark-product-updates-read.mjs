import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_UNREAD, LABEL_PRODUCT_UPDATES } from './lib/constants.mjs';

async function markProductUpdatesRead() {
  const gmail = createGmailClient();

  console.log('📖 MARKING PRODUCT UPDATES AS READ\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: `label:"${LABEL_PRODUCT_UPDATES}"`,
      maxResults: 500
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} Product Updates emails\n`);

    if (messageIds.length === 0) {
      console.log('✅ No Product Updates to process\n');
      return;
    }

    const batchSize = 50;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize).map(m => m.id);

      await gmail.users.messages.batchModify({
        userId: USER_ID,
        requestBody: {
          ids: batch,
          removeLabelIds: [GMAIL_UNREAD]
        }
      });

      const processed = i + batch.length;
      console.log(`  ✅ Marked ${processed}/${messageIds.length} as read`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Product Updates marked as read: ${messageIds.length}\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

markProductUpdatesRead().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
