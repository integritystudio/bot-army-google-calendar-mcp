import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';
import { buildLabelCache, createLabels, applyPatterns } from './lib/gmail-label-utils.mjs';

async function createCCVNewsletterSubLabel() {
  const gmail = createGmailClient();

  console.log('📂 CREATING CCV NEWSLETTER SUB-LABEL\n');
  console.log('═'.repeat(80) + '\n');

  // Pre-fetch existing labels to avoid N+1 queries
  const existingLabelMap = await buildLabelCache(gmail);

  // Step 1: Create sub-label
  console.log('1️⃣  CREATING LABEL: Newsletters/CCV\n');

  const labelIds = {};
  await createLabels(gmail, ['Newsletters/CCV'], labelIds, existingLabelMap);

  const subLabelId = labelIds['Newsletters/CCV'];

  // Step 2: Apply label to existing CCV newsletter emails
  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING LABEL TO EXISTING EMAILS\n');

  const ccvPatterns = [
    { label: 'Newsletters/CCV', query: 'subject:CCV OR subject:"CCV Newsletter"' },
    { label: 'Newsletters/CCV', query: 'from:ccv@ OR from:newsletter@ccv' },
  ];

  const totalLabeled = await applyPatterns(gmail, ccvPatterns, labelIds);

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  // Step 3: Create filter for future CCV newsletter emails
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTER\n');

  try {
    const response = await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: {
        criteria: {
          subject: 'CCV OR "CCV Newsletter"',
        },
        action: {
          addLabelIds: [subLabelId],
        },
      },
    });

    console.log('✅ Filter created successfully!');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Criteria: Subject contains "CCV" or "CCV Newsletter"`);
    console.log(`   Action: Apply label "Newsletters/CCV"\n`);

  } catch (error) {
    if (error.message.includes('exists')) {
      console.log('⚠️  Filter already exists\n');
    } else {
      console.log(`⚠️  Error creating filter: ${error.message}\n`);
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ CCV NEWSLETTER SUB-LABEL COMPLETE\n');
  console.log(`  📌 Emails labeled: ${totalLabeled}`);
  console.log(`  📂 Label: Newsletters/CCV (${subLabelId})`);
  console.log('\n📂 Updated Newsletter Label hierarchy:');
  console.log('   Newsletters');
  console.log('   ├── Company');
  console.log('   ├── News Aggregates');
  console.log('   ├── Social');
  console.log('   ├── Subject-Based');
  console.log('   └── CCV (NEW)\n');
}

createCCVNewsletterSubLabel().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
