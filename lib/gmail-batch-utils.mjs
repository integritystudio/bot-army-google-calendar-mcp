import { USER_ID, DEFAULT_MAX_RESULTS } from './constants.mjs';
import { getHeader } from './email-utils.mjs';

const DEFAULT_BATCH_SIZE = 50;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Apply label modifications to messages in batches.
 * @param {Object} gmail - Authenticated Gmail client
 * @param {Array<string|{id:string}>} messages - Message IDs or message objects
 * @param {{ addLabelIds?: string[], removeLabelIds?: string[] }} modifications
 * @param {number} [batchSize]
 * @returns {Promise<number>} Count of messages processed
 */
export async function batchModifyMessages(gmail, messages, modifications, batchSize = DEFAULT_BATCH_SIZE) {
  const ids = messages.map(m => (typeof m === 'string' ? m : m.id));
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    await gmail.users.messages.batchModify({
      userId: USER_ID,
      requestBody: { ids: batch, ...modifications }
    });
    console.log(`  Processed ${Math.min(i + batchSize, ids.length)}/${ids.length}`);
  }
  return ids.length;
}

/**
 * Search for messages and apply label modifications in one operation.
 * @param {Object} gmail - Authenticated Gmail client
 * @param {string} query - Gmail search query
 * @param {{ addLabelIds?: string[], removeLabelIds?: string[] }} modifications
 * @param {number} [maxResults]
 * @returns {Promise<number>} Count of messages processed
 */
export async function searchAndModify(gmail, query, modifications, maxResults = 500) {
  const res = await gmail.users.messages.list({ userId: USER_ID, q: query, maxResults });
  const messages = res.data.messages || [];
  if (messages.length === 0) return 0;
  return batchModifyMessages(gmail, messages, modifications);
}

/**
 * Search for messages, filter to those older than daysAgo, and apply label modifications.
 * @param {Object} gmail - Authenticated Gmail client
 * @param {string} query - Gmail search query
 * @param {number} daysAgo - Only modify messages older than this many days
 * @param {{ addLabelIds?: string[], removeLabelIds?: string[] }} modifications
 * @param {number} [maxResults]
 * @returns {Promise<string[]>} IDs of messages that were modified
 */
export async function searchAndModifyOlderThan(gmail, query, daysAgo, modifications, maxResults = DEFAULT_MAX_RESULTS) {
  const cutoff = new Date(Date.now() - daysAgo * MS_PER_DAY);
  const res = await gmail.users.messages.list({ userId: USER_ID, q: query, maxResults });
  const messages = res.data.messages || [];
  if (messages.length === 0) return [];

  const fullMsgs = await Promise.all(
    messages.map(msg =>
      gmail.users.messages.get({ userId: USER_ID, id: msg.id, format: 'metadata', metadataHeaders: ['Date'] })
    )
  );

  const oldIds = fullMsgs
    .filter(res => new Date(getHeader(res.data.payload?.headers || [], 'Date')) < cutoff)
    .map(res => res.data.id);

  if (oldIds.length > 0) {
    await batchModifyMessages(gmail, oldIds, modifications);
  }
  return oldIds;
}
