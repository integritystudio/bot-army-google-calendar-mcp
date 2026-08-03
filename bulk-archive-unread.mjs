/**
 * Bulk-archive all unread inbox emails except those labeled "Keep Important".
 * Messages stay unread — only the INBOX label is removed.
 *
 * Usage: node bulk-archive-unread.mjs
 *
 * Resumable: archived messages drop out of the is:unread in:inbox query,
 * so rerunning after a crash continues where the previous run stopped.
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';

const PAGE_SIZE = 500;
const KEEP_LABEL = 'Keep Important';
const LOG_EVERY_PAGES = 20;
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 5;
const MIN_SPLIT_SIZE = 25;

const gmail = await createGmailClient();

const labelMap = await buildLabelCache(gmail);
const keepId = labelMap.get(KEEP_LABEL);
if (!keepId) {
  console.error(`Label "${KEEP_LABEL}" not found — aborting.`);
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withRetry(fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.response?.status || err?.code;
      const precondition = err?.cause?.status === 'FAILED_PRECONDITION' || status === 400;
      const retryable = status === 429 || precondition || (status >= 500 && status < 600);
      if (!retryable || attempt >= MAX_RETRIES) throw err;
      console.log(`  Rate limited/server error (${status}), retry ${attempt}/${MAX_RETRIES}...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
}

// Collect protected IDs by label ID up front — exact membership, no reliance on
// how Gmail search normalizes the "Keep Important" name in a -label: query.
const keepIds = new Set();
let pageToken;
do {
  const res = await withRetry(() =>
    gmail.users.messages.list({ userId: 'me', labelIds: [keepId, 'UNREAD', 'INBOX'], maxResults: PAGE_SIZE, pageToken })
  );
  for (const m of res.data.messages || []) keepIds.add(m.id);
  pageToken = res.data.nextPageToken;
} while (pageToken);
console.log(`Protected (${KEEP_LABEL}, unread, in inbox): ${keepIds.size}`);

// Retries exhausted on a batch → split it and recurse, so one unmodifiable
// message costs at most MIN_SPLIT_SIZE skips instead of killing the run.
async function archiveBatch(ids) {
  try {
    await withRetry(() =>
      gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: { ids, removeLabelIds: ['INBOX'] },
      })
    );
    return ids.length;
  } catch (err) {
    if (ids.length <= MIN_SPLIT_SIZE) {
      console.log(`  Skipping ${ids.length} messages that persistently fail (${err?.cause?.status || err?.code})`);
      for (const id of ids) skippedIds.add(id);
      return 0;
    }
    const mid = Math.ceil(ids.length / 2);
    return (await archiveBatch(ids.slice(0, mid))) + (await archiveBatch(ids.slice(mid)));
  }
}

const skippedIds = new Set();
let archived = 0;
let pages = 0;

for (;;) {
  const res = await withRetry(() =>
    gmail.users.messages.list({ userId: 'me', q: 'is:unread in:inbox', maxResults: PAGE_SIZE })
  );
  const messages = res.data.messages || [];
  const toArchive = messages.map(m => m.id).filter(id => !keepIds.has(id) && !skippedIds.has(id));

  if (toArchive.length > 0) {
    archived += await archiveBatch(toArchive);
  } else {
    // Nothing archivable on page 1: either the inbox is empty of unread mail,
    // or only protected/skipped messages remain. Either way, done.
    break;
  }

  pages++;
  if (pages % LOG_EVERY_PAGES === 0) console.log(`Archived ${archived} so far...`);
}

console.log(`\nDone. Archived: ${archived} | Protected left in inbox: ${keepIds.size} | Skipped (failed): ${skippedIds.size}`);
