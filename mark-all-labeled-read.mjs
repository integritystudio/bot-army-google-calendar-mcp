import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_UNREAD, LABEL_EVENTS, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING, LABEL_MONITORING } from './lib/constants.mjs';

async function markAllLabeledAsRead() {
  const gmail = createGmailClient();

  console.log('📖 MARKING ALL LABELED CATEGORIES AS READ\n');
  console.log('═'.repeat(80) + '\n');

  // Excluding Sentry Alerts and Keep Important
  const labelNames = [LABEL_EVENTS, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING, LABEL_MONITORING];

  let totalMarked = 0;

  for (const name of labelNames) {
    try {
      const searchResponse = await gmail.users.messages.list({
        userId: USER_ID,
        q: `label:"${name}" is:unread`,
        maxResults: 500
      });

      const labeledUnread = searchResponse.data.messages || [];

      if (labeledUnread.length === 0) {
        console.log(`${name}: 0 unread\n`);
        continue;
      }

      console.log(`${name}: ${labeledUnread.length} unread`);

      const batchSize = 50;
      for (let i = 0; i < labeledUnread.length; i += batchSize) {
        const batch = labeledUnread.slice(i, i + batchSize).map(m => m.id);

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch,
            removeLabelIds: [GMAIL_UNREAD]
          }
        });

        totalMarked += batch.length;
        const processed = i + batch.length;
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
