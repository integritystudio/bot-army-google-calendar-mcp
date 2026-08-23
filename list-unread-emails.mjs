/**
 * Inspect unread mail and label health, grouped by the tracked label taxonomy.
 *
 * Not a report-messages.mjs preset: it files each message under the FIRST label it
 * carries from an ordered priority list, and reports per-label totals — neither of which
 * is a query-and-print. The taxonomy itself lives in config/tracked-labels.mjs.
 *
 * Two modes were removed rather than kept, because a better tool already answered them:
 *   --count  -> node report-messages.mjs --total --count "is:unread"
 *               Exact. This read labels.get's messagesUnread, which is eventually
 *               consistent and reported 1,313 against a true 13.
 *   --verify -> node audit-label-drift.mjs --query "from:info@email.meetup.com" --expect Events
 *               node audit-label-drift.mjs --query "from:news@alphasignal.ai" --expect Newsletters
 *               Spot-checking two hardcoded senders drifts from the config it means to
 *               verify: this asserted 'Product Updates' on AlphaSignal until 2026-08-11
 *               and so reported a miss on correctly labeled mail. audit-label-drift
 *               draws the expectation from the config instead.
 * --schema became audit-schema-markup.mjs; it shared no code with either mode here.
 *
 * Usage:
 *   node list-unread-emails.mjs          # category breakdown with previews
 *   node list-unread-emails.mjs --stats  # per-label total/unread counts + mailbox profile
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, runIfMain } from './lib/cli-utils.mjs';
import { BANNER, DIVIDER } from './lib/console-utils.mjs';
import { extractDisplayName, extractEmailAddress } from './lib/email-utils.mjs';
import { buildLabelCache, buildLabelIndex } from './lib/gmail-label-utils.mjs';
import { mapWithConcurrency, fetchMessageHeaders } from './lib/gmail-message-utils.mjs';
import { USER_ID, LABEL_SENTRY } from './lib/constants.mjs';
import { CATEGORY_PRIORITY, TRACKED_LABELS } from './config/tracked-labels.mjs';

const USAGE = 'Usage: node list-unread-emails.mjs [--stats]';

const PREVIEW_LIMIT = 5;
const SUBJECT_MAX_LENGTH = 60;

const SYSTEM_LABEL_UNREAD = 'UNREAD';
const SYSTEM_LABEL_INBOX = 'INBOX';

// Cheap per-label counts: one labels.get rather than paging every message. Neither number
// Gmail offers here is exact, in different ways. messages.list's resultSizeEstimate is an
// estimate (201 reported against a true 433). labels.get's messagesTotal/messagesUnread are
// eventually consistent and can be wrong by orders of magnitude — Travel reported 1313
// unread against a true 13, then self-corrected minutes later; the tell is the same figure
// repeating across unrelated labels. So this summary is indicative only: confirm any count
// you are about to act on with countMessagesMatching(), which pages and is exact.
async function getLabelCounts(gmail, labelId) {
  const res = await gmail.users.labels.get({ userId: USER_ID, id: labelId });
  return { total: res.data.messagesTotal || 0, unread: res.data.messagesUnread || 0 };
}

async function listUnreadEmails(gmail) {
  const searchResponse = await gmail.users.messages.list({ userId: USER_ID, q: 'is:unread', maxResults: 500 });

  const messageIds = searchResponse.data.messages || [];

  console.log('LISTING UNREAD EMAILS\n');
  console.log(BANNER + '\n');
  console.log(`Total unread: ${messageIds.length}\n`);

  if (messageIds.length === 0) {
    console.log('Inbox is clean!\n');
    return;
  }

  const { byId: labelMap } = await buildLabelIndex(gmail);

  // fetchMessageHeaders retries and warns about what it could not fetch. The unretried
  // fan-out this replaces let a 429 reject the whole run, and the categories below are
  // reported as counts — a short fetch would have read as a quieter mailbox.
  const emails = (await fetchMessageHeaders(gmail, messageIds.map(m => m.id)))
    .map(({ subject, from, labelIds }) => ({
      subject,
      from,
      labels: labelIds.map(id => labelMap.get(id)).filter(Boolean),
    }));

  const categories = Object.fromEntries([...CATEGORY_PRIORITY, LABEL_SENTRY, 'Other'].map(k => [k, []]));

  for (const email of emails) {
    const matched = CATEGORY_PRIORITY.find(label => email.labels.includes(label));
    if (matched) {
      categories[matched].push(email);
    } else if (email.from.includes('sentry')) {
      categories[LABEL_SENTRY].push(email);
    } else {
      categories['Other'].push(email);
    }
  }

  for (const [category, items] of Object.entries(categories)) {
    if (items.length === 0) continue;
    console.log(`\n${category} (${items.length}):`);
    console.log(DIVIDER);
    items.slice(0, PREVIEW_LIMIT).forEach(email => {
      console.log(`  • ${email.subject.substring(0, SUBJECT_MAX_LENGTH)}`);
      console.log(`    From: ${(extractDisplayName(email.from) || extractEmailAddress(email.from)).substring(0, 50)}`);
    });
    if (items.length > PREVIEW_LIMIT) console.log(`  ... and ${items.length - PREVIEW_LIMIT} more`);
  }

  console.log('\n' + BANNER);
  console.log('\nSUMMARY\n');
  for (const [category, items] of Object.entries(categories)) {
    if (items.length > 0) console.log(`  ${category}: ${items.length}`);
  }
  console.log(`\nTotal: ${messageIds.length}`);
  console.log(BANNER + '\n');
}

async function showStats(gmail) {
  const labelMap = await buildLabelCache(gmail);

  const profile = await gmail.users.getProfile({ userId: USER_ID });
  console.log(`Total messages: ${profile.data.messagesTotal}`);
  console.log(`Total threads: ${profile.data.threadsTotal}`);

  const [unreadCounts, inboxCounts] = await Promise.all([
    getLabelCounts(gmail, SYSTEM_LABEL_UNREAD),
    getLabelCounts(gmail, SYSTEM_LABEL_INBOX),
  ]);
  console.log(`Unread: ${unreadCounts.total}`);
  console.log(`Unread in inbox: ${inboxCounts.unread}`);

  console.log('\nBy Label (total / unread):');
  const labelStats = await mapWithConcurrency(TRACKED_LABELS, async label => {
      const labelId = labelMap.get(label);
      if (!labelId) return { label, total: 0, unread: 0, missing: true };
      const { total, unread } = await getLabelCounts(gmail, labelId);
      return { label, total, unread };
  });

  for (const { label, total, unread, missing } of labelStats) {
    if (missing) {
      console.log(`  ${label}: 0 (label not found)`);
    } else {
      console.log(`  ${label}: ${total} total, ${unread} unread`);
    }
  }
}

async function run() {
  const { values } = parseCli({ stats: { type: 'boolean', default: false } }, USAGE);
  const gmail = createGmailClient();
  return values.stats ? showStats(gmail) : listUnreadEmails(gmail);
}

runIfMain(import.meta.url, run);
