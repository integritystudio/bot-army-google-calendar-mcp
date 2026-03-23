import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');
const EVENTS_LABEL_ID = 'Label_1';

async function organizeEvents() {
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

  console.log('📅 ORGANIZING EVENT EMAILS\n');
  console.log('═'.repeat(80));

  // Step 1: Find and label existing event emails
  console.log('\n1️⃣  APPLYING LABEL TO EXISTING EVENT EMAILS\n');

  const eventPatterns = [
    // Meetup events
    'from:info@email.meetup.com',

    // Calendly team events
    'from:teamcalendly@send.calendly.com',
    'from:support@calendly.zendesk.com',

    // Community/spiritual events
    'from:"ATX - Awkwardly Zen"',
    'from:"Austin Cafe Drawing Group"',
    'from:"Austin Robotics & AI"',
    'from:"International House"',

    // Event indicators in subject/body
    'subject:"📅 Just scheduled"',
    'subject:"Just scheduled"',
    'subject:event OR subject:conference OR subject:summit OR subject:workshop',
    'subject:venue OR subject:location OR subject:address',
    'subject:register OR subject:registration',
    'subject:happening OR subject:"save the date"',

    // Calendar invitations
    'subject:invitation OR subject:invite',
  ];

  let totalLabeled = 0;
  const processedQueries = new Set();

  for (const query of eventPatterns) {
    // Skip duplicate queries
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
            addLabelIds: [EVENTS_LABEL_ID],
          },
        });

        console.log(`  ✅ Applied to ${count} emails matching: "${query}"`);
        totalLabeled += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error processing "${query}": ${error.message}`);
    }
  }

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  // Step 2: Create filters for future events
  console.log('═'.repeat(80));
  console.log('\n2️⃣  CREATING AUTO-LABEL FILTERS FOR FUTURE EVENTS\n');

  const filters = [
    {
      name: 'Meetup Event Notifications',
      criteria: { from: 'info@email.meetup.com' },
    },
    {
      name: 'Calendly Team Events',
      criteria: { from: 'teamcalendly@send.calendly.com' },
    },
    {
      name: 'ATX Awkwardly Zen Events',
      criteria: { from: 'ATX - Awkwardly Zen' },
    },
    {
      name: 'Community Event Notifications',
      criteria: { query: 'subject:"📅 Just scheduled"' },
    },
    {
      name: 'Workshop & Conference Announcements',
      criteria: { subject: 'workshop OR conference OR summit OR webinar' },
    },
    {
      name: 'Event Invitations',
      criteria: { subject: 'invitation OR invite OR rsvp' },
    },
  ];

  let filtersCreated = 0;

  for (const filterConfig of filters) {
    try {
      const response = await gmail.users.settings.filters.create({
        userId: 'me',
        requestBody: {
          criteria: filterConfig.criteria,
          action: {
            addLabelIds: [EVENTS_LABEL_ID],
          },
        },
      });

      console.log(`  ✅ Filter created: ${filterConfig.name}`);
      console.log(`     ID: ${response.data.id}\n`);
      filtersCreated++;
    } catch (error) {
      if (error.message.includes('exists')) {
        console.log(`  ℹ️  Filter already exists: ${filterConfig.name}`);
      } else {
        console.log(`  ⚠️  Error creating filter "${filterConfig.name}": ${error.message}`);
      }
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ EVENT EMAIL ORGANIZATION COMPLETE\n');
  console.log(`  📌 Labeled existing emails: ${totalLabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log('\n💡 Event emails will now be automatically labeled going forward!');
}

organizeEvents().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
