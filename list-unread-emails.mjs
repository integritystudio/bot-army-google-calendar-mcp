/**
 * Inspect unread emails and label health.
 *
 * Usage:
 *   node list-unread-emails.mjs          # full category breakdown with previews
 *   node list-unread-emails.mjs --count  # just print total unread count
 *   node list-unread-emails.mjs --stats  # per-label total/unread counts + mailbox profile
 *   node list-unread-emails.mjs --verify # spot-check label application on sample emails
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { BANNER } from './lib/console-utils.mjs';
import { extractDisplayName, getHeader } from './lib/email-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import {
  USER_ID,
  LABEL_SENTRY,
  LABEL_KEEP_IMPORTANT,
  LABEL_EVENTS,
  LABEL_MONITORING,
  LABEL_PRODUCT_UPDATES,
  LABEL_COMMUNITIES,
  LABEL_SERVICES,
  LABEL_BILLING,
} from './lib/constants.mjs';

const countOnly = process.argv.includes('--count');
const statsMode = process.argv.includes('--stats');
const verifyMode = process.argv.includes('--verify');

const CATEGORY_PRIORITY = [
  LABEL_KEEP_IMPORTANT, LABEL_EVENTS, LABEL_MONITORING,
  LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING,
];

const TRACKED_LABELS = [LABEL_SENTRY, LABEL_KEEP_IMPORTANT, LABEL_EVENTS, LABEL_MONITORING, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING];

const PREVIEW_LIMIT = 5;
const SUBJECT_MAX_LENGTH = 60;

async function listUnreadEmails(gmail) {
  const searchResponse = await gmail.users.messages.list({ userId: USER_ID, q: 'is:unread', maxResults: countOnly ? 1 : 500 });
  const unreadCount = searchResponse.data.resultSizeEstimate || 0;

  if (countOnly) {
    console.log(`\nUnread messages: ${unreadCount}`);
    return;
  }

  const messageIds = searchResponse.data.messages || [];

  console.log('LISTING UNREAD EMAILS\n');
  console.log(BANNER + '\n');
  console.log(`Total unread: ${messageIds.length}\n`);

  if (messageIds.length === 0) {
    console.log('Inbox is clean!\n');
    return;
  }

  const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
  const labelMap = new Map((labelsResponse.data.labels || []).map(l => [l.id, l.name]));

  const fullMsgs = await Promise.all(
    messageIds.map(msg =>
      gmail.users.messages.get({ userId: USER_ID, id: msg.id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] })
    )
  );

  const emails = fullMsgs.map(fullMsg => {
    const headers = fullMsg.data.payload?.headers || [];
    return {
      id: fullMsg.data.id,
      subject: getHeader(headers, 'Subject', '(no subject)'),
      from: getHeader(headers, 'From', '(unknown)'),
      date: getHeader(headers, 'Date'),
      labels: (fullMsg.data.labelIds || []).map(id => labelMap.get(id)).filter(Boolean),
    };
  });

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
    console.log('─'.repeat(80));
    items.slice(0, PREVIEW_LIMIT).forEach(email => {
      console.log(`  • ${email.subject.substring(0, SUBJECT_MAX_LENGTH)}`);
      console.log(`    From: ${extractDisplayName(email.from).substring(0, 50)}`);
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

  const [unreadResult, inboxResult] = await Promise.all([
    gmail.users.messages.list({ userId: USER_ID, q: 'is:unread' }),
    gmail.users.messages.list({ userId: USER_ID, q: 'is:unread in:inbox' }),
  ]);
  console.log(`Unread (is:unread): ${unreadResult.data.resultSizeEstimate}`);
  console.log(`Unread in inbox: ${inboxResult.data.resultSizeEstimate}`);

  console.log('\nBy Label (total / unread):');
  const labelStats = await Promise.all(
    TRACKED_LABELS.map(async label => {
      const labelId = labelMap.get(label);
      if (!labelId) return { label, total: 0, unread: 0, missing: true };
      const [totalRes, unreadRes] = await Promise.all([
        gmail.users.messages.list({ userId: USER_ID, q: `label:${labelId}` }),
        gmail.users.messages.list({ userId: USER_ID, q: `label:${labelId} is:unread` }),
      ]);
      return {
        label,
        total: totalRes.data.resultSizeEstimate || 0,
        unread: unreadRes.data.resultSizeEstimate || 0,
      };
    })
  );

  for (const { label, total, unread, missing } of labelStats) {
    if (missing) {
      console.log(`  ${label}: 0 (label not found)`);
    } else {
      console.log(`  ${label}: ${total} total, ${unread} unread`);
    }
  }
}

async function verifyLabels(gmail) {
  const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
  const labelMapById = new Map((labelsResponse.data.labels || []).map(l => [l.id, l.name]));

  console.log('Checking if labels were applied...\n');

  const meetupResult = await gmail.users.messages.list({ userId: USER_ID, q: 'from:info@email.meetup.com' });
  console.log(`Meetup emails found: ${meetupResult.data.resultSizeEstimate}`);

  if (meetupResult.data.messages?.length > 0) {
    const msg = await gmail.users.messages.get({ userId: USER_ID, id: meetupResult.data.messages[0].id });
    const labels = msg.data.labelIds || [];
    console.log(`Labels on first Meetup email: ${labels.map(id => labelMapById.get(id)).filter(Boolean).join(', ')}`);
    console.log(`Has 'Events' label: ${labels.some(id => labelMapById.get(id) === LABEL_EVENTS)}\n`);

    const alphaResult = await gmail.users.messages.list({ userId: USER_ID, q: 'from:news@alphasignal.ai' });
    if (alphaResult.data.messages?.length > 0) {
      const msg2 = await gmail.users.messages.get({ userId: USER_ID, id: alphaResult.data.messages[0].id });
      const labels2 = msg2.data.labelIds || [];
      console.log(`AlphaSignal email has 'Product Updates' label: ${labels2.some(id => labelMapById.get(id) === LABEL_PRODUCT_UPDATES)}`);
    }
  }
}

async function run() {
  const gmail = createGmailClient();
  if (statsMode) return showStats(gmail);
  if (verifyMode) return verifyLabels(gmail);
  return listUnreadEmails(gmail);
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
