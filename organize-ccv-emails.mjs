import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function organizeCCVEmails() {
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

  console.log('📂 ORGANIZING CCV EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  // Step 1: Create CCV organization label
  console.log('1️⃣  CREATING LABEL: CCV (Organization)\n');

  let ccvOrgLabelId;

  try {
    const response = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: 'CCV',
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });

    console.log('✅ Label created successfully!');
    console.log(`   Name: ${response.data.name}`);
    console.log(`   ID: ${response.data.id}\n`);
    ccvOrgLabelId = response.data.id;

  } catch (error) {
    if (error.message.includes('exists') || error.message.includes('conflicts')) {
      console.log('⚠️  Label already exists: CCV\n');
      const labels = await gmail.users.labels.list({ userId: 'me' });
      const existing = labels.data.labels.find(l => l.name === 'CCV');
      if (existing) {
        console.log(`   ID: ${existing.id}\n`);
        ccvOrgLabelId = existing.id;
      }
    } else {
      console.error('❌ Error creating label:', error.message);
      process.exit(1);
    }
  }

  // Step 2: Move meeting coordination emails from Newsletters to CCV
  console.log('═'.repeat(80));
  console.log('\n2️⃣  MOVING MEETING COORDINATION FROM NEWSLETTERS TO CCV\n');

  const meetingPatterns = [
    'subject:"BYOG" OR subject:"Annual Meeting"',
    'subject:"PROGRAM COMM MEETING"',
    'subject:"CCV" AND (subject:meeting OR subject:program OR subject:poll)',
  ];

  const newsletterLabelId = 'Label_11'; // Newsletters/CCV
  let meetingEmailsMoved = 0;

  for (const query of meetingPatterns) {
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
            addLabelIds: [ccvOrgLabelId],
            removeLabelIds: [newsletterLabelId],
          },
        });

        console.log(`  ✅ Moved ${count} emails matching: "${query.substring(0, 50)}..."`);
        console.log(`     Added: CCV (Organization)`);
        console.log(`     Removed: Newsletters/CCV\n`);
        meetingEmailsMoved += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error with "${query}": ${error.message}`);
    }
  }

  console.log(`  📊 Total moved: ${meetingEmailsMoved} emails\n`);

  // Step 3: Create filters for organizational emails
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTERS\n');

  const filters = [
    {
      name: 'CCV Meeting Announcements',
      criteria: { subject: 'PROGRAM COMM MEETING OR CCV Annual Meeting OR BYOG' },
    },
    {
      name: 'CCV Organization Emails',
      criteria: { from: 'CCV@' },
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
            addLabelIds: [ccvOrgLabelId],
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
  console.log('\n✨ CCV EMAIL ORGANIZATION COMPLETE\n');
  console.log(`  📌 Meeting coordination emails moved: ${meetingEmailsMoved}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log(`  📂 Labels:`);
  console.log(`     - CCV (Organization) - ${ccvOrgLabelId}`);
  console.log(`     - Newsletters/CCV (Monthly newsletters only)`);
  console.log('\n📂 New Organization:\n');
  console.log('   CCV (Organization Emails)');
  console.log('   ├── Meeting Announcements');
  console.log('   ├── Community Engagement');
  console.log('   └── Organization Updates\n');
  console.log('   Newsletters');
  console.log('   └── CCV (Monthly Newsletters)\n');
}

organizeCCVEmails().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
