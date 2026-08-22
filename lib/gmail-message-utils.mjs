import { Parser } from 'htmlparser2';
import {
  USER_ID,
  GMAIL_FETCH_CONCURRENCY,
  GMAIL_FETCHES_PER_SECOND,
  MS_PER_SECOND,
} from './constants.mjs';
import { getHeader, decodeBase64Payload } from './email-utils.mjs';
import { extractHtmlFromPayload } from './schema-extractor.mjs';
import { withRetry } from './gmail-retry.mjs';

// Elements whose text is markup machinery, not message content.
const NON_CONTENT_ELEMENTS = new Set(['style', 'script', 'head', 'title', 'noscript']);

// Stylesheet fingerprints. Meetup's text/plain part is the stylesheet — sometimes only
// that, sometimes prose with 24k characters of @media blocks appended — so a plain part
// carrying these is contaminated and the HTML is the better source. Length cannot make
// this call: the contaminated parts run 15k-34k characters after brace-stripping,
// because @media nests its braces.
const STYLESHEET_MARKERS = /@media\b|!important|\{[^{}]*:[^{}]*\}/;

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
  // Recurses, matching extractHtmlFromPayload: a top-level-only scan misses the
  // text/plain inside multipart/mixed > multipart/alternative, which is how mail with
  // an attachment is shaped.
  for (const part of payload?.parts ?? []) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Payload(part.body.data);
    }
  }
  for (const part of payload?.parts ?? []) {
    const nested = decodeMessageBody(part);
    if (nested) return nested;
  }
  return '';
}

/**
 * Readable text from an HTML document.
 *
 * Parses rather than strips tags: a `<style ...>` carrying a `>` in an attribute, or any
 * malformed markup, slips past a `<style[\s\S]*?</style>` pattern and leaks the whole
 * stylesheet into the result. htmlparser2 also decodes every entity, where the regex
 * version special-cased exactly two (&nbsp; and &amp;) and left the rest as source text.
 *
 * @param {string} html
 * @returns {string} Whitespace-collapsed text content
 */
export function htmlToText(html) {
  if (!html) return '';
  const chunks = [];
  let skipDepth = 0;
  // Separate at element boundaries rather than joining text chunks with a space: the
  // parser splits a text node around each decoded entity, so joining on space would
  // spell "caf&eacute; opens" as "caf é opens".
  const parser = new Parser({
    onopentag(name) {
      if (NON_CONTENT_ELEMENTS.has(name)) skipDepth++;
      chunks.push(' ');
    },
    onclosetag(name) {
      if (NON_CONTENT_ELEMENTS.has(name) && skipDepth > 0) skipDepth--;
      chunks.push(' ');
    },
    ontext(text) {
      if (skipDepth === 0) chunks.push(text);
    },
  }, { decodeEntities: true });
  parser.write(html);
  parser.end();
  // \s covers the U+00A0 that decoding &nbsp; produces.
  return chunks.join('').replace(/\s+/g, ' ').trim();
}

/** A text/plain part is worth using when it holds prose and no stylesheet. */
function isUsablePlainText(text) {
  return Boolean(text.trim()) && !STYLESHEET_MARKERS.test(text);
}

/**
 * Extracts readable body text from a Gmail message payload.
 *
 * Prefers text/plain when it is usable, and otherwise parses the HTML part — which is
 * the common case for event and marketing senders, whose plain part is decorative.
 *
 * @param {Object} payload - message.data.payload
 * @returns {string}
 */
export function extractBodyText(payload) {
  const plain = decodeMessageBody(payload);
  // Not `if (plain)`: a whitespace-only or stylesheet-filled part is still truthy, so
  // that test returned it and the HTML holding the real content was never parsed. In one
  // label that silenced 4,934 of 5,625 messages into "no event date found".
  if (isUsablePlainText(plain)) return plain;
  const html = extractHtmlFromPayload(payload);
  return html ? htmlToText(html) : plain.trim();
}

// Paging lives in the shared core so the MCP handlers and these scripts cannot
// drift apart on it. Re-exported here because every caller already imports it
// from this module.
export { messagePages, countMessagesMatching, listAllMessageIds } from '../src/shared/gmail-core.ts';

