import { createGmailClient } from './lib/gmail-client.mjs';
import { LABEL_EVENTS, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const gmail = createGmailClient();

console.log('🏷️  LABELING REMAINING UNREAD EMAILS\n');
console.log('═'.repeat(80) + '\n');

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

const labelCache = await buildLabelCache(gmail);

for (const rule of labelingRules) {
  const labelId = labelCache.get(rule.label);
  if (!labelId) {
    console.log(`⚠️  Label not found: ${rule.label}\n`);
    continue;
  }

  const queryCounts = await Promise.all(rule.queries.map(async (query) => {
    const count = await searchAndModify(gmail, `is:unread ${query}`, { addLabelIds: [labelId] });
    if (count > 0) console.log(`${rule.label} - ${query}: ${count} labeled`);
    return count;
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
