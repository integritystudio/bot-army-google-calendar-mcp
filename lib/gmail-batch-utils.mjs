import { USER_ID, DEFAULT_MAX_RESULTS, MS_PER_DAY } from './constants.mjs';
import { batchModifyMessages } from '../src/shared/gmail-core.ts';

// Batching lives in the shared core so the MCP handlers and these scripts cannot
// drift apart on it. Re-exported here because every caller already imports it
// from this module.
export { batchModifyMessages };

const SEARCH_PAGE_SIZE = 500;

/**
 * Search for messages and apply label modifications in one operation.
 *
 * Pages to exhaustion by default. A single capped messages.list call used to
 * truncate any backlog larger than maxResults while still reporting success —
 * the same bug GmailApplyFiltersHandler already fixed on the MCP side. Pass
 * maxResults where a broad, sender-unconstrained query genuinely needs a
 * safety cap (e.g. subject-only matches).
 *
 * @param {Object} gmail - Authenticated Gmail client
 * @param {string} query - Gmail search query
 * @param {{ addLabelIds?: string[], removeLabelIds?: string[] }} modifications
 * @param {number} [maxResults] - Cap the sweep; omit to page to exhaustion
 * @returns {Promise<number>} Count of messages processed
 */
export async function searchAndModify(gmail, query, modifications, maxResults) {
  const ids = [];
  let pageToken;
  do {
    const res = await gmail.users.messages.list({
      userId: USER_ID,
      q: query,
      maxResults: SEARCH_PAGE_SIZE,
      pageToken,
    });
    for (const message of res.data.messages ?? []) {
      if (message.id) ids.push(message.id);
      if (maxResults != null && ids.length >= maxResults) break;
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && !(maxResults != null && ids.length >= maxResults));

  if (ids.length === 0) return 0;
  return batchModifyMessages(gmail, ids, modifications);
}

/**
 * Search for messages, filter to those older than daysAgo, and apply label modifications.
 * Uses messages.get with format=minimal to fetch internalDate (not available on messages.list).
 * @param {Object} gmail - Authenticated Gmail client
 * @param {string} query - Gmail search query
 * @param {number} daysAgo - Only modify messages older than this many days
 * @param {{ addLabelIds?: string[], removeLabelIds?: string[] }} modifications
 * @param {number} [maxResults]
 * @returns {Promise<string[]>} IDs of messages that were modified
 */
export async function searchAndModifyOlderThan(gmail, query, daysAgo, modifications, maxResults = DEFAULT_MAX_RESULTS) {
  const cutoffMs = Date.now() - daysAgo * MS_PER_DAY;
  const res = await gmail.users.messages.list({
    userId: USER_ID,
    q: query,
    maxResults,
  });
  const messageStubs = res.data.messages || [];
  if (messageStubs.length === 0) return [];

  // messages.list only returns id/threadId; fetch internalDate via minimal get
  const detailed = await Promise.all(
    messageStubs.map(({ id }) =>
      gmail.users.messages.get({
        userId: USER_ID,
        id,
        format: 'minimal',
        fields: 'id,internalDate',
      })
    )
  );

  const oldIds = detailed
    .filter(msg => parseInt(msg.data.internalDate, 10) < cutoffMs)
    .map(msg => msg.data.id);

  if (oldIds.length > 0) {
    await batchModifyMessages(gmail, oldIds, modifications);
  }
  return oldIds;
}
