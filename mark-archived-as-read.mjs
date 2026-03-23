import { createGmailClient } from './lib/gmail-client.mjs';

async function markArchivedAsRead() {
  const gmail = createGmailClient();

  console.log('📖 MARKING ARCHIVED EMAILS AS READ\n');
  console.log('═'.repeat(80) + '\n');

  const categoriesToProcess = [
    'Product Updates',
    'Monitoring',
    'Communities',
    'Services & Alerts',
    'Billing'
  ];

  let totalMarked = 0;

  try {
    // Get all labels
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const labels = labelsResponse.data.labels || [];
    if (labels.length === 0) {
      console.log('No labels found\n');
      return;
    }
    const labelMap = {};
    labels.forEach(l => { labelMap[l.name] = l.id; });

    for (const category of categoriesToProcess) {
      const labelId = labelMap[category];
      if (!labelId) continue;

      // Find unread emails with this label (not in INBOX - archived)
      const searchQuery = `label:"${category}" is:unread -label:INBOX`;
      const searchResponse = await gmail.users.messages.list({
        userId: 'me',
        q: searchQuery,
        maxResults: 500
      });

      const messageIds = searchResponse.data.messages || [];
      console.log(`${category}: ${messageIds.length} unread\n`);

      if (messageIds.length === 0) continue;

      // Mark as read in batches
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

        totalMarked += batch.length;
        const processed = Math.min(i + batchSize, messageIds.length);
        console.log(`  ✅ Marked ${processed}/${messageIds.length} as read`);
      }

      console.log();
    }

    console.log('═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`📖 Total emails marked as read: ${totalMarked}\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

markArchivedAsRead().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
