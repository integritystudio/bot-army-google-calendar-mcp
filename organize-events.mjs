import { createGmailClient } from './lib/gmail-client.mjs';
import { LABEL_EVENTS } from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';
import { createGmailFilter } from './lib/gmail-filter-utils.mjs';

const EVENT_PATTERNS = [
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

const EVENT_FILTERS = [
  { name: 'Meetup Event Notifications', criteria: { from: 'info@email.meetup.com' } },
  { name: 'Calendly Team Events', criteria: { from: 'teamcalendly@send.calendly.com' } },
  { name: 'ATX Awkwardly Zen Events', criteria: { from: 'ATX - Awkwardly Zen' } },
  { name: 'Community Event Notifications', criteria: { query: 'subject:"📅 Just scheduled"' } },
  { name: 'Workshop & Conference Announcements', criteria: { subject: 'workshop OR conference OR summit OR webinar' } },
  { name: 'Event Invitations', criteria: { subject: 'invitation OR invite OR rsvp' } },
];

async function organizeEvents() {
  const gmail = createGmailClient();

  console.log('ORGANIZING EVENT EMAILS\n');
  const labelCache = await buildLabelCache(gmail);
  const eventsLabelId = labelCache.get(LABEL_EVENTS);
  if (!eventsLabelId) {
    console.error('Events label not found');
    process.exit(1);
  }
  console.log('═'.repeat(80));
  console.log('\n1. APPLYING LABEL TO EXISTING EVENT EMAILS\n');

  let totalLabeled = 0;
  const processedQueries = new Set();

  for (const query of EVENT_PATTERNS) {
    if (processedQueries.has(query)) continue;
    processedQueries.add(query);
    try {
      const count = await searchAndModify(gmail, query, { addLabelIds: [eventsLabelId] }, 100);
      if (count > 0) console.log(`  Applied to ${count} emails matching: "${query}"`);
      totalLabeled += count;
    } catch (error) {
      console.log(`  Error processing "${query}": ${error.message}`);
    }
  }

  console.log(`\n  Total labeled: ${totalLabeled} emails\n`);
  console.log('═'.repeat(80));
  console.log('\n2. CREATING AUTO-LABEL FILTERS FOR FUTURE EVENTS\n');

  let filtersCreated = 0;
  for (const filterConfig of EVENT_FILTERS) {
    const filterId = await createGmailFilter(gmail, filterConfig.criteria, { addLabelIds: [eventsLabelId] });
    if (filterId) {
      console.log(`  Filter created: ${filterConfig.name}`);
      filtersCreated++;
    } else {
      console.log(`  Filter already exists: ${filterConfig.name}`);
    }
  }

  console.log('═'.repeat(80));
  console.log('\nEVENT EMAIL ORGANIZATION COMPLETE\n');
  console.log(`  Labeled existing emails: ${totalLabeled}`);
  console.log(`  Filters created: ${filtersCreated}`);
}

organizeEvents().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
