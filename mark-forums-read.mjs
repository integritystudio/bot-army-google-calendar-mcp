/**
 * Mark Forums emails older than 5 days as read.
 *
 * A modify-messages.mjs preset. Applies immediately rather than previewing: the
 * selection is one label, and removing UNREAD is idempotent and reversible.
 *
 * Usage: node mark-forums-read.mjs
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { runIfMain } from './lib/cli-utils.mjs';
import { modifyMessages } from './modify-messages.mjs';
import { GMAIL_UNREAD, LABEL_FORUMS } from './lib/constants.mjs';

const CUTOFF_DAYS = 5;

async function main() {
  const { modified } = await modifyMessages(await createGmailClient(), {
    labelName: LABEL_FORUMS,
    unreadOnly: true,
    query: `older_than:${CUTOFF_DAYS}d`,
    remove: [GMAIL_UNREAD],
    apply: true,
    quiet: true,
  });

  console.log(`Marked ${modified} Forums emails as read.`);
}

runIfMain(import.meta.url, main);
