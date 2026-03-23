import { createGmailClient } from './lib/gmail-client.mjs';

const USER_ID = 'me';

async function createSubjectNewslettersSubLabel() {
  const gmail = createGmailClient();

  console.log('📂 CREATING NEWSLETTERS SUB-LABEL\n');
  console.log('═'.repeat(80) + '\n');

  // Pre-fetch existing labels to avoid N+1 queries
  const existingLabelsRes = await gmail.users.labels.list({ userId: USER_ID, fields: 'labels(id,name)' });
  const existingLabelMap = new Map(
    existingLabelsRes.data.labels.map(l => [l.name, l.id])
  );

  // Step 1: Create sub-label
  console.log('1️⃣  CREATING LABEL: Newsletters/Subject-Based\n');

  let subLabelId;

  try {
    const response = await gmail.users.labels.create({
      userId: USER_ID,
      requestBody: {
        name: 'Newsletters/Subject-Based',
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });

    console.log('✅ Label created successfully!');
    console.log(`   Name: ${response.data.name}`);
    console.log(`   ID: ${response.data.id}\n`);
    subLabelId = response.data.id;

  } catch (error) {
    if (error.message.includes('exists') || error.message.includes('conflicts')) {
      console.log('⚠️  Label already exists: Newsletters/Subject-Based\n');
      // Use pre-fetched existing labels
      const existingId = existingLabelMap.get('Newsletters/Subject-Based');
      if (existingId) {
        console.log(`   ID: ${existingId}\n`);
        subLabelId = existingId;
      }
    } else {
      console.error('❌ Error creating label:', error.message);
      process.exit(1);
    }
  }

  // Step 2: Apply label to existing subject-based newsletter emails
  console.log('═'.repeat(80));
  console.log('\n2️⃣  APPLYING LABEL TO EXISTING EMAILS\n');

  const subjectPatterns = [
    'subject:newsletter OR subject:digest OR subject:weekly OR subject:monthly',
    'subject:"weekly update" OR subject:"monthly update" OR subject:"weekly digest"',
  ];

  let totalLabeled = 0;
  const processedQueries = new Set();

  for (const query of subjectPatterns) {
    if (processedQueries.has(query)) continue;
    processedQueries.add(query);

    try {
      const searchResult = await gmail.users.messages.list({
        userId: USER_ID,
        q: query,
        maxResults: 100,
      });

      if (!searchResult.data.messages) continue;

      const messageIds = searchResult.data.messages.map(m => m.id);
      const count = messageIds.length;

      if (count > 0) {
        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: messageIds,
            addLabelIds: [subLabelId],
          },
        });

        console.log(`  ✅ Applied to ${count} emails matching: "${query}"`);
        totalLabeled += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error with "${query}": ${error.message}`);
    }
  }

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  // Step 3: Create filter for future subject-based newsletters
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
