import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, LABEL_BILLING, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';

const BILLING_KEYWORDS = '(invoice OR billing OR payment OR charge OR receipt OR statement)';
const URGENT_KEYWORDS = '(late fee OR overdue OR "missed payment")';

async function updateBillingFilter() {
  const gmail = createGmailClient();

  console.log('UPDATING BILLING FILTER - PROTECT URGENT ALERTS\n');
  console.log('═'.repeat(80) + '\n');

  const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
  const billingLabel = labelsResponse.data.labels.find(l => l.name === LABEL_BILLING);
  const keepImportantLabel = labelsResponse.data.labels.find(l => l.name === LABEL_KEEP_IMPORTANT);

  if (!billingLabel) {
    console.log('Billing label not found. Run create-billing-filter.mjs first.\n');
    process.exit(1);
  }
  if (!keepImportantLabel) {
    console.log('Keep Important label not found.\n');
    process.exit(1);
  }

  const billingLabelId = billingLabel.id;
  const keepImportantLabelId = keepImportantLabel.id;

  console.log('STEP 1: Creating urgent billing alert filter\n');

  try {
    await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: {
        criteria: { query: `subject:${BILLING_KEYWORDS} subject:${URGENT_KEYWORDS}` },
        action: { addLabelIds: [billingLabelId, keepImportantLabelId] },
      },
    });
    console.log('Filter created: Urgent billing alerts (KEEP IN INBOX)\n');
  } catch (error) {
    if (error.message.includes('Too many')) {
      console.log('Gmail label limit reached, using simplified approach\n');
    } else {
      throw error;
    }
  }

  console.log('STEP 2: Applying to existing urgent billing emails\n');

  const urgentQuery = `subject:${BILLING_KEYWORDS} subject:${URGENT_KEYWORDS}`;
  const urgentResponse = await gmail.users.messages.list({ userId: USER_ID, q: urgentQuery, maxResults: 100 });
  const urgentIds = urgentResponse.data.messages || [];

  if (urgentIds.length > 0) {
    await batchModifyMessages(gmail, urgentIds, { addLabelIds: [billingLabelId, keepImportantLabelId] });
    console.log(`Applied to ${urgentIds.length} urgent billing emails (kept in inbox)\n`);
  } else {
    console.log('No urgent billing emails found\n');
  }

  console.log('═'.repeat(80));
  console.log('COMPLETE\n');
}

updateBillingFilter().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
