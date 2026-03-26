import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, LABEL_EVENTS } from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';

async function organizeEvents() {
  const gmail = createGmailClient();

  console.log('📅 ORGANIZING EVENT EMAILS\n');
  const labelCache = await buildLabelCache(gmail);
  const eventsLabelId = labelCache.get(LABEL_EVENTS);
  if (!eventsLabelId) {
    console.error('Events label not found');
    process.exit(1);
  }
  console.log('═'.repeat(80));

  console.log('\n1️⃣  APPLYING LABEL TO EXISTING EVENT EMAILS\n');

  const eventPatterns = [
    'from:info@email.meetup.com',

    'from:teamcalendly@send.calendly.com',
    'from:support@calendly.zendesk.com',

    'from:"ATX - Awkwardly Zen"',
    'from:"Austin Cafe Drawing Group"',
    'from:"Austin Robotics & AI"',
    'from:"International House"',

    'subject:"📅 Just scheduled"',
    'subject:"Just scheduled"',
    'subject:event OR subject:conference OR subject:summit OR subject:workshop',
    'subject:venue OR subject:location OR subject:address',
    'subject:register OR subject:registration',
    'subject:happening OR subject:"save the date"',

    'subject:invitation OR subject:invite',
  ];

  let totalLabeled = 0;
  const processedQueries = new Set();

  for (const query of eventPatterns) {
    if (processedQueries.has(query)) continue;
    processedQueries.add(query);

    try {
      const searchResult = await gmail.users.messages.list({
        userId: USER_ID,
        q: query,
        maxResults: 100,
      });

      if (!searchResult.data.messages) continue;

      const messageIds = searchResult.data.messages.map(m => m.id);
      const count = messageIds.length;

      if (count > 0) {
        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: messageIds,
            addLabelIds: [eventsLabelId],
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
        userId: USER_ID,
        requestBody: {
          criteria: filterConfig.criteria,
          action: {
            addLabelIds: [eventsLabelId],
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
