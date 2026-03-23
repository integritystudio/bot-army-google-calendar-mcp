import { createGmailClient } from './lib/gmail-client.mjs';

async function organizeInternationalHouse() {
  const gmail = createGmailClient();

  console.log('🎤 ORGANIZING INTERNATIONAL HOUSE EVENTS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get or create Events label
    let eventsLabelId;
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const existingLabel = labelsResponse.data.labels.find(l => l.name === 'Events');

    if (existingLabel) {
      eventsLabelId = existingLabel.id;
      console.log('✅ Using existing label: Events\n');
    } else {
      const createLabelResponse = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: 'Events',
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      eventsLabelId = createLabelResponse.data.id;
      console.log('✅ Created label: Events\n');
    }

    // Find International House emails
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
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

    let futureEvents = [];
    let pastEvents = [];

    // Fetch full content to parse event dates
    console.log('Analyzing event dates...\n');
    for (const msg of messageIds) {
      try {
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });

        const headers = fullMsg.data.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const dateStr = headers.find(h => h.name === 'Date')?.value || '';

        // Try to extract event date from email content
        const body = fullMsg.data.payload?.parts?.[0]?.body?.data
          ? Buffer.from(fullMsg.data.payload.parts[0].body.data, 'base64').toString('utf-8')
          : '';

        // Look for date patterns like "@ Fri, Mar 22" or "Feb 26" or similar
        const datePattern = /(?:@\s+)?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+([A-Za-z]+)\s+(\d{1,2})/i;
        const match = body.match(datePattern) || subject.match(datePattern);

        let eventDate = null;
        if (match) {
          const monthStr = match[1];
          const dayStr = parseInt(match[2]);

          // Parse month
          const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
          const monthIndex = months[monthStr.toLowerCase().substring(0, 3)];

          if (monthIndex !== undefined) {
            eventDate = new Date(today.getFullYear(), monthIndex, dayStr);
          }
        }

        if (eventDate && eventDate >= today) {
          futureEvents.push({ id: msg.id, subject, eventDate });
        } else if (eventDate && eventDate < today) {
          pastEvents.push({ id: msg.id, subject, eventDate });
        } else {
          // If we can't parse date, assume it's recent/relevant - keep it
          futureEvents.push({ id: msg.id, subject, eventDate: null });
        }
      } catch (error) {
        console.log(`⚠️  Error processing email: ${error.message}`);
      }
    }

    console.log(`Future events: ${futureEvents.length}`);
    console.log(`Past events: ${pastEvents.length}\n`);

    // Label future events
    if (futureEvents.length > 0) {
      console.log('Labeling future events with "Events"...\n');
      const batchSize = 50;
      for (let i = 0; i < futureEvents.length; i += batchSize) {
        const batch = futureEvents.slice(i, Math.min(i + batchSize, futureEvents.length));
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(e => e.id),
            addLabelIds: [eventsLabelId]
          }
        });
        const processed = Math.min(i + batchSize, futureEvents.length);
        console.log(`  ✅ Labeled ${processed}/${futureEvents.length}`);
      }
    }

    // Archive past events
    if (pastEvents.length > 0) {
      console.log('\nArchiving past events...\n');
      const batchSize = 50;
      for (let i = 0; i < pastEvents.length; i += batchSize) {
        const batch = pastEvents.slice(i, Math.min(i + batchSize, pastEvents.length));
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(e => e.id),
            addLabelIds: [eventsLabelId],
            removeLabelIds: ['INBOX']
          }
        });
        const processed = Math.min(i + batchSize, pastEvents.length);
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
