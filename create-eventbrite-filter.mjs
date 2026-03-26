import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_EVENTS } from './lib/constants.mjs';

async function createEventbriteFilter() {
  const gmail = createGmailClient();

  console.log('📧 SETTING UP EVENTBRITE FILTER\n');
  console.log('═'.repeat(80) + '\n');

  try {
    let eventsLabelId;
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const existingLabel = labelsResponse.data.labels.find(l => l.name === LABEL_EVENTS);

    if (existingLabel) {
      eventsLabelId = existingLabel.id;
      console.log('✅ Using existing label: Events\n');
    } else {
      const createLabelResponse = await gmail.users.labels.create({
        userId: USER_ID,
        requestBody: {
          name: LABEL_EVENTS,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      eventsLabelId = createLabelResponse.data.id;
      console.log('✅ Created label: Events\n');
    }

    await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: {
        criteria: {
          query: 'from:noreply@reminder.eventbrite.com'
        },
        action: {
          addLabelIds: [eventsLabelId],
          removeLabelIds: [GMAIL_INBOX]
        }
      }
    });
    console.log('✅ Filter created for future Eventbrite emails\n');

    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: 'is:unread from:noreply@reminder.eventbrite.com'
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`📊 Found ${messageIds.length} existing unread Eventbrite emails\n`);

    if (messageIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [eventsLabelId],
            removeLabelIds: [GMAIL_INBOX]
          }
        });

        const processed = i + batch.length;
        console.log(`✅ Applied to ${processed}/${messageIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Label: Events`);
    console.log(`✅ Filter: from:noreply@reminder.eventbrite.com`);
    console.log(`✅ Applied to: ${messageIds.length} existing emails`);
    console.log(`✅ Future Eventbrite emails will auto-label and skip inbox\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createEventbriteFilter().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
