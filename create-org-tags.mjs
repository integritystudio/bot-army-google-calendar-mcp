// Organization tags are an informational dimension, orthogonal to category routing:
// a sender's mail may route to Billing, Promotions, or Purchases, but always carries
// the same Organization label. Filters here are label-only — never archive/mark-read.
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, runIfMain } from './lib/cli-utils.mjs';
import { applyTagSet } from './lib/gmail-tag-utils.mjs';
import { ORG_TAGS } from './config/org-tags.mjs';


const USAGE = 'Usage: node create-org-tags.mjs [--filters-only] [--only <label-prefix>] [--orgs a,b]';

async function run() {
  const { values } = parseCli({
    'filters-only': { type: 'boolean', default: false },
    only: { type: 'string' },
    orgs: { type: 'string' },
  }, USAGE);
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

runIfMain(import.meta.url, run);
