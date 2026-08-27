/**
 * Report on the messages matching one or more Gmail queries.
 *
 * Six scripts had each hand-rolled the same shape — resolve a query, page the ids,
 * fetch headers, project a few fields, print. This is that shape once.
 * list-unlabeled-unread.mjs, audit-unread.mjs and summarize-remaining.mjs are presets
 * over it, each carrying a fixed query set worth a name of its own.
 *
 * Usage:
 *   node report-messages.mjs "is:unread has:nouserlabels in:inbox"
 *   node report-messages.mjs --columns date,from,subject,labels --max 200 "label:Newsletters"
 *   node report-messages.mjs --total --count "is:unread"
 *
 * Replaces two scripts that added nothing but a default; their recipes:
 *   dump-messages: node report-messages.mjs --total [--max N] "<gmail-query>"
 *   list-inbox:    node report-messages.mjs --format list --group-by category \
 *                    --columns unread,sender,subject --max 200 "in:inbox"
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, exitWithUsage, runIfMain } from './lib/cli-utils.mjs';
import { buildLabelIndex } from './lib/gmail-label-utils.mjs';
import { normalizeWhitespace } from './lib/email-utils.mjs';
import {
  countMessagesMatching,
  listAllMessageIds,
  fetchMessageHeaders,
} from './lib/gmail-message-utils.mjs';

export const DEFAULT_MAX = 500;
const DEFAULT_COLUMNS = ['date', 'from', 'subject'];
const UNSUB_HEADER = 'List-Unsubscribe';
const NO_CATEGORY = 'NONE';
const NO_LABELS = 'NONE';
const PREVIEW_ALL = 'all';

/**
 * Gmail's own tabs, plus the flags that are labels but read as state. A user label is
 * anything left over, which is what "has no user label" means to the routing config.
 */
const SYSTEM_LABEL_PREFIXES = [
  'CATEGORY_', 'IMPORTANT', 'UNREAD', 'INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'STARRED',
];
const isSystemLabel = (name) => SYSTEM_LABEL_PREFIXES.some((prefix) => name.startsWith(prefix));

/** Collapse whitespace so one message stays one row in TSV. */
const flatten = normalizeWhitespace;

/**
 * Column renderers. `width` is applied only by the list format — TSV never truncates,
 * because its consumer is a spreadsheet or another script, not a terminal.
 */
