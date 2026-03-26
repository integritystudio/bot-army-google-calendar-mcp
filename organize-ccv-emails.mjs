import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, LABEL_CCV, LABEL_NEWSLETTERS_CCV } from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';

async function organizeCCVEmails() {
  const gmail = createGmailClient();

  console.log('📂 ORGANIZING CCV EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  console.log('1️⃣  CREATING LABEL: CCV (Organization)\n');

  const labelCache = await buildLabelCache(gmail);
  let ccvOrgLabelId = labelCache.get(LABEL_CCV);

  if (ccvOrgLabelId) {
    console.log('✅ Using existing label: CCV\n');
    console.log(`   ID: ${ccvOrgLabelId}\n`);
  } else {
    try {
      const response = await gmail.users.labels.create({
        userId: USER_ID,
        requestBody: {
          name: LABEL_CCV,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });
      console.log('✅ Label created successfully!');
      console.log(`   Name: ${response.data.name}`);
      console.log(`   ID: ${response.data.id}\n`);
      ccvOrgLabelId = response.data.id;
    } catch (error) {
      console.error('❌ Error creating label:', error.message);
      process.exit(1);
    }
  }

  console.log('═'.repeat(80));
  console.log('\n2️⃣  MOVING MEETING COORDINATION FROM NEWSLETTERS TO CCV\n');

  const meetingPatterns = [
    'subject:"BYOG" OR subject:"Annual Meeting"',
    'subject:"PROGRAM COMM MEETING"',
    'subject:"CCV" AND (subject:meeting OR subject:program OR subject:poll)',
  ];

  const newsletterLabelId = labelCache.get(LABEL_NEWSLETTERS_CCV);
  let meetingEmailsMoved = 0;

  for (const query of meetingPatterns) {
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
            addLabelIds: [ccvOrgLabelId],
            removeLabelIds: [newsletterLabelId],
          },
        });

        console.log(`  ✅ Moved ${count} emails matching: "${query.substring(0, 50)}..."`);
        console.log(`     Added: CCV (Organization)`);
        console.log(`     Removed: Newsletters/CCV\n`);
        meetingEmailsMoved += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error with "${query}": ${error.message}`);
    }
  }

  console.log(`  📊 Total moved: ${meetingEmailsMoved} emails\n`);

  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTERS\n');

  const filters = [
    {
      name: 'CCV Meeting Announcements',
      criteria: { subject: 'PROGRAM COMM MEETING OR CCV Annual Meeting OR BYOG' },
    },
    {
      name: 'CCV Organization Emails',
      criteria: { from: 'CCV@' },
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
            addLabelIds: [ccvOrgLabelId],
          },
        },
      });

      console.log(`  ✅ Filter created: ${filter.name}`);
      console.log(`     ID: ${response.data.id}\n`);
      filtersCreated++;
    } catch (error) {
      if (error.message.includes('exists')) {
        console.log(`  ℹ️  Filter already exists: ${filter.name}`);
      } else {
        console.log(`  ⚠️  Error creating filter "${filter.name}": ${error.message}`);
      }
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ CCV EMAIL ORGANIZATION COMPLETE\n');
  console.log(`  📌 Meeting coordination emails moved: ${meetingEmailsMoved}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log(`  📂 Labels:`);
  console.log(`     - CCV (Organization) - ${ccvOrgLabelId}`);
  console.log(`     - Newsletters/CCV (Monthly newsletters only)`);
  console.log('\n📂 New Organization:\n');
  console.log('   CCV (Organization Emails)');
  console.log('   ├── Meeting Announcements');
  console.log('   ├── Community Engagement');
  console.log('   └── Organization Updates\n');
  console.log('   Newsletters');
  console.log('   └── CCV (Monthly Newsletters)\n');
}

organizeCCVEmails().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
