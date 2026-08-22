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
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, exitWithUsage, runIfMain } from './lib/cli-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { withRetry } from './lib/gmail-retry.mjs';
import { messagePages, countMessagesMatching } from './lib/gmail-message-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { USER_ID } from './lib/constants.mjs';

async function labelMessageCount(gmail, labelId) {
  const res = await withRetry(() => gmail.users.labels.get({ userId: USER_ID, id: labelId }));
  return res.data.messagesTotal;
}

/**
 * Counts messages carrying ALL of the given labels — messages.list ANDs labelIds.
 * Counted by paging rather than read from resultSizeEstimate, which is approximate.
 */
async function countMessagesWithLabels(gmail, labelIds) {
  return (await countMessagesMatching(gmail, { labelIds })).count;
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
  // Streamed rather than collected: the source label can hold tens of thousands of ids,
  // and paging is safe here because adding a label leaves the source set unchanged.
  for await (const messages of messagePages(gmail, { labelIds: [fromId] })) {
    merged += await batchModifyMessages(gmail, messages, { addLabelIds: [intoId] });
    if (messages.length) console.log(`  merged ${merged}...`);
  }

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

const USAGE = 'Usage: node merge-label.mjs --from "<name>" --into "<name>" [--delete-source] [--dry-run]';

async function main() {
  const { values } = parseCli({
    from: { type: 'string' },
    into: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'delete-source': { type: 'boolean', default: false },
  }, USAGE);
  const fromName = values.from;
  const intoName = values.into;
  const dryRun = values['dry-run'];
  const deleteSource = values['delete-source'];
  if (!fromName || !intoName) exitWithUsage(USAGE);
  const gmail = createGmailClient();
  const { merged, after } = await mergeLabel(gmail, fromName, intoName, { dryRun, deleteSource });
  if (!dryRun) {
    console.log(`\nMerged ${merged} messages into "${intoName}" (now ${after.into})`);
  }
}

runIfMain(import.meta.url, main);
