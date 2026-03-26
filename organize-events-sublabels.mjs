import { createGmailClient } from './lib/gmail-client.mjs';
import { LABEL_EVENTS_MEETUP, LABEL_EVENTS_CALENDLY, LABEL_EVENTS_COMMUNITY, LABEL_EVENTS_WORKSHOPS, LABEL_EVENTS_INVITATIONS } from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

async function organizeEventsSubLabels() {
  const gmail = createGmailClient();

  console.log('📂 ORGANIZING EVENTS BY SUB-LABEL\n');
  console.log('═'.repeat(80));

  console.log('\n1️⃣  APPLYING SUB-LABELS TO EXISTING EMAILS\n');

  const labelCache = await buildLabelCache(gmail);
  const subLabels = {
    [LABEL_EVENTS_MEETUP]: labelCache.get(LABEL_EVENTS_MEETUP),
    [LABEL_EVENTS_CALENDLY]: labelCache.get(LABEL_EVENTS_CALENDLY),
    [LABEL_EVENTS_COMMUNITY]: labelCache.get(LABEL_EVENTS_COMMUNITY),
    [LABEL_EVENTS_WORKSHOPS]: labelCache.get(LABEL_EVENTS_WORKSHOPS),
    [LABEL_EVENTS_INVITATIONS]: labelCache.get(LABEL_EVENTS_INVITATIONS),
  };

  const eventCategories = [
    {
      label: LABEL_EVENTS_MEETUP,
      labelId: subLabels[LABEL_EVENTS_MEETUP],
      query: 'from:info@email.meetup.com',
    },
    {
      label: LABEL_EVENTS_CALENDLY,
      labelId: subLabels[LABEL_EVENTS_CALENDLY],
      query: 'from:teamcalendly@send.calendly.com OR from:support@calendly.zendesk.com',
    },
    {
      label: LABEL_EVENTS_COMMUNITY,
      labelId: subLabels[LABEL_EVENTS_COMMUNITY],
      query: 'subject:"📅 Just scheduled"',
    },
    {
      label: LABEL_EVENTS_WORKSHOPS,
      labelId: subLabels[LABEL_EVENTS_WORKSHOPS],
      query: 'subject:workshop OR subject:conference OR subject:summit OR subject:webinar',
    },
    {
      label: LABEL_EVENTS_INVITATIONS,
      labelId: subLabels[LABEL_EVENTS_INVITATIONS],
      query: 'subject:invitation OR subject:invite OR subject:rsvp',
    },
  ].filter(c => c.labelId);

  let totalLabeled = 0;

  for (const category of eventCategories) {
    try {
      const count = await searchAndModify(gmail, category.query, { addLabelIds: [category.labelId] }, 100);
      if (count === 0) console.log(`  ℹ️  No emails found for: ${category.label}`);
      else console.log(`  ✅ ${category.label}: ${count} emails`);
      totalLabeled += count;
    } catch (error) {
      console.log(`  ⚠️  Error with ${category.label}: ${error.message}`);
    }
  }

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  console.log('═'.repeat(80));
  console.log('\n2️⃣  CREATING AUTO-LABEL FILTERS\n');

  const filters = [
    {
      name: 'Meetup Events',
      criteria: { from: 'info@email.meetup.com' },
      labelId: subLabels[LABEL_EVENTS_MEETUP],
    },
    {
      name: 'Calendly Events',
      criteria: { from: 'teamcalendly@send.calendly.com' },
      labelId: subLabels[LABEL_EVENTS_CALENDLY],
    },
    {
      name: 'Community Event Announcements',
      criteria: { subject: '📅 Just scheduled' },
      labelId: subLabels[LABEL_EVENTS_COMMUNITY],
    },
    {
      name: 'Workshop & Conference Events',
      criteria: { subject: 'workshop OR conference OR summit OR webinar' },
      labelId: subLabels[LABEL_EVENTS_WORKSHOPS],
    },
    {
      name: 'Event Invitations',
      criteria: { subject: 'invitation OR invite OR rsvp' },
      labelId: subLabels[LABEL_EVENTS_INVITATIONS],
    },
  ].filter(f => f.labelId);

  let filtersCreated = 0;

  for (const filter of filters) {
    try {
      const response = await gmail.users.settings.filters.create({
        userId: USER_ID,
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
