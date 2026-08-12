/**
 * Remove a label from every message carrying it, paging until none remain.
 *
 * relabel-messages.mjs cannot do this at scale: it calls searchAndModify, which
 * issues a single messages.list capped at DEFAULT_MAX_RESULTS (100) and does not
 * page — so on a 7k-message label it strips 100 and reports success.
 *
 * Paging here re-queries the first page each round instead of using pageToken:
 * removing the label shrinks the result set as we go, which invalidates tokens.
 *
 * Usage:
 *   node strip-label.mjs --label "Organization/BigTech" [--dry-run]
 *   node strip-label.mjs --label "X" --query "from:foo.com"   # only foo.com's copies
 */
import { pathToFileURL } from 'node:url';
import { createGmailClient } from './lib/gmail-client.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { withRetry } from './lib/gmail-retry.mjs';
import { argAfter } from './lib/cli-utils.mjs';
import { USER_ID } from './lib/constants.mjs';

const LIST_PAGE_SIZE = 500;
const BATCH_SIZE = 1000;

export async function stripLabel(gmail, labelName, { dryRun = false, scopeQuery = null } = {}) {
  const labelCache = await buildLabelCache(gmail);
  const labelId = labelCache.get(labelName);
  if (!labelId) throw new Error(`Label not found: "${labelName}"`);

  // The label clause is what shrinks each round; a scope query just narrows it further.
  const query = `label:"${labelName}"${scopeQuery ? ` ${scopeQuery}` : ''}`;
  let total = 0;
  for (;;) {
    const res = await withRetry(() => gmail.users.messages.list({
      userId: USER_ID, q: query, maxResults: LIST_PAGE_SIZE,
    }));
    const ids = (res.data.messages ?? []).map((m) => m.id);
    if (ids.length === 0) break;
    if (dryRun) {
      console.log(`  would strip ${ids.length} (first page only in dry-run)`);
      return ids.length;
    }
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      await withRetry(() => gmail.users.messages.batchModify({
        userId: USER_ID,
        requestBody: { ids: ids.slice(i, i + BATCH_SIZE), removeLabelIds: [labelId] },
      }));
    }
    total += ids.length;
    console.log(`  stripped ${total}...`);
  }
  return total;
}

async function main() {
  const labelName = argAfter('--label');
  const scopeQuery = argAfter('--query');
  const dryRun = process.argv.includes('--dry-run');
  if (!labelName) {
    console.error('Usage: node strip-label.mjs --label "<name>" [--dry-run]');
    process.exit(1);
  }
  const gmail = createGmailClient();
  const n = await stripLabel(gmail, labelName, { dryRun, scopeQuery });
  const scope = scopeQuery ? ` matching ${scopeQuery}` : '';
  console.log(`${dryRun ? 'Would strip' : 'Stripped'} ${n} messages from "${labelName}"${scope}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
