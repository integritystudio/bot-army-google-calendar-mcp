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
        console.error(`❌ Error: ${labelName}: ${error.message}\n`);
      }
    }
  }
}

async function applyPatterns(gmail, patterns, labelIds) {
  let totalLabeled = 0;

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
        totalLabeled += count;
      }
    } catch (error) {
      console.error(`  ❌ Failed ${pattern.label}: ${error.message}`);
    }
  }

  return totalLabeled;
}

async function createInvitationsSubLabels() {
  const gmail = createGmailClient();

  console.log('📂 CREATING EVENTS/INVITATIONS SUB-LABELS\n');
  console.log('═'.repeat(80) + '\n');

  const existingLabelsRes = await gmail.users.labels.list({ userId: USER_ID, fields: 'labels(id,name)' });
  const existingLabelMap = new Map(
    existingLabelsRes.data.labels.map(l => [l.name, l.id])
  );

  // Step 1: Create sub-labels
  console.log('1️⃣  CREATING SUB-LABELS\n');

  const subLabels = [
    'Events/Invitations/Professional',
    'Events/Invitations/Work',
    'Events/Invitations/Conferences',
    'Events/Invitations/Community Services',
  ];

  const labelIds = {};

  await createLabels(gmail, subLabels, labelIds, existingLabelMap);

  // Step 2: Apply sub-labels to existing emails
  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING SUB-LABELS TO EXISTING EMAILS\n');

  const invitationPatterns = [
    {
      label: 'Events/Invitations/Professional',
      query: 'from:notifications-noreply@linkedin.com OR from:linkedin.com subject:event OR subject:invitation',
    },
    {
      label: 'Events/Invitations/Work',
      query: 'subject:invitation AND (from:integritystudio OR from:@gmail.com OR from:@company)',
    },
    {
      label: 'Events/Invitations/Conferences',
      query: 'subject:SXSW OR subject:conference OR subject:summit OR subject:festival',
    },
    {
      label: 'Events/Invitations/Community Services',
      query: 'from:capitalcityvillage OR from:village.org OR subject:"Capital City"',
    },
  ];

  const totalLabeled = await applyPatterns(gmail, invitationPatterns, labelIds);

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  // Step 3: Create filters
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTERS\n');

  const filters = [
    {
      name: 'LinkedIn Professional Events',
      criteria: { from: 'notifications-noreply@linkedin.com' },
      labelId: labelIds['Events/Invitations/Professional'],
    },
    {
      name: 'Work Meeting Invitations',
      criteria: { subject: 'invitation OR invite OR rsvp' },
      labelId: labelIds['Events/Invitations/Work'],
    },
    {
      name: 'Conference & Festival Invites',
      criteria: { subject: 'SXSW OR conference OR summit OR festival' },
      labelId: labelIds['Events/Invitations/Conferences'],
    },
    {
      name: 'Community Service Invitations',
      criteria: { from: 'capitalcityvillage OR village.org' },
      labelId: labelIds['Events/Invitations/Community Services'],
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
  console.log('\n✨ INVITATIONS SUB-LABELS COMPLETE\n');
  console.log(`  📌 Emails labeled: ${totalLabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log('\n📂 Updated Events/Invitations Hierarchy:\n');
  console.log('   Events/Invitations');
  console.log('   ├── Professional (LinkedIn events & conferences)');
  console.log('   ├── Work (Colleague meeting invitations)');
  console.log('   ├── Conferences (SXSW, festivals, summits)');
  console.log('   └── Community Services (Capital City Village, etc.)\n');
}

createInvitationsSubLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
