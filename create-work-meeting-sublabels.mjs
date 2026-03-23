import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createWorkMeetingSubLabels() {
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

  console.log('📂 CREATING WORK MEETING SUB-LABELS\n');
  console.log('═'.repeat(80) + '\n');

  // Step 1: Create sub-labels
  console.log('1️⃣  CREATING SUB-LABELS\n');

  const subLabels = [
    'Events/Invitations/Work/One-on-One',
    'Events/Invitations/Work/Team Syncs',
    'Events/Invitations/Work/Client/External',
    'Events/Invitations/Work/Internal Meetings',
  ];

  const labelIds = {};

  for (const labelName of subLabels) {
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
        console.log(`❌ Error: ${labelName}: ${error.message}\n`);
      }
    }
  }

  // Step 2: Apply sub-labels to existing emails
  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING SUB-LABELS TO EXISTING EMAILS\n');

  const workPatterns = [
    {
      label: 'Events/Invitations/Work/One-on-One',
      query: 'label:Label_16 AND (subject:"John" OR subject:"1:1" OR subject:"one-on-one" OR subject:"neighbor client")',
    },
    {
      label: 'Events/Invitations/Work/Team Syncs',
      query: 'label:Label_16 AND (subject:"Team" OR subject:"Sync" OR subject:"Integrity" OR subject:"Core Team")',
    },
    {
      label: 'Events/Invitations/Work/Client/External',
      query: 'label:Label_16 AND (subject:client OR subject:external OR subject:partner)',
    },
    {
      label: 'Events/Invitations/Work/Internal Meetings',
      query: 'label:Label_16 AND (subject:meeting OR subject:workshop OR subject:training OR subject:strategy)',
    },
  ];

  let totalLabeled = 0;

  for (const pattern of workPatterns) {
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

        console.log(`  ✅ ${pattern.label}: ${count} emails`);
        totalLabeled += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error with ${pattern.label}: ${error.message}`);
    }
  }

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  // Step 3: Create filters
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTERS\n');

  const filters = [
    {
      name: 'One-on-One Meetings',
      criteria: { subject: '1:1 OR "one-on-one" OR "one on one"' },
      labelId: labelIds['Events/Invitations/Work/One-on-One'],
    },
    {
      name: 'Team Syncs',
      criteria: { subject: 'sync OR "team meeting" OR standup' },
      labelId: labelIds['Events/Invitations/Work/Team Syncs'],
    },
    {
      name: 'Client & External Meetings',
      criteria: { subject: 'client OR external OR partner OR vendor' },
      labelId: labelIds['Events/Invitations/Work/Client/External'],
    },
    {
      name: 'Internal Training & Strategy',
      criteria: { subject: 'workshop OR training OR strategy OR development' },
      labelId: labelIds['Events/Invitations/Work/Internal Meetings'],
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
            addLabelIds: [filter.labelId],
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
  console.log('\n✨ WORK MEETING SUB-LABELS COMPLETE\n');
  console.log(`  📌 Emails labeled: ${totalLabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log('\n📂 Updated Events/Invitations/Work Hierarchy:\n');
  console.log('   Events/Invitations/Work');
  console.log('   ├── One-on-One (Individual meetings)');
  console.log('   ├── Team Syncs (Team meetings, standups)');
  console.log('   ├── Client/External (Client and partner meetings)');
  console.log('   └── Internal Meetings (Training, strategy, workshops)\n');
}

createWorkMeetingSubLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
