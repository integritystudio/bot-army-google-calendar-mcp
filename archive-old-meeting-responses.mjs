import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, GMAIL_UNREAD } from './lib/constants.mjs';
import { getHeader } from './lib/email-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { BANNER } from './lib/console-utils.mjs';

const DAYS_AGO = 7;
const MAX_RESULTS = 100;

const searchQueries = [
  'subject:Accepted subject:Integrity',
  'subject:Declined subject:Integrity',
  'subject:"Added to a team"',
  'from:john@integritystudio.ai subject:(Accepted OR Declined)',
  'from:chandra@integritystudio.ai subject:(Accepted OR Declined)'
];

async function archiveOldMeetingResponses() {
  const gmail = createGmailClient();

  console.log('ARCHIVING OLD MEETING RESPONSES\n');
  console.log(BANNER + '\n');

  const oneWeekAgo = new Date(Date.now() - DAYS_AGO * 24 * 60 * 60 * 1000);
  const dateStr = oneWeekAgo.toISOString().split('T')[0];
  console.log(`Archiving responses before ${dateStr}\n`);

  let totalArchived = 0;

  for (const query of searchQueries) {
    const searchResp = await gmail.users.messages.list({ userId: USER_ID, q: query, maxResults: MAX_RESULTS });
    const messages = searchResp.data.messages || [];
    if (messages.length === 0) continue;

    console.log(`Query: ${query}`);
    console.log(`Found ${messages.length} emails\n`);

    const fullMsgs = await Promise.all(
      messages.map(msg =>
        gmail.users.messages.get({ userId: USER_ID, id: msg.id, format: 'metadata', metadataHeaders: ['Date', 'Subject'] })
      )
    );

    const oldIds = [];
    for (const fullMsg of fullMsgs) {
      const headers = fullMsg.data.payload?.headers || [];
      const msgDateStr = getHeader(headers, 'Date');
      const subject = getHeader(headers, 'Subject');
      const emailDate = new Date(msgDateStr);
      if (emailDate < oneWeekAgo) {
        oldIds.push(fullMsg.data.id);
        console.log(`  ${subject.substring(0, 50)}`);
        console.log(`    Date: ${emailDate.toLocaleDateString()}\n`);
      }
    }

    if (oldIds.length > 0) {
      await batchModifyMessages(gmail, oldIds, { removeLabelIds: [GMAIL_UNREAD, GMAIL_INBOX] });
      totalArchived += oldIds.length;
      console.log(`Archived and marked ${oldIds.length} as read\n`);
    }
  }

  console.log(BANNER);
  console.log('COMPLETE\n');
  console.log(`Total archived: ${totalArchived} meeting responses\n`);
  console.log(BANNER + '\n');
}

archiveOldMeetingResponses().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
