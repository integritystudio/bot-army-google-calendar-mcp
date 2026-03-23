import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES } from './lib/constants.mjs';

async function createRemainingFilters() {
  const gmail = createGmailClient();

  console.log('🏷️  CREATING FILTERS FOR REMAINING CATEGORIES\n');
  console.log('═'.repeat(80) + '\n');

  // Define filter configurations
  const filterConfigs = [
    {
      labelName: LABEL_PRODUCT_UPDATES,
      description: 'Product updates from SaaS platforms',
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
        { query: 'from:arthur@storylane.io', name: 'Storylane' }
      ]
    },
    {
      labelName: LABEL_COMMUNITIES,
      description: 'Community and group emails',
      filters: [
        { query: 'from:wtm@technovation.org', name: 'Women Techmakers' }
      ]
    },
    {
      labelName: LABEL_SERVICES,
      description: 'Service notifications and alerts',
      filters: [
        { query: 'from:memberservices@founderscard.com', name: 'FoundersCard' },
        { query: 'from:notifications@link.com', name: 'Link' },
        { query: 'from:bot@notifications.heroku.com', name: 'Heroku' },
        { query: 'from:my-saved-home@mail.zillow.com', name: 'Zillow' },
        { query: 'from:upcoming@americanbestech.com', name: 'American Best' },
        { query: 'from:alerts@mail.zapier.com', name: 'Zapier' }
      ]
    }
  ];

  let totalCreated = 0;
  let totalErrors = 0;

  for (const categoryConfig of filterConfigs) {
    console.log(`\n📌 ${categoryConfig.labelName.toUpperCase()}\n`);

    // Get or create label
    let labelId;
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const existingLabel = labelsResponse.data.labels.find(l => l.name === categoryConfig.labelName);

    if (existingLabel) {
      labelId = existingLabel.id;
      console.log(`✅ Using existing label: ${categoryConfig.labelName}\n`);
    } else {
      const createLabelResponse = await gmail.users.labels.create({
        userId: USER_ID,
        requestBody: {
          name: categoryConfig.labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      labelId = createLabelResponse.data.id;
      console.log(`✅ Created label: ${categoryConfig.labelName}\n`);
    }

    // Create filters for each sub-category
    for (const filter of categoryConfig.filters) {
      try {
        await gmail.users.settings.filters.create({
          userId: USER_ID,
          requestBody: {
            criteria: {
              query: filter.query
            },
            action: {
              addLabelIds: [labelId],
              removeLabelIds: [GMAIL_INBOX]
            }
          }
        });
        console.log(`  ✅ ${filter.name}`);
        totalCreated++;
      } catch (error) {
        if (error.message.includes('exists')) {
          console.log(`  ℹ️  ${filter.name} (filter exists)`);
        } else {
          console.log(`  ❌ ${filter.name}: ${error.message}`);
          totalErrors++;
        }
      }
    }
  }

  // Apply filters to existing emails
  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 APPLYING TO EXISTING EMAILS\n');

  let emailsProcessed = 0;

  for (const categoryConfig of filterConfigs) {
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const label = labelsResponse.data.labels.find(l => l.name === categoryConfig.labelName);

    if (!label) continue;

    // Build combined query for all filters in this category
    const queries = categoryConfig.filters.map(f => `(${f.query})`).join(' OR ');

    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: queries,
      maxResults: 100
    });

    const messageIds = searchResponse.data.messages || [];

    if (messageIds.length > 0) {
      console.log(`${categoryConfig.labelName}: ${messageIds.length} emails`);

      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [label.id],
            removeLabelIds: [GMAIL_INBOX]
          }
        });

        emailsProcessed += batch.length;
      }

      console.log(`  ✅ Labeled and archived\n`);
    }
  }

  console.log('═'.repeat(80));
  console.log('COMPLETE\n');
  console.log(`✅ Filters created: ${totalCreated}`);
  console.log(`⚠️  Errors: ${totalErrors}`);
  console.log(`📊 Emails processed: ${emailsProcessed}\n`);
  console.log('═'.repeat(80) + '\n');
}

createRemainingFilters().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
