/**
 * Move messages matching a Gmail query into Spam.
 * Adds SPAM and removes INBOX/UNREAD; other labels are untouched.
 *
 * Prints matches and exits without modifying anything unless --yes is passed,
 * so a query can be checked before it is applied — an over-broad one trains
 * Gmail's classifier on wanted mail.
 *
 * Selection, preview and batching live in modify-messages.mjs; this is the
 * spam-shaped preset of it.
 *
 * Usage:
 *   node mark-spam.mjs "from:someone@example.com subject:Hello"        # preview
 *   node mark-spam.mjs "from:someone@example.com subject:Hello" --yes  # apply
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { modifyMessages } from './modify-messages.mjs';
import { GMAIL_SPAM, GMAIL_INBOX, GMAIL_UNREAD } from './lib/constants.mjs';

const apply = process.argv.includes('--yes');
const query = process.argv.slice(2).filter(arg => !arg.startsWith('--')).join(' ');
if (!query) {
  console.error('Usage: node mark-spam.mjs "<gmail-query>" [--yes]');
  process.exit(1);
}

const { modified } = await modifyMessages(await createGmailClient(), {
  query,
  add: [GMAIL_SPAM],
  remove: [GMAIL_INBOX, GMAIL_UNREAD],
  apply,
});

if (apply) console.log(`Moved ${modified} to Spam.`);
