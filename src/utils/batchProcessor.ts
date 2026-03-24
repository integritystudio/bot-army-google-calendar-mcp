/**
 * Generic batch processing utilities for parallel operations with error aggregation
 */

import { formatErrorMessage } from "../handlers/core/errorFormatting.js";

export interface BatchResult<T> {
  results: T[];
  errors: Array<{ id: string; error: string }>;
}

export interface BatchProcessorOptions<T, TItem = string> {
  items: TItem[];
  operation: (item: TItem) => Promise<T>;
  errorFormatter?: (error: unknown) => string;
  continueOnError?: boolean;
}

const defaultErrorFormatter = (error: unknown): string => {
  return formatErrorMessage(error);
};

/**
 * Process items in parallel with error aggregation
 * @param options - Configuration for batch processing
 * @returns Object with results and errors arrays
 * @throws If continueOnError is false and any operation fails
 *
 * @example
 * const result = await processBatchItems({
 *   items: ['cal1', 'cal2', 'cal3'],
 *   operation: async (calendarId) => await fetchCalendar(calendarId),
 *   continueOnError: true
 * });
 */
export async function processBatchItems<T, TItem = string>(
  options: BatchProcessorOptions<T, TItem>
): Promise<BatchResult<T>> {
  const {
    items,
    operation,
    errorFormatter = defaultErrorFormatter,
    continueOnError = true
  } = options;

  const results: T[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  if (continueOnError) {
    // Process all items, collect errors
    const promises = items.map(async (item, index) => {
      try {
        const result = await operation(item);
        return { success: true, id: String(index), result } as const;
      } catch (error: unknown) {
        return { success: false, id: String(index), error } as const;
      }
    });

    const outcomes = await Promise.all(promises);

    outcomes.forEach((outcome) => {
      if (outcome.success) {
        results.push(outcome.result);
      } else {
        errors.push({
          id: outcome.id,
          error: errorFormatter(outcome.error)
        });
      }
    });
  } else {
    // Stop on first error (fail fast)
    const promises = items.map((item) => operation(item));
    results.push(...(await Promise.all(promises)));
  }

  return { results, errors };
}

/**
 * Process items in batches (chunks) to limit concurrency with error aggregation
 * @param items - Items to process
 * @param operation - Async operation for each item
 * @param batchSize - Number of items to process concurrently (default: 5)
 * @param continueOnError - Whether to continue processing remaining items on error (default: true)
 * @returns Object with results and errors arrays
 *
 * @example
 * const { results, errors } = await processBatchItemsChunked(
 *   calendars,
 *   cal => fetchEvents(cal),
 *   5, // process 5 at a time
 *   true // continue on error
 * );
 */
export async function processBatchItemsChunked<T, TItem = string>(
  items: TItem[],
  operation: (item: TItem) => Promise<T>,
  batchSize: number = 5,
  continueOnError: boolean = true
): Promise<BatchResult<T>> {
  const results: T[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (let chunkIndex = 0; chunkIndex < items.length; chunkIndex += batchSize) {
    const chunk = items.slice(chunkIndex, chunkIndex + batchSize);

    if (continueOnError) {
      const promises = chunk.map(async (item, index) => {
        try {
          const result = await operation(item);
          return { success: true, id: String(chunkIndex + index), result } as const;
        } catch (error: unknown) {
          return { success: false, id: String(chunkIndex + index), error } as const;
        }
      });

      const outcomes = await Promise.all(promises);
      outcomes.forEach((outcome) => {
        if (outcome.success) {
          results.push(outcome.result);
        } else {
          errors.push({
            id: outcome.id,
            error: formatErrorMessage(outcome.error)
          });
        }
      });
    } else {
      const chunkResults = await Promise.all(
        chunk.map((item) => operation(item))
      );
      results.push(...chunkResults);
    }
  }

  return { results, errors };
}
