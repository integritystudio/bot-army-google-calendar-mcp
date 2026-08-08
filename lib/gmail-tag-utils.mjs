/**
 * Shared machinery for label-only tag sets (Organization, Country).
 *
 * A tag set is an informational dimension orthogonal to category routing: mail
 * may route to Billing, Promotions or Purchases and still carry the same tag.
 * Filters created here are label-only — they never archive or mark read.
 */
import { ensureLabelExists, createGmailFilter } from './gmail-filter-utils.mjs';

const BATCH_SIZE = 1000;
const LIST_PAGE_SIZE = 500;
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 3000;

/**
 * Retries transient Gmail failures. Gmail intermittently throws
 * FAILED_PRECONDITION / 429 on rapid batch operations.
 *
 * @param {() => Promise<T>} fn - Operation to attempt
 * @returns {Promise<T>}
 * @template T
 */
export async function withRetry(fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const transient = (error instanceof Error && error.message.includes('Precondition'))
        || (typeof error?.code === 'number' && [429, 500, 503].includes(error.code));
      if (!transient || attempt >= MAX_RETRIES) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
}

/**
 * Adds a label to every message matching a query, paging through all results.
 *
 * @param {Object} gmail - Gmail API client
 * @param {string} query - Gmail search query
 * @param {string} labelId - Label ID to add
 * @returns {Promise<number>} Count of messages labeled
 */
export async function labelAllMatching(gmail, query, labelId) {
  let total = 0;
  let pageToken;
  do {
    const res = await withRetry(() => gmail.users.messages.list({
      userId: 'me', q: query, maxResults: LIST_PAGE_SIZE, pageToken,
    }));
    const ids = (res.data.messages || []).map(m => m.id);
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE);
      await withRetry(() => gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: { ids: chunk, addLabelIds: [labelId] },
      }));
    }
    total += ids.length;
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return total;
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
