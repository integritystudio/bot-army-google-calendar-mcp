import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createAllSubLabels() {
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

  console.log('📂 CREATING COMPREHENSIVE SUB-LABELS\n');
  console.log('═'.repeat(80) + '\n');

  // Step 1: Create workshop sub-labels
  console.log('1️⃣  CREATING WORKSHOP SUB-LABELS\n');

  const workshopLabels = [
    'Events/Workshops/Technical/AI-ML',
    'Events/Workshops/Professional Development',
    'Events/Workshops/Healthcare/Medical',
    'Events/Workshops/Creative/Arts',
    'Events/Workshops/Business/Leadership',
  ];

  const labelIds = {};

  for (const labelName of workshopLabels) {
    try {
      const response = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });

      console.log(`✅ ${labelName}`);
      labelIds[labelName] = response.data.id;
    } catch (error) {
      if (error.message.includes('exists')) {
        const labels = await gmail.users.labels.list({ userId: 'me' });
        const existing = labels.data.labels.find(l => l.name === labelName);
        if (existing) {
          console.log(`⚠️  Exists: ${labelName}`);
          labelIds[labelName] = existing.id;
        }
      }
    }
  }

  console.log();

  // Step 2: Create community services sub-labels
  console.log('2️⃣  CREATING COMMUNITY SERVICES SUB-LABELS\n');

  const communityLabels = [
    'Events/Invitations/Community Services/Capital City Village',
    'Events/Invitations/Community Services/Social Events',
    'Events/Invitations/Community Services/Volunteer',
  ];

  for (const labelName of communityLabels) {
    try {
      const response = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });

      console.log(`✅ ${labelName}`);
      labelIds[labelName] = response.data.id;
    } catch (error) {
      if (error.message.includes('exists')) {
        const labels = await gmail.users.labels.list({ userId: 'me' });
        const existing = labels.data.labels.find(l => l.name === labelName);
        if (existing) {
          console.log(`⚠️  Exists: ${labelName}`);
          labelIds[labelName] = existing.id;
        }
      }
    }
  }

  console.log();

  // Step 3: Apply workshop sub-labels
  console.log('═'.repeat(80));
  console.log('\n3️⃣  APPLYING WORKSHOP SUB-LABELS\n');

  const workshopPatterns = [
    {
      label: 'Events/Workshops/Technical/AI-ML',
      query: 'label:Label_5 AND (subject:"computer vision" OR subject:ai OR subject:"machine learning" OR subject:coding)',
    },
    {
      label: 'Events/Workshops/Professional Development',
      query: 'label:Label_5 AND (subject:"validating world models" OR subject:"video datasets")',
    },
    {
      label: 'Events/Workshops/Healthcare/Medical',
      query: 'label:Label_5 AND (subject:"home care" OR subject:healthcare OR subject:medical)',
    },
    {
      label: 'Events/Workshops/Creative/Arts',
      query: 'label:Label_5 AND (subject:"god-given" OR subject:"operational excellence")',
    },
    {
      label: 'Events/Workshops/Business/Leadership',
      query: 'label:Label_5 AND (subject:"business plan")',
    },
  ];

  let workshopsLabeled = 0;

  for (const pattern of workshopPatterns) {
    try {
      const searchResult = await gmail.users.messages.list({
        userId: 'me',
        q: pattern.query,
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
            addLabelIds: [labelIds[pattern.label]],
          },
        });

        console.log(`  ✅ ${pattern.label.split('/').pop()}: ${count}`);
        workshopsLabeled += count;
      }
    } catch (error) {
      // Skip errors
    }
  }

  console.log(`\n  Total workshops labeled: ${workshopsLabeled}\n`);

  // Step 4: Apply community services sub-labels
  console.log('═'.repeat(80));
  console.log('\n4️⃣  APPLYING COMMUNITY SERVICES SUB-LABELS\n');

  const communityPatterns = [
    {
      label: 'Events/Invitations/Community Services/Capital City Village',
      query: 'label:Label_18 AND (from:capitalcityvillage OR from:capitalcity)',
    },
    {
      label: 'Events/Invitations/Community Services/Social Events',
      query: 'label:Label_18 AND (subject:"let\'s do lunch" OR subject:"game night" OR subject:"gathering")',
    },
    {
      label: 'Events/Invitations/Community Services/Volunteer',
      query: 'label:Label_18 AND (subject:volunteer OR subject:opportunity)',
    },
  ];

  let communityLabeled = 0;

  for (const pattern of communityPatterns) {
    try {
      const searchResult = await gmail.users.messages.list({
        userId: 'me',
        q: pattern.query,
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
            addLabelIds: [labelIds[pattern.label]],
          },
        });

        console.log(`  ✅ ${pattern.label.split('/').pop()}: ${count}`);
        communityLabeled += count;
      }
    } catch (error) {
      // Skip errors
    }
  }

  console.log(`\n  Total community services labeled: ${communityLabeled}\n`);

  console.log('═'.repeat(80));
  console.log('\n✨ SUB-LABEL CREATION COMPLETE\n');
  console.log('📂 NEW LABEL HIERARCHIES:\n');
  console.log('   Events/Workshops');
  console.log('   ├── Technical/AI-ML');
  console.log('   ├── Professional Development');
  console.log('   ├── Healthcare/Medical');
  console.log('   ├── Creative/Arts');
  console.log('   └── Business/Leadership\n');
  console.log('   Events/Invitations/Community Services');
  console.log('   ├── Capital City Village');
  console.log('   ├── Social Events');
  console.log('   └── Volunteer\n');
}

createAllSubLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
