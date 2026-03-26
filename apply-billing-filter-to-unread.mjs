import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_BILLING, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';

async function applyBillingFilterToUnread() {
  const gmail = createGmailClient();

  console.log('💳 APPLYING BILLING FILTER TO UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const billingLabel = labelsResponse.data.labels.find(l => l.name === LABEL_BILLING);
    const keepImportantLabel = labelsResponse.data.labels.find(l => l.name === LABEL_KEEP_IMPORTANT);

    if (!billingLabel || !keepImportantLabel) {
      console.log('❌ Required labels not found\n');
      process.exit(1);
    }

    const billingLabelId = billingLabel.id;
    const keepImportantLabelId = keepImportantLabel.id;

    const billingKeywords = '(invoice OR billing OR payment OR charge OR receipt OR statement)';
    const urgentKeywords = '(late fee OR overdue OR "missed payment")';

    console.log('STEP 1: Finding unread urgent billing emails\n');

    const urgentQuery = `is:unread subject:${billingKeywords} subject:${urgentKeywords}`;
    const urgentResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: urgentQuery,
      maxResults: 100
    });

    const urgentIds = urgentResponse.data.messages || [];
    console.log(`Found ${urgentIds.length} unread urgent billing emails\n`);

    if (urgentIds.length > 0) {
      console.log('Applying labels: Billing + Keep Important (staying in inbox)...\n');
      const batchSize = 50;
      for (let i = 0; i < urgentIds.length; i += batchSize) {
        const batch = urgentIds.slice(i, i + batchSize);
        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [billingLabelId, keepImportantLabelId]
          }
        });
        const processed = i + batch.length;
        console.log(`  ✅ Processed ${processed}/${urgentIds.length}`);
      }
    }

    console.log('\nSTEP 2: Finding unread regular billing emails (non-urgent)\n');

    const regularQuery = `is:unread subject:${billingKeywords} -"late fee" -overdue -"missed payment"`;
    const regularResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: regularQuery,
      maxResults: 100
    });

    const regularIds = regularResponse.data.messages || [];
    console.log(`Found ${regularIds.length} unread regular billing emails\n`);

    if (regularIds.length > 0) {
      console.log('Applying labels: Billing (archiving)...\n');
      const batchSize = 50;
      for (let i = 0; i < regularIds.length; i += batchSize) {
        const batch = regularIds.slice(i, i + batchSize);
        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [billingLabelId],
            removeLabelIds: [GMAIL_INBOX]
          }
        });
        const processed = i + batch.length;
        console.log(`  ✅ Processed ${processed}/${regularIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log('Applied billing filters:');
    console.log(`  🚨 Urgent billing (late fees, overdue, missed payments): ${urgentIds.length}`);
    console.log(`     → Labels: Billing + Keep Important (staying in inbox)\n`);
    console.log(`  💳 Regular billing (invoices, payments, etc.): ${regularIds.length}`);
    console.log(`     → Labels: Billing (archived)\n`);
    console.log(`Total processed: ${urgentIds.length + regularIds.length} emails\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

applyBillingFilterToUnread().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
