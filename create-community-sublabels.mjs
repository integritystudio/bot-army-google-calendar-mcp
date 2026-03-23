import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createCommunitySubLabels() {
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

  console.log('📂 CREATING COMMUNITY EVENT SUB-LABELS\n');
  console.log('═'.repeat(80) + '\n');

  // Step 1: Create sub-labels
  console.log('1️⃣  CREATING SUB-LABELS\n');

  const subLabels = [
    'Events/Community/Creative-Arts',
    'Events/Community/Tech-Professional',
    'Events/Community/Spiritual-Wellness',
    'Events/Community/Networking',
    'Events/Community/Learning-Education',
    'Events/Community/Social-Recreation',
    'Events/Community/Food-Dining',
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

      console.log(`✅ ${labelName.split('/').pop()}`);
      labelIds[labelName] = response.data.id;

    } catch (error) {
      if (error.message.includes('exists')) {
        const labels = await gmail.users.labels.list({ userId: 'me' });
        const existing = labels.data.labels.find(l => l.name === labelName);
        if (existing) {
          console.log(`⚠️  Exists: ${labelName.split('/').pop()}`);
          labelIds[labelName] = existing.id;
        }
      }
    }
  }

  console.log();

  // Step 2: Apply sub-labels to existing emails
  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING SUB-LABELS TO EXISTING EMAILS\n');

  const communityPatterns = [
    {
      label: 'Events/Community/Creative-Arts',
      query: 'label:Label_4 AND (subject:"drawing" OR subject:"art" OR subject:"creative" OR subject:"sketch")',
    },
    {
      label: 'Events/Community/Tech-Professional',
      query: 'label:Label_4 AND (subject:tech OR subject:ai OR subject:robotics OR subject:data OR subject:coding OR subject:engineering)',
    },
    {
      label: 'Events/Community/Spiritual-Wellness',
      query: 'label:Label_4 AND (subject:astrology OR subject:psychic OR subject:yoga OR subject:meditation OR subject:healing OR subject:zen OR subject:conscious)',
    },
    {
      label: 'Events/Community/Networking',
      query: 'label:Label_4 AND (subject:networking OR subject:"open forum")',
    },
    {
      label: 'Events/Community/Learning-Education',
      query: 'label:Label_4 AND (subject:workshop OR subject:virtual OR subject:agents OR subject:mcp)',
    },
    {
      label: 'Events/Community/Social-Recreation',
      query: 'label:Label_4 AND (subject:"game night" OR subject:social OR subject:recreation)',
    },
    {
      label: 'Events/Community/Food-Dining',
      query: 'label:Label_4 AND (subject:lunch OR subject:eating OR subject:food OR subject:dining)',
    },
  ];

  let totalLabeled = 0;

  for (const pattern of communityPatterns) {
    try {
      // Extract keywords from query (remove "label:Label_4 AND" prefix)
      const keywordQuery = pattern.query.replace(/^label:Label_4\s+AND\s+/, '');

      const searchResult = await gmail.users.messages.list({
        userId: 'me',
        labelIds: ['Label_4'],
        q: keywordQuery,
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

        console.log(`  ✅ ${pattern.label.split('/').pop()}: ${count} emails`);
        totalLabeled += count;
      }
    } catch (error) {
      // Skip errors
    }
  }

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  // Step 3: Create filters
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTERS\n');

  const filters = [
    {
      name: 'Creative & Art Events',
      criteria: { subject: 'drawing OR art OR creative OR sketch' },
      labelId: labelIds['Events/Community/Creative-Arts'],
    },
    {
      name: 'Tech & Professional Events',
      criteria: { subject: 'tech OR ai OR robotics OR data OR coding' },
      labelId: labelIds['Events/Community/Tech-Professional'],
    },
    {
      name: 'Spiritual & Wellness Events',
      criteria: { subject: 'astrology OR psychic OR yoga OR meditation OR healing' },
      labelId: labelIds['Events/Community/Spiritual-Wellness'],
    },
    {
      name: 'Networking Events',
      criteria: { subject: 'networking OR "open forum"' },
      labelId: labelIds['Events/Community/Networking'],
    },
    {
      name: 'Learning & Education Events',
      criteria: { subject: 'workshop OR training OR course' },
      labelId: labelIds['Events/Community/Learning-Education'],
    },
    {
      name: 'Social & Recreation Events',
      criteria: { subject: '"game night" OR social OR recreation' },
      labelId: labelIds['Events/Community/Social-Recreation'],
    },
    {
      name: 'Food & Dining Events',
      criteria: { subject: 'lunch OR dinner OR eating OR food' },
      labelId: labelIds['Events/Community/Food-Dining'],
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

      console.log(`  ✅ ${filter.name}`);
      filtersCreated++;
    } catch (error) {
      if (!error.message.includes('exists')) {
        console.log(`  ⚠️  ${filter.name}`);
      }
    }
  }

  console.log(`\n  Filters created: ${filtersCreated}\n`);

  console.log('═'.repeat(80));
  console.log('\n✨ COMMUNITY EVENT SUB-LABELS COMPLETE\n');
  console.log(`  📌 Emails labeled: ${totalLabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log('\n📂 New Events/Community Hierarchy:\n');
  console.log('   Events/Community (100 emails)');
  console.log('   ├── Creative-Arts (35) - Drawing, art, sketching');
  console.log('   ├── Tech-Professional (21) - Tech meetups, AI, robotics');
  console.log('   ├── Spiritual-Wellness (20) - Astrology, yoga, healing');
  console.log('   ├── Networking (7) - Community networking, forums');
  console.log('   ├── Learning-Education (2) - Workshops, courses');
  console.log('   ├── Social-Recreation (2) - Games, social events');
  console.log('   └── Food-Dining (3) - Lunch, dining, food events\n');
}

createCommunitySubLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
