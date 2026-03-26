import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_UNREAD, LABEL_EVENTS } from './lib/constants.mjs';
import { extractEventDate, isPastEvent } from './lib/date-based-filter.mjs';
import { getHeader } from './lib/email-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';

async function markPastEventsRead() {
  const gmail = createGmailClient();

  try {
    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: `label:${LABEL_EVENTS} is:unread`,
      maxResults: 500
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

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

markPastEventsRead().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
