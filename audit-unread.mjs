/**
 * Audit the 500 most recent unread messages: sender, subject, date, labels, inbox state.
 * Writes TSV to stdout; summary to stderr.
 *
 * Usage: node audit-unread.mjs > /path/to/out.tsv
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { getHeader } from './lib/email-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { mapWithConcurrency } from './lib/gmail-message-utils.mjs';
import { USER_ID } from './lib/constants.mjs';

const AUDIT_SIZE = 500;
const FETCH_CONCURRENCY = 20;
const SYSTEM_LABEL_PREFIXES = ['CATEGORY_', 'IMPORTANT', 'UNREAD', 'INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'STARRED'];

const isSystemLabel = (name) => SYSTEM_LABEL_PREFIXES.some((p) => name.startsWith(p));

/** Collapse tabs/newlines so one message stays one TSV row. */
const flatten = (value) => (value || '').replace(/\s+/g, ' ').trim();

async function main() {
  const gmail = await createGmailClient();
  const labelCache = await buildLabelCache(gmail);
  const idToName = new Map();
  for (const [name, id] of labelCache.entries()) idToName.set(id, name);

  const { data } = await gmail.users.messages.list({ userId: USER_ID, q: 'is:unread', maxResults: AUDIT_SIZE });
  const messages = data.messages ?? [];

  const rows = await mapWithConcurrency(messages, async ({ id }) => {
    const { data: msg } = await gmail.users.messages.get({
      userId: USER_ID,
      id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date', 'List-Unsubscribe'],
    });
    const labelIds = msg.labelIds ?? [];
    const names = labelIds.map((lid) => idToName.get(lid) ?? lid);
    return {
      id,
      date: new Date(Number(msg.internalDate)).toISOString().slice(0, 10),
      from: flatten(getHeader(msg.payload.headers, 'From')),
      subject: flatten(getHeader(msg.payload.headers, 'Subject')).slice(0, 120),
      userLabels: names.filter((n) => !isSystemLabel(n)),
      systemLabels: names.filter(isSystemLabel),
      hasUnsub: Boolean(getHeader(msg.payload.headers, 'List-Unsubscribe')),
    };
  }, FETCH_CONCURRENCY);

  console.log(['date', 'from', 'subject', 'inbox', 'category', 'userLabels', 'unsub'].join('\t'));
  for (const r of rows) {
    console.log([
      r.date,
      r.from,
      r.subject,
      r.systemLabels.includes('INBOX') ? 'INBOX' : 'archived',
      (r.systemLabels.find((s) => s.startsWith('CATEGORY_')) ?? 'CATEGORY_NONE').replace('CATEGORY_', ''),
      r.userLabels.join('|') || 'NONE',
      r.hasUnsub ? 'unsub' : '',
    ].join('\t'));
  }

  const unlabeled = rows.filter((r) => r.userLabels.length === 0);
  console.error(`total=${rows.length} unlabeled=${unlabeled.length} inbox=${rows.filter((r) => r.systemLabels.includes('INBOX')).length}`);
}

main();
