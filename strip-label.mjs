/**
 * Remove a label from every message carrying it.
 *
 * A modify-messages.mjs preset. Selection goes through labelIds, never a `label:"…"`
 * query — a label name is not safe search input: parentheses return 0 matches even
 * inside quotes, and `&`/spaces can tokenize into a sibling label. Both fail silently
 * (see README.md#known-issues). This script was the standing example of that failure,
 * reporting `Stripped 0` against a label demonstrably holding mail.
 *
 * The re-query-the-first-page loop this replaces existed because removing a label
 * shrinks the result set and invalidates page tokens. modify-messages collects every id
 * before modifying anything, so no page token is ever held across a mutation and the
 * problem it worked around cannot arise.
 *
 * **Check what remains labeled before stripping.** Removing `Product Updates` from
 * AlphaSignal mail would have orphaned 215 of 321 messages, because only the rest also
 * carried `Newsletters`; backfill the correct label first.
 *
 * Usage:
 *   node strip-label.mjs --label "Organization/BigTech"
 *   node strip-label.mjs --label "X" --dry-run              # preview, change nothing
 *   node strip-label.mjs --label "X" --query "from:foo.com" # only foo.com's copies
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, exitWithUsage, runIfMain } from './lib/cli-utils.mjs';
import { modifyMessages } from './modify-messages.mjs';

const USAGE = 'Usage: node strip-label.mjs --label "<name>" [--query "<gmail-query>"] [--dry-run]';

async function main() {
  const { values } = parseCli({
    label: { type: 'string' },
    query: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  }, USAGE);

  const labelName = values.label;
  const scopeQuery = values.query ?? null;
  const dryRun = values['dry-run'];
  if (!labelName) exitWithUsage(USAGE);

  const { matched, modified } = await modifyMessages(await createGmailClient(), {
    labelName,
    query: scopeQuery,
    remove: [labelName],
    apply: !dryRun,
    previewHint: 'drop --dry-run to apply',
  });

  const scope = scopeQuery ? ` matching ${scopeQuery}` : '';
  console.log(dryRun
    ? `Would strip ${matched} messages from "${labelName}"${scope}`
    : `Stripped ${modified} messages from "${labelName}"${scope}`);
}

runIfMain(import.meta.url, main);
