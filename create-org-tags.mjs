// Organization tags are an informational dimension, orthogonal to category routing:
// a sender's mail may route to Billing, Promotions, or Purchases, but always carries
// the same Organization label. Filters here are label-only — never archive/mark-read.
//
// Usage:
//   node create-org-tags.mjs                          # create filters + backfill existing mail
//   node create-org-tags.mjs --filters-only           # skip backfill
//   node create-org-tags.mjs --only Organization/Google
//   node create-org-tags.mjs --orgs github,meetup
import { runIfMain } from './lib/cli-utils.mjs';
import { runTagSetCli } from './lib/gmail-tag-utils.mjs';
import { ORG_TAGS } from './config/org-tags.mjs';

const run = () => runTagSetCli(ORG_TAGS, { script: 'create-org-tags.mjs', entriesFlag: 'orgs' });

runIfMain(import.meta.url, run);
