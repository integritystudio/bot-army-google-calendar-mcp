/**
 * Mark unread emails under a label older than a cutoff date as read.
 * Only the UNREAD label is removed — inbox/archive state and other labels are untouched.
 *
 * Usage:
 *   node mark-old-label-read.mjs --label "Newsletters"                     # default cutoff: one month back
 *   node mark-old-label-read.mjs --label "Job Search" --before 2026/06/01  # explicit cutoff (Gmail date format)
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { listAllMessageIds } from './lib/gmail-message-utils.mjs';

const BATCH_LIMIT = 1000;
const DEFAULT_CUTOFF_DAYS = 30;

const argAfter = flag => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : null;
};

const defaultBefore = () => {
  const d = new Date();
  d.setDate(d.getDate() - DEFAULT_CUTOFF_DAYS);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

const labelName = argAfter('--label');
const before = argAfter('--before') || defaultBefore();
if (!labelName) {
  console.error('Usage: node mark-old-label-read.mjs --label "<name>" [--before YYYY/MM/DD]');
  process.exit(1);
}

const gmail = await createGmailClient();
const labelMap = await buildLabelCache(gmail);
const labelId = labelMap.get(labelName);
if (!labelId) {
  console.error(`Label "${labelName}" not found`);
  process.exit(1);
}

const ids = await listAllMessageIds(gmail, { labelIds: [labelId, 'UNREAD'], q: `before:${before}` });

console.log(`Unread "${labelName}" emails before ${before}: ${ids.length}`);

for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
  await gmail.users.messages.batchModify({
    userId: 'me',
    requestBody: { ids: ids.slice(i, i + BATCH_LIMIT), removeLabelIds: ['UNREAD'] },
  });
  if (ids.length > BATCH_LIMIT) console.log(`  ${Math.min(i + BATCH_LIMIT, ids.length)}/${ids.length}`);
}

console.log(`Marked ${ids.length} as read.`);
