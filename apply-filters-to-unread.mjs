import { createGmailClient } from './lib/gmail-client.mjs';
import {
  USER_ID,
  GMAIL_INBOX,
  LABEL_PRODUCT_UPDATES,
  LABEL_MEETUP_EVENTS,
  LABEL_COMMUNITY_EVENTS,
  LABEL_CALENDLY_NOTIFICATIONS,
  LABEL_LINKEDIN_UPDATES,
  LABEL_DMARC_REPORTS
} from './lib/constants.mjs';

async function applyFiltersToUnread() {
  const gmail = createGmailClient();

  console.log('📧 APPLYING FILTERS TO EXISTING UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
  const labelMap = {};
  (labelsResponse.data.labels || []).forEach(label => {
    labelMap[label.name] = label.id;
  });

  const filterConfigs = [
    {
      name: LABEL_MEETUP_EVENTS,
      query: 'is:unread from:info@email.meetup.com'
    },
    {
      name: LABEL_COMMUNITY_EVENTS,
      query: 'is:unread from:("ATX - Awkwardly Zen" OR "Austin Cafe Drawing Group" OR "Austin Robotics & AI")'
    },
    {
      name: LABEL_PRODUCT_UPDATES,
      query: 'is:unread from:(noreply@email.openai.com OR no-reply@email.claude.com OR googlecloud@google.com OR "AlphaSignal" OR lukak@storylane.io)'
    },
    {
      name: LABEL_CALENDLY_NOTIFICATIONS,
      query: 'is:unread from:teamcalendly@send.calendly.com'
    },
    {
      name: LABEL_LINKEDIN_UPDATES,
      query: 'is:unread from:updates-noreply@linkedin.com'
    },
    {
      name: LABEL_DMARC_REPORTS,
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
      const searchResponse = await gmail.users.messages.list({
        userId: USER_ID,
        q: config.query,
        maxResults: 500
      });

      const messageIds = searchResponse.data.messages || [];
      console.log(`${config.name}: ${messageIds.length} emails`);

      if (messageIds.length === 0) {
        console.log('  (none to process)\n');
        continue;
      }

      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [labelId],
            removeLabelIds: [GMAIL_INBOX]
          }
        });

        const processed = i + batch.length;
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
