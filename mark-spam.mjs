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
import { parseCli, exitWithUsage, runMain } from './lib/cli-utils.mjs';
import { modifyMessages } from './modify-messages.mjs';
import { GMAIL_SPAM, GMAIL_INBOX, GMAIL_UNREAD } from './lib/constants.mjs';

const USAGE = 'Usage: node mark-spam.mjs "<gmail-query>" [--yes]';

const { values, positionals } = parseCli(
  { yes: { type: 'boolean', default: false } },
  USAGE,
  { allowPositionals: true },
);
const apply = values.yes;
const query = positionals.join(' ');
if (!query) exitWithUsage(USAGE);

async function main() {
  const { modified } = await modifyMessages(await createGmailClient(), {
    query,
    add: [GMAIL_SPAM],
    remove: [GMAIL_INBOX, GMAIL_UNREAD],
    apply,
  });

  if (apply) console.log(`Moved ${modified} to Spam.`);
}

runMain(main);
