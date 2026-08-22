/**
 * Remove a label from every message carrying it, paging until none remain.
 *
 * relabel-messages.mjs now pages too (it is a modify-messages.mjs preset), so the
 * 100-message truncation that made this script necessary is gone. It still earns its
 * place: removing a label shrinks the result set, and this handles that directly.
 *
 * Paging here re-queries the first page each round instead of using pageToken:
 * removing the label shrinks the result set as we go, which invalidates tokens.
 *
 * Usage:
 *   node strip-label.mjs --label "Organization/BigTech" [--dry-run]
 *   node strip-label.mjs --label "X" --query "from:foo.com"   # only foo.com's copies
 */
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createGmailClient } from './lib/gmail-client.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { withRetry } from './lib/gmail-retry.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { USER_ID } from './lib/constants.mjs';

const LIST_PAGE_SIZE = 500;

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
    await batchModifyMessages(gmail, ids, { removeLabelIds: [labelId] });
    total += ids.length;
    console.log(`  stripped ${total}...`);
  }
  return total;
}

const USAGE = 'Usage: node strip-label.mjs --label "<name>" [--dry-run]';

async function main() {
  let values;
  try {
    ({ values } = parseArgs({ options: {
      label: { type: 'string' },
      query: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    } }));
  } catch (error) {
    console.error(error.message);
    console.error(USAGE);
    process.exit(1);
  }
  const labelName = values.label;
  const scopeQuery = values.query ?? null;
  const dryRun = values['dry-run'];
  if (!labelName) {
    console.error(USAGE);
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
