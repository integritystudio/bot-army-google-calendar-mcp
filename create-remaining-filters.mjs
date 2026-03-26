import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_INBOX, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES } from './lib/constants.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const FILTER_CATEGORIES = [
  {
    labelName: LABEL_PRODUCT_UPDATES,
    filters: [
      { query: 'from:workspace-noreply@google.com', name: 'Google Workspace' },
      { query: 'from:GoogleCloudStartups@google.com', name: 'Google Cloud Startups' },
      { query: 'from:no-reply@discuss.google.d', name: 'Google Developer Forums' },
      { query: 'from:analytics-noreply@google.com', name: 'Google Analytics' },
      { query: 'from:noreply@notifications.hubspot.com', name: 'HubSpot' },
      { query: 'from:notifications@mail.postman.com', name: 'Postman' },
      { query: 'from:zeno@updates.resend.com', name: 'Resend' },
      { query: 'from:(support@mixpanel.com OR content@mixpanel.com)', name: 'Mixpanel' },
      { query: 'from:noreply@tm.openai.com', name: 'OpenAI' },
      { query: 'from:communications@yodlee.com', name: 'Yodlee' },
      { query: 'from:hello@adapty.io', name: 'Adapty' },
      { query: 'from:no-reply@comms.datahub.com', name: 'DataHub' },
      { query: 'from:arthur@storylane.io', name: 'Storylane' },
    ],
  },
  {
    labelName: LABEL_COMMUNITIES,
    filters: [
      { query: 'from:wtm@technovation.org', name: 'Women Techmakers' },
    ],
  },
  {
    labelName: LABEL_SERVICES,
    filters: [
      { query: 'from:memberservices@founderscard.com', name: 'FoundersCard' },
      { query: 'from:notifications@link.com', name: 'Link' },
      { query: 'from:bot@notifications.heroku.com', name: 'Heroku' },
      { query: 'from:my-saved-home@mail.zillow.com', name: 'Zillow' },
      { query: 'from:upcoming@americanbestech.com', name: 'American Best' },
      { query: 'from:alerts@mail.zapier.com', name: 'Zapier' },
    ],
  },
];

async function createRemainingFilters() {
  const gmail = createGmailClient();

  console.log('CREATING FILTERS FOR REMAINING CATEGORIES\n');
  console.log('═'.repeat(80) + '\n');

  let totalCreated = 0;
  let totalErrors = 0;

  for (const categoryConfig of FILTER_CATEGORIES) {
    console.log(`\n${categoryConfig.labelName.toUpperCase()}\n`);

    const labelId = await ensureLabelExists(gmail, categoryConfig.labelName);

    for (const filter of categoryConfig.filters) {
      const filterId = await createGmailFilter(
        gmail,
        { query: filter.query },
        { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] },
      );
      if (filterId !== undefined) {
        console.log(`  ${filter.name}${filterId ? '' : ' (already exists)'}`);
        if (filterId) totalCreated++;
      } else {
        console.log(`  Error: ${filter.name}`);
        totalErrors++;
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('\nAPPLYING TO EXISTING EMAILS\n');

  let emailsProcessed = 0;

  for (const categoryConfig of FILTER_CATEGORIES) {
    const labelId = await ensureLabelExists(gmail, categoryConfig.labelName).catch(() => null);
    if (!labelId) continue;

    const queries = categoryConfig.filters.map(f => `(${f.query})`).join(' OR ');
    const count = await searchAndModify(gmail, queries, { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] }, 100);
    if (count > 0) {
      console.log(`${categoryConfig.labelName}: ${count} emails labeled and archived`);
      emailsProcessed += count;
    }
  }

  console.log('═'.repeat(80));
  console.log(`Filters created: ${totalCreated} | Errors: ${totalErrors} | Emails processed: ${emailsProcessed}\n`);
  console.log('═'.repeat(80) + '\n');
}

createRemainingFilters().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
