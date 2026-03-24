/**
 * Generic batch processing utilities for parallel operations with error aggregation
 */

export interface BatchResult<T> {
  results: T[];
  errors: Array<{ id: string; error: string }>;
}

export interface BatchProcessorOptions<T> {
  items: string[];
  operation: (id: string) => Promise<T>;
  errorFormatter?: (error: any) => string;
  continueOnError?: boolean;
}

const defaultErrorFormatter = (error: any): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(error);
};

/**
 * Process items in parallel with error aggregation
 * @param options - Configuration for batch processing
 * @returns Object with results and errors arrays
 *
 * @example
 * const result = await processBatchItems({
 *   items: ['cal1', 'cal2', 'cal3'],
 *   operation: async (calendarId) => await fetchCalendar(calendarId),
 *   continueOnError: true
 * });
 */
export async function processBatchItems<T>(
  options: BatchProcessorOptions<T>
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
    const promises = items.map(async (id) => {
      try {
        const result = await operation(id);
        return { success: true, id, result } as const;
      } catch (error) {
        return { success: false, id, error } as const;
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
    const promises = items.map((id) => operation(id));
    results.push(...(await Promise.all(promises)));
  }

  return { results, errors };
}

/**
 * Process items in batches (chunks) to limit concurrency
 * @param items - Items to process
 * @param operation - Async operation for each item
 * @param batchSize - Number of items to process concurrently
 * @returns Array of results in original order
 *
 * @example
 * const results = await processBatchItemsChunked(
 *   calendars,
 *   cal => fetchEvents(cal),
 *   5 // process 5 at a time
 * );
 */
export async function processBatchItemsChunked<T>(
  items: string[],
  operation: (id: string) => Promise<T>,
  batchSize: number = 5
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(
      chunk.map((id) => operation(id))
    );
    results.push(...chunkResults);
  }

  return results;
}
