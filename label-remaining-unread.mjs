import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, LABEL_EVENTS, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';

const gmail = createGmailClient();

console.log('🏷️  LABELING REMAINING UNREAD EMAILS\n');
console.log('═'.repeat(80) + '\n');

// Define labeling rules by sender/content pattern
const labelingRules = [
  {
    label: LABEL_EVENTS,
    queries: [
      'from:info@email.meetup.com',
      'from:notifications@email.calendly.com OR from:teamcalendly@send.calendly.com',
      'from:info@email.meetup.com subject:"Just scheduled"',
    ]
  },
  {
    label: LABEL_PRODUCT_UPDATES,
    queries: [
      'from:googlecloud@google.com OR from:CloudPlatform-noreply@google.com',
      'from:news@alphasignal.ai',
      'from:noreply@email.openai.com',
      'from:lukak@storylane.io',
      'from:no-reply@email.claude.com'
    ]
  },
  {
    label: LABEL_COMMUNITIES,
    queries: [
      'from:wtm@technovation.org'
    ]
  },
  {
    label: LABEL_KEEP_IMPORTANT,
    queries: [
      'from:capitalcity@a.helpfulvillage.com'
    ]
  }
];

const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
const labelMap = {};
labelsResponse.data.labels.forEach(l => { labelMap[l.name] = l.id; });

for (const rule of labelingRules) {
  if (!labelMap[rule.label]) {
    console.log(`⚠️  Label not found: ${rule.label}\n`);
    continue;
  }

  const queryCounts = await Promise.all(rule.queries.map(async (query) => {
    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: `is:unread ${query}`,
      maxResults: 500
    });

    const messageIds = searchResponse.data.messages || [];
    if (messageIds.length === 0) return 0;

    console.log(`${rule.label} - ${query}: ${messageIds.length}`);

    const batchSize = 50;
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      await gmail.users.messages.batchModify({
        userId: USER_ID,
        requestBody: {
          ids: batch.map(m => m.id),
          addLabelIds: [labelMap[rule.label]]
        }
      });
    }

    console.log(`  ✅ Labeled ${messageIds.length}`);
    return messageIds.length;
  }));

  const totalLabeled = queryCounts.reduce((sum, n) => sum + n, 0);

  if (totalLabeled > 0) {
    console.log(`\n${rule.label} total: ${totalLabeled}\n`);
  }
}

console.log('═'.repeat(80));
console.log('COMPLETE\n');
console.log('Remaining unread are now labeled appropriately.\n');
console.log('═'.repeat(80) + '\n');
