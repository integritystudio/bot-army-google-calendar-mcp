import { createGmailClient } from './lib/gmail-client.mjs';
import {
  USER_ID, GMAIL_UNREAD,
  LABEL_PRODUCT_UPDATES, LABEL_MONITORING, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING,
} from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';

async function markArchivedAsRead() {
  const gmail = createGmailClient();

  console.log('📖 MARKING ARCHIVED EMAILS AS READ\n');
  console.log('═'.repeat(80) + '\n');

  const categoriesToProcess = [
    LABEL_PRODUCT_UPDATES,
    LABEL_MONITORING,
    LABEL_COMMUNITIES,
    LABEL_SERVICES,
    LABEL_BILLING,
  ];

  let totalMarked = 0;

  try {
    const labelCache = await buildLabelCache(gmail);

    for (const category of categoriesToProcess) {
      const labelId = labelCache.get(category);
      if (!labelId) continue;

      const searchQuery = `label:"${category}" is:unread -label:INBOX`;
      const searchResponse = await gmail.users.messages.list({
        userId: USER_ID,
        q: searchQuery,
        maxResults: 500
      });

      const messageIds = searchResponse.data.messages || [];
      console.log(`${category}: ${messageIds.length} unread\n`);

      if (messageIds.length === 0) continue;

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

        totalMarked += batch.length;
        const processed = i + batch.length;
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
