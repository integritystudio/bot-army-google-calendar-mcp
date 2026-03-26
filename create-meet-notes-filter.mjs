import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_MEETING_NOTES } from './lib/constants.mjs';

async function createMeetNotesFilter() {
  const gmail = createGmailClient();

  console.log('📝 CREATING GOOGLE MEET NOTES FILTER\n');
  console.log('═'.repeat(80) + '\n');

  try {
    let notesLabelId;
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const existingLabel = labelsResponse.data.labels.find(l => l.name === LABEL_MEETING_NOTES);

    if (existingLabel) {
      notesLabelId = existingLabel.id;
      console.log('✅ Using existing label: Meeting Notes\n');
    } else {
      const createLabelResponse = await gmail.users.labels.create({
        userId: USER_ID,
        requestBody: {
          name: LABEL_MEETING_NOTES,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      notesLabelId = createLabelResponse.data.id;
      console.log('✅ Created label: Meeting Notes\n');
    }

    await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: {
        criteria: {
          query: 'from:meetings-noreply@google.com subject:Notes'
        },
        action: {
          addLabelIds: [notesLabelId],
          removeLabelIds: [GMAIL_INBOX]
        }
      }
    });
    console.log('✅ Filter created for future Google Meet notes\n');

    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: 'is:unread from:meetings-noreply@google.com subject:Notes'
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`📊 Found ${messageIds.length} existing unread Google Meet notes\n`);

    if (messageIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [notesLabelId],
            removeLabelIds: [GMAIL_INBOX]
          }
        });

        const processed = i + batch.length;
        console.log(`✅ Applied to ${processed}/${messageIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Label: Meeting Notes`);
    console.log(`✅ Filter: from:meetings-noreply@google.com subject:Notes`);
    console.log(`✅ Applied to: ${messageIds.length} existing emails`);
    console.log(`✅ Future Google Meet notes will auto-label and skip inbox\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createMeetNotesFilter().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
