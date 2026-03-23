import { createGmailClient } from './lib/gmail-client.mjs';

async function protectImportantItems() {
  const gmail = createGmailClient();

  console.log('⭐ PROTECTING IMPORTANT ITEMS IN INBOX\n');
  console.log('═'.repeat(80) + '\n');

  // Get or create Keep Important label
  let importantLabelId;
  const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
  const existingLabel = labelsResponse.data.labels.find(l => l.name === 'Keep Important');

  if (existingLabel) {
    importantLabelId = existingLabel.id;
    console.log('✅ Using existing label: Keep Important\n');
  } else {
    const createLabelResponse = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: 'Keep Important',
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      }
    });
    importantLabelId = createLabelResponse.data.id;
    console.log('✅ Created label: Keep Important\n');
  }

  const importantFilters = [
    {
      name: 'Cloudflare Alerts',
      query: 'from:noreply@notify.cloudflare.com'
    },
    {
      name: 'Calendly Refunds & Support',
      query: 'from:(support@calendly.zendesk.com OR invoice+statements@calendly.com) OR subject:(refund OR "Added to a team")'
    },
    {
      name: 'Investment Banking Meetings',
      query: 'from:notification@calendly.com subject:"Introductory Meeting"'
    },
    {
      name: 'Capital City Village Services',
      query: 'from:(capitalcity@a.helpfulvillage.com OR info@capitalcityvillage.org)'
    }
  ];

  console.log('STEP 1: Creating filters to keep important items in inbox\n');

  for (const config of importantFilters) {
    try {
      await gmail.users.settings.filters.create({
        userId: 'me',
        requestBody: {
          criteria: {
            query: config.query
          },
          action: {
            addLabelIds: [importantLabelId]
            // Note: NOT removing INBOX label - this keeps them visible
          }
        }
      });
      console.log(`  ✅ ${config.name}`);
      console.log(`     Query: ${config.query}\n`);
    } catch (error) {
      console.log(`  ⚠️  ${config.name}: ${error.message}\n`);
    }
  }

  console.log('STEP 2: Labeling existing important emails\n');

  // Apply Important label to existing items
  const queries = [
    'from:noreply@notify.cloudflare.com',
    'from:(support@calendly.zendesk.com OR invoice+statements@calendly.com) OR subject:(refund OR "Added to a team")',
    'from:notification@calendly.com subject:"Introductory Meeting"',
    'from:(capitalcity@a.helpfulvillage.com OR info@capitalcityvillage.org)'
  ];

  let totalLabeled = 0;

  for (const query of queries) {
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100
    });

    const messageIds = searchResponse.data.messages || [];
    if (messageIds.length === 0) continue;

    // Apply label in batches
    const batchSize = 50;
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: batch.map(m => m.id),
          addLabelIds: [importantLabelId]
        }
      });
    }

    totalLabeled += messageIds.length;
  }

  console.log(`  ✅ Labeled ${totalLabeled} important emails\n`);

  console.log('═'.repeat(80));
  console.log('COMPLETE\n');
  console.log('Protected items (will stay in inbox):');
  console.log('  • Cloudflare alerts (action required)');
  console.log('  • Calendly refunds & support');
  console.log('  • Investment Banking meeting reminders');
  console.log('  • Capital City Village service requests\n');
  console.log('All labeled with: Keep Important ⭐\n');
  console.log('═'.repeat(80) + '\n');
}

protectImportantItems().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
