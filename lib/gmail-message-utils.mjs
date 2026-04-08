import { USER_ID, DEFAULT_MAX_RESULTS } from './constants.mjs';
import { getHeader, decodeBase64Payload } from './email-utils.mjs';

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

  const fullMsgs = await Promise.all(
    toFetch.map(({ id }) =>
      gmail.users.messages.get({
        userId: USER_ID,
        id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      }).catch(() => null)
    )
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
