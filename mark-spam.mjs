/**
 * Move messages matching a Gmail query into Spam.
 * Adds SPAM and removes INBOX/UNREAD; other labels are untouched.
 *
 * Prints every match and exits without modifying anything unless --yes is
 * passed, so a query can be checked before it is applied.
 *
 * Usage:
 *   node mark-spam.mjs "from:someone@example.com subject:Hello"        # preview
 *   node mark-spam.mjs "from:someone@example.com subject:Hello" --yes  # apply
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { listAllMessageIds, fetchMessageHeaders } from './lib/gmail-message-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { GMAIL_SPAM, GMAIL_INBOX, GMAIL_UNREAD } from './lib/constants.mjs';

const apply = process.argv.includes('--yes');
const query = process.argv.slice(2).filter(arg => !arg.startsWith('--')).join(' ');
if (!query) {
  console.error('Usage: node mark-spam.mjs "<gmail-query>" [--yes]');
  process.exit(1);
}

const gmail = await createGmailClient();

const ids = await listAllMessageIds(gmail, query);

console.log(`Matches for "${query}": ${ids.length}`);
for (const { from, subject } of await fetchMessageHeaders(gmail, ids)) {
  console.log(`  • ${from} | ${subject}`);
}

if (!ids.length) process.exit(0);
if (!apply) {
  console.log('\nPreview only — re-run with --yes to move these to Spam.');
  process.exit(0);
}

await batchModifyMessages(gmail, ids, {
  addLabelIds: [GMAIL_SPAM],
  removeLabelIds: [GMAIL_INBOX, GMAIL_UNREAD],
});

console.log(`Moved ${ids.length} to Spam.`);
