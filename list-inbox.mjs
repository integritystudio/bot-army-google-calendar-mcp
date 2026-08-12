import { createGmailClient } from './lib/gmail-client.mjs';
import { listAllMessageIds } from './lib/gmail-message-utils.mjs';

const gmail = createGmailClient();
const LIMIT = 200;
const BATCH = 25;

// Fetch up to LIMIT message IDs from inbox
const ids = await listAllMessageIds(gmail, { labelIds: ['INBOX'] }, { limit: LIMIT });

console.log(`Fetching details for ${ids.length} messages...`);

// Batch fetch metadata to avoid OOM
const details = [];
for (let i = 0; i < ids.length; i += BATCH) {
  const batch = ids.slice(i, i + BATCH);
  const results = await Promise.all(
    batch.map(id =>
      gmail.users.messages.get({
        userId: 'me', id, format: 'metadata',
        metadataHeaders: ['From', 'Subject'],
      }).then(r => r.data)
    )
  );
  details.push(...results);
}

const categories = {};
for (const msg of details) {
  const labels = msg.labelIds || [];
  const headers = Object.fromEntries((msg.payload?.headers || []).map(h => [h.name, h.value]));
  const from = (headers.From || '').replace(/<[^>]+>/, '').replace(/"/g, '').trim();
  const subject = headers.Subject || '(no subject)';

  let cat = 'Uncategorized';
  if (labels.includes('CATEGORY_PROMOTIONS')) cat = 'Promotions';
  else if (labels.includes('CATEGORY_SOCIAL')) cat = 'Social';
  else if (labels.includes('CATEGORY_UPDATES')) cat = 'Updates';
  else if (labels.includes('CATEGORY_FORUMS')) cat = 'Forums';
  else if (labels.includes('IMPORTANT') || labels.includes('STARRED')) cat = 'Primary';

  const unread = labels.includes('UNREAD');
  if (!categories[cat]) categories[cat] = [];
  categories[cat].push({ from, subject, unread });
}

for (const [cat, msgs] of Object.entries(categories).sort()) {
  const unreadCount = msgs.filter(m => m.unread).length;
  console.log(`\n── ${cat} (${msgs.length} total, ${unreadCount} unread) ──`);
  for (const { from, subject, unread } of msgs) {
    const flag = unread ? '*' : ' ';
    console.log(`  ${flag} ${from.slice(0, 28).padEnd(28)}  ${subject.slice(0, 58)}`);
  }
}
