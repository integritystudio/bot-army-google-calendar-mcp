import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_EVENTS, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';
import { classifyEmail, getGmailAction } from './lib/date-based-filter.mjs';
import { getHeader } from './lib/email-utils.mjs';

async function filterEventsByDate() {
  const gmail = createGmailClient();

  console.log('📅 FILTERING EVENTS BY DATE (WITH DATE-BASED ARCHIVE)\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const eventsLabel = labelsResponse.data.labels.find(l => l.name === LABEL_EVENTS);
    const keepImportantLabel = labelsResponse.data.labels.find(l => l.name === LABEL_KEEP_IMPORTANT);

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

    const searchQuery = `is:unread (subject:${eventKeywords} OR from:${eventSenders}) ${keepImportantLabelId ? `-label:"${LABEL_KEEP_IMPORTANT}"` : ''}`;

    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
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

    const fullMsgs = await Promise.all(
      messageIds.map(msg =>
        gmail.users.messages.get({ userId: USER_ID, id: msg.id, format: 'full' })
          .catch(error => {
            console.log(`⚠️  Error processing email: ${error.message}`);
            return null;
          })
      )
    );

    const futureIds = [];
    const pastIds = [];

    for (const fullMsg of fullMsgs.filter(Boolean)) {
      const headers = fullMsg.data.payload?.headers || [];
      const subject = getHeader(headers, 'Subject');

      let body = '';
      if (fullMsg.data.payload?.parts?.[0]?.body?.data) {
        body = Buffer.from(fullMsg.data.payload.parts[0].body.data, 'base64').toString('utf-8');
      } else if (fullMsg.data.payload?.body?.data) {
        body = Buffer.from(fullMsg.data.payload.body.data, 'base64').toString('utf-8');
      }

      const classification = classifyEmail(subject, body);

      if (classification.status === 'future') {
        futureIds.push(fullMsg.data.id);
      } else if (classification.status === 'past') {
        pastIds.push(fullMsg.data.id);
      }
    }

    const unknownCount = messageIds.length - futureIds.length - pastIds.length;

    console.log(`  Future events: ${futureIds.length}`);
    console.log(`  Past events: ${pastIds.length}`);
    console.log(`  Unknown date: ${unknownCount}\n`);

    if (futureIds.length > 0) {
      console.log('STEP 3: Labeling future events\n');
      const batchSize = 50;
      for (let i = 0; i < futureIds.length; i += batchSize) {
        const batch = futureIds.slice(i, i + batchSize);
        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch,
            addLabelIds: [eventsLabelId]
          }
        });
        const processed = i + batch.length;
        console.log(`  ✅ Labeled ${processed}/${futureIds.length}`);
      }
    }

    if (pastIds.length > 0) {
      console.log('\nSTEP 4: Archiving past events\n');
      const batchSize = 50;
      for (let i = 0; i < pastIds.length; i += batchSize) {
        const batch = pastIds.slice(i, i + batchSize);
        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch,
            addLabelIds: [eventsLabelId],
            removeLabelIds: [GMAIL_INBOX]
          }
        });
        const processed = i + batch.length;
        console.log(`  ✅ Archived ${processed}/${pastIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Processed: ${messageIds.length} event emails`);
    console.log(`✅ Future events labeled: ${futureIds.length}`);
    console.log(`✅ Past events archived: ${pastIds.length}`);
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
