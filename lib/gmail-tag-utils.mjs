/**
 * Shared machinery for label-only tag sets (Organization, Country).
 *
 * A tag set is an informational dimension orthogonal to category routing: mail
 * may route to Billing, Promotions or Purchases and still carry the same tag.
 * Filters created here are label-only — they never archive or mark read.
 */
import { ensureLabelExists, createGmailFilter } from './gmail-filter-utils.mjs';
import { withRetry } from './gmail-retry.mjs';
import { searchAndModify } from './gmail-batch-utils.mjs';
import { createGmailClient } from './gmail-client.mjs';
import { parseCli } from './cli-utils.mjs';

/**
 * Adds a label to every message matching a query, paging through all results.
 *
 * Delegates to searchAndModify, which collects every id BEFORE modifying anything.
 * The hand-rolled loop this replaces labeled each page and then followed its
 * nextPageToken — but applyTagSet's backfill query excludes the label being added,
 * so labeling a page shrank the result set the token indexed into and the next page
 * skipped messages. Silently: the run reported the count it did label. Same reason
 * strip-label.mjs re-queries the first page each round (see messagePages' contract).
 *
 * @param {Object} gmail - Gmail API client
 * @param {string} query - Gmail search query
 * @param {string} labelId - Label ID to add
 * @returns {Promise<number>} Count of messages labeled
 */
export function labelAllMatching(gmail, query, labelId) {
  return searchAndModify(gmail, query, { addLabelIds: [labelId] });
}

/**
 * Creates label-only filters for a tag set and backfills existing mail.
 *
 * @param {Object} gmail - Gmail API client
 * @param {Array<{labelName: string, entries: Array<{name: string, query: string}>}>} tagSet
 * @param {Object} [options]
 * @param {boolean} [options.skipBackfill=false] - Create filters without labeling existing mail
 * @param {string|null} [options.onlyLabel=null] - Restrict to labels with this prefix
 * @param {string[]|null} [options.onlyEntries=null] - Restrict to these entry names (lowercased)
 * @returns {Promise<number>} Count of filters created
 */
export async function applyTagSet(gmail, tagSet, { skipBackfill = false, onlyLabel = null, onlyEntries = null } = {}) {
  let filterCount = 0;

  for (const tag of tagSet) {
    if (onlyLabel && !tag.labelName.startsWith(onlyLabel)) continue;
    console.log(`\n${tag.labelName.toUpperCase()}`);
    const labelId = await ensureLabelExists(gmail, tag.labelName);

    for (const entry of tag.entries) {
      if (onlyEntries && !onlyEntries.includes(entry.name.toLowerCase())) continue;
      const filterId = await withRetry(() => createGmailFilter(gmail, { query: entry.query }, { addLabelIds: [labelId] }));
      if (filterId) filterCount++;

      let backfilled = 0;
      if (!skipBackfill) {
        backfilled = await labelAllMatching(gmail, `(${entry.query}) -label:"${tag.labelName}"`, labelId);
      }
      console.log(`  ${filterId ? '✓' : '~'} ${entry.name}${backfilled ? ` (+${backfilled} tagged)` : ''}`);
    }
  }

  return filterCount;
}

/**
 * The CLI both tag-set scripts are. They differed only in which config they read and in
 * the name of their entry-selection flag, so the body lived twice.
 *
 * `entriesFlag` stays per-script rather than becoming a shared `--entries`: `--orgs` and
 * `--countries` are the documented surface, and renaming them would break invocations to
 * remove a duplication that is already gone.
 *
 * @param {Array<{labelName: string, entries: Array<{name: string, query: string}>}>} tagSet
 * @param {{script: string, entriesFlag: string}} cli - Script name for the usage line,
 *   and the flag that selects individual entries by name
 */
export async function runTagSetCli(tagSet, { script, entriesFlag }) {
  const usage = `Usage: node ${script} [--filters-only] [--only <label-prefix>] [--${entriesFlag} a,b]`;
  const { values } = parseCli({
    'filters-only': { type: 'boolean', default: false },
    only: { type: 'string' },
    [entriesFlag]: { type: 'string' },
  }, usage);

  const filterCount = await applyTagSet(createGmailClient(), tagSet, {
    skipBackfill: values['filters-only'],
    onlyLabel: values.only ?? null,
    onlyEntries: values[entriesFlag]?.split(',').map((s) => s.trim().toLowerCase()) ?? null,
  });

  console.log(`\nFilters created: ${filterCount}`);
}
