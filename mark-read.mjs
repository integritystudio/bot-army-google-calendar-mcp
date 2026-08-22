/**
 * Mark unread mail under the routine categories as read.
 *
 * A modify-messages.mjs preset, applied per label. Selection goes through labelIds
 * rather than a label:"..." query, so a label name containing parentheses or an
 * ampersand cannot silently select nothing (see README.md#known-issues).
 *
 * The --past-events mode this used to carry is gone: mark-past-events-read.mjs does
 * the same job and does it better. That mode loaded 500 full bodies in one
 * Promise.all and issued a single modify at the end, so any failure discarded every
 * classification already completed — the exact failure that cost a 12.5k-message run
 * 4,161 of them. The standalone script chunks, pages, and retries.
 *
 * Usage:
 *   node mark-read.mjs                  # mark all labeled emails as read
 *   node mark-read.mjs --archived-only  # restrict to emails no longer in inbox
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, runMain } from './lib/cli-utils.mjs';
import { modifyMessages } from './modify-messages.mjs';
import {
  GMAIL_UNREAD,
  LABEL_EVENTS, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES,
  LABEL_SERVICES, LABEL_BILLING, LABEL_MONITORING,
} from './lib/constants.mjs';

const LABELED_LABELS = [
  LABEL_EVENTS, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES,
  LABEL_SERVICES, LABEL_BILLING, LABEL_MONITORING,
];

const USAGE = 'Usage: node mark-read.mjs [--archived-only]';

const { values } = parseCli({ 'archived-only': { type: 'boolean', default: false } }, USAGE);
const archivedOnly = values['archived-only'];

async function main() {
  const gmail = await createGmailClient();
  let total = 0;
  for (const labelName of LABELED_LABELS) {
    const { modified } = await modifyMessages(gmail, {
      labelName,
      unreadOnly: true,
      query: archivedOnly ? '-label:INBOX' : null,
      remove: [GMAIL_UNREAD],
      apply: true,
      quiet: true,
    });
    if (modified > 0) console.log(`${labelName}: ${modified} marked as read`);
    total += modified;
  }
  console.log(`Total: ${total} ${archivedOnly ? 'archived ' : ''}emails marked as read`);
}

runMain(main);
