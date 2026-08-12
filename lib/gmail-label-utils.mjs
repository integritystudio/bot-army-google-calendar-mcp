/**
 * Gmail label creation and pattern application utilities.
 * Shared helpers for bulk label operations across create-*.mjs scripts.
 */

import { USER_ID, DEFAULT_MAX_RESULTS } from './constants.mjs';
import { LabelPatternSchema, LabelIdMapSchema } from '../src/schemas/gmail-label-utils-types.ts';

// labels.list marks built-ins (INBOX, UNREAD, CATEGORY_*) as 'system'.
const SYSTEM_LABEL_TYPE = 'system';

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
  // Validate labelNames
  if (!Array.isArray(labelNames) || !labelNames.every(name => typeof name === 'string')) {
    throw new Error('labelNames must be an array of strings');
  }
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
      if (error.code === 409 || error.message?.includes('exists')) {
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
 * @param {Object} gmail - Gmail API client
 * @param {Array} patterns - Array of patterns with label names and queries
 * @param {Object} labelIds - Map of label names to their IDs (populated by createLabels)
 * @returns {Promise<number>} Total number of emails labeled
 */
export async function applyPatterns(gmail, patterns, labelIds) {
  // Validate input
  const validatedPatterns = LabelPatternSchema.array().parse(patterns);
  const validatedLabelIds = LabelIdMapSchema.parse(labelIds);

  let total = 0;

  for (const pattern of validatedPatterns) {
    try {
      const searchResult = await gmail.users.messages.list({
        userId: USER_ID,
        q: pattern.query,
        maxResults: DEFAULT_MAX_RESULTS,
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
  return (await buildLabelIndex(gmail)).byName;
}

/**
 * Both directions of the label map, plus the user/system split, from one labels.list.
 *
 * Callers reading labelIds off a message need id -> name, which four scripts each
 * rebuilt by inverting buildLabelCache's map — three of them spelled differently. The
 * user/system split matters because only user labels are worth reporting as applied or
 * stray; UNREAD, INBOX and CATEGORY_* are noise.
 *
 * @param {Object} gmail - Gmail API client
 * @returns {Promise<{byName: Map<string,string>, byId: Map<string,string>, userLabelNames: Set<string>}>}
 */
export async function buildLabelIndex(gmail) {
  const response = await gmail.users.labels.list({
    userId: USER_ID,
    fields: 'labels(id,name,type)',
  });

  const byName = new Map();
  const byId = new Map();
  const userLabelNames = new Set();
  for (const label of response.data.labels || []) {
    byName.set(label.name, label.id);
    byId.set(label.id, label.name);
    if (label.type !== SYSTEM_LABEL_TYPE) userLabelNames.add(label.name);
  }
  return { byName, byId, userLabelNames };
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
