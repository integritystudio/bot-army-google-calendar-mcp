/**
 * Move messages matching a Gmail query between user labels.
 *
 * Gmail filters only run on arrival, so mail that was mis-categorized (or whose
 * category was refined later) has to be re-labeled after the fact.
 *
 * Usage:
 *   node relabel-messages.mjs --query "label:Legal before:2021/01/01" \
 *     --add "Services & Alerts/Health" --remove "Legal"
 */
import { parseArgs } from 'node:util';
import { createGmailClient } from './lib/gmail-client.mjs';
import { DEFAULT_MAX_RESULTS } from './lib/constants.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { BANNER } from './lib/console-utils.mjs';

const USAGE = 'Usage: node relabel-messages.mjs --query "<gmail-query>" [--add "<label>"] [--remove "<label>"]';

let values;
try {
  ({ values } = parseArgs({ options: {
    query: { type: 'string' },
    add: { type: 'string' },
    remove: { type: 'string' },
  } }));
} catch (error) {
  console.error(error.message);
  console.error(USAGE);
  process.exit(1);
}
const query = values.query;
const addName = values.add;
const removeName = values.remove;

if (!query || (!addName && !removeName)) {
  console.error(USAGE);
  process.exit(1);
}

async function relabelMessages() {
  const gmail = createGmailClient();
  const labelCache = await buildLabelCache(gmail);

  const resolve = name => {
    const id = labelCache.get(name);
    if (!id) {
      console.error(`Label not found: "${name}"`);
      process.exit(1);
    }
    return id;
  };

  const modifications = {};
  if (addName) modifications.addLabelIds = [resolve(addName)];
  if (removeName) modifications.removeLabelIds = [resolve(removeName)];

  console.log(`RELABELING — query: ${query}`);
  if (addName) console.log(`  + ${addName}`);
  if (removeName) console.log(`  - ${removeName}`);
  console.log('\n' + BANNER + '\n');

  const count = await searchAndModify(gmail, query, modifications, DEFAULT_MAX_RESULTS);

  console.log(BANNER);
  console.log('COMPLETE\n');
  console.log(`Total relabeled: ${count} messages\n`);
  console.log(BANNER + '\n');
}

relabelMessages().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
