import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_MONITORING } from './lib/constants.mjs';

async function createSignozFilter() {
  const gmail = createGmailClient();

  console.log('📊 CREATING SIGNOZ ALERTS FILTER\n');
  console.log('═'.repeat(80) + '\n');

  try {
    let signozLabelId;
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const existingLabel = labelsResponse.data.labels.find(l => l.name === LABEL_MONITORING);

    if (existingLabel) {
      signozLabelId = existingLabel.id;
      console.log('✅ Using existing label: Monitoring\n');
    } else {
      const createLabelResponse = await gmail.users.labels.create({
        userId: USER_ID,
        requestBody: {
          name: LABEL_MONITORING,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      signozLabelId = createLabelResponse.data.id;
      console.log('✅ Created label: Monitoring\n');
    }

    await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: {
        criteria: {
          query: 'from:alertmanager@signoz.cloud'
        },
        action: {
          addLabelIds: [signozLabelId],
          removeLabelIds: [GMAIL_INBOX]
        }
      }
    });
    console.log('✅ Filter created for future SigNoz alerts\n');

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
        const batch = messageIds.slice(i, i + batchSize);

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [signozLabelId],
            removeLabelIds: [GMAIL_INBOX]
          }
        });

        const processed = i + batch.length;
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
