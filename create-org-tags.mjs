// Organization tags are an informational dimension, orthogonal to category routing:
// a sender's mail may route to Billing, Promotions, or Purchases, but always carries
// the same Organization label. Filters here are label-only — never archive/mark-read.
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createGmailClient } from './lib/gmail-client.mjs';
import { applyTagSet } from './lib/gmail-tag-utils.mjs';
import { ORG_TAGS } from './config/org-tags.mjs';


async function run() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        'filters-only': { type: 'boolean', default: false },
        only: { type: 'string' },
        orgs: { type: 'string' },
      },
    }));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const skipBackfill = values['filters-only'];
  const onlyLabel = values.only ?? null;
  const onlyOrgs = values.orgs?.split(',').map(s => s.trim().toLowerCase());
  const gmail = createGmailClient();
  const filterCount = await applyTagSet(gmail, ORG_TAGS, {
    skipBackfill,
    onlyLabel,
    onlyEntries: onlyOrgs,
  });

  console.log(`\nFilters created: ${filterCount}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
