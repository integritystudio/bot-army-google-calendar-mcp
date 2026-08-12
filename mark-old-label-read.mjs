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
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { GMAIL_UNREAD } from './lib/constants.mjs';

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

const ids = await listAllMessageIds(gmail, { labelIds: [labelId, GMAIL_UNREAD], q: `before:${before}` });

console.log(`Unread "${labelName}" emails before ${before}: ${ids.length}`);

await batchModifyMessages(gmail, ids, { removeLabelIds: [GMAIL_UNREAD] }, {
  onProgress: (done, total) => { if (done < total) console.log(`  ${done}/${total}`); },
});

console.log(`Marked ${ids.length} as read.`);
