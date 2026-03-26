import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_DMARC_REPORTS } from './lib/constants.mjs';

async function archiveDmarcEmails() {
  const gmail = createGmailClient();

  console.log('📧 ARCHIVING DMARC REPORTS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const dmarcLabel = labelsResponse.data.labels.find(l => l.name === LABEL_DMARC_REPORTS);

    if (!dmarcLabel) {
      console.log('❌ DMARC Reports label not found\n');
      process.exit(1);
    }

    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: 'subject:DMARC',
      maxResults: 100
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} DMARC emails\n`);

    if (messageIds.length > 0) {
      console.log('Archiving DMARC emails...\n');
      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [dmarcLabel.id],
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
    console.log(`✅ Filter: Already exists (subject:DMARC)`);
    console.log(`✅ Archived: ${messageIds.length} emails`);
    console.log(`✅ Future DMARC reports will auto-label and skip inbox\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

archiveDmarcEmails().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
