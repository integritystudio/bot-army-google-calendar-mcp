/**
 * Retry policy for transient Gmail API failures.
 *
 * Lives on its own rather than inside a feature module: label tagging, bulk relabelling
 * and message fetching all need it, and a lib module importing it from a tag module is
 * the kind of edge that turns into an import cycle.
 */
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 3000;
const TRANSIENT_STATUS_CODES = [429, 500, 503];
const TRANSIENT_MESSAGE = 'Precondition';

/**
 * Retries transient Gmail failures. Gmail intermittently throws
 * FAILED_PRECONDITION / 429 on rapid batch operations.
 *
 * @param {() => Promise<T>} fn - Operation to attempt
 * @returns {Promise<T>}
 * @template T
 */
export async function withRetry(fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const transient = (error instanceof Error && error.message.includes(TRANSIENT_MESSAGE))
        || (typeof error?.code === 'number' && TRANSIENT_STATUS_CODES.includes(error.code));
      if (!transient || attempt >= MAX_RETRIES) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
}
