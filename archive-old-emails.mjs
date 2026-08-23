/**
 * Archive emails older than DAYS_AGO that match a given label or Gmail query.
 *
 * A query targets senders that should stay in the inbox briefly but not linger —
 * Gmail filters run only on arrival, so age-based archiving has to happen here.
 *
 * Selection and batching live in modify-messages.mjs; this is the age-cutoff
 * archive preset of it.
 *
 * Two changes from the hand-rolled version this replaces. It no longer stops at
 * DEFAULT_MAX_RESULTS — searchAndModifyOlderThan defaults that cap, so dropping the
 * argument would not have lifted it — and so it previews unless --yes. And the age
 * test is now Gmail's own `before:`, which costs one query rather than a
 * messages.get per candidate to read internalDate client-side.
 *
 * Usage:
 *   node archive-old-emails.mjs --label "Meeting Responses"        # preview
 *   node archive-old-emails.mjs --query "from:laseraway.co" --yes  # apply
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, exitWithUsage, runIfMain } from './lib/cli-utils.mjs';
import { modifyMessages } from './modify-messages.mjs';
import { GMAIL_INBOX, GMAIL_UNREAD } from './lib/constants.mjs';
import { gmailDateDaysAgo } from './lib/date-based-filter.mjs';
import { BANNER, printComplete } from './lib/console-utils.mjs';

const DAYS_AGO = 7;

const USAGE = 'Usage: node archive-old-emails.mjs (--label "<label name>" | --query "<gmail-query>") [--yes]';

async function main() {
  const { values } = parseCli({
    label: { type: 'string' },
    query: { type: 'string' },
    yes: { type: 'boolean', default: false },
  }, USAGE);

  const { label: labelName, query, yes: apply } = values;
  if (!labelName && !query) exitWithUsage(USAGE);

  const before = gmailDateDaysAgo(DAYS_AGO);
  console.log(`ARCHIVING OLD EMAILS — ${query ? `query: ${query}` : `label: ${labelName}`}\n`);
  console.log(BANNER + '\n');
  console.log(`Archiving emails before ${before}\n`);

  const { modified } = await modifyMessages(await createGmailClient(), {
    labelName: labelName ?? null,
    query: query ?? null,
    before,
    remove: [GMAIL_UNREAD, GMAIL_INBOX],
    apply,
  });

  if (apply) printComplete(`Total archived: ${modified} emails\n`);
}

runIfMain(import.meta.url, main);
