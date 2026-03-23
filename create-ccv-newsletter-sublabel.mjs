import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createCCVNewsletterSubLabel() {
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

  console.log('📂 CREATING CCV NEWSLETTER SUB-LABEL\n');
  console.log('═'.repeat(80) + '\n');

  // Step 1: Create sub-label
  console.log('1️⃣  CREATING LABEL: Newsletters/CCV\n');

  let subLabelId;

  try {
    const response = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: 'Newsletters/CCV',
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
      console.log('⚠️  Label already exists: Newsletters/CCV\n');
      const labels = await gmail.users.labels.list({ userId: 'me' });
      const existing = labels.data.labels.find(l => l.name === 'Newsletters/CCV');
      if (existing) {
        console.log(`   ID: ${existing.id}\n`);
        subLabelId = existing.id;
      }
    } else {
      console.error('❌ Error creating label:', error.message);
      process.exit(1);
    }
  }

  // Step 2: Apply label to existing CCV newsletter emails
  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING LABEL TO EXISTING EMAILS\n');

  const ccvPatterns = [
    'subject:CCV OR subject:"CCV Newsletter"',
    'from:ccv@ OR from:newsletter@ccv',
  ];

  let totalLabeled = 0;

  for (const query of ccvPatterns) {
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

        console.log(`  ✅ Applied to ${count} emails matching: "${query}"`);
        totalLabeled += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error with "${query}": ${error.message}`);
    }
  }

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  // Step 3: Create filter for future CCV newsletter emails
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTER\n');

  try {
    const response = await gmail.users.settings.filters.create({
      userId: 'me',
      requestBody: {
        criteria: {
          subject: 'CCV OR "CCV Newsletter"',
        },
        action: {
          addLabelIds: [subLabelId],
        },
      },
    });

    console.log('✅ Filter created successfully!');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Criteria: Subject contains "CCV" or "CCV Newsletter"`);
    console.log(`   Action: Apply label "Newsletters/CCV"\n`);

  } catch (error) {
    if (error.message.includes('exists')) {
      console.log('⚠️  Filter already exists\n');
    } else {
      console.log(`⚠️  Error creating filter: ${error.message}\n`);
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ CCV NEWSLETTER SUB-LABEL COMPLETE\n');
  console.log(`  📌 Emails labeled: ${totalLabeled}`);
  console.log(`  📂 Label: Newsletters/CCV (${subLabelId})`);
  console.log('\n📂 Updated Newsletter Label hierarchy:');
  console.log('   Newsletters');
  console.log('   ├── Company');
  console.log('   ├── News Aggregates');
  console.log('   ├── Social');
  console.log('   ├── Subject-Based');
  console.log('   └── CCV (NEW)\n');
}

createCCVNewsletterSubLabel().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
