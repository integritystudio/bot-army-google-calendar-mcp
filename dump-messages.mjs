/**
 * Dump matching messages as TSV (date, from, subject) for any Gmail query —
 * bulk triage/categorization without opening emails.
 *
 * Usage:
 *   node dump-messages.mjs "is:unread has:nouserlabels in:inbox"
 *   node dump-messages.mjs --max 100 "label:Newsletters newer_than:7d"
 */
import { parseArgs } from 'node:util';
import { createGmailClient } from './lib/gmail-client.mjs';
import { countMessagesMatching, fetchMessageHeaders } from './lib/gmail-message-utils.mjs';

const DEFAULT_MAX_DUMP = 500;
const USAGE = 'Usage: node dump-messages.mjs [--max N] "<gmail-query>"';

let values;
let positionals;
try {
  ({ values, positionals } = parseArgs({
    options: {
      max: { type: 'string' },
    },
    allowPositionals: true,
  }));
} catch (error) {
  console.error(error.message);
  console.error(USAGE);
  process.exit(1);
}

const maxDump = Number(values.max) || DEFAULT_MAX_DUMP;
const query = positionals.join(' ').trim();

if (!query) {
  console.error(USAGE);
  process.exit(1);
}

const gmail = await createGmailClient();
const { count, sampleIds } = await countMessagesMatching(gmail, query, { sampleSize: maxDump });
console.error(`Matches: ${count}${count > sampleIds.length ? ` (dumping first ${sampleIds.length})` : ''}`);

for (const { from, subject, date } of await fetchMessageHeaders(gmail, sampleIds)) {
  const d = new Date(date);
  const day = isNaN(d) ? date : d.toISOString().slice(0, 10);
  console.log(`${day}\t${from}\t${subject}`);
}
