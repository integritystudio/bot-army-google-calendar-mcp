// Country tags record where a sender's mail originates. Like Organization tags they
// are an informational dimension orthogonal to category routing: a message may route
// to Promotions/Food & Drink and still carry Country/Mexico. Filters here are
// label-only — never archive/mark-read.
//
// Seed entries use country-coded domains only. A brand that sends localized mail from
// a global domain (e.g. Benefit Cosmetics Mexico via benefitcosmetics.com) cannot be
// attributed by domain and is deliberately left out rather than mislabeled.
//
// Data only — no Gmail client and no CLI. create-country-tags.mjs applies these;
// audit-label-drift.mjs reads them.
import {
  LABEL_COUNTRY_COLOMBIA,
  LABEL_COUNTRY_MEXICO,
} from '../lib/constants.mjs';

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
