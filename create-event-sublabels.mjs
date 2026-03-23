import { createGmailClient } from './lib/gmail-client.mjs';

const USER_ID = 'me';

async function createLabels(gmail, labelNames, labelIds, existingLabelMap) {
  for (const labelName of labelNames) {
    try {
      const response = await gmail.users.labels.create({
        userId: USER_ID,
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
        const existingId = existingLabelMap.get(labelName);
        if (existingId) {
          console.log(`   ID: ${existingId}\n`);
          labelIds[labelName] = existingId;
        }
      } else {
        console.error(`❌ Error creating ${labelName}: ${error.message}\n`);
      }
    }
  }
}

async function applyPatterns(gmail, patterns, labelIds) {
  for (const pattern of patterns) {
    try {
      const searchResult = await gmail.users.messages.list({
        userId: USER_ID,
        q: pattern.query,
        maxResults: 100,
      });

      if (!searchResult.data.messages) continue;

      const messageIds = searchResult.data.messages.map(m => m.id);
      const count = messageIds.length;

      if (count > 0) {
        const labelId = labelIds[pattern.label];
        if (!labelId) {
          console.error(`  ❌ No label ID resolved for ${pattern.label}, skipping`);
          continue;
        }

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: messageIds,
            addLabelIds: [labelId],
          },
        });

        console.log(`  ✅ ${pattern.label}: ${count} emails`);
      }
    } catch (error) {
      console.error(`  ❌ Failed ${pattern.label}: ${error.message}`);
    }
  }
}

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
