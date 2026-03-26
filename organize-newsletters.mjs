import { createGmailClient } from './lib/gmail-client.mjs';
import { LABEL_NEWSLETTERS } from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';
import { createGmailFilter } from './lib/gmail-filter-utils.mjs';

const NEWSLETTER_PATTERNS = [
  'from:news@alphasignal.ai',
  'from:noreply@email.openai.com',
  'from:hello@adapty.io',
  'from:info@email.meetup.com',
  'from:googlecloud@google.com',
  'from:communications@yodlee.com',
  'from:updates-noreply@linkedin.com',
  'from:noreply@notifications.hubspot.com',
  'from:support@substack.com',
  'subject:newsletter OR subject:digest OR subject:weekly OR subject:monthly',
  'label:Promotions',
];

const NEWSLETTER_FILTERS = [
  { name: 'AlphaSignal News', criteria: { from: 'news@alphasignal.ai' } },
  { name: 'OpenAI Newsletter', criteria: { from: 'noreply@email.openai.com' } },
  { name: 'Adapty Updates', criteria: { from: 'hello@adapty.io' } },
  { name: 'Meetup Notifications', criteria: { from: 'info@email.meetup.com' } },
  { name: 'Google Cloud Updates', criteria: { from: 'googlecloud@google.com' } },
  { name: 'Promotional Emails', criteria: { query: 'label:Promotions' } },
];

async function organizeNewsletters() {
  const gmail = createGmailClient();

  console.log('ORGANIZING NEWSLETTERS\n');
  const labelCache = await buildLabelCache(gmail);
  const newsletterLabelId = labelCache.get(LABEL_NEWSLETTERS);
  if (!newsletterLabelId) {
    console.error('Newsletters label not found');
    process.exit(1);
  }
  console.log('═'.repeat(80));
  console.log('\n1. APPLYING LABEL TO EXISTING NEWSLETTERS\n');

  let totalLabeled = 0;
  for (const query of NEWSLETTER_PATTERNS) {
    try {
      const count = await searchAndModify(gmail, query, { addLabelIds: [newsletterLabelId] }, 100);
      if (count > 0) console.log(`  Applied to ${count} emails matching: "${query}"`);
      totalLabeled += count;
    } catch (error) {
      console.log(`  Error processing "${query}": ${error.message}`);
    }
  }

  console.log(`\n  Total labeled: ${totalLabeled} emails\n`);
  console.log('═'.repeat(80));
  console.log('\n2. CREATING AUTO-LABEL FILTER FOR FUTURE NEWSLETTERS\n');

  let filtersCreated = 0;
  for (const filterConfig of NEWSLETTER_FILTERS) {
    const filterId = await createGmailFilter(gmail, filterConfig.criteria, { addLabelIds: [newsletterLabelId] });
    if (filterId) {
      console.log(`  Filter created: ${filterConfig.name}`);
      filtersCreated++;
    } else {
      console.log(`  Filter already exists: ${filterConfig.name}`);
    }
  }

  console.log('═'.repeat(80));
  console.log('\nNEWSLETTER ORGANIZATION COMPLETE\n');
  console.log(`  Labeled existing emails: ${totalLabeled}`);
  console.log(`  Filters created: ${filtersCreated}`);
}

organizeNewsletters().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
