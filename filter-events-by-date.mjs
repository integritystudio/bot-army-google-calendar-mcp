import { createGmailClient } from './lib/gmail-client.mjs';
import { runMain } from './lib/cli-utils.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_EVENTS, LABEL_KEEP_IMPORTANT, DEFAULT_MAX_RESULTS } from './lib/constants.mjs';
import { classifyEmail } from './lib/date-based-filter.mjs';
import { getHeader } from './lib/email-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { BANNER } from './lib/console-utils.mjs';
import { decodeMessageBody } from './lib/gmail-message-utils.mjs';

const EVENT_KEYWORDS = '(event OR meeting OR conference OR workshop OR seminar OR webinar OR presentation OR summit OR expo OR networking OR panel OR forum OR gathering OR ceremony OR celebration)';
const EVENT_SENDERS = '(meetup OR eventbrite OR "international house" OR calendly OR calendar)';

async function filterEventsByDate() {
  const gmail = createGmailClient();

  console.log('FILTERING EVENTS BY DATE (WITH DATE-BASED ARCHIVE)\n');
  console.log(BANNER + '\n');

  const labelCache = await buildLabelCache(gmail);
  const eventsLabelId = labelCache.get(LABEL_EVENTS);
  const keepImportantLabelId = labelCache.get(LABEL_KEEP_IMPORTANT);

  if (!eventsLabelId) {
    console.log('Events label not found\n');
    process.exit(1);
  }

  const searchQuery = `is:unread (subject:${EVENT_KEYWORDS} OR from:${EVENT_SENDERS}) ${keepImportantLabelId ? `-label:"${LABEL_KEEP_IMPORTANT}"` : ''}`;
  const searchResponse = await gmail.users.messages.list({ userId: USER_ID, q: searchQuery, maxResults: DEFAULT_MAX_RESULTS });
  const messageIds = searchResponse.data.messages || [];
  console.log(`Found ${messageIds.length} event-like emails\n`);

  if (messageIds.length === 0) {
    console.log('No event emails to process\n');
    return;
  }

  const fullMsgs = await Promise.all(
    messageIds.map(msg =>
      gmail.users.messages.get({ userId: USER_ID, id: msg.id, format: 'full' })
        .catch(error => { console.log(`Error processing email: ${error.message}`); return null; })
    )
  );

  const futureIds = [];
  const pastIds = [];

  for (const fullMsg of fullMsgs.filter(Boolean)) {
    const headers = fullMsg.data.payload?.headers || [];
    const subject = getHeader(headers, 'Subject');
    const body = decodeMessageBody(fullMsg.data.payload);
    // Anchor year-less dates to arrival, not to now (see date-based-filter.mjs).
    const classification = classifyEmail(subject, body, new Date(Number(fullMsg.data.internalDate)));
    if (classification.status === 'future') futureIds.push(fullMsg.data.id);
    else if (classification.status === 'past') pastIds.push(fullMsg.data.id);
  }

  const unknownCount = messageIds.length - futureIds.length - pastIds.length;
  console.log(`Future events: ${futureIds.length} | Past events: ${pastIds.length} | Unknown: ${unknownCount}\n`);

  if (futureIds.length > 0) {
    await batchModifyMessages(gmail, futureIds, { addLabelIds: [eventsLabelId] });
  }
  if (pastIds.length > 0) {
    await batchModifyMessages(gmail, pastIds, { addLabelIds: [eventsLabelId], removeLabelIds: [GMAIL_INBOX] });
  }

  console.log(BANNER);
  console.log('COMPLETE\n');
  console.log(`Future events labeled: ${futureIds.length} | Past events archived: ${pastIds.length} | Unknown: ${unknownCount}\n`);
  console.log(BANNER + '\n');
}

runMain(filterEventsByDate);
