import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';
import { buildLabelCache, createLabels, applyPatterns } from './lib/gmail-label-utils.mjs';

async function createNewsletterTypeSubLabels() {
  const gmail = createGmailClient();

  console.log('📂 CREATING NEWSLETTER TYPE SUB-LABELS\n');
  console.log('═'.repeat(80) + '\n');

  // Pre-fetch existing labels to avoid N+1 queries
  const existingLabelMap = await buildLabelCache(gmail);

  // Step 1: Create both sub-labels
  console.log('1️⃣  CREATING LABELS\n');

  const labelNames = ['Newsletters/Company', 'Newsletters/News Aggregates'];
  const labelIds = {};

  await createLabels(gmail, labelNames, labelIds, existingLabelMap);

  // Step 2: Apply labels to existing emails
  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING LABELS TO EXISTING EMAILS\n');

  // Company-specific newsletters
  const companyPatterns = [
    { label: 'Newsletters/Company', query: 'from:news@alphasignal.ai' },
    { label: 'Newsletters/Company', query: 'from:noreply@email.openai.com' },
    { label: 'Newsletters/Company', query: 'from:hello@adapty.io' },
    { label: 'Newsletters/Company', query: 'from:googlecloud@google.com' },
    { label: 'Newsletters/Company', query: 'from:communications@yodlee.com' },
    { label: 'Newsletters/Company', query: 'from:lukak@storylane.io' },
    { label: 'Newsletters/Company', query: 'from:arthur@storylane.io' },
    { label: 'Newsletters/Company', query: 'from:teamcalendly@send.calendly.com' },
    { label: 'Newsletters/Company', query: 'from:hello@anthropic.com' },
  ];

  console.log('  Company newsletters:\n');
  const companyLabeled = await applyPatterns(gmail, companyPatterns, labelIds);

  console.log(`\n  📊 Company newsletters labeled: ${companyLabeled}\n`);

  // News aggregate newsletters (digests, roundups, curated)
  const aggregatePatterns = [
    { label: 'Newsletters/News Aggregates', query: 'subject:digest OR subject:roundup OR subject:"weekly digest" OR subject:"weekly summary"' },
    { label: 'Newsletters/News Aggregates', query: 'from:news@alphasignal.ai subject:digest' },
    { label: 'Newsletters/News Aggregates', query: 'subject:"week in" OR subject:"month in" OR subject:"what\'s new"' },
  ];

  console.log('  Aggregate newsletters:\n');
  const aggregateLabeled = await applyPatterns(gmail, aggregatePatterns, labelIds);

  console.log(`\n  📊 News aggregate newsletters labeled: ${aggregateLabeled}\n`);

  // Step 3: Create filters
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTERS\n');

  const companyFilters = [
    {
      name: 'Company: AlphaSignal',
      criteria: { from: 'news@alphasignal.ai' },
      type: 'Company',
    },
    {
      name: 'Company: OpenAI',
      criteria: { from: 'noreply@email.openai.com' },
      type: 'Company',
    },
    {
      name: 'Company: Adapty',
      criteria: { from: 'hello@adapty.io' },
      type: 'Company',
    },
    {
      name: 'Company: Google Cloud',
      criteria: { from: 'googlecloud@google.com' },
      type: 'Company',
    },
    {
      name: 'Company: Storylane',
      criteria: { from: 'lukak@storylane.io OR from:arthur@storylane.io' },
      type: 'Company',
    },
    {
      name: 'Aggregate: Digest Newsletters',
      criteria: { subject: 'digest OR roundup OR summary' },
      type: 'Aggregate',
    },
    {
      name: 'Aggregate: Weekly/Monthly Updates',
      criteria: { subject: '"week in" OR "month in" OR "what\'s new"' },
      type: 'Aggregate',
    },
  ];

  let filtersCreated = 0;

  for (const filter of companyFilters) {
    try {
      const labelId = filter.type === 'Company'
        ? labelIds['Newsletters/Company']
        : labelIds['Newsletters/News Aggregates'];

      const response = await gmail.users.settings.filters.create({
        userId: USER_ID,
        requestBody: {
          criteria: filter.criteria,
          action: {
            addLabelIds: [labelId],
          },
        },
      });

      console.log(`  ✅ Filter: ${filter.name}`);
      console.log(`     ID: ${response.data.id}\n`);
      filtersCreated++;
    } catch (error) {
      if (error.message.includes('exists')) {
        console.log(`  ℹ️  Filter exists: ${filter.name}`);
      } else {
        console.log(`  ⚠️  Error: ${filter.name}: ${error.message}`);
      }
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ NEWSLETTER TYPE SUB-LABELS COMPLETE\n');
  console.log(`  📌 Company newsletters labeled: ${companyLabeled}`);
  console.log(`  📌 News aggregate newsletters labeled: ${aggregateLabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log('\n📂 Updated Newsletter Label hierarchy:');
  console.log('   Newsletters');
  console.log('   ├── Company (direct company updates)');
  console.log('   │   ├── AlphaSignal');
  console.log('   │   ├── OpenAI');
  console.log('   │   ├── Adapty');
  console.log('   │   ├── Google Cloud');
  console.log('   │   └── Storylane');
  console.log('   ├── News Aggregates (curated summaries)');
  console.log('   ├── Social');
  console.log('   └── Subject-Based\n');
  console.log('💡 Newsletters are now organized by content type: direct company updates vs. curated news!');
}

createNewsletterTypeSubLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
