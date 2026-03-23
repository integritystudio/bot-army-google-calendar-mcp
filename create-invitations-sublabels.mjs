import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createInvitationsSubLabels() {
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

  console.log('📂 CREATING EVENTS/INVITATIONS SUB-LABELS\n');
  console.log('═'.repeat(80) + '\n');

  // Step 1: Create sub-labels
  console.log('1️⃣  CREATING SUB-LABELS\n');

  const subLabels = [
    'Events/Invitations/Professional',
    'Events/Invitations/Work',
    'Events/Invitations/Conferences',
    'Events/Invitations/Community Services',
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

  const invitationPatterns = [
    {
      label: 'Events/Invitations/Professional',
      query: 'from:notifications-noreply@linkedin.com OR from:linkedin.com subject:event OR subject:invitation',
    },
    {
      label: 'Events/Invitations/Work',
      query: 'subject:invitation AND (from:integritystudio OR from:@gmail.com OR from:@company)',
    },
    {
      label: 'Events/Invitations/Conferences',
      query: 'subject:SXSW OR subject:conference OR subject:summit OR subject:festival',
    },
    {
      label: 'Events/Invitations/Community Services',
      query: 'from:capitalcityvillage OR from:village.org OR subject:"Capital City"',
    },
  ];

  let totalLabeled = 0;

  for (const pattern of invitationPatterns) {
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
      name: 'LinkedIn Professional Events',
      criteria: { from: 'notifications-noreply@linkedin.com' },
      labelId: labelIds['Events/Invitations/Professional'],
    },
    {
      name: 'Work Meeting Invitations',
      criteria: { subject: 'invitation OR invite OR rsvp' },
      labelId: labelIds['Events/Invitations/Work'],
    },
    {
      name: 'Conference & Festival Invites',
      criteria: { subject: 'SXSW OR conference OR summit OR festival' },
      labelId: labelIds['Events/Invitations/Conferences'],
    },
    {
      name: 'Community Service Invitations',
      criteria: { from: 'capitalcityvillage OR village.org' },
      labelId: labelIds['Events/Invitations/Community Services'],
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
  console.log('\n✨ INVITATIONS SUB-LABELS COMPLETE\n');
  console.log(`  📌 Emails labeled: ${totalLabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log('\n📂 Updated Events/Invitations Hierarchy:\n');
  console.log('   Events/Invitations');
  console.log('   ├── Professional (LinkedIn events & conferences)');
  console.log('   ├── Work (Colleague meeting invitations)');
  console.log('   ├── Conferences (SXSW, festivals, summits)');
  console.log('   └── Community Services (Capital City Village, etc.)\n');
}

createInvitationsSubLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
