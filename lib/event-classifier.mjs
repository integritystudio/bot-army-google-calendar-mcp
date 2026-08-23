/**
 * Fetch messages and classify them by the event date in their own text.
 *
 * Two scripts had this pipeline: mark-past-events-read.mjs and
 * filter-events-by-date.mjs. They agreed on the hard parts — anchor year-less dates to
 * arrival, keep only the verdict so a large label does not hold hundreds of MB of
 * bodies, retry a fetch rather than dropping it — and disagreed on everything that
 * mattered less, with filter-events-by-date holding the older answer each time.
 *
 * Chunked, with the caller acting on each chunk before the next is fetched. A run that
 * accumulates every verdict and modifies once at the end loses all of it if anything
 * throws partway, which is how a 12.5k-message run discarded 4,161 completed
 * classifications. A crash now costs at most one chunk, for both callers.
 */
import { classifyEmail } from './date-based-filter.mjs';
import { getHeader } from './email-utils.mjs';
import { extractBodyText, mapWithConcurrency } from './gmail-message-utils.mjs';
import { withRetry } from './gmail-retry.mjs';
import { USER_ID } from './constants.mjs';

export const CLASSIFY_CHUNK_SIZE = 500;
export const STATUS_PAST = 'past';
export const STATUS_FUTURE = 'future';

/**
 * Classify each message and hand the verdicts to `onChunk` a chunk at a time.
 *
 * @param {Object} gmail - Gmail API client
 * @param {string[]} ids - Message ids to classify
 * @param {Object} [options]
 * @param {number} [options.chunkSize]
 * @param {(chunk: {past: string[], future: string[], unknown: string[],
 *   done: number, total: number}) => Promise<void>|void} [options.onChunk] - Awaited
 *   once per chunk, before the next is fetched
 * @returns {Promise<{past: number, future: number, unknown: number, failed: number}>}
 */
export async function classifyByEventDate(gmail, ids, { chunkSize = CLASSIFY_CHUNK_SIZE, onChunk } = {}) {
  const totals = { past: 0, future: 0, unknown: 0, failed: 0 };

  for (let offset = 0; offset < ids.length; offset += chunkSize) {
    const chunk = ids.slice(offset, offset + chunkSize);

    const verdicts = await mapWithConcurrency(chunk, async (id) => {
      // Retried rather than swallowed with .catch(() => null): a dropped message is
      // simply never classified, so a rate-limited run reported a smaller label
      // instead of an error.
      const msg = await withRetry(() =>
        gmail.users.messages.get({ userId: USER_ID, id, format: 'full' })
      ).catch(() => { totals.failed++; return null; });

      if (!msg) return null;

      const headers = msg.data.payload?.headers || [];
      const subject = getHeader(headers, 'Subject', '');
      // extractBodyText, not decodeMessageBody: a whitespace-only or stylesheet-filled
      // plain part is still truthy, so reading only that returned nothing usable and
      // the HTML holding the event date was never parsed. In one label that silenced
      // 4,934 of 5,625 messages into "no event date found".
      const body = extractBodyText(msg.data.payload);
      // Anchor year-less dates to when the mail arrived, not to now: a 2025 email saying
      // "March 25" means March 2025, and resolving it against today would date every
      // backfilled message to whenever this script happens to run.
      const { status } = classifyEmail(subject, body, new Date(Number(msg.data.internalDate)));
      // Only the verdict survives the mapper — retaining every full body would hold
      // hundreds of MB on a label the size of Events/Meetup.
      return { id: msg.data.id, status };
    });

    const found = verdicts.filter(Boolean);
    const byStatus = {
      past: found.filter((v) => v.status === STATUS_PAST).map((v) => v.id),
      future: found.filter((v) => v.status === STATUS_FUTURE).map((v) => v.id),
      unknown: found
        .filter((v) => v.status !== STATUS_PAST && v.status !== STATUS_FUTURE)
        .map((v) => v.id),
    };
    totals.past += byStatus.past.length;
    totals.future += byStatus.future.length;
    totals.unknown += byStatus.unknown.length;

    await onChunk?.({ ...byStatus, done: offset + chunk.length, total: ids.length });
  }

  return totals;
}
