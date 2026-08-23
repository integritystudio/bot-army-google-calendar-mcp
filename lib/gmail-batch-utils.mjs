import { batchModifyMessages, listAllMessageIds } from '../src/shared/gmail-core.ts';
import { DEFAULT_MAX_RESULTS } from './constants.mjs';

// Batching lives in the shared core so the MCP handlers and these scripts cannot
// drift apart on it. Re-exported here because every caller already imports it
// from this module.
export { batchModifyMessages };

/**
 * Search for messages and apply label modifications in one operation.
 *
 * Pages to exhaustion by default. A single capped messages.list call used to
 * truncate any backlog larger than maxResults while still reporting success —
 * the same bug GmailApplyFiltersHandler already fixed on the MCP side. Pass
 * maxResults where a broad, sender-unconstrained query genuinely needs a
 * safety cap (e.g. subject-only matches).
 *
 * Collect-then-modify, never interleaved: the modification usually removes INBOX or
 * UNREAD, which changes whether later pages still match the selector that found them.
 * Paging is listAllMessageIds' job — the hand-rolled loop this replaces duplicated it
 * and, unlike messagePages, did not retry messages.list.
 *
 * @param {Object} gmail - Authenticated Gmail client
 * @param {string} query - Gmail search query
 * @param {{ addLabelIds?: string[], removeLabelIds?: string[] }} modifications
 * @param {number} [maxResults] - Cap the sweep; omit to page to exhaustion
 * @returns {Promise<number>} Count of messages processed
 */
export async function searchAndModify(gmail, query, modifications, maxResults) {
  const ids = await listAllMessageIds(gmail, query, { limit: maxResults ?? Infinity });
  if (ids.length === 0) return 0;
  return batchModifyMessages(gmail, ids, modifications);
}

/**
 * Cap on a sweep whose query matches subject words rather than senders. Unbounded, such
 * a query relabels and archives any mail that merely says "statement" or "receipt".
 */
export const SUBJECT_SWEEP_CAP = DEFAULT_MAX_RESULTS;

/**
 * A capped sweep that says when it stopped short.
 *
 * The bare count cannot distinguish "that was all of them" from "there are more behind
 * the cap", so a truncated run reported exactly like a complete one. Shared by the two
 * scripts that sweep on subject keywords — it was the only thing they had in common.
 *
 * @param {Object} gmail
 * @param {string} query
 * @param {{ addLabelIds?: string[], removeLabelIds?: string[] }} modifications
 * @param {string} description - Named in the truncation notice
 * @returns {Promise<number>}
 */
export async function cappedSweep(gmail, query, modifications, description) {
  const count = await searchAndModify(gmail, query, modifications, SUBJECT_SWEEP_CAP);
  if (count >= SUBJECT_SWEEP_CAP) {
    console.log(`  Note: ${description} hit the ${SUBJECT_SWEEP_CAP}-message cap; re-run to continue.`);
  }
  return count;
}