/**
 * Evenly spaced permission to make a call, shared across a worker pool.
 *
 * Slots are claimed synchronously, so the assignment is atomic on the event loop and
 * concurrent workers cannot land on the same one. Reserving ahead rather than sleeping a
 * fixed interval keeps the pool at the target rate instead of the much lower
 * rate/latency product a per-call delay would impose.
 *
 * @param {number} callsPerSecond
 * @returns {() => Promise<void>}
 */
export function createPacer(callsPerSecond) {
  const minIntervalMs = MS_PER_SECOND / callsPerSecond;
  let nextSlotAt = 0;
  return async () => {
    const now = Date.now();
    const slotAt = Math.max(now, nextSlotAt);
    nextSlotAt = slotAt + minIntervalMs;
    const wait = slotAt - now;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  };
}

/**
 * Map over items with a bounded worker pool at a bounded rate, preserving input order.
 *
 * Gmail rejects unbounded fan-out ("Too many concurrent requests for user"), so
 * every batch of messages.get calls must go through here rather than Promise.all.
 *
 * Concurrency alone is not enough: a bounded pool against a responsive mailbox still
 * exhausts the per-minute quota, and every worker then 429s together — which withRetry
 * cannot absorb, since all of them back off and retry in lockstep. The pacer is what
 * keeps a large run under the cap; see GMAIL_FETCHES_PER_SECOND.
 *
 * @param {T[]} items
 * @param {(item: T, index: number) => Promise<R>} fn
 * @param {number} [limit]
 * @param {{ callsPerSecond?: number }} [options]
 * @returns {Promise<R[]>}
 * @template T, R
 */
export async function mapWithConcurrency(
  items,
  fn,
  limit = GMAIL_FETCH_CONCURRENCY,
  { callsPerSecond = GMAIL_FETCHES_PER_SECOND } = {}
) {
  const results = new Array(items.length);
  const waitForSlot = createPacer(callsPerSecond);
  let cursor = 0;
  const worker = async () => {
    for (let i = cursor++; i < items.length; i = cursor++) {
      await waitForSlot();
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Fetch Subject/From/Date metadata for a list of message IDs.
 *
 * Each result carries its own id: callers that label what they fetched cannot use
 * the input array to recover it, because failed fetches are dropped and the two
 * arrays stop lining up.
 *
 * labelIds and internalDate ride along free — format=metadata returns both whether
 * or not they are asked for, so a caller needing them does not have to re-fetch.
 * `extraHeaders` adds to the three always fetched; values land in `headers`.
 *
 * @param {Object} gmail - Gmail API client
 * @param {string[]} ids - Message IDs
 * @param {{ extraHeaders?: string[] }} [options]
 * @returns {Promise<Array<{id: string, subject: string, from: string, date: string,
 *   internalDate: string, labelIds: string[], headers: Record<string, string>}>>}
 */
export async function fetchMessageHeaders(gmail, ids, { extraHeaders = [] } = {}) {
  let failed = 0;
  const metadataHeaders = ['Subject', 'From', 'Date', ...extraHeaders];
  const fullMsgs = await mapWithConcurrency(ids, id =>
    withRetry(() => gmail.users.messages.get({
      userId: USER_ID,
      id,
      format: 'metadata',
      metadataHeaders,
    })).catch(() => { failed++; return null; })
  );
  // Never drop failures silently: a swallowed 429 is indistinguishable from a message
  // that simply has no matching header, so a rate-limited run reads as a smaller
  // mailbox. Retrying first means anything still counted here is a real loss.
  if (failed > 0) {
    console.warn(`fetchMessageHeaders: ${failed} of ${ids.length} messages could not be fetched`);
  }
  return fullMsgs.filter(Boolean).map(msg => {
    const headers = msg.data.payload?.headers || [];
    return {
      id: msg.data.id,
      subject: getHeader(headers, 'Subject', '(no subject)'),
      from: getHeader(headers, 'From', '(unknown)'),
      date: getHeader(headers, 'Date', '(no date)'),
      internalDate: msg.data.internalDate,
      labelIds: msg.data.labelIds ?? [],
      headers: Object.fromEntries(extraHeaders.map(name => [name, getHeader(headers, name)])),
    };
  });
}
