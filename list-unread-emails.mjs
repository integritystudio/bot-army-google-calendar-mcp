/**
 * List unread emails grouped by label category.
 *
 * Usage:
 *   node list-unread-emails.mjs          # full category breakdown with previews
 *   node list-unread-emails.mjs --count  # just print total unread count
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { extractDisplayName, getHeader } from './lib/email-utils.mjs';
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

const CATEGORY_PRIORITY = [
  LABEL_KEEP_IMPORTANT, LABEL_EVENTS, LABEL_MONITORING,
  LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING,
];

const PREVIEW_LIMIT = 5;
const SUBJECT_MAX_LENGTH = 60;

async function listUnreadEmails() {
  const gmail = createGmailClient();

  const searchResponse = await gmail.users.messages.list({ userId: USER_ID, q: 'is:unread', maxResults: countOnly ? 1 : 500 });
  const unreadCount = searchResponse.data.resultSizeEstimate || 0;

  if (countOnly) {
    console.log(`\nUnread messages: ${unreadCount}`);
    return;
  }

  const messageIds = searchResponse.data.messages || [];

  console.log('LISTING UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');
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

  console.log('\n' + '═'.repeat(80));
  console.log('\nSUMMARY\n');
  for (const [category, items] of Object.entries(categories)) {
    if (items.length > 0) console.log(`  ${category}: ${items.length}`);
  }
  console.log(`\nTotal: ${messageIds.length}`);
  console.log('═'.repeat(80) + '\n');
}

listUnreadEmails().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
