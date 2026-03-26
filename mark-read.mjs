/**
 * Mark emails as read based on label membership or past-event date detection.
 *
 * Usage:
 *   node mark-read.mjs                  # mark all labeled emails as read
 *   node mark-read.mjs --archived-only  # restrict to emails no longer in inbox
 *   node mark-read.mjs --past-events    # mark only past-date event emails as read
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import {
  USER_ID,
  GMAIL_UNREAD,
  LABEL_EVENTS, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES,
  LABEL_SERVICES, LABEL_BILLING, LABEL_MONITORING,
} from './lib/constants.mjs';
import { extractEventDate, isPastEvent } from './lib/date-based-filter.mjs';
import { getHeader } from './lib/email-utils.mjs';
import { batchModifyMessages, searchAndModify } from './lib/gmail-batch-utils.mjs';

const pastEventsMode = process.argv.includes('--past-events');
const archivedOnly = process.argv.includes('--archived-only');

const LABELED_LABELS = [LABEL_EVENTS, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING, LABEL_MONITORING];

async function markLabeledRead(gmail) {
  const archiveSuffix = archivedOnly ? ' -label:INBOX' : '';
  let total = 0;
  for (const label of LABELED_LABELS) {
    const count = await searchAndModify(gmail, `label:"${label}" is:unread${archiveSuffix}`, { removeLabelIds: [GMAIL_UNREAD] });
    if (count > 0) console.log(`${label}: ${count} marked as read`);
    total += count;
  }
  const qualifier = archivedOnly ? 'archived ' : '';
  console.log(`Total: ${total} ${qualifier}emails marked as read`);
}

async function markPastEventsRead(gmail) {
  const searchResponse = await gmail.users.messages.list({
    userId: USER_ID,
    q: `label:${LABEL_EVENTS} is:unread`,
    maxResults: 500,
  });

  const messageIds = searchResponse.data.messages || [];
  console.log(`Found ${messageIds.length} unread event emails`);
  if (messageIds.length === 0) return;

  const fullMsgs = await Promise.all(
    messageIds.map(msg =>
      gmail.users.messages.get({ userId: USER_ID, id: msg.id, format: 'full' })
    )
  );

  const pastIds = fullMsgs
    .filter(fullMsg => {
      const headers = fullMsg.data.payload?.headers || [];
      const subject = getHeader(headers, 'Subject');

      let body = '';
      if (fullMsg.data.payload?.body?.data) {
        body = Buffer.from(fullMsg.data.payload.body.data, 'base64').toString('utf-8');
      } else if (fullMsg.data.payload?.parts) {
        const textPart = fullMsg.data.payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      }

      const eventDate = extractEventDate(subject + '\n' + body);
      return eventDate && isPastEvent(eventDate);
    })
    .map(fullMsg => fullMsg.data.id);

  console.log(`Identified ${pastIds.length} past events`);
  if (pastIds.length === 0) return;

  await batchModifyMessages(gmail, pastIds, { removeLabelIds: [GMAIL_UNREAD] });
  console.log(`Past events marked as read: ${pastIds.length}`);
  console.log(`Future events remaining unread: ${messageIds.length - pastIds.length}`);
}

const gmail = createGmailClient();
const action = pastEventsMode ? markPastEventsRead : markLabeledRead;
action(gmail).catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
