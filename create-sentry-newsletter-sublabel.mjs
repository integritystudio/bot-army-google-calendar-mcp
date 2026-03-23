import { createGmailClient } from './lib/gmail-client.mjs';

const USER_ID = 'me';

async function createSentryNewsletterSubLabel() {
  const gmail = createGmailClient();

  console.log('📂 CREATING NEWSLETTERS/SENTRY SUB-LABEL\n');
  console.log('═'.repeat(80) + '\n');

  // Pre-fetch existing labels to avoid N+1 queries
  const existingLabelsRes = await gmail.users.labels.list({ userId: USER_ID, fields: 'labels(id,name)' });
  const existingLabelMap = new Map(
    existingLabelsRes.data.labels.map(l => [l.name, l.id])
  );

  // Step 1: Create Newsletters/Sentry sub-label
  console.log('1️⃣  CREATING LABEL: Newsletters/Sentry\n');

  let sentryNewsletterLabelId;

  try {
    const response = await gmail.users.labels.create({
      userId: USER_ID,
      requestBody: {
        name: 'Newsletters/Sentry',
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });

    console.log('✅ Label created successfully!');
    console.log(`   Name: ${response.data.name}`);
    console.log(`   ID: ${response.data.id}\n`);
    sentryNewsletterLabelId = response.data.id;

  } catch (error) {
    if (error.message.includes('exists') || error.message.includes('conflicts')) {
      console.log('⚠️  Label already exists: Newsletters/Sentry\n');
      const existingId = existingLabelMap.get('Newsletters/Sentry');
      if (existingId) {
        console.log(`   ID: ${existingId}\n`);
        sentryNewsletterLabelId = existingId;
      }
    } else {
      console.error('❌ Error creating label:', error.message);
      process.exit(1);
    }
  }

  // Step 2: Find and move Sentry digests back to Newsletters
  console.log('═'.repeat(80));
  console.log('\n2️⃣  MOVING SENTRY DIGESTS BACK TO NEWSLETTERS\n');

  const sentryDigestQuery = 'from:noreply@md.getsentry.com subject:"Weekly Report"';
  const performanceTrackingLabelId = 'Label_12';

  let digestsRelabeled = 0;

  try {
    const searchResult = await gmail.users.messages.list({
      userId: USER_ID,
      q: sentryDigestQuery,
      maxResults: 100,
    });

    if (searchResult.data.messages) {
      const messageIds = searchResult.data.messages.map(m => m.id);
      const count = messageIds.length;

      if (count > 0) {
        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: messageIds,
            addLabelIds: [sentryNewsletterLabelId],
            removeLabelIds: [performanceTrackingLabelId],
          },
        });

        console.log(`  ✅ Relabeled ${count} Sentry weekly digest emails`);
        console.log(`     Added: Newsletters/Sentry`);
        console.log(`     Removed: Performance Tracking\n`);
        digestsRelabeled = count;
      }
    }
  } catch (error) {
    console.log(`  ⚠️  Error finding digests: ${error.message}`);
  }

  console.log(`  📊 Total relabeled: ${digestsRelabeled} emails\n`);

  // Step 3: Create filter for future Sentry digests
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTER FOR SENTRY DIGESTS\n');

  try {
    const response = await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: {
        criteria: {
          from: 'noreply@md.getsentry.com',
          subject: 'Weekly Report',
        },
        action: {
          addLabelIds: [sentryNewsletterLabelId],
        },
      },
    });

    console.log('✅ Filter created successfully!');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Criteria: From Sentry + Subject contains "Weekly Report"`);
    console.log(`   Action: Apply label "Newsletters/Sentry"\n`);

  } catch (error) {
    if (error.message.includes('exists')) {
      console.log('⚠️  Filter already exists\n');
    } else {
      console.log(`⚠️  Error creating filter: ${error.message}\n`);
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ SENTRY NEWSLETTER SUB-LABEL COMPLETE\n');
  console.log(`  📌 Sentry digests moved back to Newsletters: ${digestsRelabeled}`);
  console.log(`  📂 Label: Newsletters/Sentry (${sentryNewsletterLabelId})`);
  console.log(`  🔍 Remaining in Performance Tracking: Sentry error alerts & real-time notifications`);
  console.log('\n📂 Updated Organization:\n');
  console.log('   Newsletters');
  console.log('   ├── Company');
  console.log('   ├── News Aggregates');
  console.log('   ├── Social');
  console.log('   ├── Subject-Based');
  console.log('   ├── CCV');
  console.log('   └── Sentry (Weekly Digests) ← NEW!\n');
  console.log('   Performance Tracking');
  console.log('   └── Sentry Error Alerts (Real-time alerts only)\n');
}

createSentryNewsletterSubLabel().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
