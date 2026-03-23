import { createGmailClient } from './lib/gmail-client.mjs';
import { classifyEmail, getGmailAction } from './lib/date-based-filter.mjs';

async function filterEventsByDate() {
  const gmail = createGmailClient();

  console.log('📅 FILTERING EVENTS BY DATE (WITH DATE-BASED ARCHIVE)\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get labels
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const eventsLabel = labelsResponse.data.labels.find(l => l.name === 'Events');
    const keepImportantLabel = labelsResponse.data.labels.find(l => l.name === 'Keep Important');

    if (!eventsLabel) {
      console.log('❌ Events label not found\n');
      process.exit(1);
    }

    const eventsLabelId = eventsLabel.id;
    const keepImportantLabelId = keepImportantLabel?.id;

    // Event email patterns
    const eventKeywords = '(event OR meeting OR conference OR workshop OR seminar OR webinar OR presentation OR summit OR expo OR networking OR panel OR forum OR gathering OR ceremony OR celebration)';
    const eventSenders = '(meetup OR eventbrite OR "international house" OR calendly OR calendar)';

    console.log('STEP 1: Finding event-like unread emails\n');

    const searchQuery = `is:unread (subject:${eventKeywords} OR from:${eventSenders}) ${keepImportantLabelId ? `-label:"Keep Important"` : ''}`;

    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 100
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} event-like emails\n`);

    if (messageIds.length === 0) {
      console.log('No event emails to process\n');
      return;
    }

    console.log('STEP 2: Classifying events by date\n');

    let futureCount = 0;
    let pastCount = 0;
    let unknownCount = 0;

    const futureIds = [];
    const pastIds = [];

    // Process each email
    for (const msg of messageIds) {
      try {
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });

        const headers = fullMsg.data.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '';

        // Get email body
        let body = '';
        if (fullMsg.data.payload?.parts?.[0]?.body?.data) {
          body = Buffer.from(fullMsg.data.payload.parts[0].body.data, 'base64').toString('utf-8');
        } else if (fullMsg.data.payload?.body?.data) {
          body = Buffer.from(fullMsg.data.payload.body.data, 'base64').toString('utf-8');
        }

        // Classify email by date
        const classification = classifyEmail(subject, body);

        if (classification.status === 'future') {
          futureIds.push(msg.id);
          futureCount++;
        } else if (classification.status === 'past') {
          pastIds.push(msg.id);
          pastCount++;
        } else {
          unknownCount++;
        }

      } catch (error) {
        console.log(`⚠️  Error processing email: ${error.message}`);
      }
    }

    console.log(`  Future events: ${futureCount}`);
    console.log(`  Past events: ${pastCount}`);
    console.log(`  Unknown date: ${unknownCount}\n`);

    // Label future events
    if (futureIds.length > 0) {
      console.log('STEP 3: Labeling future events\n');
      const batchSize = 50;
      for (let i = 0; i < futureIds.length; i += batchSize) {
        const batch = futureIds.slice(i, Math.min(i + batchSize, futureIds.length));
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch,
            addLabelIds: [eventsLabelId]
          }
        });
        const processed = Math.min(i + batchSize, futureIds.length);
        console.log(`  ✅ Labeled ${processed}/${futureIds.length}`);
      }
    }

    // Archive past events
    if (pastIds.length > 0) {
      console.log('\nSTEP 4: Archiving past events\n');
      const batchSize = 50;
      for (let i = 0; i < pastIds.length; i += batchSize) {
        const batch = pastIds.slice(i, Math.min(i + batchSize, pastIds.length));
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch,
            addLabelIds: [eventsLabelId],
            removeLabelIds: ['INBOX']
          }
        });
        const processed = Math.min(i + batchSize, pastIds.length);
        console.log(`  ✅ Archived ${processed}/${pastIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Processed: ${messageIds.length} event emails`);
    console.log(`✅ Future events labeled: ${futureCount}`);
    console.log(`✅ Past events archived: ${pastCount}`);
    console.log(`ℹ️  Unknown date: ${unknownCount}\n`);
    console.log('Protected emails (Keep Important):');
    console.log(`  • Overdue payments, late fees, missed payments`);
    console.log(`  • Cloudflare rate limit alerts`);
    console.log(`  • Investment banking meetings`);
    console.log(`  • Capital City Village services\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

filterEventsByDate().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
