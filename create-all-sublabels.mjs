import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';
import { createLabels, applyPatterns } from './lib/gmail-label-utils.mjs';

async function createAllSubLabels() {
  const gmail = createGmailClient();

  console.log('📂 CREATING COMPREHENSIVE SUB-LABELS\n');
  console.log('═'.repeat(80) + '\n');

  const existingLabelsRes = await gmail.users.labels.list({ userId: USER_ID, fields: 'labels(id,name)' });
  const existingLabelMap = new Map(
    existingLabelsRes.data.labels.map(l => [l.name, l.id])
  );

  const labelIds = {};

  console.log('1️⃣  CREATING WORKSHOP SUB-LABELS\n');
  await createLabels(
    gmail,
    [
      'Events/Workshops/Technical/AI-ML',
      'Events/Workshops/Professional Development',
      'Events/Workshops/Healthcare/Medical',
      'Events/Workshops/Creative/Arts',
      'Events/Workshops/Business/Leadership',
    ],
    labelIds,
    existingLabelMap
  );
  console.log();

  console.log('2️⃣  CREATING COMMUNITY SERVICES SUB-LABELS\n');
  await createLabels(
    gmail,
    [
      'Events/Invitations/Community Services/Capital City Village',
      'Events/Invitations/Community Services/Social Events',
      'Events/Invitations/Community Services/Volunteer',
    ],
    labelIds,
    existingLabelMap
  );
  console.log();

  console.log('═'.repeat(80));
  console.log('\n3️⃣  APPLYING WORKSHOP SUB-LABELS\n');
  const workshopsLabeled = await applyPatterns(
    gmail,
    [
      {
        label: 'Events/Workshops/Technical/AI-ML',
        query: 'label:Label_5 AND (subject:"computer vision" OR subject:ai OR subject:"machine learning" OR subject:coding)',
      },
      {
        label: 'Events/Workshops/Professional Development',
        query: 'label:Label_5 AND (subject:"validating world models" OR subject:"video datasets")',
      },
      {
        label: 'Events/Workshops/Healthcare/Medical',
        query: 'label:Label_5 AND (subject:"home care" OR subject:healthcare OR subject:medical)',
      },
      {
        label: 'Events/Workshops/Creative/Arts',
        query: 'label:Label_5 AND (subject:"god-given" OR subject:"operational excellence")',
      },
      {
        label: 'Events/Workshops/Business/Leadership',
        query: 'label:Label_5 AND (subject:"business plan")',
      },
    ],
    labelIds
  );
  console.log(`\n  Total workshops labeled: ${workshopsLabeled}\n`);

  console.log('═'.repeat(80));
  console.log('\n4️⃣  APPLYING COMMUNITY SERVICES SUB-LABELS\n');
  const communityLabeled = await applyPatterns(
    gmail,
    [
      {
        label: 'Events/Invitations/Community Services/Capital City Village',
        query: 'label:Label_18 AND (from:capitalcityvillage OR from:capitalcity)',
      },
      {
        label: 'Events/Invitations/Community Services/Social Events',
        query: 'label:Label_18 AND (subject:"let\'s do lunch" OR subject:"game night" OR subject:"gathering")',
      },
      {
        label: 'Events/Invitations/Community Services/Volunteer',
        query: 'label:Label_18 AND (subject:volunteer OR subject:opportunity)',
      },
    ],
    labelIds
  );
  console.log(`\n  Total community services labeled: ${communityLabeled}\n`);

  console.log('═'.repeat(80));
  console.log('\n✨ SUB-LABEL CREATION COMPLETE\n');
  console.log('📂 NEW LABEL HIERARCHIES:\n');
  console.log('   Events/Workshops');
  console.log('   ├── Technical/AI-ML');
  console.log('   ├── Professional Development');
  console.log('   ├── Healthcare/Medical');
  console.log('   ├── Creative/Arts');
  console.log('   └── Business/Leadership\n');
  console.log('   Events/Invitations/Community Services');
  console.log('   ├── Capital City Village');
  console.log('   ├── Social Events');
  console.log('   └── Volunteer\n');
}

createAllSubLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
