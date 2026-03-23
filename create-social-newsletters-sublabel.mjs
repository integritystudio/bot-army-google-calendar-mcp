import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createSocialNewslettersSubLabel() {
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

  console.log('📂 CREATING SOCIAL NEWSLETTERS SUB-LABEL\n');
  console.log('═'.repeat(80) + '\n');

  // Step 1: Create sub-label
  console.log('1️⃣  CREATING LABEL: Newsletters/Social\n');

  let subLabelId;

  try {
    const response = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: 'Newsletters/Social',
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });

    console.log('✅ Label created successfully!');
    console.log(`   Name: ${response.data.name}`);
    console.log(`   ID: ${response.data.id}\n`);
    subLabelId = response.data.id;

  } catch (error) {
    if (error.message.includes('exists') || error.message.includes('conflicts')) {
      console.log('⚠️  Label already exists: Newsletters/Social\n');
      const labels = await gmail.users.labels.list({ userId: 'me' });
      const existing = labels.data.labels.find(l => l.name === 'Newsletters/Social');
      if (existing) {
        console.log(`   ID: ${existing.id}\n`);
        subLabelId = existing.id;
      }
    } else {
      console.error('❌ Error creating label:', error.message);
      process.exit(1);
    }
  }

  // Step 2: Apply label to existing social newsletter emails (excluding events)
  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING LABEL TO EXISTING EMAILS\n');

  const socialPatterns = [
    'from:updates-noreply@linkedin.com -"📅" -subject:event -subject:invitation -subject:invite',
    'from:noreply@twitter.com -"📅" -subject:event',
    'from:notifications@reddit.com -"📅" -subject:event',
    'from:hello@facebook.com -"📅" -subject:event',
    'label:CATEGORY_SOCIAL -"📅" -subject:event -subject:invitation',
  ];

  let totalLabeled = 0;
  const processedQueries = new Set();

  for (const query of socialPatterns) {
    if (processedQueries.has(query)) continue;
    processedQueries.add(query);

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
            addLabelIds: [subLabelId],
          },
        });

        console.log(`  ✅ Applied to ${count} emails matching: "${query.substring(0, 60)}..."`);
        totalLabeled += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error processing query: ${error.message}`);
    }
  }

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  // Step 3: Create filter for future social newsletters
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTERS\n');

  const filters = [
    {
      name: 'LinkedIn Social Updates',
      criteria: { from: 'updates-noreply@linkedin.com' },
    },
    {
      name: 'Twitter/X Updates',
      criteria: { from: 'noreply@twitter.com' },
    },
    {
      name: 'Reddit Notifications',
      criteria: { from: 'notifications@reddit.com' },
    },
    {
      name: 'Facebook Updates',
      criteria: { from: 'hello@facebook.com' },
    },
    {
      name: 'Social Category (Excluding Events)',
      criteria: {
        query: 'label:CATEGORY_SOCIAL -subject:event -subject:invitation -subject:invite'
      },
    },
  ];

  let filtersCreated = 0;

  for (const filter of filters) {
    try {
      const response = await gmail.users.settings.filters.create({
        userId: 'me',
        requestBody: {
          criteria: filter.criteria,
          action: {
            addLabelIds: [subLabelId],
          },
        },
      });

      console.log(`  ✅ Filter created: ${filter.name}`);
      console.log(`     ID: ${response.data.id}\n`);
      filtersCreated++;
    } catch (error) {
      if (error.message.includes('exists')) {
        console.log(`  ℹ️  Filter already exists: ${filter.name}`);
      } else {
        console.log(`  ⚠️  Error creating filter "${filter.name}": ${error.message}`);
      }
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ SOCIAL NEWSLETTER SUB-LABEL COMPLETE\n');
  console.log(`  📌 Emails labeled: ${totalLabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log(`  📂 Label: Newsletters/Social (${subLabelId})`);
  console.log('\n💡 Social newsletters are now organized separately, with events excluded!');
  console.log('\n📂 Updated Newsletter Label hierarchy:');
  console.log('   Newsletters');
  console.log('   ├── Social');
  console.log('   ├── Subject-Based');
  console.log('   ├── AlphaSignal');
  console.log('   ├── OpenAI');
  console.log('   ├── Adapty');
  console.log('   ├── Meetup');
  console.log('   └── Google Cloud\n');
}

createSocialNewslettersSubLabel().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
