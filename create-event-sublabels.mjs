import { createGmailClient } from './lib/gmail-client.mjs';


import { USER_ID } from './lib/constants.mjs';
import { createLabels, applyPatterns } from './lib/gmail-label-utils.mjs';


async function createEventSubLabels() {
  const gmail = createGmailClient();

  const subLabels = [
    'Events/Meetup',
    'Events/Calendly',
    'Events/Community',
    'Events/Workshops',
    'Events/Invitations',
  ];

  console.log('📂 CREATING EVENT SUB-LABELS\n');
  console.log('═'.repeat(80) + '\n');

  const existingLabelsRes = await gmail.users.labels.list({ userId: USER_ID, fields: 'labels(id,name)' });
  const existingLabelMap = new Map(
    existingLabelsRes.data.labels.map(l => [l.name, l.id])
  );

  const labelIds = {};

  await createLabels(gmail, subLabels, labelIds, existingLabelMap);

  console.log('═'.repeat(80));
  console.log('\n📋 SUB-LABEL MAPPING\n');

  const mapping = [
    { category: 'Meetup Event Notifications', subLabel: 'Events/Meetup', from: 'info@email.meetup.com' },
    { category: 'Calendly Team Events', subLabel: 'Events/Calendly', from: 'teamcalendly@send.calendly.com' },
    { category: 'Community Event Notifications', subLabel: 'Events/Community', subject: '"📅 Just scheduled"' },
    { category: 'Workshop & Conference Announcements', subLabel: 'Events/Workshops', subject: 'workshop OR conference OR summit' },
    { category: 'Event Invitations', subLabel: 'Events/Invitations', subject: 'invitation OR invite OR rsvp' },
  ];

  for (const item of mapping) {
    const criteria = item.from ? `from: ${item.from}` : `subject: ${item.subject}`;
    console.log(`📌 ${item.category}`);
    console.log(`   Label: ${item.subLabel}`);
    console.log(`   Criteria: ${criteria}`);
    console.log(`   ID: ${labelIds[item.subLabel] || 'Not created'}\n`);
  }

  console.log('═'.repeat(80));
  console.log('\n✨ SUB-LABELS CREATED\n');
  console.log('To apply these sub-labels to existing emails and create filters,');
  console.log('run: node organize-events-sublabels.mjs\n');
}

createEventSubLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
