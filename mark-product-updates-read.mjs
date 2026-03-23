import { createGmailClient } from './lib/gmail-client.mjs';

async function markProductUpdatesRead() {
  const gmail = createGmailClient();

  console.log('📖 MARKING PRODUCT UPDATES AS READ\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get Product Updates label
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const productLabel = (labelsResponse.data.labels || []).find(l => l.name === 'Product Updates');

    if (!productLabel) {
      console.log('Product Updates label not found\n');
      return;
    }

    // Find all emails with Product Updates label
    const searchQuery = `label:"${productLabel.name}"`;
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 500
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} Product Updates emails\n`);

    if (messageIds.length === 0) {
      console.log('✅ No Product Updates to process\n');
      return;
    }

    // Mark all as read in batches
    const batchSize = 50;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize).map(m => m.id);

      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: batch,
          removeLabelIds: ['UNREAD']
        }
      });

      const processed = Math.min(i + batchSize, messageIds.length);
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
