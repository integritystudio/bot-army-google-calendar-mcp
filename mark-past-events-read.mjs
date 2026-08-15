#!/usr/bin/env node
/**
 * Mark past-dated event emails in a label as read (keep future events unread).
 *
 * Usage:
 *   node mark-past-events-read.mjs [--label "Events"] [--dry-run]
 *
 * Walks the label's unread messages, extracts event dates from subject/body via
 * classifyEmail (lib/date-based-filter.mjs), and removes UNREAD from messages
 * whose event date has passed. Future and undatable messages are left unread.
 */
import { parseArgs } from 'node:util';
import { createGmailClient } from './lib/gmail-client.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { classifyEmail } from './lib/date-based-filter.mjs';
import { getHeader } from './lib/email-utils.mjs';
import { listAllMessageIds, extractBodyText, mapWithConcurrency } from './lib/gmail-message-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { withRetry } from './lib/gmail-retry.mjs';
import { USER_ID, GMAIL_UNREAD, LABEL_EVENTS } from './lib/constants.mjs';

const PROGRESS_EVERY = 25;
const STATUS_PAST = 'past';
const STATUS_FUTURE = 'future';

const USAGE = 'Usage: node mark-past-events-read.mjs [--label "Events"] [--dry-run]';

let values;
try {
  ({ values } = parseArgs({
    options: {
      label: { type: 'string', default: LABEL_EVENTS },
      'dry-run': { type: 'boolean', default: false },
    },
  }));
} catch (error) {
  console.error(error.message);
  console.error(USAGE);
  process.exit(1);
}

const labelName = values.label;
const dryRun = values['dry-run'];

if (!labelName) {
  console.error(USAGE);
  process.exit(1);
}

const gmail = await createGmailClient();
const labelMap = await buildLabelCache(gmail);
const labelId = labelMap.get(labelName);
if (!labelId) {
  console.error(`Unknown label: ${labelName}`);
  process.exit(1);
}

const ids = await listAllMessageIds(gmail, { labelIds: [labelId, GMAIL_UNREAD] });
console.log(`Unread "${labelName}" emails: ${ids.length}`);

let failed = 0;
let fetched = 0;
const verdicts = await mapWithConcurrency(ids, async (id) => {
  // Retried rather than swallowed with .catch(() => null): a dropped message is
  // simply never classified, so a rate-limited run reported a smaller label
  // instead of an error.
  const msg = await withRetry(() =>
    gmail.users.messages.get({ userId: USER_ID, id, format: 'full' })
  ).catch(() => { failed++; return null; });

  if (++fetched % PROGRESS_EVERY === 0 || fetched === ids.length) {
    console.log(`  ${fetched}/${ids.length} classified`);
  }
  if (!msg) return null;

  const headers = msg.data.payload?.headers || [];
  const subject = getHeader(headers, 'Subject', '');
  const body = extractBodyText(msg.data.payload);
  // Anchor year-less dates to when the mail arrived, not to now: a 2025 email saying
  // "March 25" means March 2025, and resolving it against today would date every
  // backfilled message to whenever this script happens to run.
  const { status } = classifyEmail(subject, body, new Date(Number(msg.data.internalDate)));
  // Only the verdict survives the mapper — retaining every full body would hold
  // hundreds of MB on a label the size of Events/Meetup.
  return { id: msg.data.id, status };
});

const pastIds = verdicts.filter(v => v?.status === STATUS_PAST).map(v => v.id);
const futureCount = verdicts.filter(v => v?.status === STATUS_FUTURE).length;
const unknownCount = verdicts.length - failed - pastIds.length - futureCount;

console.log(`Past: ${pastIds.length} | Future: ${futureCount} | Unknown (left unread): ${unknownCount}`);
if (failed > 0) console.warn(`${failed} message(s) could not be fetched and were left unread.`);

if (dryRun) {
  console.log('Dry run - no changes made.');
} else if (pastIds.length > 0) {
  await batchModifyMessages(gmail, pastIds, { removeLabelIds: [GMAIL_UNREAD] });
  console.log(`Marked ${pastIds.length} past events as read.`);
} else {
  console.log('No past events to mark.');
}
