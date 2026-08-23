// Country tags record where a sender's mail originates. Like Organization tags they
// are an informational dimension orthogonal to category routing: a message may route
// to Promotions/Food & Drink and still carry Country/Mexico. Filters here are
// label-only — never archive/mark-read.
//
// Seed entries use country-coded domains only. A brand that sends localized mail from
// a global domain (e.g. Benefit Cosmetics Mexico via benefitcosmetics.com) cannot be
// attributed by domain and is deliberately left out rather than mislabeled.
//
// Usage:
//   node create-country-tags.mjs                      # create filters + backfill existing mail
//   node create-country-tags.mjs --filters-only       # skip backfill
//   node create-country-tags.mjs --only Country/Mexico
//   node create-country-tags.mjs --countries rappi
import { runIfMain } from './lib/cli-utils.mjs';
import { runTagSetCli } from './lib/gmail-tag-utils.mjs';
import { COUNTRY_TAGS } from './config/country-tags.mjs';

const run = () => runTagSetCli(COUNTRY_TAGS, { script: 'create-country-tags.mjs', entriesFlag: 'countries' });

runIfMain(import.meta.url, run);
