import { createGmailClient } from './lib/gmail-client.mjs';

const USER_ID = 'me';

async function createSocialNewslettersSubLabel() {
  const gmail = createGmailClient();

  console.log('📂 CREATING SOCIAL NEWSLETTERS SUB-LABEL\n');
  console.log('═'.repeat(80) + '\n');

  // Pre-fetch existing labels to avoid N+1 queries
  const existingLabelsRes = await gmail.users.labels.list({ userId: USER_ID, fields: 'labels(id,name)' });
  const existingLabelMap = new Map(
    existingLabelsRes.data.labels.map(l => [l.name, l.id])
  );

  // Step 1: Create sub-label
  console.log('1️⃣  CREATING LABEL: Newsletters/Social\n');

  let subLabelId;

  try {
    const response = await gmail.users.labels.create({
      userId: USER_ID,
      requestBody: {
        name: 'Newsletters/Social',
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });

    console.log('✅ Label created successfully!');
    console.log(`   Name: ${response.data.name}`);
    console.log(`   ID: ${response.data.id}\n`);
    subLabelId = response.data.id;

  } catch (error) {
    if (error.message.includes('exists') || error.message.includes('conflicts')) {
      console.log('⚠️  Label already exists: Newsletters/Social\n');
      const existingId = existingLabelMap.get('Newsletters/Social');
      if (existingId) {
        console.log(`   ID: ${existingId}\n`);
        subLabelId = existingId;
      }
    } else {
      console.error('❌ Error creating label:', error.message);
      process.exit(1);
    }
  }

  // Step 2: Apply label to existing social newsletter emails (excluding events)
  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING LABEL TO EXISTING EMAILS\n');

  const socialPatterns = [
    'from:updates-noreply@linkedin.com -"📅" -subject:event -subject:invitation -subject:invite',
    'from:noreply@twitter.com -"📅" -subject:event',
    'from:notifications@reddit.com -"📅" -subject:event',
    'from:hello@facebook.com -"📅" -subject:event',
    'label:CATEGORY_SOCIAL -"📅" -subject:event -subject:invitation',
  ];

  let totalLabeled = 0;
  const processedQueries = new Set();

  for (const query of socialPatterns) {
    if (processedQueries.has(query)) continue;
    processedQueries.add(query);

    try {
      const searchResult = await gmail.users.messages.list({
        userId: USER_ID,
        q: query,
        maxResults: 100,
      });

      if (!searchResult.data.messages) continue;

      const messageIds = searchResult.data.messages.map(m => m.id);
      const count = messageIds.length;

      if (count > 0) {
        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: messageIds,
            addLabelIds: [subLabelId],
          },
        });

        console.log(`  ✅ Applied to ${count} emails matching: "${query.substring(0, 60)}..."`);
        totalLabeled += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error processing query: ${error.message}`);
    }
  }

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
