/**
 * Mark emails as read based on label membership.
 *
 * The --past-events mode this used to carry is gone: mark-past-events-read.mjs does
 * the same job and does it better. That mode loaded 500 full bodies in one
 * Promise.all and issued a single modify at the end, so any failure discarded every
 * classification already completed.
 *
 * Usage:
 *   node mark-read.mjs                  # mark all labeled emails as read
 *   node mark-read.mjs --archived-only  # restrict to emails no longer in inbox
 */
import { parseArgs } from 'node:util';
import { createGmailClient } from './lib/gmail-client.mjs';
import {
  GMAIL_UNREAD,
  LABEL_EVENTS, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES,
  LABEL_SERVICES, LABEL_BILLING, LABEL_MONITORING,
} from './lib/constants.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

let values;
try {
  ({ values } = parseArgs({
    options: {
      'archived-only': { type: 'boolean', default: false },
    },
  }));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const archivedOnly = values['archived-only'];

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

const gmail = createGmailClient();
markLabeledRead(gmail).catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
