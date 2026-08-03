import { USER_ID } from './constants.mjs';
import { buildLabelCache } from './gmail-label-utils.mjs';

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
    const res = await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: { criteria, action },
    });
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
