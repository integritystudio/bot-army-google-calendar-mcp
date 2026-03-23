import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

const SUB_LABELS = {
  'Events/Meetup': 'Label_2',
  'Events/Calendly': 'Label_3',
  'Events/Community': 'Label_4',
  'Events/Workshops': 'Label_5',
  'Events/Invitations': 'Label_6',
};

async function organizeEventsSubLabels() {
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

  console.log('📂 ORGANIZING EVENTS BY SUB-LABEL\n');
  console.log('═'.repeat(80));

  // Step 1: Apply sub-labels to existing emails
  console.log('\n1️⃣  APPLYING SUB-LABELS TO EXISTING EMAILS\n');

  const eventCategories = [
    {
      label: 'Events/Meetup',
      labelId: SUB_LABELS['Events/Meetup'],
      query: 'from:info@email.meetup.com',
    },
    {
      label: 'Events/Calendly',
      labelId: SUB_LABELS['Events/Calendly'],
      query: 'from:teamcalendly@send.calendly.com OR from:support@calendly.zendesk.com',
    },
    {
      label: 'Events/Community',
      labelId: SUB_LABELS['Events/Community'],
      query: 'subject:"📅 Just scheduled"',
    },
    {
      label: 'Events/Workshops',
      labelId: SUB_LABELS['Events/Workshops'],
      query: 'subject:workshop OR subject:conference OR subject:summit OR subject:webinar',
    },
    {
      label: 'Events/Invitations',
      labelId: SUB_LABELS['Events/Invitations'],
      query: 'subject:invitation OR subject:invite OR subject:rsvp',
    },
  ];

  let totalLabeled = 0;

  for (const category of eventCategories) {
    try {
      const searchResult = await gmail.users.messages.list({
        userId: 'me',
        q: category.query,
        maxResults: 100,
      });

      if (!searchResult.data.messages) {
        console.log(`  ℹ️  No emails found for: ${category.label}`);
        continue;
      }

      const messageIds = searchResult.data.messages.map(m => m.id);
      const count = messageIds.length;

      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: messageIds,
          addLabelIds: [category.labelId],
        },
      });

      console.log(`  ✅ ${category.label}: ${count} emails`);
      totalLabeled += count;
    } catch (error) {
      console.log(`  ⚠️  Error with ${category.label}: ${error.message}`);
    }
  }

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  // Step 2: Create filters for future emails
  console.log('═'.repeat(80));
  console.log('\n2️⃣  CREATING AUTO-LABEL FILTERS\n');

  const filters = [
    {
      name: 'Meetup Events',
      criteria: { from: 'info@email.meetup.com' },
      labelId: SUB_LABELS['Events/Meetup'],
    },
    {
      name: 'Calendly Events',
      criteria: { from: 'teamcalendly@send.calendly.com' },
      labelId: SUB_LABELS['Events/Calendly'],
    },
    {
      name: 'Community Event Announcements',
      criteria: { subject: '📅 Just scheduled' },
      labelId: SUB_LABELS['Events/Community'],
    },
    {
      name: 'Workshop & Conference Events',
      criteria: { subject: 'workshop OR conference OR summit OR webinar' },
      labelId: SUB_LABELS['Events/Workshops'],
    },
    {
      name: 'Event Invitations',
      criteria: { subject: 'invitation OR invite OR rsvp' },
      labelId: SUB_LABELS['Events/Invitations'],
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
  console.log('\n✨ EVENT SUB-LABELS ORGANIZATION COMPLETE\n');
  console.log(`  📌 Emails labeled: ${totalLabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log('\n💡 Your events are now organized by category!');
  console.log('\n📂 Label hierarchy in Gmail:');
  console.log('   Events');
  console.log('   ├── Meetup');
  console.log('   ├── Calendly');
  console.log('   ├── Community');
  console.log('   ├── Workshops');
  console.log('   └── Invitations\n');
}

organizeEventsSubLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
