/**
 * Merge one label into another: add the target label to every message carrying the
 * source, then optionally delete the source label.
 *
 * Selects messages by labelIds, not a `label:"..."` query, because label names are
 * not safe search input: a name containing parentheses returns 0 matches, and one
 * containing `&` or spaces tokenizes in ways that can pull in a sibling label. Both
 * failures are silent — the script would report success having merged the wrong set.
 * labelIds is an exact server-side filter with no query parsing involved.
 *
 * Paging uses pageToken, unlike strip-label.mjs: adding a label leaves the source
 * result set unchanged, so tokens stay valid. Removal is left to labels.delete,
 * which detaches the label from every message server-side in one call.
 *
 * Usage:
 *   node merge-label.mjs --from "A" --into "B" [--delete-source] [--dry-run]
 */
import { pathToFileURL } from 'node:url';
import { createGmailClient } from './lib/gmail-client.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { withRetry } from './lib/gmail-retry.mjs';
import { argAfter } from './lib/cli-utils.mjs';
import { USER_ID } from './lib/constants.mjs';

const LIST_PAGE_SIZE = 500;
// Gmail's hard cap on ids per batchModify call.
const BATCH_SIZE = 1000;

async function labelMessageCount(gmail, labelId) {
  const res = await withRetry(() => gmail.users.labels.get({ userId: USER_ID, id: labelId }));
  return res.data.messagesTotal;
}

/**
 * Counts messages carrying ALL of the given labels — messages.list ANDs labelIds.
 * Counted by paging rather than read from resultSizeEstimate, which is approximate.
 */
async function countMessagesWithLabels(gmail, labelIds) {
  let total = 0;
  let pageToken;
  do {
    const res = await withRetry(() => gmail.users.messages.list({
      userId: USER_ID, labelIds, maxResults: LIST_PAGE_SIZE, pageToken,
    }));
    total += (res.data.messages ?? []).length;
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return total;
}

export async function mergeLabel(gmail, fromName, intoName, { dryRun = false, deleteSource = false } = {}) {
  const labelCache = await buildLabelCache(gmail);
  const fromId = labelCache.get(fromName);
  const intoId = labelCache.get(intoName);
  // Fail fast rather than creating a label from a typo, as relabel-messages.mjs does.
  if (!fromId) throw new Error(`Source label not found: "${fromName}"`);
  if (!intoId) throw new Error(`Target label not found: "${intoName}"`);
  if (fromId === intoId) throw new Error('Source and target are the same label');

  const before = {
    from: await labelMessageCount(gmail, fromId),
    into: await labelMessageCount(gmail, intoId),
  };
  console.log(`  "${fromName}": ${before.from} messages`);
  console.log(`  "${intoName}": ${before.into} messages`);

  if (dryRun) {
    console.log(`\nWould add "${intoName}" to ${before.from} messages`);
    if (deleteSource) console.log(`Would then delete "${fromName}"`);
    return { merged: 0, before, after: before };
  }

  let merged = 0;
  let pageToken;
  do {
    const res = await withRetry(() => gmail.users.messages.list({
      userId: USER_ID, labelIds: [fromId], maxResults: LIST_PAGE_SIZE, pageToken,
    }));
    const ids = (res.data.messages ?? []).map((m) => m.id);
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      await withRetry(() => gmail.users.messages.batchModify({
        userId: USER_ID,
        requestBody: { ids: ids.slice(i, i + BATCH_SIZE), addLabelIds: [intoId] },
      }));
    }
    merged += ids.length;
    if (ids.length) console.log(`  merged ${merged}...`);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  const after = {
    from: await labelMessageCount(gmail, fromId),
    into: await labelMessageCount(gmail, intoId),
  };
  // Deleting the source is lossy for any message that does not also carry the target,
  // so verify the leftover set is empty rather than comparing totals. Totals cannot
  // express this: the two labels usually overlap, so the target's net gain is legitimately
  // smaller than the number merged (it was 0 of 3758 for the Food merge), and mail
  // arriving mid-run via a filter can add source-only messages after we paged past them.
  const sourceOnly = await countMessagesWithLabels(gmail, [fromId])
    - await countMessagesWithLabels(gmail, [fromId, intoId]);
  if (sourceOnly > 0) {
    throw new Error(
      `Refusing to delete "${fromName}": ${sourceOnly} of its messages do not carry `
      + `"${intoName}". Re-run to merge them.`,
    );
  }

  if (deleteSource) {
    await withRetry(() => gmail.users.labels.delete({ userId: USER_ID, id: fromId }));
    console.log(`  deleted "${fromName}"`);
  }

  return { merged, before, after };
}

async function main() {
  const fromName = argAfter('--from');
  const intoName = argAfter('--into');
  const dryRun = process.argv.includes('--dry-run');
  const deleteSource = process.argv.includes('--delete-source');
  if (!fromName || !intoName) {
    console.error('Usage: node merge-label.mjs --from "<name>" --into "<name>" [--delete-source] [--dry-run]');
    process.exit(1);
  }
  const gmail = createGmailClient();
  const { merged, after } = await mergeLabel(gmail, fromName, intoName, { dryRun, deleteSource });
  if (!dryRun) {
    console.log(`\nMerged ${merged} messages into "${intoName}" (now ${after.into})`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
