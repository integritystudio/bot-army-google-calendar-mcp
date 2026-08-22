/**
 * Dump matching messages as TSV (date, from, subject) for any Gmail query —
 * bulk triage/categorization without opening emails.
 *
 * A report-messages.mjs preset. Uses --total, so the count on stderr is the true
 * match count even when only the first --max are dumped.
 *
 * Usage:
 *   node dump-messages.mjs "is:unread has:nouserlabels in:inbox"
 *   node dump-messages.mjs --max 100 "label:Newsletters newer_than:7d"
 */
import { parseArgs } from 'node:util';
import { createGmailClient } from './lib/gmail-client.mjs';
import { report, DEFAULT_MAX } from './report-messages.mjs';

const USAGE = 'Usage: node dump-messages.mjs [--max N] "<gmail-query>"';

let values;
let positionals;
try {
  ({ values, positionals } = parseArgs({
    options: { max: { type: 'string' } },
    allowPositionals: true,
  }));
} catch (error) {
  console.error(error.message);
  console.error(USAGE);
  process.exit(1);
}

const query = positionals.join(' ').trim();
if (!query) {
  console.error(USAGE);
  process.exit(1);
}

const gmail = await createGmailClient();
await report(gmail, [{ name: 'Matches', query }], {
  columns: ['date', 'from', 'subject'],
  max: Number(values.max) || DEFAULT_MAX,
  total: true,
});
