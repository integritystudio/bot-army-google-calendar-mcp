/**
 * Audit the 500 most recent unread messages: sender, subject, date, labels, inbox state.
 * Writes TSV to stdout; summary to stderr.
 *
 * A report-messages.mjs preset. Deliberately omits --total: this is a sample of the
 * newest unread, not a mailbox-wide count. Use `list-unlabeled-unread.mjs --all` for
 * the exact figure.
 *
 * Usage: node audit-unread.mjs > /path/to/out.tsv
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { report } from './report-messages.mjs';

const AUDIT_SIZE = 500;

const gmail = await createGmailClient();
const [{ rows }] = await report(gmail, [{ name: 'unread', query: 'is:unread' }], {
  columns: ['date', 'from', 'subject', 'inbox', 'category', 'labels', 'unsub'],
  max: AUDIT_SIZE,
});

const unlabeled = rows.filter((r) => r.userLabels.length === 0).length;
const inInbox = rows.filter((r) => r.inInbox).length;
console.error(`total=${rows.length} unlabeled=${unlabeled} inbox=${inInbox}`);
