/**
 * Apply a label change to every message matching a selection.
 *
 * Generalizes what six scripts each hand-rolled:
 * resolve labels, build a selector, page it, batch-modify the result. Both now
 * delegate here, and any new "select some mail and relabel it" task is a flag
 * combination rather than another script.
 *
 * Selection prefers labelIds over a `label:"..."` query, because a label name is
 * not safe search input: parentheses return 0 matches and `&`/spaces can tokenize
 * into a sibling label, both silently (see README.md#known-issues).
 *
 * Every label named on the command line must already exist — a typo fails fast
 * rather than silently selecting nothing or creating a label, and system names
 * (UNREAD, INBOX, SPAM) resolve through the same lookup as user labels.
 *
 * Usage:
 *   node modify-messages.mjs --label "Newsletters" --unread --before 2026/06/01 --remove UNREAD --yes
 *   node modify-messages.mjs --query "from:spammy.example" --add SPAM --remove INBOX,UNREAD --yes
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, exitWithUsage, runIfMain } from './lib/cli-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { listAllMessageIds, fetchMessageHeaders } from './lib/gmail-message-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { GMAIL_UNREAD } from './lib/constants.mjs';

/** How many matches to list before summarizing the rest. */
const PREVIEW_LIMIT = 25;

/**
 * @param {Object} gmail - Gmail API client
 * @param {Object} options
 * @param {string} [options.labelName] - Restrict to messages carrying this label
 * @param {string} [options.query] - Gmail search query, ANDed with the label restriction
 * @param {boolean} [options.unreadOnly] - Restrict to unread messages
 * @param {string} [options.before] - Gmail-format cutoff date (YYYY/MM/DD)
 * @param {string[]} [options.add] - Label names to add
 * @param {string[]} [options.remove] - Label names to remove
 * @param {boolean} [options.apply] - Modify for real; otherwise preview and change nothing
 * @param {number} [options.previewLimit]
 * @param {boolean} [options.quiet] - Suppress the match count and progress lines, for
 *   presets that loop and print their own per-iteration summary
 * @returns {Promise<{matched: number, modified: number}>}
 */
export async function modifyMessages(gmail, {
  labelName = null,
  query = null,
  unreadOnly = false,
  before = null,
  add = [],
  remove = [],
  apply = false,
  previewLimit = PREVIEW_LIMIT,
  quiet = false,
} = {}) {
  if (!labelName && !query) throw new Error('Nothing selected: pass --label or --query');
  if (!add.length && !remove.length) throw new Error('No change requested: pass --add or --remove');

  const labelCache = await buildLabelCache(gmail);
  const resolve = (name) => {
    const id = labelCache.get(name);
    if (!id) throw new Error(`Label not found: "${name}"`);
    return id;
  };

  const labelIds = [];
  if (labelName) labelIds.push(resolve(labelName));
  if (unreadOnly) labelIds.push(GMAIL_UNREAD);

  const queryParts = [query, before && `before:${before}`].filter(Boolean);
  const selector = {};
  if (labelIds.length) selector.labelIds = labelIds;
  if (queryParts.length) selector.q = queryParts.join(' ');

  // Resolved before listing: a typo'd label should fail before the paging spend.
  const modifications = {};
  if (add.length) modifications.addLabelIds = add.map(resolve);
  if (remove.length) modifications.removeLabelIds = remove.map(resolve);

  const ids = await listAllMessageIds(gmail, selector);
  if (!quiet) console.log(`Matches: ${ids.length}`);
  if (!ids.length) return { matched: 0, modified: 0 };

  if (!apply) {
    for (const { from, subject } of await fetchMessageHeaders(gmail, ids.slice(0, previewLimit))) {
      console.log(`  • ${from} | ${subject}`);
    }
    if (ids.length > previewLimit) console.log(`  … and ${ids.length - previewLimit} more`);
    console.log('\nPreview only — re-run with --yes to apply.');
    return { matched: ids.length, modified: 0 };
  }

  const modified = await batchModifyMessages(gmail, ids, modifications, {
    onProgress: quiet ? undefined : (done, total) => { if (done < total) console.log(`  ${done}/${total}`); },
  });
  return { matched: ids.length, modified };
}

/** Splits a comma-separated flag value, e.g. --remove INBOX,UNREAD */
const listArg = (value) => (value ?? '').split(',').map(s => s.trim()).filter(Boolean);

const USAGE = 'Usage: node modify-messages.mjs (--label "<name>" | --query "<gmail-query>")'
  + ' [--unread] [--before YYYY/MM/DD] [--add "<label>"] [--remove "<label>"] [--yes]';

async function main() {
  const { values } = parseCli({
    label: { type: 'string' },
    query: { type: 'string' },
    before: { type: 'string' },
    unread: { type: 'boolean', default: false },
    add: { type: 'string' },
    remove: { type: 'string' },
    yes: { type: 'boolean', default: false },
  }, USAGE);
  const options = {
    labelName: values.label ?? null,
    query: values.query ?? null,
    before: values.before ?? null,
    unreadOnly: values.unread,
    add: listArg(values.add),
    remove: listArg(values.remove),
    apply: values.yes,
  };
  if (!options.labelName && !options.query) exitWithUsage(USAGE);
  const { modified } = await modifyMessages(await createGmailClient(), options);
  if (options.apply) console.log(`Modified ${modified} messages.`);
}

runIfMain(import.meta.url, main);
