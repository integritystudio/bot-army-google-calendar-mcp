import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_BILLING, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { ensureLabelExists } from './lib/gmail-filter-utils.mjs';

// Modes:
//   (default)      create base billing filter + apply to existing emails
//   --update       add urgent billing alert filter + apply to existing urgent emails
//   --apply-only   apply billing filters to unread emails (no filter creation)

const BILLING_KEYWORDS = '(invoice OR billing OR payment OR charge OR receipt OR statement)';
const URGENT_KEYWORDS = '(late fee OR overdue OR "missed payment")';

const mode = process.argv.includes('--update')
  ? 'update'
  : process.argv.includes('--apply-only')
    ? 'apply-only'
    : 'create';

const gmail = createGmailClient();

async function resolveBillingLabelIds() {
  if (mode === 'apply-only') {
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const billingLabel = labelsResponse.data.labels.find(l => l.name === LABEL_BILLING);
    const keepImportantLabel = labelsResponse.data.labels.find(l => l.name === LABEL_KEEP_IMPORTANT);
    if (!billingLabel || !keepImportantLabel) {
      console.log('Required labels not found\n');
      process.exit(1);
    }
    return { billingLabelId: billingLabel.id, keepImportantLabelId: keepImportantLabel.id };
  }

  const billingLabelId = await ensureLabelExists(gmail, LABEL_BILLING);
  let keepImportantLabelId;
  try {
    keepImportantLabelId = await ensureLabelExists(gmail, LABEL_KEEP_IMPORTANT);
  } catch {
    console.log('Keep Important label not found\n');
  }
  return { billingLabelId, keepImportantLabelId };
}

async function run() {
  console.log('═'.repeat(80) + '\n');
  const { billingLabelId, keepImportantLabelId } = await resolveBillingLabelIds();

  if (mode === 'create') {
    console.log('CREATING BILLING FILTER WITH SMART RULES\n');

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
  }

  if (mode === 'update') {
    console.log('UPDATING BILLING FILTER - PROTECT URGENT ALERTS\n');

    if (!keepImportantLabelId) {
      console.log('Keep Important label not found.\n');
      process.exit(1);
    }

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

  if (mode === 'apply-only') {
    console.log('APPLYING BILLING FILTER TO UNREAD EMAILS\n');

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
  }

  console.log('═'.repeat(80) + '\n');
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
