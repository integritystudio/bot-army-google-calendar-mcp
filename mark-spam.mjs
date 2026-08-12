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

const BATCH_LIMIT = 1000;
const SPAM_LABEL = 'SPAM';
const INBOX_LABEL = 'INBOX';
const UNREAD_LABEL = 'UNREAD';

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

for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
  await gmail.users.messages.batchModify({
    userId: 'me',
    requestBody: {
      ids: ids.slice(i, i + BATCH_LIMIT),
      addLabelIds: [SPAM_LABEL],
      removeLabelIds: [INBOX_LABEL, UNREAD_LABEL],
    },
  });
}

console.log(`Moved ${ids.length} to Spam.`);
