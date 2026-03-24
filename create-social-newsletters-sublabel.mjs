import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';
import { buildLabelCache, createLabels, applyPatterns } from './lib/gmail-label-utils.mjs';

async function createSocialNewslettersSubLabel() {
  const gmail = createGmailClient();

  console.log('📂 CREATING SOCIAL NEWSLETTERS SUB-LABEL\n');
  console.log('═'.repeat(80) + '\n');

  // Pre-fetch existing labels to avoid N+1 queries
  const existingLabelMap = await buildLabelCache(gmail);

  // Step 1: Create sub-label
  console.log('1️⃣  CREATING LABEL: Newsletters/Social\n');

  const labelIds = {};
  await createLabels(gmail, ['Newsletters/Social'], labelIds, existingLabelMap);

  const subLabelId = labelIds['Newsletters/Social'];

  // Step 2: Apply label to existing social newsletter emails (excluding events)
  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING LABEL TO EXISTING EMAILS\n');

  const socialPatterns = [
    { label: 'Newsletters/Social', query: 'from:updates-noreply@linkedin.com -"📅" -subject:event -subject:invitation -subject:invite' },
    { label: 'Newsletters/Social', query: 'from:noreply@twitter.com -"📅" -subject:event' },
    { label: 'Newsletters/Social', query: 'from:notifications@reddit.com -"📅" -subject:event' },
    { label: 'Newsletters/Social', query: 'from:hello@facebook.com -"📅" -subject:event' },
    { label: 'Newsletters/Social', query: 'label:CATEGORY_SOCIAL -"📅" -subject:event -subject:invitation' },
  ];

  const totalLabeled = await applyPatterns(gmail, socialPatterns, labelIds);

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  // Step 3: Create filter for future social newsletters
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTERS\n');

  const filters = [
    {
      name: 'LinkedIn Social Updates',
      criteria: { from: 'updates-noreply@linkedin.com' },
    },
    {
      name: 'Twitter/X Updates',
      criteria: { from: 'noreply@twitter.com' },
    },
    {
      name: 'Reddit Notifications',
      criteria: { from: 'notifications@reddit.com' },
    },
    {
      name: 'Facebook Updates',
      criteria: { from: 'hello@facebook.com' },
    },
    {
      name: 'Social Category (Excluding Events)',
      criteria: {
        query: 'label:CATEGORY_SOCIAL -subject:event -subject:invitation -subject:invite'
      },
    },
  ];

  let filtersCreated = 0;

  for (const filter of filters) {
    try {
      const response = await gmail.users.settings.filters.create({
        userId: USER_ID,
        requestBody: {
          criteria: filter.criteria,
          action: {
            addLabelIds: [subLabelId],
          },
        },
      });

      console.log(`  ✅ Filter created: ${filter.name}`);
      console.log(`     ID: ${response.data.id}\n`);
      filtersCreated++;
    } catch (error) {
      if (error.message.includes('exists')) {
        console.log(`  ℹ️  Filter already exists: ${filter.name}`);
      } else {
        console.log(`  ⚠️  Error creating filter "${filter.name}": ${error.message}`);
      }
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ SOCIAL NEWSLETTER SUB-LABEL COMPLETE\n');
  console.log(`  📌 Emails labeled: ${totalLabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log(`  📂 Label: Newsletters/Social (${subLabelId})`);
  console.log('\n💡 Social newsletters are now organized separately, with events excluded!');
  console.log('\n📂 Updated Newsletter Label hierarchy:');
  console.log('   Newsletters');
  console.log('   ├── Social');
  console.log('   ├── Subject-Based');
  console.log('   ├── AlphaSignal');
  console.log('   ├── OpenAI');
  console.log('   ├── Adapty');
  console.log('   ├── Meetup');
  console.log('   └── Google Cloud\n');
}

createSocialNewslettersSubLabel().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
