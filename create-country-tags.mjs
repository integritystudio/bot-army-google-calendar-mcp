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
import { createGmailClient } from './lib/gmail-client.mjs';
import { argAfter } from './lib/cli-utils.mjs';
import { applyTagSet } from './lib/gmail-tag-utils.mjs';
import {
  LABEL_COUNTRY_COLOMBIA,
  LABEL_COUNTRY_MEXICO,
} from './lib/constants.mjs';

const COUNTRY_TAGS = [
  {
    labelName: LABEL_COUNTRY_COLOMBIA,
    entries: [
      { name: 'Rappi', query: 'from:rappi.com.co' },
    ],
  },
  {
    labelName: LABEL_COUNTRY_MEXICO,
    entries: [
      { name: 'Rappi', query: 'from:rappi.com.mx' },
      { name: 'Zen To Go', query: 'from:zentogo.com.mx' },
    ],
  },
];

const skipBackfill = process.argv.includes('--filters-only');
const onlyLabel = argAfter('--only');
const onlyCountries = argAfter('--countries')?.split(',').map(s => s.trim().toLowerCase());

async function run() {
  const gmail = createGmailClient();
  const filterCount = await applyTagSet(gmail, COUNTRY_TAGS, {
    skipBackfill,
    onlyLabel,
    onlyEntries: onlyCountries,
  });

  console.log(`\nFilters created: ${filterCount}`);
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
