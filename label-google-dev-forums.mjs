import { createGmailClient } from './lib/gmail-client.mjs';

const gmail = createGmailClient();

console.log('🏷️  LABELING GOOGLE DEVELOPER FORUMS\n');
console.log('═'.repeat(80) + '\n');

// Get Communities label ID
const labelsResp = await gmail.users.labels.list({ userId: 'me' });
const communitiesLabel = labelsResp.data.labels.find(l => l.name === 'Communities');

if (!communitiesLabel) {
  console.log('Communities label not found\n');
  process.exit(1);
}

// Find all Google Developer forum emails
const searchResp = await gmail.users.messages.list({
  userId: 'me',
  q: 'from:"no-reply@discuss.google.dev" OR from:"no-reply@discuss.google.com"',
  maxResults: 500
});

const messageIds = searchResp.data.messages || [];
console.log(`Found ${messageIds.length} Google Developer forum emails\n`);

if (messageIds.length === 0) {
  console.log('✅ No emails to process\n');
  process.exit(0);
}

// Label and mark as read in batches
const batchSize = 50;
let processedCount = 0;

for (let i = 0; i < messageIds.length; i += batchSize) {
  const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

  await gmail.users.messages.batchModify({
    userId: 'me',
    requestBody: {
      ids: batch.map(m => m.id),
      addLabelIds: [communitiesLabel.id],
      removeLabelIds: ['UNREAD']
    }
  });

  processedCount += batch.length;
  const processed = Math.min(i + batchSize, messageIds.length);
  console.log(`  ✅ Processed ${processed}/${messageIds.length}`);
}

console.log('\n' + '═'.repeat(80));
console.log('COMPLETE\n');
console.log(`✅ Google Developer forums labeled as Communities: ${messageIds.length}`);
console.log(`✅ All marked as read\n`);
console.log('═'.repeat(80) + '\n');
