/**
 * Archive emails older than DAYS_AGO that match a given label.
 *
 * Usage:
 *   node archive-old-emails.mjs --label "Meeting Responses"
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_INBOX, GMAIL_UNREAD, DEFAULT_MAX_RESULTS, MS_PER_DAY } from './lib/constants.mjs';
import { searchAndModifyOlderThan } from './lib/gmail-batch-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { BANNER } from './lib/console-utils.mjs';

const DAYS_AGO = 7;

const labelArgIndex = process.argv.indexOf('--label');
const labelName = labelArgIndex !== -1 ? process.argv[labelArgIndex + 1] : null;

if (!labelName) {
  console.error('Usage: node archive-old-emails.mjs --label "<label name>"');
  process.exit(1);
}

async function archiveOldEmails() {
  const gmail = createGmailClient();

  const labelCache = await buildLabelCache(gmail);
  const labelId = labelCache.get(labelName);
  if (!labelId) {
    console.error(`Label not found: "${labelName}"`);
    process.exit(1);
  }

  console.log(`ARCHIVING OLD EMAILS — label: ${labelName}\n`);
  console.log(BANNER + '\n');

  const cutoffDate = new Date(Date.now() - DAYS_AGO * MS_PER_DAY).toISOString().split('T')[0];
  console.log(`Archiving emails before ${cutoffDate}\n`);

  const archivedIds = await searchAndModifyOlderThan(
    gmail,
    `label:"${labelName}"`,
    DAYS_AGO,
    { removeLabelIds: [GMAIL_UNREAD, GMAIL_INBOX] },
    DEFAULT_MAX_RESULTS
  );

  console.log(BANNER);
  console.log('COMPLETE\n');
  console.log(`Total archived: ${archivedIds.length} emails\n`);
  console.log(BANNER + '\n');
}

archiveOldEmails().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
