import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_BILLING, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { ensureLabelExists } from './lib/gmail-filter-utils.mjs';

const BILLING_KEYWORDS = '(invoice OR billing OR payment OR charge OR receipt OR statement)';

async function createBillingFilter() {
  const gmail = createGmailClient();

  console.log('CREATING BILLING FILTER WITH SMART RULES\n');
  console.log('═'.repeat(80) + '\n');

  const billingLabelId = await ensureLabelExists(gmail, LABEL_BILLING);
  let keepImportantLabelId;
  try {
    keepImportantLabelId = await ensureLabelExists(gmail, LABEL_KEEP_IMPORTANT);
  } catch {
    console.log('Keep Important label not found\n');
  }

  const rateLimitLabelIds = keepImportantLabelId
    ? [billingLabelId, keepImportantLabelId]
    : [billingLabelId];

  console.log('STEP 1: Creating filters\n');

  try {
    await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: {
        criteria: { query: `subject:${BILLING_KEYWORDS} subject:"rate limit"` },
        action: { addLabelIds: rateLimitLabelIds },
      },
    });
    console.log('Filter 1: Billing + Rate Limit (KEEP IN INBOX)');
  } catch (error) {
    console.log(`Filter 1 error: ${error.message}`);
  }

  try {
    await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: {
        criteria: { query: `subject:${BILLING_KEYWORDS} -"rate limit"` },
        action: { addLabelIds: [billingLabelId], removeLabelIds: [GMAIL_INBOX] },
      },
    });
    console.log('Filter 2: Billing Only (SKIP INBOX)');
  } catch (error) {
    console.log(`Filter 2 error: ${error.message}`);
  }

  console.log('\nSTEP 2: Applying to existing emails\n');

  const rateLimitResponse = await gmail.users.messages.list({
    userId: USER_ID,
    q: `subject:${BILLING_KEYWORDS} subject:"rate limit"`,
    maxResults: 100,
  });
  const rateLimitIds = rateLimitResponse.data.messages || [];
  if (rateLimitIds.length > 0) {
    await batchModifyMessages(gmail, rateLimitIds, { addLabelIds: rateLimitLabelIds });
    console.log(`Applied to ${rateLimitIds.length} rate limit emails (kept in inbox)`);
  }

  const regularResponse = await gmail.users.messages.list({
    userId: USER_ID,
    q: `subject:${BILLING_KEYWORDS} -"rate limit"`,
    maxResults: 100,
  });
  const regularIds = regularResponse.data.messages || [];
  if (regularIds.length > 0) {
    await batchModifyMessages(gmail, regularIds, { addLabelIds: [billingLabelId], removeLabelIds: [GMAIL_INBOX] });
    console.log(`Applied to ${regularIds.length} regular billing emails (archived)`);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('COMPLETE\n');
  console.log(`Rate limit billing: ${rateLimitIds.length} | Regular billing: ${regularIds.length}\n`);
  console.log('═'.repeat(80) + '\n');
}

createBillingFilter().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
