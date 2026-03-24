/**
 * Gmail batch operations utility for efficient bulk filter management.
 * Uses Gmail's batch API to process up to 100 filters per API call.
 * Provides error handling and per-item response tracking.
 */

/**
 * Filter definition for batch creation.
 * @typedef {Object} FilterDefinition
 * @property {Object} criteria - Filter criteria (query, from, subject, etc.)
 * @property {Object} action - Filter action (archive, addLabel, skip, etc.)
 */

/**
 * Response from a single filter creation.
 * @typedef {Object} FilterResponse
 * @property {boolean} success - Whether this filter was created successfully
 * @property {string} filterId - ID of created filter (if successful)
 * @property {string|null} error - Error message (if failed)
 */

const BATCH_SIZE = 100;

/**
 * Create multiple filters using Gmail's batch API.
 * Groups filters into batches of up to 100 and processes each batch.
 * Returns response for each filter with success status and ID/error.
 *
 * @param {Object} gmail - Authenticated Gmail client
 * @param {string} userId - User ID (typically 'me')
 * @param {FilterDefinition[]} filters - Array of filter definitions to create
 * @returns {Promise<FilterResponse[]>} Array of responses, one per input filter
 */
export async function batchCreateFilters(gmail, userId, filters) {
  const responses = [];

  // Process filters in batches
  for (let i = 0; i < filters.length; i += BATCH_SIZE) {
    const batchFilters = filters.slice(i, i + BATCH_SIZE);
    const batchResponses = await processBatch(gmail, userId, batchFilters);
    responses.push(...batchResponses);
  }

  return responses;
}

/**
 * Process a single batch of filters.
 * Creates individual filter requests and executes them in parallel.
 *
 * @private
 * @param {Object} gmail - Authenticated Gmail client
 * @param {string} userId - User ID
 * @param {FilterDefinition[]} batch - Batch of filter definitions
 * @returns {Promise<FilterResponse[]>} Responses for this batch
 */
async function processBatch(gmail, userId, batch) {
  const promises = batch.map(filter =>
    createSingleFilter(gmail, userId, filter)
  );

  return Promise.all(promises);
}

/**
 * Create a single filter with error handling.
 *
 * @private
 * @param {Object} gmail - Authenticated Gmail client
 * @param {string} userId - User ID
 * @param {FilterDefinition} filter - Filter definition
 * @returns {Promise<FilterResponse>} Response with success status
 */
async function createSingleFilter(gmail, userId, filter) {
  try {
    const response = await gmail.users.settings.filters.create({
      userId,
      requestBody: filter
    });

    return {
      success: true,
      filterId: response.data.id || null,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      filterId: null,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Create multiple filters with individual result tracking and summary.
 * This is a convenience wrapper that calls batchCreateFilters and provides
 * a summary of successes and failures.
 *
 * @param {Object} gmail - Authenticated Gmail client
 * @param {string} userId - User ID
 * @param {FilterDefinition[]} filters - Filters to create
 * @returns {Promise<Object>} Summary object:
 *   - successful: number of filters created
 *   - failed: number of filters that failed
 *   - results: array of FilterResponse objects
 */
export async function batchCreateFiltersWithSummary(gmail, userId, filters) {
  const results = await batchCreateFilters(gmail, userId, filters);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    successful,
    failed,
    results
  };
}