const COLUMNS = {
  date: { width: 10, render: (r) => r.day },
  from: { width: 40, render: (r) => flatten(r.from) },
  sender: { width: 28, render: (r) => flatten(r.from).replace(/<[^>]+>/, '').replace(/"/g, '').trim() },
  subject: { width: 60, render: (r) => flatten(r.subject) },
  labels: { width: 40, render: (r) => r.userLabels.join('|') || NO_LABELS },
  category: { width: 12, render: (r) => r.category },
  inbox: { width: 8, render: (r) => (r.inInbox ? 'INBOX' : 'archived') },
  unread: { width: 1, render: (r) => (r.unread ? '*' : ' ') },
  unsub: { width: 5, render: (r) => (r.hasUnsub ? 'unsub' : '') },
};

export const COLUMN_NAMES = Object.keys(COLUMNS);

/**
 * Label ids are stable for the life of a process, and presets call report() more than
 * once — memoising stops each extra call re-listing every label.
 */
let labelIndex;
async function labelIndexFor(gmail) {
  labelIndex ??= (await buildLabelIndex(gmail)).byId;
  return labelIndex;
}

/**
 * One message, with every column's input resolved. Built once per message rather than
 * per column so a report showing both `labels` and `category` walks labelIds once.
 */
function toRow(message, idToName) {
  const names = (message.labelIds ?? []).map((id) => idToName.get(id) ?? id);
  const parsed = new Date(Number(message.internalDate));
  return {
    id: message.id,
    from: message.from,
    subject: message.subject,
    day: isNaN(parsed) ? flatten(message.date) : parsed.toISOString().slice(0, 10),
    userLabels: names.filter((n) => !isSystemLabel(n)),
    category: (names.find((n) => n.startsWith('CATEGORY_')) ?? `CATEGORY_${NO_CATEGORY}`).replace('CATEGORY_', ''),
    inInbox: names.includes('INBOX'),
    unread: names.includes('UNREAD'),
    hasUnsub: Boolean(message.headers?.[UNSUB_HEADER]),
  };
}

/**
 * Fetch and project one query's messages.
 *
 * `total` pages the whole match set for an exact count, which costs one request per 500
 * matches — opt in. Without it the sweep stops at `max`, and the reported figure is the
 * size of the sample, not of the mailbox.
 */
export async function collect(gmail, query, { max = DEFAULT_MAX, total = false, idToName } = {}) {
  const { count, sampleIds } = total
    ? await countMessagesMatching(gmail, query, { sampleSize: max })
    : { count: null, sampleIds: await listAllMessageIds(gmail, query, { limit: max }) };

  // Always asked for: one more metadataHeaders entry costs nothing, and making it
  // conditional would mean the unsub column silently renders empty when a preset
  // forgets to request it.
  const messages = await fetchMessageHeaders(gmail, sampleIds, { extraHeaders: [UNSUB_HEADER] });
  return { query, total: count, rows: messages.map((m) => toRow(m, idToName)) };
}

function printTsv(rows, columns, { header = true } = {}) {
  if (header) console.log(columns.join('\t'));
  for (const row of rows) {
    console.log(columns.map((c) => COLUMNS[c].render(row)).join('\t'));
  }
}

function printList(rows, columns, { indent = '  ' } = {}) {
  for (const row of rows) {
    const cells = columns.map((c) => COLUMNS[c].render(row).slice(0, COLUMNS[c].width));
    console.log(`${indent}• ${cells.join(' | ')}`);
  }
}

/** Group rows for `--group-by`; a single unnamed group means "don't group". */
function groupRows(rows, groupBy) {
  if (groupBy !== 'category') return new Map([[null, rows]]);
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.category)) groups.set(row.category, []);
    groups.get(row.category).push(row);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Run one or more queries and print them.
 *
 * @param {Object} gmail
 * @param {Array<{name?: string, query: string}>} queries
 * @param {{columns?: string[], format?: 'tsv'|'list', groupBy?: 'category'|'none',
 *   max?: number, total?: boolean, count?: boolean, preview?: number,
 *   skipEmpty?: boolean}} [options]
 */
export async function report(gmail, queries, {
  columns = DEFAULT_COLUMNS,
  format = 'tsv',
  groupBy = 'none',
  max = DEFAULT_MAX,
  total = false,
  count = false,
  preview = Infinity,
  skipEmpty = false,
} = {}) {
  const unknown = columns.filter((c) => !COLUMNS[c]);
  if (unknown.length) {
    throw new Error(`Unknown column(s): ${unknown.join(', ')}. Known: ${COLUMN_NAMES.join(', ')}`);
  }
  const idToName = await labelIndexFor(gmail);

  const results = [];
  for (const { name, query } of queries) {
    const result = { name: name ?? query, ...await collect(gmail, query, { max, total, idToName }) };
    results.push(result);
    // A named bucket that is empty is the normal case for a hand-checked query list;
    // printing "Bucket: 0" for each one buries the buckets that do have mail.
    if (skipEmpty && result.rows.length === 0) continue;

    const shown = Math.min(preview, result.rows.length);
    const headline = result.total ?? result.rows.length;
    const truncated = result.total !== null && result.total > result.rows.length;

    if (format === 'tsv') {
      // Counts go to stderr so stdout stays a clean TSV stream for a pipe.
      console.error(
        `${result.name}: ${headline}${truncated ? ` (showing first ${result.rows.length})` : ''}`
      );
      if (!count) printTsv(result.rows.slice(0, shown), columns, { header: results.length === 1 });
      continue;
    }

    console.log(`${result.name}: ${headline}${truncated ? ` (showing first ${result.rows.length})` : ''}`);
    if (count) continue;
    for (const [group, groupedRows] of groupRows(result.rows, groupBy)) {
      if (group !== null) {
        const unread = groupedRows.filter((r) => r.unread).length;
        console.log(`\n── ${group} (${groupedRows.length} total, ${unread} unread) ──`);
      }
      printList(groupedRows.slice(0, preview), columns);
    }
  }
  return results;
}

const USAGE = `Usage: node report-messages.mjs [options] "<gmail-query>" ["<gmail-query>"...]

  --columns a,b,c   ${COLUMN_NAMES.join(',')}  (default ${DEFAULT_COLUMNS.join(',')})
  --format tsv|list default tsv
  --group-by category|none
  --max N           per-query cap on messages fetched (default ${DEFAULT_MAX})
  --preview N|all   rows printed per group (default all)
  --total           exact match count, paging the whole result set (slow)
  --count           counts only, no rows`;

async function main() {
  const { values, positionals } = parseCli({
    columns: { type: 'string' },
    format: { type: 'string', default: 'tsv' },
    'group-by': { type: 'string', default: 'none' },
    max: { type: 'string' },
    preview: { type: 'string' },
    total: { type: 'boolean', default: false },
    count: { type: 'boolean', default: false },
  }, USAGE, { allowPositionals: true });

  const queries = positionals.map((q) => q.trim()).filter(Boolean).map((query) => ({ query }));
  if (queries.length === 0) exitWithUsage(USAGE);

  const gmail = await createGmailClient();
  await report(gmail, queries, {
    columns: values.columns ? values.columns.split(',').map((c) => c.trim()) : DEFAULT_COLUMNS,
    format: values.format,
    groupBy: values['group-by'],
    max: Number(values.max) || DEFAULT_MAX,
    preview: values.preview === PREVIEW_ALL ? Infinity : Number(values.preview) || Infinity,
    total: values.total,
    count: values.count,
  });
}

runIfMain(import.meta.url, main);
