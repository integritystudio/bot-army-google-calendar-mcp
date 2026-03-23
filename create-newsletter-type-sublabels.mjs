import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createNewsletterTypeSubLabels() {
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

  console.log('📂 CREATING NEWSLETTER TYPE SUB-LABELS\n');
  console.log('═'.repeat(80) + '\n');

  // Step 1: Create both sub-labels
  console.log('1️⃣  CREATING LABELS\n');

  const labelNames = ['Newsletters/Company', 'Newsletters/News Aggregates'];
  const labelIds = {};

  for (const labelName of labelNames) {
    try {
      const response = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });

      console.log(`✅ Created: ${labelName}`);
      console.log(`   ID: ${response.data.id}\n`);
      labelIds[labelName] = response.data.id;

    } catch (error) {
      if (error.message.includes('exists') || error.message.includes('conflicts')) {
        console.log(`⚠️  Already exists: ${labelName}`);
        const labels = await gmail.users.labels.list({ userId: 'me' });
        const existing = labels.data.labels.find(l => l.name === labelName);
        if (existing) {
          console.log(`   ID: ${existing.id}\n`);
          labelIds[labelName] = existing.id;
        }
      } else {
        console.log(`❌ Error creating ${labelName}: ${error.message}\n`);
      }
    }
  }

  // Step 2: Apply labels to existing emails
  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING LABELS TO EXISTING EMAILS\n');

  // Company-specific newsletters
  const companyPatterns = [
    'from:news@alphasignal.ai',
    'from:noreply@email.openai.com',
    'from:hello@adapty.io',
    'from:googlecloud@google.com',
    'from:communications@yodlee.com',
    'from:lukak@storylane.io',
    'from:arthur@storylane.io',
    'from:teamcalendly@send.calendly.com',
    'from:hello@anthropic.com',
  ];

  let companyLabeled = 0;

  for (const query of companyPatterns) {
    try {
      const searchResult = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
      });

      if (!searchResult.data.messages) continue;

      const messageIds = searchResult.data.messages.map(m => m.id);
      const count = messageIds.length;

      if (count > 0) {
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: messageIds,
            addLabelIds: [labelIds['Newsletters/Company']],
          },
        });

        console.log(`  ✅ Company: ${count} emails from "${query.split(':')[1].replace(/"/g, '')}"`);
        companyLabeled += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error with ${query}: ${error.message}`);
    }
  }

  console.log(`\n  📊 Company newsletters labeled: ${companyLabeled}\n`);

  // News aggregate newsletters (digests, roundups, curated)
  const aggregatePatterns = [
    'subject:digest OR subject:roundup OR subject:"weekly digest" OR subject:"weekly summary"',
    'from:news@alphasignal.ai subject:digest',
    'subject:"week in" OR subject:"month in" OR subject:"what\'s new"',
  ];

  let aggregateLabeled = 0;

  for (const query of aggregatePatterns) {
    try {
      const searchResult = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
      });

      if (!searchResult.data.messages) continue;

      const messageIds = searchResult.data.messages.map(m => m.id);
      const count = messageIds.length;

      if (count > 0) {
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: messageIds,
            addLabelIds: [labelIds['Newsletters/News Aggregates']],
          },
        });

        console.log(`  ✅ Aggregate: ${count} emails matching "${query.substring(0, 50)}..."`);
        aggregateLabeled += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error: ${error.message}`);
    }
  }

  console.log(`\n  📊 News aggregate newsletters labeled: ${aggregateLabeled}\n`);

  // Step 3: Create filters
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTERS\n');

  const companyFilters = [
    {
      name: 'Company: AlphaSignal',
      criteria: { from: 'news@alphasignal.ai' },
      type: 'Company',
    },
    {
      name: 'Company: OpenAI',
      criteria: { from: 'noreply@email.openai.com' },
      type: 'Company',
    },
    {
      name: 'Company: Adapty',
      criteria: { from: 'hello@adapty.io' },
      type: 'Company',
    },
    {
      name: 'Company: Google Cloud',
      criteria: { from: 'googlecloud@google.com' },
      type: 'Company',
    },
    {
      name: 'Company: Storylane',
      criteria: { from: 'lukak@storylane.io OR from:arthur@storylane.io' },
      type: 'Company',
    },
    {
      name: 'Aggregate: Digest Newsletters',
      criteria: { subject: 'digest OR roundup OR summary' },
      type: 'Aggregate',
    },
    {
      name: 'Aggregate: Weekly/Monthly Updates',
      criteria: { subject: '"week in" OR "month in" OR "what\'s new"' },
      type: 'Aggregate',
    },
  ];

  let filtersCreated = 0;

  for (const filter of companyFilters) {
    try {
      const labelId = filter.type === 'Company'
        ? labelIds['Newsletters/Company']
        : labelIds['Newsletters/News Aggregates'];

      const response = await gmail.users.settings.filters.create({
        userId: 'me',
        requestBody: {
          criteria: filter.criteria,
          action: {
            addLabelIds: [labelId],
          },
        },
      });

      console.log(`  ✅ Filter: ${filter.name}`);
      console.log(`     ID: ${response.data.id}\n`);
      filtersCreated++;
    } catch (error) {
      if (error.message.includes('exists')) {
        console.log(`  ℹ️  Filter exists: ${filter.name}`);
      } else {
        console.log(`  ⚠️  Error: ${filter.name}: ${error.message}`);
      }
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ NEWSLETTER TYPE SUB-LABELS COMPLETE\n');
  console.log(`  📌 Company newsletters labeled: ${companyLabeled}`);
  console.log(`  📌 News aggregate newsletters labeled: ${aggregateLabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log('\n📂 Updated Newsletter Label hierarchy:');
  console.log('   Newsletters');
  console.log('   ├── Company (direct company updates)');
  console.log('   │   ├── AlphaSignal');
  console.log('   │   ├── OpenAI');
  console.log('   │   ├── Adapty');
  console.log('   │   ├── Google Cloud');
  console.log('   │   └── Storylane');
  console.log('   ├── News Aggregates (curated summaries)');
  console.log('   ├── Social');
  console.log('   └── Subject-Based\n');
  console.log('💡 Newsletters are now organized by content type: direct company updates vs. curated news!');
}

createNewsletterTypeSubLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
