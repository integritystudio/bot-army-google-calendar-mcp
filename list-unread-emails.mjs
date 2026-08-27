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
 *   node list-unread-emails.mjs          # category breakdown of the 500 newest unread
 *   node list-unread-emails.mjs --total  # also count the whole mailbox exactly (slow)
 *   node list-unread-emails.mjs --stats  # per-label total/unread counts + mailbox profile
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, runIfMain } from './lib/cli-utils.mjs';
import { BANNER, DIVIDER } from './lib/console-utils.mjs';
import { extractDisplayName, extractEmailAddress } from './lib/email-utils.mjs';
import { buildLabelCache, buildLabelIndex } from './lib/gmail-label-utils.mjs';
import { mapWithConcurrency, countMessagesMatching, listAllMessageIds, fetchMessageHeaders } from './lib/gmail-message-utils.mjs';
import { USER_ID, LABEL_SENTRY } from './lib/constants.mjs';
import { CATEGORY_PRIORITY, TRACKED_LABELS } from './config/tracked-labels.mjs';

const USAGE = 'Usage: node list-unread-emails.mjs [--stats] [--total]';

const PREVIEW_LIMIT = 5;
const SUBJECT_MAX_LENGTH = 60;

const UNREAD_QUERY = 'is:unread';
/**
 * How many messages the category breakdown reads headers for.
 *
 * This used to be a bare `maxResults: 500`, and the length of that one page WAS the
 * reported total — so a mailbox past 500 unread printed exactly 500 and read as a hard
 * number. It measured 147,970 the day this was fixed.
 *
 * The sample is still bounded (the breakdown is a shape, not a census), but it is now
 * labeled as one. `--total` adds the exact figure, and is opt-in because it pages the
 * whole match set: one request per 500 matches, 82s at 148k unread. Same tradeoff, and
 * the same reason, as `list-unlabeled-unread.mjs --all`.
 */
const BREAKDOWN_SAMPLE = 500;

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

async function listUnreadEmails(gmail, { exactTotal = false } = {}) {
  // With --total, one paged walk yields both the exact count and the sample. Without it,
  // fetch one id past the sample so a full page can be reported as "at least N" rather
  // than as a total — the length of a capped page is not a count.
  const { totalUnread, sampleIds } = exactTotal
    ? await countMessagesMatching(gmail, UNREAD_QUERY, { sampleSize: BREAKDOWN_SAMPLE })
        .then(({ count, sampleIds: ids }) => ({ totalUnread: count, sampleIds: ids }))
    : await listAllMessageIds(gmail, UNREAD_QUERY, { limit: BREAKDOWN_SAMPLE + 1 })
        .then((ids) => ({ totalUnread: null, sampleIds: ids.slice(0, BREAKDOWN_SAMPLE) }));

  const truncated = exactTotal
    ? sampleIds.length < totalUnread
    : sampleIds.length === BREAKDOWN_SAMPLE;

  console.log('LISTING UNREAD EMAILS\n');
  console.log(BANNER + '\n');
  console.log(totalUnread !== null
    ? `Total unread: ${totalUnread}\n`
    : `Unread: ${truncated ? `more than ${BREAKDOWN_SAMPLE} — rerun with --total for the exact count` : sampleIds.length}\n`);

  if (sampleIds.length === 0) {
    console.log('Inbox is clean!\n');
    return;
  }

  if (truncated) {
    console.log(`Breakdown covers the ${sampleIds.length} newest; counts below are of that sample.\n`);
  }

  const { byId: labelMap } = await buildLabelIndex(gmail);

  // fetchMessageHeaders retries and warns about what it could not fetch. The unretried
  // fan-out this replaces let a 429 reject the whole run, and the categories below are
  // reported as counts — a short fetch would have read as a quieter mailbox.
  const emails = (await fetchMessageHeaders(gmail, sampleIds))
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
  if (!truncated) {
    console.log(`\nTotal: ${sampleIds.length}`);
  } else if (totalUnread !== null) {
    console.log(`\nCategorized: ${emails.length} of ${totalUnread} unread`);
  } else {
    console.log(`\nCategorized: the ${emails.length} newest — rerun with --total for the mailbox count`);
  }
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
  const { values } = parseCli({
    stats: { type: 'boolean', default: false },
    total: { type: 'boolean', default: false },
  }, USAGE);
  const gmail = await createGmailClient();
  return values.stats ? showStats(gmail) : listUnreadEmails(gmail, { exactTotal: values.total });
}

runIfMain(import.meta.url, run);
