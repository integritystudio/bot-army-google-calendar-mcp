import { createGmailClient } from './lib/gmail-client.mjs';
import {
  LABEL_EVENTS_MEETUP, LABEL_EVENTS_CALENDLY, LABEL_EVENTS_COMMUNITY,
  LABEL_EVENTS_WORKSHOPS, LABEL_EVENTS_INVITATIONS,
} from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';
import { createGmailFilter } from './lib/gmail-filter-utils.mjs';

const EVENT_CATEGORIES = [
  {
    label: LABEL_EVENTS_MEETUP,
    searchQuery: 'from:info@email.meetup.com',
    filterCriteria: { from: 'info@email.meetup.com' },
    filterName: 'Meetup Events',
  },
  {
    label: LABEL_EVENTS_CALENDLY,
    searchQuery: 'from:teamcalendly@send.calendly.com OR from:support@calendly.zendesk.com',
    filterCriteria: { from: 'teamcalendly@send.calendly.com' },
    filterName: 'Calendly Events',
  },
  {
    label: LABEL_EVENTS_COMMUNITY,
    searchQuery: 'subject:"📅 Just scheduled"',
    filterCriteria: { subject: '📅 Just scheduled' },
    filterName: 'Community Event Announcements',
  },
  {
    label: LABEL_EVENTS_WORKSHOPS,
    searchQuery: 'subject:workshop OR subject:conference OR subject:summit OR subject:webinar',
    filterCriteria: { subject: 'workshop OR conference OR summit OR webinar' },
    filterName: 'Workshop & Conference Events',
  },
  {
    label: LABEL_EVENTS_INVITATIONS,
    searchQuery: 'subject:invitation OR subject:invite OR subject:rsvp',
    filterCriteria: { subject: 'invitation OR invite OR rsvp' },
    filterName: 'Event Invitations',
  },
];

async function organizeEventsSubLabels() {
  const gmail = createGmailClient();

  console.log('ORGANIZING EVENTS BY SUB-LABEL\n');
  console.log('═'.repeat(80));
  console.log('\n1. APPLYING SUB-LABELS TO EXISTING EMAILS\n');

  const labelCache = await buildLabelCache(gmail);

  const categories = EVENT_CATEGORIES
    .map(c => ({ ...c, labelId: labelCache.get(c.label) }))
    .filter(c => c.labelId);

  let totalLabeled = 0;
  for (const category of categories) {
    const count = await searchAndModify(gmail, category.searchQuery, { addLabelIds: [category.labelId] }, 100).catch(error => {
      console.log(`  Error with ${category.label}: ${error.message}`);
      return 0;
    });
    if (count === 0) console.log(`  No emails found for: ${category.label}`);
    else console.log(`  ${category.label}: ${count} emails`);
    totalLabeled += count;
  }

  console.log(`\n  Total labeled: ${totalLabeled} emails\n`);
  console.log('═'.repeat(80));
  console.log('\n2. CREATING AUTO-LABEL FILTERS\n');

  let filtersCreated = 0;
  for (const category of categories) {
    const filterId = await createGmailFilter(gmail, category.filterCriteria, { addLabelIds: [category.labelId] });
    if (filterId) {
      console.log(`  Filter created: ${category.filterName}`);
      filtersCreated++;
    } else {
      console.log(`  Filter already exists: ${category.filterName}`);
    }
  }

  console.log('═'.repeat(80));
  console.log('\nEVENT SUB-LABELS ORGANIZATION COMPLETE\n');
  console.log(`  Emails labeled: ${totalLabeled}`);
  console.log(`  Filters created: ${filtersCreated}`);
}

organizeEventsSubLabels().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
