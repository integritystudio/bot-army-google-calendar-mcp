import { createGmailClient } from './lib/gmail-client.mjs';

const NEWSLETTER_LABEL_ID = 'Label_3733692735004912601';

async function organizeNewsletters() {
  const gmail = createGmailClient();

  console.log('📧 ORGANIZING NEWSLETTERS\n');
  console.log('═'.repeat(80));

  // Step 1: Find and label existing newsletters
  console.log('\n1️⃣  APPLYING LABEL TO EXISTING NEWSLETTERS\n');

  const newsletterPatterns = [
    'from:news@alphasignal.ai',
    'from:noreply@email.openai.com',
    'from:hello@adapty.io',
    'from:info@email.meetup.com',
    'from:googlecloud@google.com',
    'from:communications@yodlee.com',
    'from:updates-noreply@linkedin.com',
    'from:noreply@notifications.hubspot.com',
    'from:support@substack.com',
    'subject:newsletter OR subject:digest OR subject:weekly OR subject:monthly',
    'label:Promotions',
  ];

  let totalLabeled = 0;

  for (const query of newsletterPatterns) {
    try {
      const searchResult = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
      });

      if (!searchResult.data.messages) continue;

      const messageIds = searchResult.data.messages.map(m => m.id);
      const count = messageIds.length;

      if (count > 0) {
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: messageIds,
            addLabelIds: [NEWSLETTER_LABEL_ID],
          },
        });

        console.log(`  ✅ Applied to ${count} emails matching: "${query}"`);
        totalLabeled += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error processing "${query}": ${error.message}`);
    }
  }

  console.log(`\n  📊 Total labeled: ${totalLabeled} emails\n`);

  // Step 2: Create filter for future newsletters
  console.log('═'.repeat(80));
  console.log('\n2️⃣  CREATING AUTO-LABEL FILTER FOR FUTURE NEWSLETTERS\n');

  const filters = [
    {
      name: 'AlphaSignal News',
      criteria: { from: 'news@alphasignal.ai' },
      action: { addLabelIds: [NEWSLETTER_LABEL_ID], archive: false }
    },
    {
      name: 'OpenAI Newsletter',
      criteria: { from: 'noreply@email.openai.com' },
      action: { addLabelIds: [NEWSLETTER_LABEL_ID], archive: false }
    },
    {
      name: 'Adapty Updates',
      criteria: { from: 'hello@adapty.io' },
      action: { addLabelIds: [NEWSLETTER_LABEL_ID], archive: false }
    },
    {
      name: 'Meetup Notifications',
      criteria: { from: 'info@email.meetup.com' },
      action: { addLabelIds: [NEWSLETTER_LABEL_ID], archive: false }
    },
    {
      name: 'Google Cloud Updates',
      criteria: { from: 'googlecloud@google.com' },
      action: { addLabelIds: [NEWSLETTER_LABEL_ID], archive: false }
    },
    {
      name: 'Promotional Emails',
      criteria: { query: 'label:Promotions' },
      action: { addLabelIds: [NEWSLETTER_LABEL_ID], archive: false }
    },
  ];

  let filtersCreated = 0;

  for (const filterConfig of filters) {
    try {
      const response = await gmail.users.settings.filters.create({
        userId: 'me',
        requestBody: {
          criteria: filterConfig.criteria,
          action: {
            addLabelIds: filterConfig.action.addLabelIds,
          },
        },
      });

      console.log(`  ✅ Filter created: ${filterConfig.name}`);
      console.log(`     ID: ${response.data.id}\n`);
      filtersCreated++;
    } catch (error) {
      if (error.message.includes('exists')) {
        console.log(`  ℹ️  Filter already exists: ${filterConfig.name}`);
      } else {
        console.log(`  ⚠️  Error creating filter "${filterConfig.name}": ${error.message}`);
      }
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ NEWSLETTER ORGANIZATION COMPLETE\n');
  console.log(`  📌 Labeled existing emails: ${totalLabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log('\n💡 Newsletter emails will now be automatically labeled going forward!');
}

organizeNewsletters().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
