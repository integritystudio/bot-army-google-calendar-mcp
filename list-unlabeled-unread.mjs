/**
 * Report unread emails that carry no user label — the mail the organization
 * pipeline (create-filters.mjs, Gmail filters) hasn't categorized yet.
 *
 * A report-messages.mjs preset. By default checks the inbox only. --all additionally
 * counts unlabeled unread across the whole mailbox (exact count: one API call per 500
 * matches, so slow on large archives).
 *
 * Usage:
 *   node list-unlabeled-unread.mjs                # inbox count + previews
 *   node list-unlabeled-unread.mjs --preview 25   # more preview lines
 *   node list-unlabeled-unread.mjs --preview all  # every inbox match, no count to guess
 *   node list-unlabeled-unread.mjs --all          # include mailbox-wide count
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli } from './lib/cli-utils.mjs';
import { report } from './report-messages.mjs';

const DEFAULT_PREVIEW_COUNT = 10;
const PREVIEW_ALL = 'all';
const UNLABELED_UNREAD_QUERY = 'is:unread has:nouserlabels';

const USAGE = 'Usage: node list-unlabeled-unread.mjs [--preview N|all] [--all]';

const { values } = parseCli({
  preview: { type: 'string' },
  all: { type: 'boolean', default: false },
}, USAGE);

// Previews always come from the inbox query, so 'all' stays bounded by inbox size.
const preview = values.preview === PREVIEW_ALL
  ? Infinity
  : Number(values.preview) || DEFAULT_PREVIEW_COUNT;

const gmail = await createGmailClient();

await report(gmail, [{ name: 'Unread in inbox with no user label', query: `${UNLABELED_UNREAD_QUERY} in:inbox` }], {
  columns: ['from', 'subject'],
  format: 'list',
  // --preview all means every inbox match, so the fetch cap must follow the preview.
  max: preview,
  total: true,
  preview,
});

if (values.all) {
  await report(gmail, [{ name: 'Unread anywhere with no user label', query: UNLABELED_UNREAD_QUERY }], {
    format: 'list',
    total: true,
    count: true,
  });
}
