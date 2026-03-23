import { createGmailClient } from './lib/gmail-client.mjs';

async function applyFiltersToUnread() {
  const gmail = createGmailClient();

  console.log('📧 APPLYING FILTERS TO EXISTING UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  // Get all labels first
  const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
  const labelMap = {};
  labelsResponse.data.labels.forEach(label => {
    labelMap[label.name] = label.id;
  });

  const filterConfigs = [
    {
      name: 'Meetup Events',
      query: 'is:unread from:info@email.meetup.com'
    },
    {
      name: 'Community Events',
      query: 'is:unread from:("ATX - Awkwardly Zen" OR "Austin Cafe Drawing Group" OR "Austin Robotics & AI")'
    },
    {
      name: 'Product Updates',
      query: 'is:unread from:(noreply@email.openai.com OR no-reply@email.claude.com OR googlecloud@google.com OR "AlphaSignal" OR lukak@storylane.io)'
    },
    {
      name: 'Calendly Notifications',
      query: 'is:unread from:teamcalendly@send.calendly.com'
    },
    {
      name: 'LinkedIn Updates',
      query: 'is:unread from:updates-noreply@linkedin.com'
    },
    {
      name: 'DMARC Reports',
      query: 'is:unread subject:DMARC'
    }
  ];

  let totalProcessed = 0;

  for (const config of filterConfigs) {
    const labelId = labelMap[config.name];
    if (!labelId) {
      console.log(`⚠️  Label not found for: ${config.name}`);
      continue;
    }

    try {
      // Search for matching unread emails
      const searchResponse = await gmail.users.messages.list({
        userId: 'me',
        q: config.query,
        maxResults: 500
      });

      const messageIds = searchResponse.data.messages || [];
      console.log(`${config.name}: ${messageIds.length} emails`);

      if (messageIds.length === 0) {
        console.log('  (none to process)\n');
        continue;
      }

      // Apply label and archive in batches
      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [labelId],
            removeLabelIds: ['INBOX']
          }
        });

        const processed = Math.min(i + batchSize, messageIds.length);
        console.log(`  ✅ Processed ${processed}/${messageIds.length}`);
      }

      totalProcessed += messageIds.length;
      console.log();

    } catch (error) {
      console.log(`❌ Error processing ${config.name}: ${error.message}\n`);
    }
  }

  console.log('═'.repeat(80));
  console.log('SUMMARY\n');
  console.log(`📊 Total emails labeled & archived: ${totalProcessed}\n`);
  console.log('═'.repeat(80) + '\n');
}

applyFiltersToUnread().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
