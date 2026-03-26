import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';
import { ensureLabelExists } from './lib/gmail-filter-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';

const IMPORTANT_FILTERS = [
  {
    name: 'Cloudflare Alerts',
    query: 'from:noreply@notify.cloudflare.com',
  },
  {
    name: 'Calendly Refunds & Support',
    query: 'from:(support@calendly.zendesk.com OR invoice+statements@calendly.com) OR subject:(refund OR "Added to a team")',
  },
  {
    name: 'Investment Banking Meetings',
    query: 'from:notification@calendly.com subject:"Introductory Meeting"',
  },
  {
    name: 'Capital City Village Services',
    query: 'from:(capitalcity@a.helpfulvillage.com OR info@capitalcityvillage.org)',
  },
];

async function protectImportantItems() {
  const gmail = createGmailClient();

  console.log('PROTECTING IMPORTANT ITEMS IN INBOX\n');
  console.log('═'.repeat(80) + '\n');

  const importantLabelId = await ensureLabelExists(gmail, LABEL_KEEP_IMPORTANT);

  console.log('STEP 1: Creating filters to keep important items in inbox\n');

  for (const config of IMPORTANT_FILTERS) {
    try {
      await gmail.users.settings.filters.create({
        userId: USER_ID,
        requestBody: {
          criteria: { query: config.query },
          action: { addLabelIds: [importantLabelId] },
        },
      });
      console.log(`  ${config.name}`);
    } catch (error) {
      console.log(`  ${config.name}: ${error.message}`);
    }
  }

  console.log('\nSTEP 2: Labeling existing important emails\n');

  const queryCounts = await Promise.all(
    IMPORTANT_FILTERS.map(async ({ query }) => {
      const searchResponse = await gmail.users.messages.list({ userId: USER_ID, q: query, maxResults: 100 });
      const messageIds = searchResponse.data.messages || [];
      if (messageIds.length === 0) return 0;
      await batchModifyMessages(gmail, messageIds, { addLabelIds: [importantLabelId] });
      return messageIds.length;
    })
  );

  const totalLabeled = queryCounts.reduce((sum, n) => sum + n, 0);
  console.log(`Labeled ${totalLabeled} important emails\n`);

  console.log('═'.repeat(80));
  console.log('COMPLETE\n');
}

protectImportantItems().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
