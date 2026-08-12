/**
 * Mark unread emails under a label older than a cutoff date as read.
 * Only the UNREAD label is removed — inbox/archive state and other labels are untouched.
 *
 * Selection and batching live in modify-messages.mjs; this is the age-cutoff
 * preset of it, and applies immediately rather than previewing.
 *
 * Usage:
 *   node mark-old-label-read.mjs --label "Newsletters"                     # default cutoff: one month back
 *   node mark-old-label-read.mjs --label "Job Search" --before 2026/06/01  # explicit cutoff (Gmail date format)
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { modifyMessages } from './modify-messages.mjs';
import { argAfter } from './lib/cli-utils.mjs';
import { GMAIL_UNREAD } from './lib/constants.mjs';

const DEFAULT_CUTOFF_DAYS = 30;

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

console.log(`Unread "${labelName}" emails before ${before}:`);
const { modified } = await modifyMessages(await createGmailClient(), {
  labelName,
  unreadOnly: true,
  before,
  remove: [GMAIL_UNREAD],
  apply: true,
});

console.log(`Marked ${modified} as read.`);
