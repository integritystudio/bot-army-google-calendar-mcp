import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, LABEL_PERFORMANCE_TRACKING, LABEL_NEWSLETTERS_SUBJECT_BASED } from './lib/constants.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

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

  console.log('1️⃣  CREATING LABEL: Performance Tracking\n');

  let perfLabelId;

  try {
    const response = await gmail.users.labels.create({
      userId: USER_ID,
      requestBody: {
        name: LABEL_PERFORMANCE_TRACKING,
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
      const existingId = existingLabelMap.get(LABEL_PERFORMANCE_TRACKING);
      if (existingId) {
        console.log(`   ID: ${existingId}\n`);
        perfLabelId = existingId;
      }
    } else {
      console.error('❌ Error creating label:', error.message);
      process.exit(1);
    }
  }

  console.log('═'.repeat(80));
  console.log('\n2️⃣  MOVING SENTRY UPDATES FROM NEWSLETTER TO PERFORMANCE TRACKING\n');

  const sentryPatterns = [
    'from:noreply@md.getsentry.com',
    'subject:Sentry OR subject:"TCAD-SCRAPER-BACKEND"',
  ];

  const newsletterLabelId = existingLabelMap.get(LABEL_NEWSLETTERS_SUBJECT_BASED);
  let totalRelabeled = 0;

  for (const query of sentryPatterns) {
    try {
      const count = await searchAndModify(gmail, query,
        { addLabelIds: [perfLabelId], removeLabelIds: [newsletterLabelId] }, 100);
      if (count > 0) {
        console.log(`  ✅ Relabeled ${count} emails matching: "${query.substring(0, 50)}"`);
        console.log(`     Added: Performance Tracking`);
        console.log(`     Removed: Newsletters/Subject-Based\n`);
        totalRelabeled += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error with "${query}": ${error.message}`);
    }
  }

  console.log(`  📊 Total relabeled: ${totalRelabeled} emails\n`);

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
