import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_INBOX, GMAIL_UNREAD, DEFAULT_MAX_RESULTS } from './lib/constants.mjs';
import { searchAndModifyOlderThan } from './lib/gmail-batch-utils.mjs';
import { BANNER } from './lib/console-utils.mjs';

const DAYS_AGO = 7;

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

  const cutoffDate = new Date(Date.now() - DAYS_AGO * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  console.log(`Archiving responses before ${cutoffDate}\n`);

  let totalArchived = 0;

  for (const query of searchQueries) {
    const archivedIds = await searchAndModifyOlderThan(
      gmail, query, DAYS_AGO,
      { removeLabelIds: [GMAIL_UNREAD, GMAIL_INBOX] },
      DEFAULT_MAX_RESULTS
    );
    if (archivedIds.length > 0) {
      console.log(`Query: ${query}`);
      console.log(`Archived and marked ${archivedIds.length} as read\n`);
      totalArchived += archivedIds.length;
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
