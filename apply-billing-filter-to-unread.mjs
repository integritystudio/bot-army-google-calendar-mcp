import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_BILLING, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';

const BILLING_KEYWORDS = '(invoice OR billing OR payment OR charge OR receipt OR statement)';
const URGENT_KEYWORDS = '(late fee OR overdue OR "missed payment")';

async function applyBillingFilterToUnread() {
  const gmail = createGmailClient();

  console.log('APPLYING BILLING FILTER TO UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
  const billingLabel = labelsResponse.data.labels.find(l => l.name === LABEL_BILLING);
  const keepImportantLabel = labelsResponse.data.labels.find(l => l.name === LABEL_KEEP_IMPORTANT);

  if (!billingLabel || !keepImportantLabel) {
    console.log('Required labels not found\n');
    process.exit(1);
  }

  const billingLabelId = billingLabel.id;
  const keepImportantLabelId = keepImportantLabel.id;

  const urgentQuery = `is:unread subject:${BILLING_KEYWORDS} subject:${URGENT_KEYWORDS}`;
  const urgentResponse = await gmail.users.messages.list({ userId: USER_ID, q: urgentQuery, maxResults: 100 });
  const urgentIds = urgentResponse.data.messages || [];
  console.log(`Found ${urgentIds.length} unread urgent billing emails`);
  if (urgentIds.length > 0) {
    await batchModifyMessages(gmail, urgentIds, { addLabelIds: [billingLabelId, keepImportantLabelId] });
  }

  const regularQuery = `is:unread subject:${BILLING_KEYWORDS} -"late fee" -overdue -"missed payment"`;
  const regularResponse = await gmail.users.messages.list({ userId: USER_ID, q: regularQuery, maxResults: 100 });
  const regularIds = regularResponse.data.messages || [];
  console.log(`Found ${regularIds.length} unread regular billing emails`);
  if (regularIds.length > 0) {
    await batchModifyMessages(gmail, regularIds, { addLabelIds: [billingLabelId], removeLabelIds: [GMAIL_INBOX] });
  }

  console.log('\n' + '═'.repeat(80));
  console.log('COMPLETE\n');
  console.log(`Urgent billing (kept in inbox): ${urgentIds.length}`);
  console.log(`Regular billing (archived): ${regularIds.length}`);
  console.log(`Total processed: ${urgentIds.length + regularIds.length} emails\n`);
  console.log('═'.repeat(80) + '\n');
}

applyBillingFilterToUnread().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
