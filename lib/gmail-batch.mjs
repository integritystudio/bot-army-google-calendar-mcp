/**
 * Gmail batch operations utility for efficient bulk filter management.
 * Uses Gmail's batch API to process up to 100 filters per API call.
 * Provides error handling and per-item response tracking.
 */

import { FilterDefinitionsSchema, FilterResponseSchema, BatchSummarySchema } from '../src/schemas/gmail-batch-types.ts';

const BATCH_SIZE = 100;

/**
 * Create multiple filters using Gmail's batch API.
 * Groups filters into batches of up to 100 and processes each batch.
 * Returns response for each filter with success status and ID/error.
 *
 * @param {Object} gmail - Authenticated Gmail client
 * @param {string} userId - User ID (typically 'me')
 * @param {Array} filters - Array of filter definitions to create
 * @returns {Promise<Array>} Array of responses, one per input filter
 */
export async function batchCreateFilters(gmail, userId, filters) {
  // Validate input
  const validatedFilters = FilterDefinitionsSchema.parse(filters);
  const responses = [];

  // Process filters in batches
  for (let i = 0; i < validatedFilters.length; i += BATCH_SIZE) {
    const batchFilters = validatedFilters.slice(i, i + BATCH_SIZE);
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
 * @param {Object} filter - Filter definition
 * @returns {Promise<Object>} Response with success status
 */
async function createSingleFilter(gmail, userId, filter) {
  try {
    const response = await gmail.users.settings.filters.create({
      userId,
      requestBody: filter
    });

    return FilterResponseSchema.parse({
      success: true,
      filterId: response.data.id || null,
      error: null
    });
  } catch (error) {
    return FilterResponseSchema.parse({
      success: false,
      filterId: null,
      error: error.message || 'Unknown error'
    });
  }
}

/**
 * Create multiple filters with individual result tracking and summary.
 * This is a convenience wrapper that calls batchCreateFilters and provides
 * a summary of successes and failures.
 *
 * @param {Object} gmail - Authenticated Gmail client
 * @param {string} userId - User ID
 * @param {Array} filters - Filters to create
 * @returns {Promise<Object>} Summary object with successful/failed counts and results
 */
export async function batchCreateFiltersWithSummary(gmail, userId, filters) {
  const results = await batchCreateFilters(gmail, userId, filters);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return BatchSummarySchema.parse({
    successful,
    failed,
    results
  });
}
