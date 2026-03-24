/**
 * Gmail label creation and pattern application utilities.
 * Shared helpers for bulk label operations across create-*.mjs scripts.
 */

import { USER_ID } from './constants.mjs';

/**
 * Create Gmail labels and track their IDs.
 * Handles conflicts when labels already exist by fetching existing ID.
 *
 * @param {Object} gmail - Gmail API client
 * @param {string[]} labelNames - Array of label names to create (can be hierarchical: "Parent/Child")
 * @param {Object} labelIds - Object to store mapping of label names to their IDs
 * @param {Map} existingLabelMap - Map of existing label names to IDs (for conflict resolution)
 * @returns {Promise<void>}
 */
export async function createLabels(gmail, labelNames, labelIds, existingLabelMap) {
  for (const labelName of labelNames) {
    try {
      const response = await gmail.users.labels.create({
        userId: USER_ID,
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });

      console.log(`✅ ${labelName}`);
      labelIds[labelName] = response.data.id;
    } catch (error) {
      if (error.message.includes('exists')) {
        const existingId = existingLabelMap.get(labelName);
        if (existingId) {
          console.log(`⚠️  Exists: ${labelName}`);
          labelIds[labelName] = existingId;
        }
      } else {
        console.error(`❌ Failed ${labelName}: ${error.message}`);
      }
    }
  }
}

/**
 * Apply label patterns to existing emails based on query criteria.
 * Searches for emails matching pattern queries and labels them accordingly.
 *
 * @typedef {Object} LabelPattern
 * @property {string} label - Label name to apply (must be in labelIds)
 * @property {string} query - Gmail search query (e.g., "from:user@example.com")
 *
 * @param {Object} gmail - Gmail API client
 * @param {LabelPattern[]} patterns - Array of patterns with label names and queries
 * @param {Object} labelIds - Map of label names to their IDs (populated by createLabels)
 * @returns {Promise<number>} Total number of emails labeled
 */
export async function applyPatterns(gmail, patterns, labelIds) {
  let total = 0;

  for (const pattern of patterns) {
    try {
      const searchResult = await gmail.users.messages.list({
        userId: USER_ID,
        q: pattern.query,
        maxResults: 100,
      });

      if (!searchResult.data.messages) continue;

      const messageIds = searchResult.data.messages.map(m => m.id);
      const count = messageIds.length;

      if (count > 0) {
        const labelId = labelIds[pattern.label];
        if (!labelId) {
          console.error(`  ❌ No label ID resolved for ${pattern.label}, skipping`);
          continue;
        }

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: messageIds,
            addLabelIds: [labelId],
          },
        });

        console.log(`  ✅ ${pattern.label.split('/').pop()}: ${count}`);
        total += count;
      }
    } catch (error) {
      console.error(`  ❌ Failed ${pattern.label}: ${error.message}`);
    }
  }

  return total;
}

/**
 * Build a cache of all label names to their IDs.
 * Enables runtime label ID resolution instead of hardcoded values.
 *
 * @param {Object} gmail - Gmail API client
 * @returns {Promise<Map<string, string>>} Map of label names to their IDs
 */
export async function buildLabelCache(gmail) {
  const response = await gmail.users.labels.list({
    userId: USER_ID,
    fields: 'labels(id,name)',
  });

  const labelCache = new Map();
  for (const label of response.data.labels || []) {
    labelCache.set(label.name, label.id);
  }
  return labelCache;
}

/**
 * Resolve a single label ID by name using a cache for efficiency.
 *
 * @param {Object} gmail - Gmail API client
 * @param {string} labelName - Name of the label (e.g., "Events/Workshops")
 * @param {Map<string, string>} labelCache - Cache of label names to IDs
 * @returns {Promise<string|null>} Label ID or null if not found
 */
export async function resolveLabelId(gmail, labelName, labelCache) {
  if (labelCache.has(labelName)) {
    return labelCache.get(labelName);
  }

  // Cache miss - rebuild and retry (labels may have been created)
  const updatedCache = await buildLabelCache(gmail);
  return updatedCache.get(labelName) || null;
}

/**
 * Resolve multiple label IDs by name at once.
 *
 * @param {Object} gmail - Gmail API client
 * @param {string[]} labelNames - Array of label names to resolve
 * @returns {Promise<Map<string, string>>} Map of label names to their IDs
 */
export async function resolveLabelIds(gmail, labelNames) {
  const labelCache = await buildLabelCache(gmail);
  const result = new Map();

  for (const labelName of labelNames) {
    const id = labelCache.get(labelName);
    if (id) {
      result.set(labelName, id);
    }
  }

  return result;
}
