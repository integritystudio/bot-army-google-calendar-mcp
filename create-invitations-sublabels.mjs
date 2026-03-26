import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';
import { createLabels, applyPatterns } from './lib/gmail-label-utils.mjs';

async function createInvitationsSubLabels() {
  const gmail = createGmailClient();

  console.log('📂 CREATING EVENTS/INVITATIONS SUB-LABELS\n');
  console.log('═'.repeat(80) + '\n');

  const existingLabelsRes = await gmail.users.labels.list({ userId: USER_ID, fields: 'labels(id,name)' });
  const existingLabelMap = new Map(
    existingLabelsRes.data.labels.map(l => [l.name, l.id])
  );

  console.log('1️⃣  CREATING SUB-LABELS\n');

  const subLabels = [
    'Events/Invitations/Professional',
    'Events/Invitations/Work',
    'Events/Invitations/Conferences',
    'Events/Invitations/Community Services',
  ];

  const labelIds = {};

  await createLabels(gmail, subLabels, labelIds, existingLabelMap);

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
