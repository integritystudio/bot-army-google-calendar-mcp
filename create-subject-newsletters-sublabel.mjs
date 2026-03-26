import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';
import { buildLabelCache, createLabels, applyPatterns } from './lib/gmail-label-utils.mjs';

async function createSubjectNewslettersSubLabel() {
  const gmail = createGmailClient();

  console.log('📂 CREATING NEWSLETTERS SUB-LABEL\n');
  console.log('═'.repeat(80) + '\n');

  // Pre-fetch existing labels to avoid N+1 queries
  const existingLabelMap = await buildLabelCache(gmail);

  console.log('1️⃣  CREATING LABEL: Newsletters/Subject-Based\n');

  const labelIds = {};
  await createLabels(gmail, ['Newsletters/Subject-Based'], labelIds, existingLabelMap);

  const subLabelId = labelIds['Newsletters/Subject-Based'];

  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING LABEL TO EXISTING EMAILS\n');

  const subjectPatterns = [
    { label: 'Newsletters/Subject-Based', query: 'subject:newsletter OR subject:digest OR subject:weekly OR subject:monthly' },
    { label: 'Newsletters/Subject-Based', query: 'subject:"weekly update" OR subject:"monthly update" OR subject:"weekly digest"' },
  ];

  const totalLabeled = await applyPatterns(gmail, subjectPatterns, labelIds);

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTER\n');

  try {
    const response = await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: {
        criteria: {
          subject: 'newsletter OR digest OR weekly OR monthly',
        },
        action: {
          addLabelIds: [subLabelId],
        },
      },
    });

    console.log('✅ Filter created successfully!');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Criteria: Subject contains "newsletter", "digest", "weekly", or "monthly"`);
    console.log(`   Action: Apply label "Newsletters/Subject-Based"\n`);

  } catch (error) {
    if (error.message.includes('exists')) {
      console.log('⚠️  Filter already exists\n');
    } else {
      console.log(`⚠️  Error creating filter: ${error.message}\n`);
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ SUBJECT-BASED NEWSLETTER SUB-LABEL COMPLETE\n');
  console.log(`  📌 Emails labeled: ${totalLabeled}`);
  console.log(`  📂 Label: Newsletters/Subject-Based (${subLabelId})`);
  console.log('\n📂 Updated Newsletter Label hierarchy:');
  console.log('   Newsletters');
  console.log('   └── Subject-Based\n');
}

createSubjectNewslettersSubLabel().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
