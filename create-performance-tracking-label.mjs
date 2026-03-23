import { createGmailClient } from './lib/gmail-client.mjs';

const USER_ID = 'me';

async function createPerformanceTrackingLabel() {
  const gmail = createGmailClient();

  console.log('📊 CREATING PERFORMANCE TRACKING LABEL\n');
  console.log('═'.repeat(80) + '\n');

  // Pre-fetch existing labels to avoid N+1 queries
  const existingLabelsRes = await gmail.users.labels.list({
    userId: USER_ID,
    fields: 'labels(id,name)',
  });
  const existingLabelMap = new Map(
    existingLabelsRes.data.labels.map(l => [l.name, l.id])
  );

  // Step 1: Create Performance Tracking label
  console.log('1️⃣  CREATING LABEL: Performance Tracking\n');

  let perfLabelId;

  try {
    const response = await gmail.users.labels.create({
      userId: USER_ID,
      requestBody: {
        name: 'Performance Tracking',
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });

    console.log('✅ Label created successfully!');
    console.log(`   Name: ${response.data.name}`);
    console.log(`   ID: ${response.data.id}\n`);
    perfLabelId = response.data.id;

  } catch (error) {
    if (error.message.includes('exists') || error.message.includes('conflicts')) {
      console.log('⚠️  Label already exists: Performance Tracking\n');
      const existingId = existingLabelMap.get('Performance Tracking');
      if (existingId) {
        console.log(`   ID: ${existingId}\n`);
        perfLabelId = existingId;
      }
    } else {
      console.error('❌ Error creating label:', error.message);
      process.exit(1);
    }
  }

  // Step 2: Find and relabel Sentry emails
  console.log('═'.repeat(80));
  console.log('\n2️⃣  MOVING SENTRY UPDATES FROM NEWSLETTER TO PERFORMANCE TRACKING\n');

  const sentryPatterns = [
    'from:noreply@md.getsentry.com',
    'subject:Sentry OR subject:"TCAD-SCRAPER-BACKEND"',
  ];

  const newsletterLabelId = 'Label_7'; // Newsletters/Subject-Based
  let totalRelabeled = 0;

  for (const query of sentryPatterns) {
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
            addLabelIds: [perfLabelId],
            removeLabelIds: [newsletterLabelId],
          },
        });

        console.log(`  ✅ Relabeled ${count} emails matching: "${query.substring(0, 50)}..."`);
        console.log(`     Added: Performance Tracking`);
        console.log(`     Removed: Newsletters/Subject-Based\n`);
        totalRelabeled += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error with "${query}": ${error.message}`);
    }
  }

  console.log(`  📊 Total relabeled: ${totalRelabeled} emails\n`);

  // Step 3: Create filter for future Sentry emails
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTER FOR SENTRY\n');

  const filters = [
    {
      name: 'Sentry Error Tracking',
      criteria: { from: 'noreply@md.getsentry.com' },
    },
    {
      name: 'Sentry Alerts & Reports',
      criteria: { subject: 'Sentry OR "TCAD-SCRAPER-BACKEND"' },
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
            addLabelIds: [perfLabelId],
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
  console.log('\n✨ PERFORMANCE TRACKING LABEL COMPLETE\n');
  console.log(`  📌 Sentry emails relabeled: ${totalRelabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log(`  📂 Label: Performance Tracking (${perfLabelId})`);
  console.log('\n💡 Sentry updates are now tracked under Performance Tracking, not Newsletters!\n');
  console.log('📂 New Top-Level Label:');
  console.log('   Performance Tracking');
  console.log('   ├── Sentry Error Reports');
  console.log('   ├── Weekly Reports');
  console.log('   └── (other performance data)\n');
}

createPerformanceTrackingLabel().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
