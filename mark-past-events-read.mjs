#!/usr/bin/env node
/**
 * Mark past-dated event emails in a label as read (keep future events unread).
 *
 * Usage:
 *   node mark-past-events-read.mjs [--label "Events"] [--dry-run]
 *
 * Walks the label's unread messages and removes UNREAD from those whose event date has
 * passed; future and undatable messages are left unread. Fetching and classification
 * live in lib/event-classifier.mjs, shared with filter-events-by-date.mjs — including
 * the chunking, so a crash costs at most one chunk rather than every verdict so far.
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, exitWithUsage, runIfMain, fail } from './lib/cli-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { classifyByEventDate } from './lib/event-classifier.mjs';
import { listAllMessageIds } from './lib/gmail-message-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { GMAIL_UNREAD, LABEL_EVENTS } from './lib/constants.mjs';

const USAGE = 'Usage: node mark-past-events-read.mjs [--label "Events"] [--dry-run]';

async function main() {
  const { values } = parseCli({
    label: { type: 'string', default: LABEL_EVENTS },
    'dry-run': { type: 'boolean', default: false },
  }, USAGE);

  const labelName = values.label;
  const dryRun = values['dry-run'];

  if (!labelName) exitWithUsage(USAGE);

  const gmail = await createGmailClient();
  const labelMap = await buildLabelCache(gmail);
  const labelId = labelMap.get(labelName);
  if (!labelId) fail(`Unknown label: ${labelName}`);

  const ids = await listAllMessageIds(gmail, { labelIds: [labelId, GMAIL_UNREAD] });
  console.log(`Unread "${labelName}" emails: ${ids.length}`);

  let pastSoFar = 0;
  let markedCount = 0;
  const totals = await classifyByEventDate(gmail, ids, {
    onChunk: async ({ past, done, total }) => {
      pastSoFar += past.length;
      if (!dryRun && past.length > 0) {
        markedCount += await batchModifyMessages(gmail, past, { removeLabelIds: [GMAIL_UNREAD] });
      }
      console.log(`  ${done}/${total} classified — past ${pastSoFar}, marked ${markedCount}`);
    },
  });

  console.log(`Past: ${totals.past} | Future: ${totals.future} | Unknown (left unread): ${totals.unknown}`);
  if (totals.failed > 0) {
    console.warn(`${totals.failed} message(s) could not be fetched and were left unread.`);
  }

  if (dryRun) {
    console.log('Dry run - no changes made.');
  } else if (markedCount > 0) {
    console.log(`Marked ${markedCount} past events as read.`);
  } else {
    console.log('No past events to mark.');
  }
}

runIfMain(import.meta.url, main);
