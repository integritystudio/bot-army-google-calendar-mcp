#!/usr/bin/env node
/**
 * Mark past-dated event emails in a label as read (keep future events unread).
 *
 * Usage:
 *   node mark-past-events-read.mjs [--label "Events"] [--dry-run]
 *
 * Walks the label's unread messages, extracts event dates from subject/body via
 * classifyEmail (lib/date-based-filter.mjs), and removes UNREAD from messages
 * whose event date has passed. Future and undatable messages are left unread.
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { classifyEmail } from './lib/date-based-filter.mjs';
import { getHeader } from './lib/email-utils.mjs';
import { extractBodyText } from './lib/gmail-message-utils.mjs';
import { USER_ID, GMAIL_UNREAD, LABEL_EVENTS } from './lib/constants.mjs';

const FETCH_CHUNK = 25;
const BATCH_LIMIT = 1000;

const args = process.argv.slice(2);
const labelFlag = args.indexOf('--label');
const labelName = labelFlag !== -1 ? args[labelFlag + 1] : LABEL_EVENTS;
const dryRun = args.includes('--dry-run');

if (!labelName) {
  console.error('Usage: node mark-past-events-read.mjs [--label "Events"] [--dry-run]');
  process.exit(1);
}

const gmail = await createGmailClient();
const labelMap = await buildLabelCache(gmail);
const labelId = labelMap.get(labelName);
if (!labelId) {
  console.error(`Unknown label: ${labelName}`);
  process.exit(1);
}

const ids = [];
let pageToken;
do {
  const res = await gmail.users.messages.list({
    userId: USER_ID,
    labelIds: [labelId, GMAIL_UNREAD],
    maxResults: 500,
    pageToken,
  });
  for (const m of res.data.messages || []) ids.push(m.id);
  pageToken = res.data.nextPageToken;
} while (pageToken);
console.log(`Unread "${labelName}" emails: ${ids.length}`);

const pastIds = [];
let futureCount = 0;
let unknownCount = 0;
for (let i = 0; i < ids.length; i += FETCH_CHUNK) {
  const msgs = await Promise.all(
    ids.slice(i, i + FETCH_CHUNK).map(id =>
      gmail.users.messages.get({ userId: USER_ID, id, format: 'full' })
        .catch(() => null)
    )
  );
  for (const msg of msgs.filter(Boolean)) {
    const headers = msg.data.payload?.headers || [];
    const subject = getHeader(headers, 'Subject', '');
    const body = extractBodyText(msg.data.payload);
    const { status } = classifyEmail(subject, body);
    if (status === 'past') pastIds.push(msg.data.id);
    else if (status === 'future') futureCount++;
    else unknownCount++;
  }
  if (ids.length > FETCH_CHUNK) console.log(`  ${Math.min(i + FETCH_CHUNK, ids.length)}/${ids.length} classified`);
}

console.log(`Past: ${pastIds.length} | Future: ${futureCount} | Unknown (left unread): ${unknownCount}`);

if (dryRun) {
  console.log('Dry run - no changes made.');
} else if (pastIds.length > 0) {
  for (let i = 0; i < pastIds.length; i += BATCH_LIMIT) {
    await gmail.users.messages.batchModify({
      userId: USER_ID,
      requestBody: { ids: pastIds.slice(i, i + BATCH_LIMIT), removeLabelIds: [GMAIL_UNREAD] },
    });
  }
  console.log(`Marked ${pastIds.length} past events as read.`);
} else {
  console.log('No past events to mark.');
}
