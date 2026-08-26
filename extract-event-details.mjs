#!/usr/bin/env node
/**
 * extract-event-details.mjs — Surface date/time/location details from emails.
 *
 * For each Gmail search query given, fetches matching messages and prints the
 * subject plus body fragments around date/time/location keywords, so event
 * details (when, where) can be read without opening each email.
 *
 * Usage:
 *   node extract-event-details.mjs 'subject:"Registration confirmed"' [query...]
 *   node extract-event-details.mjs --max 3 'label:Events is:unread from:luma-mail.com'
 *   node extract-event-details.mjs --full 'subject:"Austin Women Rising"'
 *
 * Options:
 *   --max N   Messages to fetch per query (default 1)
 *   --full    Print the full extracted body text instead of keyword windows
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, exitWithUsage, runIfMain } from './lib/cli-utils.mjs';
import { listAllMessageIds, fetchFullMessages } from './lib/gmail-message-utils.mjs';

const DEFAULT_MESSAGES_PER_QUERY = 1;
const WINDOW_BEFORE_CHARS = 80;
const WINDOW_AFTER_CHARS = 100;
const MAX_WINDOWS_PER_MESSAGE = 25;
const OUTPUT_CAP_CHARS = 2600;
const WINDOW_DEDUP_BUCKET_CHARS = 120;
const WINDOW_SEPARATOR = '\n  ---\n';

const EVENT_DETAIL_KEYWORDS =
  /(when|where|date|time|location|address|venue|am|pm|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec|[ECMP][SD]T|CT)\b/gi;

/**
 * Collects deduplicated text fragments around event-detail keywords.
 *
 * @param {string} text - Whitespace-normalized body text
 * @returns {string[]}
 */
export function extractDetailWindows(text) {
  const windows = [];
  const seenBuckets = new Set();
  let match;
  EVENT_DETAIL_KEYWORDS.lastIndex = 0;
  while ((match = EVENT_DETAIL_KEYWORDS.exec(text)) && windows.length < MAX_WINDOWS_PER_MESSAGE) {
    const start = Math.max(0, match.index - WINDOW_BEFORE_CHARS);
    const bucket = Math.floor(start / WINDOW_DEDUP_BUCKET_CHARS);
    if (seenBuckets.has(bucket)) continue;
    seenBuckets.add(bucket);
    windows.push(text.substring(start, match.index + WINDOW_AFTER_CHARS));
  }
  return windows;
}

async function main() {
  const USAGE = 'Usage: node extract-event-details.mjs [--max N] [--full] <gmail-query> [query...]';

  const { values, positionals } = parseCli({
    max: { type: 'string' },
    full: { type: 'boolean', default: false },
  }, USAGE, { allowPositionals: true });

  const fullMode = values.full;
  const messagesPerQuery = values.max !== undefined ? Number(values.max) : DEFAULT_MESSAGES_PER_QUERY;
  const queries = positionals;

  if (queries.length === 0 || (values.max !== undefined && !Number.isInteger(messagesPerQuery))) {
    exitWithUsage(USAGE);
  }

  const gmail = await createGmailClient();
  for (const q of queries) {
    const ids = await listAllMessageIds(gmail, q, { limit: messagesPerQuery });
    if (ids.length === 0) {
      console.log(`=== NOT FOUND: ${q}\n`);
      continue;
    }
    // fetchFullMessages retries and preserves the order of ids, so print order matches
    // the sequential per-id fetch this replaces. A message it could not fetch after
    // retrying is dropped (with its own warning) rather than aborting the whole query.
    for (const { subject, bodyText } of await fetchFullMessages(gmail, ids)) {
      console.log(`=== ${subject}`);
      const text = bodyText.replace(/\s+/g, ' ');
      const output = fullMode ? text : extractDetailWindows(text).join(WINDOW_SEPARATOR);
      console.log(output.substring(0, OUTPUT_CAP_CHARS));
      console.log('\n');
    }
  }
}

runIfMain(import.meta.url, main);
