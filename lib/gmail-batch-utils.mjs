import { USER_ID } from './constants.mjs';

const DEFAULT_BATCH_SIZE = 50;

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
