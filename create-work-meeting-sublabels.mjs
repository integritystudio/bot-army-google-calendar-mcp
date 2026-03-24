import { createGmailClient } from './lib/gmail-client.mjs';


import { USER_ID } from './lib/constants.mjs';
import { createLabels, applyPatterns } from './lib/gmail-label-utils.mjs';


async function createWorkMeetingSubLabels() {
  const gmail = createGmailClient();

  console.log('📂 CREATING WORK MEETING SUB-LABELS\n');
  console.log('═'.repeat(80) + '\n');

  const existingLabelsRes = await gmail.users.labels.list({ userId: USER_ID, fields: 'labels(id,name)' });
  const existingLabelMap = new Map(
    existingLabelsRes.data.labels.map(l => [l.name, l.id])
  );

  // Step 1: Create sub-labels
  console.log('1️⃣  CREATING SUB-LABELS\n');

  const subLabels = [
    'Events/Invitations/Work/One-on-One',
    'Events/Invitations/Work/Team Syncs',
    'Events/Invitations/Work/Client/External',
    'Events/Invitations/Work/Internal Meetings',
  ];

  const labelIds = {};

  await createLabels(gmail, subLabels, labelIds, existingLabelMap);

  // Step 2: Apply sub-labels to existing emails
  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING SUB-LABELS TO EXISTING EMAILS\n');

  // Resolve parent label ID at runtime instead of hardcoding
  const workParentId = existingLabelMap.get('Events/Invitations/Work');
  if (!workParentId) {
    console.error('❌ Error: Could not find "Events/Invitations/Work" label. Create it first.');
    process.exit(1);
  }

  const workPatterns = [
    {
      label: 'Events/Invitations/Work/One-on-One',
      query: `label:${workParentId} AND (subject:"John" OR subject:"1:1" OR subject:"one-on-one" OR subject:"neighbor client")`,
    },
    {
      label: 'Events/Invitations/Work/Team Syncs',
      query: `label:${workParentId} AND (subject:"Team" OR subject:"Sync" OR subject:"Integrity" OR subject:"Core Team")`,
    },
    {
      label: 'Events/Invitations/Work/Client/External',
      query: `label:${workParentId} AND (subject:client OR subject:external OR subject:partner)`,
    },
    {
      label: 'Events/Invitations/Work/Internal Meetings',
      query: `label:${workParentId} AND (subject:meeting OR subject:workshop OR subject:training OR subject:strategy)`,
    },
  ];

  const totalLabeled = await applyPatterns(gmail, workPatterns, labelIds);

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  // Step 3: Create filters
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTERS\n');

  const filters = [
    {
      name: 'One-on-One Meetings',
      criteria: { subject: '1:1 OR "one-on-one" OR "one on one"' },
      labelId: labelIds['Events/Invitations/Work/One-on-One'],
    },
    {
      name: 'Team Syncs',
      criteria: { subject: 'sync OR "team meeting" OR standup' },
      labelId: labelIds['Events/Invitations/Work/Team Syncs'],
    },
    {
      name: 'Client & External Meetings',
      criteria: { subject: 'client OR external OR partner OR vendor' },
      labelId: labelIds['Events/Invitations/Work/Client/External'],
    },
    {
      name: 'Internal Training & Strategy',
      criteria: { subject: 'workshop OR training OR strategy OR development' },
      labelId: labelIds['Events/Invitations/Work/Internal Meetings'],
    },
  ];

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

      console.log(`  ✅ Filter: ${filter.name}`);
      console.log(`     ID: ${response.data.id}\n`);
      filtersCreated++;
    } catch (error) {
      if (error.message.includes('exists')) {
        console.log(`  ℹ️  Filter exists: ${filter.name}`);
      } else {
        console.error(`  ❌ Error: ${filter.name}: ${error.message}`);
      }
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ WORK MEETING SUB-LABELS COMPLETE\n');
  console.log(`  📌 Emails labeled: ${totalLabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log('\n📂 Updated Events/Invitations/Work Hierarchy:\n');
  console.log('   Events/Invitations/Work');
  console.log('   ├── One-on-One (Individual meetings)');
  console.log('   ├── Team Syncs (Team meetings, standups)');
  console.log('   ├── Client/External (Client and partner meetings)');
  console.log('   └── Internal Meetings (Training, strategy, workshops)\n');
}

createWorkMeetingSubLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
