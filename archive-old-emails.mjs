/**
 * Archive emails older than DAYS_AGO that match a given label or Gmail query.
 *
 * A query targets senders that should stay in the inbox briefly but not linger —
 * Gmail filters run only on arrival, so age-based archiving has to happen here.
 *
 * Usage:
 *   node archive-old-emails.mjs --label "Meeting Responses"
 *   node archive-old-emails.mjs --query "from:laseraway.co"
 */
import { parseArgs } from 'node:util';
import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_INBOX, GMAIL_UNREAD, DEFAULT_MAX_RESULTS, MS_PER_DAY } from './lib/constants.mjs';
import { searchAndModifyOlderThan } from './lib/gmail-batch-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { BANNER } from './lib/console-utils.mjs';

const DAYS_AGO = 7;

const USAGE = 'Usage: node archive-old-emails.mjs (--label "<label name>" | --query "<gmail-query>")';

let values;
try {
  ({ values } = parseArgs({
    options: {
      label: { type: 'string' },
      query: { type: 'string' },
    },
  }));
} catch (error) {
  console.error(error.message);
  console.error(USAGE);
  process.exit(1);
}

const labelName = values.label;
const rawQuery = values.query;

if (!labelName && !rawQuery) {
  console.error(USAGE);
  process.exit(1);
}

async function archiveOldEmails() {
  const gmail = createGmailClient();

  if (labelName) {
    const labelCache = await buildLabelCache(gmail);
    if (!labelCache.get(labelName)) {
      console.error(`Label not found: "${labelName}"`);
      process.exit(1);
    }
  }

  const searchQuery = rawQuery ?? `label:"${labelName}"`;
  console.log(`ARCHIVING OLD EMAILS — ${rawQuery ? `query: ${rawQuery}` : `label: ${labelName}`}\n`);
  console.log(BANNER + '\n');

  const cutoffDate = new Date(Date.now() - DAYS_AGO * MS_PER_DAY).toISOString().split('T')[0];
  console.log(`Archiving emails before ${cutoffDate}\n`);

  const archivedIds = await searchAndModifyOlderThan(
    gmail,
    searchQuery,
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
