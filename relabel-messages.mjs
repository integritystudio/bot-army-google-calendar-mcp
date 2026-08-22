/**
 * Move messages matching a Gmail query between user labels.
 *
 * Gmail filters only run on arrival, so mail that was mis-categorized (or whose
 * category was refined later) has to be re-labeled after the fact.
 *
 * Selection, preview and batching live in modify-messages.mjs; this is the
 * relabel-shaped preset of it. Both labels must already exist, so a typo fails
 * before the paging spend rather than creating a label.
 *
 * This used to pass DEFAULT_MAX_RESULTS to searchAndModify, which truncated the
 * sweep at 100 and still printed "Total relabeled: 100" — success, on a seventh
 * of a 7,000-message label. It now pages to exhaustion, and because an unbounded
 * relabel is a much bigger action than a capped one, it previews unless --yes.
 *
 * Usage:
 *   node relabel-messages.mjs --query "label:Legal before:2021/01/01" \
 *     --add "Services & Alerts/Health" --remove "Legal"          # preview
 *   node relabel-messages.mjs --query "..." --add "..." --yes    # apply
 */
import { parseArgs } from 'node:util';
import { createGmailClient } from './lib/gmail-client.mjs';
import { modifyMessages } from './modify-messages.mjs';
import { BANNER } from './lib/console-utils.mjs';

const USAGE = 'Usage: node relabel-messages.mjs --query "<gmail-query>" [--add "<label>"] [--remove "<label>"] [--yes]';

let values;
try {
  ({ values } = parseArgs({ options: {
    query: { type: 'string' },
    add: { type: 'string' },
    remove: { type: 'string' },
    yes: { type: 'boolean', default: false },
  } }));
} catch (error) {
  console.error(error.message);
  console.error(USAGE);
  process.exit(1);
}

const { query, add: addName, remove: removeName, yes: apply } = values;
if (!query || (!addName && !removeName)) {
  console.error(USAGE);
  process.exit(1);
}

async function main() {
  console.log(`RELABELING — query: ${query}`);
  if (addName) console.log(`  + ${addName}`);
  if (removeName) console.log(`  - ${removeName}`);
  console.log('\n' + BANNER + '\n');

  const { modified } = await modifyMessages(await createGmailClient(), {
    query,
    add: addName ? [addName] : [],
    remove: removeName ? [removeName] : [],
    apply,
  });

  if (apply) {
    console.log(BANNER);
    console.log(`COMPLETE\n\nTotal relabeled: ${modified} messages\n`);
    console.log(BANNER + '\n');
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
