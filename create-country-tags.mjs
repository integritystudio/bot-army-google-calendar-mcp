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
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createGmailClient } from './lib/gmail-client.mjs';
import { applyTagSet } from './lib/gmail-tag-utils.mjs';
import {
  LABEL_COUNTRY_COLOMBIA,
  LABEL_COUNTRY_MEXICO,
} from './lib/constants.mjs';

export const COUNTRY_TAGS = [
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


const USAGE = 'Usage: node create-country-tags.mjs [--filters-only] [--only <label>] [--countries a,b]';

async function run() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        'filters-only': { type: 'boolean', default: false },
        only: { type: 'string' },
        countries: { type: 'string' },
      },
    }));
  } catch (error) {
    console.error(error.message);
    console.error(USAGE);
    process.exit(1);
  }
  const skipBackfill = values['filters-only'];
  const onlyLabel = values.only ?? null;
  const onlyCountries = values.countries?.split(',').map(s => s.trim().toLowerCase());
  const gmail = createGmailClient();
  const filterCount = await applyTagSet(gmail, COUNTRY_TAGS, {
    skipBackfill,
    onlyLabel,
    onlyEntries: onlyCountries,
  });

  console.log(`\nFilters created: ${filterCount}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
