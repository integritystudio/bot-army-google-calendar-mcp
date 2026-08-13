import { USER_ID } from './constants.mjs';
import { buildLabelCache } from './gmail-label-utils.mjs';
import { withRetry } from './gmail-retry.mjs';

/**
 * Resolves an existing label ID by name, or creates the label if absent.
 *
 * @param {Object} gmail - Gmail API client
 * @param {string} labelName - Label name (supports hierarchical e.g. "Parent/Child")
 * @returns {Promise<string>} Label ID
 */
export async function ensureLabelExists(gmail, labelName) {
  const labelCache = await buildLabelCache(gmail);
  const existing = labelCache.get(labelName);
  if (existing) return existing;

  const res = await gmail.users.labels.create({
    userId: USER_ID,
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  });
  return res.data.id;
}

/**
 * Creates a Gmail filter. Returns the filter ID, or null if it already exists.
 * Throws for any other error.
 *
 * @param {Object} gmail - Gmail API client
 * @param {Object} criteria - Filter criteria (from, to, subject, query, etc.)
 * @param {Object} action - Filter action (addLabelIds, removeLabelIds, etc.)
 * @returns {Promise<string|null>} Filter ID or null if already exists
 */
export async function createGmailFilter(gmail, criteria, action) {
  try {
    const res = await withRetry(() =>
      gmail.users.settings.filters.create({
        userId: USER_ID,
        requestBody: { criteria, action },
      })
    );
    return res.data.id;
  } catch (error) {
    // Google returns HTTP 400 or 409 for duplicate filters; HTTP 500 internal error can also
    // indicate a duplicate when retrying after a partial failure
    if (
      error.code === 409 ||
      error.code === 500 ||
      error.message?.includes('Filter already exists') ||
      error.message?.includes('Internal error encountered')
    ) return null;
    throw error;
  }
}

/**
 * Deletes a Gmail filter by ID, retrying transient settings-API failures.
 *
 * @param {Object} gmail - Gmail API client
 * @param {string} id - Filter ID
 */
export async function deleteGmailFilter(gmail, id) {
  await withRetry(() => gmail.users.settings.filters.delete({ userId: USER_ID, id }));
}

/**
 * Canonical identity of a filter: criteria + action, normalized so a live filter
 * and a config-desired one compare equal. Gmail stores some older filters with a
 * bare `from` criteria field; config always writes `query: 'from:…'`, so `from`
 * folds into the query form. Whitespace inside queries collapses; id arrays sort.
 *
 * @param {Object} criteria - Filter criteria
 * @param {Object} action - Filter action
 * @returns {string}
 */
export function filterKey(criteria = {}, action = {}) {
  const c = { ...criteria };
  if (c.from && !c.query) {
    c.query = c.from.includes(' ') ? `from:(${c.from})` : `from:${c.from}`;
    delete c.from;
  }
  if (c.query) c.query = c.query.replace(/\s+/g, ' ').trim();
  return JSON.stringify({
    criteria: Object.fromEntries(
      Object.entries(c)
        .filter(([, value]) => value !== undefined && value !== '')
        .sort(([a], [b]) => a.localeCompare(b))
    ),
    add: [...(action.addLabelIds ?? [])].sort(),
    remove: [...(action.removeLabelIds ?? [])].sort(),
    ...(action.forward ? { forward: action.forward } : {}),
  });
}

/**
 * Diffs a category's desired filters against the full live filter list.
 *
 * - `missing`: desired filters with no live match anywhere — create these
 * - `stale`:   live filters that add ONLY this category's label yet match no
 *              desired filter — safe to delete
 * - `foreign`: unmatched live filters on this label that also add other labels
 *              or forward — never auto-delete, deleting would affect behavior
 *              outside this category
 *
 * With no ownLabelId (label-less categories) stale detection is skipped: an
 * arbitrary no-label filter can't be attributed to the category.
 *
 * @param {Object} params
 * @param {Array<{criteria: Object, action: Object}>} params.desired
 * @param {Array<Object>} params.liveAll - Every live filter (id, criteria, action)
 * @param {string|null} params.ownLabelId - The category's primary label ID
 * @returns {{missing: Array, stale: Array, foreign: Array}}
 */
export function diffFilters({ desired, liveAll, ownLabelId }) {
  const liveKeys = new Set(liveAll.map(f => filterKey(f.criteria, f.action)));
  const desiredKeys = new Set(desired.map(d => filterKey(d.criteria, d.action)));
  const missing = desired.filter(d => !liveKeys.has(filterKey(d.criteria, d.action)));

  const owned = ownLabelId
    ? liveAll.filter(f => (f.action?.addLabelIds ?? []).includes(ownLabelId))
    : [];
  const unmatched = owned.filter(f => !desiredKeys.has(filterKey(f.criteria, f.action)));
  const stale = unmatched.filter(
    f => (f.action.addLabelIds ?? []).length === 1 && !f.action.forward
  );
  const foreign = unmatched.filter(f => !stale.includes(f));
  return { missing, stale, foreign };
}

const OR_SEPARATOR = ' OR ';

/**
 * Packs per-sender queries into OR-joined chunks below maxLength (a lone query
 * longer than maxLength still gets its own chunk). Preserves input order, so
 * APPEND new senders to consolidated categories — inserting mid-list moves the
 * chunk boundaries and churns every filter after the insertion on the next sync.
 *
 * @param {string[]} queries
 * @param {number} maxLength
 * @returns {string[]} OR-joined query strings
 */
export function chunkQueries(queries, maxLength) {
  const chunks = [];
  let current = [];
  let length = 0;
  for (const query of queries) {
    const wrapped = `(${query})`;
    const addition = current.length ? OR_SEPARATOR.length + wrapped.length : wrapped.length;
    if (current.length && length + addition > maxLength) {
      chunks.push(current.join(OR_SEPARATOR));
      current = [];
      length = 0;
    }
    current.push(wrapped);
    length += current.length === 1 ? wrapped.length : OR_SEPARATOR.length + wrapped.length;
  }
  if (current.length) chunks.push(current.join(OR_SEPARATOR));
  return chunks;
}
