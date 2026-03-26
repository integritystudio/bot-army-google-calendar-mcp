/**
 * Protect important emails in inbox and manage billing filters.
 *
 * Usage:
 *   node protect-important-inbox.mjs               # create filters to keep important items in inbox
 *   node protect-important-inbox.mjs --billing      # create smart billing filters with rate-limit detection
 *   node protect-important-inbox.mjs --billing --update       # add urgent billing alert filter
 *   node protect-important-inbox.mjs --billing --apply-only   # apply billing filters to unread emails only
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_BILLING, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';
import { ensureLabelExists } from './lib/gmail-filter-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { BANNER, printComplete } from './lib/console-utils.mjs';

const billingMode = process.argv.includes('--billing');

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

const BILLING_KEYWORDS = '(invoice OR billing OR payment OR charge OR receipt OR statement)';
const URGENT_KEYWORDS = '(late fee OR overdue OR "missed payment")';

async function protectImportantItems() {
  const gmail = createGmailClient();

  console.log('PROTECTING IMPORTANT ITEMS IN INBOX\n');
  console.log(BANNER + '\n');

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

  printComplete();
}

async function resolveBillingLabelIds(gmail, mode) {
  if (mode === 'apply-only') {
    const labelCache = await buildLabelCache(gmail);
    const billingLabelId = labelCache.get(LABEL_BILLING);
    const keepImportantLabelId = labelCache.get(LABEL_KEEP_IMPORTANT);
    if (!billingLabelId || !keepImportantLabelId) {
      console.log('Required labels not found\n');
      process.exit(1);
    }
    return { billingLabelId, keepImportantLabelId };
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

async function runBillingFilters() {
  const gmail = createGmailClient();

  const billingSubMode = process.argv.includes('--update')
    ? 'update'
    : process.argv.includes('--apply-only')
      ? 'apply-only'
      : 'create';

  console.log(BANNER + '\n');
  const { billingLabelId, keepImportantLabelId } = await resolveBillingLabelIds(gmail, billingSubMode);

  if (billingSubMode === 'create') {
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

    printComplete(`Rate limit billing: ${rateLimitIds.length} | Regular billing: ${regularIds.length}\n`);
  }

  if (billingSubMode === 'update') {
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

    printComplete();
  }

  if (billingSubMode === 'apply-only') {
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

    printComplete(`Urgent billing (kept in inbox): ${urgentIds.length}\nRegular billing (archived): ${regularIds.length}\nTotal processed: ${urgentIds.length + regularIds.length} emails\n`);
  }

  console.log(BANNER + '\n');
}

const action = billingMode ? runBillingFilters : protectImportantItems;
action().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
