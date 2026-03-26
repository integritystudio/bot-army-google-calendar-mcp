import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_UNREAD, LABEL_COMMUNITIES } from './lib/constants.mjs';

const gmail = createGmailClient();

console.log('🏷️  LABELING GOOGLE DEVELOPER FORUMS\n');
console.log('═'.repeat(80) + '\n');

const labelsResp = await gmail.users.labels.list({ userId: USER_ID });
const communitiesLabel = labelsResp.data.labels.find(l => l.name === LABEL_COMMUNITIES);

if (!communitiesLabel) {
  console.log('Communities label not found\n');
  process.exit(1);
}

const searchResp = await gmail.users.messages.list({
  userId: USER_ID,
  q: 'from:"no-reply@discuss.google.dev" OR from:"no-reply@discuss.google.com"',
  maxResults: 500
});

const messageIds = searchResp.data.messages || [];
console.log(`Found ${messageIds.length} Google Developer forum emails\n`);

if (messageIds.length === 0) {
  console.log('✅ No emails to process\n');
  process.exit(0);
}

const batchSize = 50;
let processedCount = 0;

for (let i = 0; i < messageIds.length; i += batchSize) {
  const batch = messageIds.slice(i, i + batchSize);

  await gmail.users.messages.batchModify({
    userId: USER_ID,
    requestBody: {
      ids: batch.map(m => m.id),
      addLabelIds: [communitiesLabel.id],
      removeLabelIds: [GMAIL_UNREAD]
    }
  });

  processedCount += batch.length;
  const processed = i + batch.length;
  console.log(`  ✅ Processed ${processed}/${messageIds.length}`);
}

console.log('\n' + '═'.repeat(80));
console.log('COMPLETE\n');
console.log(`✅ Google Developer forums labeled as Communities: ${messageIds.length}`);
console.log(`✅ All marked as read\n`);
console.log('═'.repeat(80) + '\n');
