import { createGmailClient } from './lib/gmail-client.mjs';

const gmail = createGmailClient();

console.log('🏷️  LABELING REMAINING UNREAD EMAILS\n');
console.log('═'.repeat(80) + '\n');

// Define labeling rules by sender/content pattern
const labelingRules = [
  {
    label: 'Events',
    queries: [
      'from:info@email.meetup.com',
      'from:notifications@email.calendly.com OR from:teamcalendly@send.calendly.com',
      'from:info@email.meetup.com subject:"Just scheduled"',
    ]
  },
  {
    label: 'Product Updates',
    queries: [
      'from:googlecloud@google.com OR from:CloudPlatform-noreply@google.com',
      'from:news@alphasignal.ai',
      'from:noreply@email.openai.com',
      'from:lukak@storylane.io',
      'from:no-reply@email.claude.com'
    ]
  },
  {
    label: 'Communities',
    queries: [
      'from:wtm@technovation.org'
    ]
  },
  {
    label: 'Keep Important',
    queries: [
      'from:capitalcity@a.helpfulvillage.com'
    ]
  }
];

// Get labels first
const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
const labelMap = {};
labelsResponse.data.labels.forEach(l => { labelMap[l.name] = l.id; });

// Process each rule
for (const rule of labelingRules) {
  if (!labelMap[rule.label]) {
    console.log(`⚠️  Label not found: ${rule.label}\n`);
    continue;
  }

  let totalLabeled = 0;

  for (const query of rule.queries) {
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: `is:unread ${query}`,
      maxResults: 500
    });

    const messageIds = searchResponse.data.messages || [];
    if (messageIds.length === 0) continue;

    console.log(`${rule.label} - ${query}: ${messageIds.length}`);

    // Apply label in batches
    const batchSize = 50;
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: batch.map(m => m.id),
          addLabelIds: [labelMap[rule.label]]
        }
      });

      totalLabeled += batch.length;
    }

    console.log(`  ✅ Labeled ${messageIds.length}`);
  }

  if (totalLabeled > 0) {
    console.log(`\n${rule.label} total: ${totalLabeled}\n`);
  }
}

console.log('═'.repeat(80));
console.log('COMPLETE\n');
console.log('Remaining unread are now labeled appropriately.\n');
console.log('═'.repeat(80) + '\n');
