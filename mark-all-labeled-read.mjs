import { createGmailClient } from './lib/gmail-client.mjs';

async function markAllLabeledAsRead() {
  const gmail = createGmailClient();

  console.log('📖 MARKING ALL LABELED CATEGORIES AS READ\n');
  console.log('═'.repeat(80) + '\n');

  // Labels to mark as read (excluding Sentry Alerts and Keep Important)
  const labels = {
    'Events': 'Label_1',
    'Product Updates': 'Label_41',
    'Communities': 'Label_51',
    'Services & Alerts': 'Label_52',
    'Billing': 'Label_47',
    'Monitoring': 'Label_48'
  };

  let totalMarked = 0;

  for (const [name, id] of Object.entries(labels)) {
    try {
      const searchResponse = await gmail.users.messages.list({
        userId: 'me',
        q: `label:${id} is:unread`,
        maxResults: 500
      });

      const labeledUnread = searchResponse.data.messages || [];

      if (labeledUnread.length === 0) {
        console.log(`${name}: 0 unread\n`);
        continue;
      }

      console.log(`${name}: ${labeledUnread.length} unread`);

      // Mark as read in batches
      const batchSize = 50;
      for (let i = 0; i < labeledUnread.length; i += batchSize) {
        const batch = labeledUnread.slice(i, i + batchSize).map(m => m.id);

        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch,
            removeLabelIds: ['UNREAD']
          }
        });

        totalMarked += batch.length;
        const processed = Math.min(i + batchSize, labeledUnread.length);
        console.log(`  ✅ Marked ${processed}/${labeledUnread.length} as read`);
      }

      console.log();
    } catch (e) {
      console.error(`Error processing ${name}:`, e.message);
    }
  }

  console.log('═'.repeat(80));
  console.log('COMPLETE\n');
  console.log(`📖 Total emails marked as read: ${totalMarked}`);
  console.log(`✅ Kept unread: Sentry Alerts, Keep Important\n`);
  console.log('═'.repeat(80) + '\n');
}

markAllLabeledAsRead().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
