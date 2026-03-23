import { createGmailClient } from './lib/gmail-client.mjs';

const USER_ID = 'me';

async function createSignozFilter() {
  const gmail = createGmailClient();

  console.log('📊 CREATING SIGNOZ ALERTS FILTER\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get or create SigNoz label
    let signozLabelId;
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const existingLabel = labelsResponse.data.labels.find(l => l.name === 'Monitoring');

    if (existingLabel) {
      signozLabelId = existingLabel.id;
      console.log('✅ Using existing label: Monitoring\n');
    } else {
      const createLabelResponse = await gmail.users.labels.create({
        userId: USER_ID,
        requestBody: {
          name: 'Monitoring',
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      signozLabelId = createLabelResponse.data.id;
      console.log('✅ Created label: Monitoring\n');
    }

    // Create filter for future emails
    await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: {
        criteria: {
          query: 'from:alertmanager@signoz.cloud'
        },
        action: {
          addLabelIds: [signozLabelId],
          removeLabelIds: ['INBOX']
        }
      }
    });
    console.log('✅ Filter created for future SigNoz alerts\n');

    // Apply to existing emails
    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: 'from:alertmanager@signoz.cloud'
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`📊 Found ${messageIds.length} existing SigNoz emails\n`);

    if (messageIds.length > 0) {
      console.log('Archiving existing SigNoz emails...\n');
      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [signozLabelId],
            removeLabelIds: ['INBOX']
          }
        });

        const processed = Math.min(i + batchSize, messageIds.length);
        console.log(`  ✅ Processed ${processed}/${messageIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Label: Monitoring`);
    console.log(`✅ Filter: from:alertmanager@signoz.cloud`);
    console.log(`✅ Archived: ${messageIds.length} existing emails`);
    console.log(`✅ Future SigNoz alerts will auto-label and skip inbox\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createSignozFilter().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
