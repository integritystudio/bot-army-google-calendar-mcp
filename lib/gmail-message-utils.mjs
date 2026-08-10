import { USER_ID, DEFAULT_MAX_RESULTS, GMAIL_FETCH_CONCURRENCY } from './constants.mjs';
import { getHeader, decodeBase64Payload } from './email-utils.mjs';
import { extractHtmlFromPayload } from './schema-extractor.mjs';

const HTML_TAG_PATTERN = /<[^>]+>/g;
const STYLE_BLOCK_PATTERN = /<style[\s\S]*?<\/style>/gi;

/**
 * Decodes the plain-text body from a Gmail message payload.
 * Checks direct body data first, then looks for a text/plain part.
 *
 * @param {Object} payload - message.data.payload
 * @returns {string}
 */
export function decodeMessageBody(payload) {
  if (payload?.body?.data) {
    return decodeBase64Payload(payload.body.data);
  }
  const textPart = payload?.parts?.find(p => p.mimeType === 'text/plain');
  if (textPart?.body?.data) {
    return decodeBase64Payload(textPart.body.data);
  }
  console.warn('decodeMessageBody: no text/plain body found in payload');
  return '';
}

/**
 * Extracts readable body text from a Gmail message payload.
 * Prefers the text/plain part; falls back to tag-stripped HTML for
 * HTML-only senders (most event/marketing mail).
 *
 * @param {Object} payload - message.data.payload
 * @returns {string}
 */
export function extractBodyText(payload) {
  const plain = decodeMessageBody(payload);
  if (plain) return plain;
  const html = extractHtmlFromPayload(payload);
  if (!html) return '';
  return html
    .replace(STYLE_BLOCK_PATTERN, ' ')
    .replace(HTML_TAG_PATTERN, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/**
 * Fetches messages under a label and returns their metadata (Subject, From, Date).
 * Handles individual fetch failures by filtering them out.
 *
 * @param {Object} gmail - Gmail API client
 * @param {string} labelId - Label ID to query
 * @param {Object} [options]
 * @param {number} [options.maxResults=100] - Max results from messages.list
 * @param {number} [options.limit] - Cap on how many messages to fetch metadata for
 * @returns {Promise<{total: number, messages: Array<{subject: string, from: string, date: string}>}>}
 */
export async function fetchLabeledMessageMetadata(gmail, labelId, { maxResults = DEFAULT_MAX_RESULTS, limit } = {}) {
  const result = await gmail.users.messages.list({
    userId: USER_ID,
    labelIds: [labelId],
    maxResults,
  });

  const messageHeaders = result.data.messages || [];
  const toFetch = limit ? messageHeaders.slice(0, limit) : messageHeaders;

  const fullMsgs = await mapWithConcurrency(toFetch, ({ id }) =>
    gmail.users.messages.get({
      userId: USER_ID,
      id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    }).catch(() => null)
  );

  return {
    total: messageHeaders.length,
    messages: fullMsgs
      .filter(Boolean)
      .map(msg => {
        const headers = msg.data.payload?.headers || [];
        return {
          subject: getHeader(headers, 'Subject', '(no subject)'),
          from: getHeader(headers, 'From', '(unknown)'),
          date: getHeader(headers, 'Date', '(no date)'),
        };
      }),
  };
}

const LIST_PAGE_SIZE = 500;

/**
 * Count all messages matching a Gmail search query, paginating past the
 * per-page cap for an exact total (one API call per 500 matches).
 *
 * @param {Object} gmail - Gmail API client
 * @param {string} q - Gmail search query (e.g. 'is:unread has:nouserlabels')
 * @param {Object} [options]
 * @param {number} [options.sampleSize=0] - How many matching message IDs to return
 * @returns {Promise<{count: number, sampleIds: string[]}>}
 */
export async function countMessagesMatching(gmail, q, { sampleSize = 0 } = {}) {
  let count = 0;
  let pageToken;
  const sampleIds = [];
  do {
    const res = await gmail.users.messages.list({ userId: USER_ID, q, maxResults: LIST_PAGE_SIZE, pageToken });
    const messages = res.data.messages || [];
    sampleIds.push(...messages.slice(0, Math.max(0, sampleSize - sampleIds.length)).map(m => m.id));
    count += messages.length;
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return { count, sampleIds };
}

/**
 * Map over items with a bounded worker pool, preserving input order.
 *
 * Gmail rejects unbounded fan-out ("Too many concurrent requests for user"), so
 * every batch of messages.get calls must go through here rather than Promise.all.
 *
 * @param {T[]} items
 * @param {(item: T, index: number) => Promise<R>} fn
 * @param {number} [limit]
 * @returns {Promise<R[]>}
 * @template T, R
 */
export async function mapWithConcurrency(items, fn, limit = GMAIL_FETCH_CONCURRENCY) {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    for (let i = cursor++; i < items.length; i = cursor++) results[i] = await fn(items[i], i);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Fetch Subject/From/Date metadata for a list of message IDs.
 *
 * @param {Object} gmail - Gmail API client
 * @param {string[]} ids - Message IDs
 * @returns {Promise<Array<{subject: string, from: string, date: string}>>}
 */
export async function fetchMessageHeaders(gmail, ids) {
  const fullMsgs = await mapWithConcurrency(ids, id =>
    gmail.users.messages.get({
      userId: USER_ID,
      id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    }).catch(() => null)
  );
  return fullMsgs.filter(Boolean).map(msg => {
    const headers = msg.data.payload?.headers || [];
    return {
      subject: getHeader(headers, 'Subject', '(no subject)'),
      from: getHeader(headers, 'From', '(unknown)'),
      date: getHeader(headers, 'Date', '(no date)'),
    };
  });
}
