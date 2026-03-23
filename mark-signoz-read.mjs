import { createGmailClient } from './lib/gmail-client.mjs';

async function markSignozRead() {
  const gmail = createGmailClient();

  console.log('📖 MARKING SIGNOZ EMAILS AS READ\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Search for all SigNoz emails (both read and unread)
    const searchQuery = 'from:(alertmanager@signoz.cloud OR vishal@mail.signoz.io)';
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 500
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} SigNoz emails\n`);

    if (messageIds.length === 0) {
      console.log('✅ No SigNoz emails found\n');
      return;
    }

    // Mark all as read in batches
    const batchSize = 50;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize).map(m => m.id);

      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: batch.map(m => m.id),
          removeLabelIds: ['UNREAD']
        }
      });

      const processed = Math.min(i + batchSize, messageIds.length);
      console.log(`  ✅ Marked ${processed}/${messageIds.length} as read`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ SigNoz emails processed: ${messageIds.length}\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

markSignozRead().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
