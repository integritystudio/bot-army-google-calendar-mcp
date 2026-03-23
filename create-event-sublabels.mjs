import { createGmailClient } from './lib/gmail-client.mjs';

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
        // Fetch existing label ID
        const labels = await gmail.users.labels.list({ userId: 'me' });
        const existing = labels.data.labels.find(l => l.name === labelName);
        if (existing) {
          console.log(`   ID: ${existing.id}\n`);
          labelIds[labelName] = existing.id;
        }
      } else {
        console.log(`❌ Error creating ${labelName}: ${error.message}\n`);
      }
    }
  }

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
