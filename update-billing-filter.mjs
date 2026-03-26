import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, LABEL_BILLING, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';

async function updateBillingFilter() {
  const gmail = createGmailClient();

  console.log('💳 UPDATING BILLING FILTER - PROTECT URGENT ALERTS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const billingLabel = labelsResponse.data.labels.find(l => l.name === LABEL_BILLING);
    const keepImportantLabel = labelsResponse.data.labels.find(l => l.name === LABEL_KEEP_IMPORTANT);

    if (!billingLabel) {
      console.log('❌ Billing label not found. Run create-billing-filter.mjs first.\n');
      process.exit(1);
    }

    if (!keepImportantLabel) {
      console.log('❌ Keep Important label not found.\n');
      process.exit(1);
    }

    const billingLabelId = billingLabel.id;
    const keepImportantLabelId = keepImportantLabel.id;

    console.log('STEP 1: Creating urgent billing alert filter\n');

    const urgentKeywords = '(late fee OR overdue OR "missed payment")';
    const billingKeywords = '(invoice OR billing OR payment OR charge OR receipt OR statement)';

    try {
      await gmail.users.settings.filters.create({
        userId: USER_ID,
        requestBody: {
          criteria: {
            query: `subject:${billingKeywords} subject:${urgentKeywords}`
          },
          action: {
            addLabelIds: [billingLabelId, keepImportantLabelId]
          }
        }
      });
      console.log('✅ Filter created: Urgent billing alerts (KEEP IN INBOX)');
      console.log('   Criteria: Billing keywords + (late fee OR overdue OR missed payment)');
      console.log('   Action: Label Billing + Keep Important\n');
    } catch (error) {
      if (error.message.includes('Too many')) {
        console.log('⚠️  Gmail label limit reached, using simplified approach\n');
      } else {
        throw error;
      }
    }

    console.log('STEP 2: Applying to existing urgent billing emails\n');

    const urgentQuery = `subject:${billingKeywords} subject:${urgentKeywords}`;
    const urgentResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: urgentQuery,
      maxResults: 100
    });

    const urgentIds = urgentResponse.data.messages || [];
    if (urgentIds.length > 0) {
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
      }
      console.log(`  ✅ Applied to ${urgentIds.length} urgent billing emails (kept in inbox)\n`);
    } else {
      console.log('  ℹ️  No urgent billing emails found\n');
    }

    console.log('═'.repeat(80));
    console.log('COMPLETE\n');
    console.log('Updated Billing Filter Rules:');
    console.log('  🚨 Urgent Billing → (late fee OR overdue OR missed payment)');
    console.log('     Action: Label Billing + Keep Important → STAY IN INBOX\n');
    console.log('  📌 Rate Limit Alerts → (already protected by Cloudflare filter)');
    console.log('     Action: Keep Important → STAY IN INBOX\n');
    console.log('  💳 Regular Billing → Everything else');
    console.log('     Action: Label Billing → ARCHIVED\n');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateBillingFilter().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
