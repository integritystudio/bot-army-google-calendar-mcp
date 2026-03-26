import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_DMARC_REPORTS } from './lib/constants.mjs';

async function createDmarcFilter() {
  const gmail = createGmailClient();

  console.log('📧 CREATING DMARC REPORTS FILTER\n');
  console.log('═'.repeat(80) + '\n');

  try {
    let dmarcLabelId;
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const existingLabel = labelsResponse.data.labels.find(l => l.name === LABEL_DMARC_REPORTS);

    if (existingLabel) {
      dmarcLabelId = existingLabel.id;
      console.log('✅ Using existing label: DMARC Reports\n');
    } else {
      const createLabelResponse = await gmail.users.labels.create({
        userId: USER_ID,
        requestBody: {
          name: LABEL_DMARC_REPORTS,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      dmarcLabelId = createLabelResponse.data.id;
      console.log('✅ Created label: DMARC Reports\n');
    }

    await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: {
        criteria: {
          query: 'subject:DMARC'
        },
        action: {
          addLabelIds: [dmarcLabelId],
          removeLabelIds: [GMAIL_INBOX]
        }
      }
    });
    console.log('✅ Filter created for future DMARC emails\n');

    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: 'subject:DMARC',
      maxResults: 100
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`📊 Found ${messageIds.length} existing DMARC emails\n`);

    if (messageIds.length > 0) {
      console.log('Archiving existing DMARC emails...\n');
      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [dmarcLabelId],
            removeLabelIds: [GMAIL_INBOX]
          }
        });

        const processed = i + batch.length;
        console.log(`  ✅ Processed ${processed}/${messageIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Label: DMARC Reports`);
    console.log(`✅ Filter: subject:DMARC`);
    console.log(`✅ Archived: ${messageIds.length} existing emails`);
    console.log(`✅ Future DMARC reports will auto-label and skip inbox\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createDmarcFilter().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
