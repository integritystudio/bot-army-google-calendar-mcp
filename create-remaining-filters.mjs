import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createRemainingFilters() {
  const tokenFileData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const accountMode = process.env.ACCOUNT_MODE || 'normal';
  const tokenData = tokenFileData[accountMode];

  const credPath = process.env.GOOGLE_OAUTH_CREDENTIALS || './credentials.json';
  const credData = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  const oauth2Client = new OAuth2Client(
    credData.installed.client_id,
    credData.installed.client_secret,
    credData.installed.redirect_uris[0]
  );
  oauth2Client.setCredentials(tokenData);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  console.log('🏷️  CREATING FILTERS FOR REMAINING CATEGORIES\n');
  console.log('═'.repeat(80) + '\n');

  // Define filter configurations
  const filterConfigs = [
    {
      labelName: 'Product Updates',
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
      labelName: 'Communities',
      description: 'Community and group emails',
      filters: [
        { query: 'from:wtm@technovation.org', name: 'Women Techmakers' }
      ]
    },
    {
      labelName: 'Services & Alerts',
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
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const existingLabel = labelsResponse.data.labels.find(l => l.name === categoryConfig.labelName);

    if (existingLabel) {
      labelId = existingLabel.id;
      console.log(`✅ Using existing label: ${categoryConfig.labelName}\n`);
    } else {
      const createLabelResponse = await gmail.users.labels.create({
        userId: 'me',
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
          userId: 'me',
          requestBody: {
            criteria: {
              query: filter.query
            },
            action: {
              addLabelIds: [labelId],
              removeLabelIds: ['INBOX']
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
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const label = labelsResponse.data.labels.find(l => l.name === categoryConfig.labelName);

    if (!label) continue;

    // Build combined query for all filters in this category
    const queries = categoryConfig.filters.map(f => `(${f.query})`).join(' OR ');

    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
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
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [label.id],
            removeLabelIds: ['INBOX']
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
