import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_EVENTS } from './lib/constants.mjs';
import { getHeader } from './lib/email-utils.mjs';

async function organizeInternationalHouse() {
  const gmail = createGmailClient();

  console.log('🎤 ORGANIZING INTERNATIONAL HOUSE EVENTS\n');
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

    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: 'from:"International House"',
      maxResults: 100
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} International House emails\n`);

    if (messageIds.length === 0) {
      console.log('No International House emails found\n');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('Analyzing event dates...\n');

    const MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const DATE_PATTERN = /(?:@\s+)?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+([A-Za-z]+)\s+(\d{1,2})/i;

    const fullMsgs = await Promise.all(
      messageIds.map(msg =>
        gmail.users.messages.get({ userId: USER_ID, id: msg.id, format: 'full' })
          .catch(error => {
            console.log(`⚠️  Error processing email: ${error.message}`);
            return null;
          })
      )
    );

    const futureEvents = [];
    const pastEvents = [];

    for (const fullMsg of fullMsgs.filter(Boolean)) {
      const headers = fullMsg.data.payload?.headers || [];
      const subject = getHeader(headers, 'Subject');

      const body = fullMsg.data.payload?.parts?.[0]?.body?.data
        ? Buffer.from(fullMsg.data.payload.parts[0].body.data, 'base64').toString('utf-8')
        : '';

      const match = body.match(DATE_PATTERN) || subject.match(DATE_PATTERN);

      let eventDate = null;
      if (match) {
        const monthIndex = MONTH_INDEX[match[1].toLowerCase().substring(0, 3)];
        if (monthIndex !== undefined) {
          eventDate = new Date(today.getFullYear(), monthIndex, parseInt(match[2]));
        }
      }

      const entry = { id: fullMsg.data.id, subject, eventDate };
      if (eventDate && eventDate < today) {
        pastEvents.push(entry);
      } else {
        futureEvents.push(entry);
      }
    }

    console.log(`Future events: ${futureEvents.length}`);
    console.log(`Past events: ${pastEvents.length}\n`);

    if (futureEvents.length > 0) {
      console.log('Labeling future events with "Events"...\n');
      const batchSize = 50;
      for (let i = 0; i < futureEvents.length; i += batchSize) {
        const batch = futureEvents.slice(i, i + batchSize);
        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(e => e.id),
            addLabelIds: [eventsLabelId]
          }
        });
        const processed = i + batch.length;
        console.log(`  ✅ Labeled ${processed}/${futureEvents.length}`);
      }
    }

    if (pastEvents.length > 0) {
      console.log('\nArchiving past events...\n');
      const batchSize = 50;
      for (let i = 0; i < pastEvents.length; i += batchSize) {
        const batch = pastEvents.slice(i, i + batchSize);
        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(e => e.id),
            addLabelIds: [eventsLabelId],
            removeLabelIds: [GMAIL_INBOX]
          }
        });
        const processed = i + batch.length;
        console.log(`  ✅ Archived ${processed}/${pastEvents.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Label: Events`);
    console.log(`✅ Future events (staying in inbox): ${futureEvents.length}`);
    console.log(`✅ Past events (archived): ${pastEvents.length}\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

organizeInternationalHouse().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
