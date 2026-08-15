/**
 * Report unread emails that carry no user label — the mail the organization
 * pipeline (organize-emails.mjs, Gmail filters) hasn't categorized yet.
 *
 * By default checks the inbox only. --all additionally counts unlabeled unread
 * across the whole mailbox (exact count: one API call per 500 matches, so slow
 * on large archives).
 *
 * Usage:
 *   node list-unlabeled-unread.mjs                # inbox count + previews
 *   node list-unlabeled-unread.mjs --preview 25   # more preview lines
 *   node list-unlabeled-unread.mjs --preview all  # every inbox match, no count to guess
 *   node list-unlabeled-unread.mjs --all          # include mailbox-wide count
 */
import { parseArgs } from 'node:util';
import { createGmailClient } from './lib/gmail-client.mjs';
import { countMessagesMatching, fetchMessageHeaders } from './lib/gmail-message-utils.mjs';

const DEFAULT_PREVIEW_COUNT = 10;
const PREVIEW_ALL = 'all';
const FROM_MAX_LENGTH = 40;
const SUBJECT_MAX_LENGTH = 60;
const UNLABELED_UNREAD_QUERY = 'is:unread has:nouserlabels';

let values;
try {
  ({ values } = parseArgs({
    options: {
      preview: { type: 'string' },
      all: { type: 'boolean', default: false },
    },
  }));
} catch (error) {
  console.error(error.message);
  console.error('Usage: node list-unlabeled-unread.mjs [--preview N|all] [--all]');
  process.exit(1);
}

// Previews always come from the inbox query, so 'all' stays bounded by inbox size.
const previewArg = values.preview;
const previewCount = previewArg === PREVIEW_ALL ? Infinity : Number(previewArg) || DEFAULT_PREVIEW_COUNT;
const includeAll = values.all;

const gmail = await createGmailClient();

const inbox = await countMessagesMatching(gmail, `${UNLABELED_UNREAD_QUERY} in:inbox`, { sampleSize: previewCount });
console.log(`Unread in inbox with no user label: ${inbox.count}`);

if (includeAll) {
  const anywhere = await countMessagesMatching(gmail, UNLABELED_UNREAD_QUERY);
  console.log(`Unread anywhere with no user label: ${anywhere.count}`);
}

for (const { from, subject } of await fetchMessageHeaders(gmail, inbox.sampleIds)) {
  console.log(`  • ${from.slice(0, FROM_MAX_LENGTH)} | ${subject.slice(0, SUBJECT_MAX_LENGTH)}`);
}
