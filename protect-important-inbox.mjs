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
import { parseCli, runMain } from './lib/cli-utils.mjs';
import { DEFAULT_MAX_RESULTS, GMAIL_INBOX, LABEL_BILLING, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';
import { BANNER, printComplete } from './lib/console-utils.mjs';

const USAGE = 'Usage: node protect-important-inbox.mjs [--billing [--update | --apply-only]]';

const { values } = parseCli({
  billing: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
  'apply-only': { type: 'boolean', default: false },
}, USAGE);

const billingMode = values.billing;

const IMPORTANT_FILTERS = [
  { name: 'Cloudflare Alerts', query: 'from:noreply@notify.cloudflare.com' },
  { name: 'Calendly Refunds & Support', query: 'from:(support@calendly.zendesk.com OR invoice+statements@calendly.com) OR subject:(refund OR "Added to a team")' },
  { name: 'Investment Banking Meetings', query: 'from:notification@calendly.com subject:"Introductory Meeting"' },
  { name: 'Capital City Village Services', query: 'from:(capitalcity@a.helpfulvillage.com OR info@capitalcityvillage.org)' },
];

const BILLING_KEYWORDS = '(invoice OR billing OR payment OR charge OR receipt OR statement)';
const URGENT_KEYWORDS = '(late fee OR overdue OR "missed payment")';

/**
 * Every sweep below matches on subject words rather than senders, so an unbounded run
 * would relabel and archive any mail that merely says "statement" or "receipt". The cap
 * is deliberate — searchAndModify pages to exhaustion without one.
 */
const SUBJECT_SWEEP_CAP = DEFAULT_MAX_RESULTS;

/**
 * A capped sweep that says when it stopped short. The bare count cannot distinguish
 * "that was all of them" from "there are more behind the cap", so a truncated run used
 * to report exactly like a complete one.
 */
async function cappedSweep(gmail, query, modifications, description) {
  const count = await searchAndModify(gmail, query, modifications, SUBJECT_SWEEP_CAP);
  if (count >= SUBJECT_SWEEP_CAP) {
    console.log(`  Note: ${description} hit the ${SUBJECT_SWEEP_CAP}-message cap; re-run to continue.`);
  }
  return count;
}

async function protectImportantItems() {
  const gmail = createGmailClient();

  console.log('PROTECTING IMPORTANT ITEMS IN INBOX\n');
  console.log(BANNER + '\n');

  const importantLabelId = await ensureLabelExists(gmail, LABEL_KEEP_IMPORTANT);

  console.log('STEP 1: Creating filters to keep important items in inbox\n');

  for (const config of IMPORTANT_FILTERS) {
    const filterId = await createGmailFilter(gmail, { query: config.query }, { addLabelIds: [importantLabelId] });
    console.log(filterId ? `  ${config.name}` : `  ${config.name} (already exists)`);
  }

  console.log('\nSTEP 2: Labeling existing important emails\n');

  const queryCounts = await Promise.all(
    IMPORTANT_FILTERS.map(({ name, query }) => cappedSweep(gmail, query, { addLabelIds: [importantLabelId] }, name))
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

  const billingSubMode = values.update
    ? 'update'
    : values['apply-only']
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
    const f1 = await createGmailFilter(gmail, { query: `subject:${BILLING_KEYWORDS} subject:"rate limit"` }, { addLabelIds: rateLimitLabelIds });
    console.log(f1 ? 'Filter 1: Billing + Rate Limit (KEEP IN INBOX)' : 'Filter 1 already exists');

    const f2 = await createGmailFilter(gmail, { query: `subject:${BILLING_KEYWORDS} -"rate limit"` }, { addLabelIds: [billingLabelId], removeLabelIds: [GMAIL_INBOX] });
    console.log(f2 ? 'Filter 2: Billing Only (SKIP INBOX)' : 'Filter 2 already exists');

    console.log('\nSTEP 2: Applying to existing emails\n');

    const rateLimitCount = await cappedSweep(gmail, `subject:${BILLING_KEYWORDS} subject:"rate limit"`, { addLabelIds: rateLimitLabelIds }, 'rate limit billing');
    if (rateLimitCount > 0) console.log(`Applied to ${rateLimitCount} rate limit emails (kept in inbox)`);

    const regularCount = await cappedSweep(gmail, `subject:${BILLING_KEYWORDS} -"rate limit"`, { addLabelIds: [billingLabelId], removeLabelIds: [GMAIL_INBOX] }, 'regular billing');
    if (regularCount > 0) console.log(`Applied to ${regularCount} regular billing emails (archived)`);

    printComplete(`Rate limit billing: ${rateLimitCount} | Regular billing: ${regularCount}\n`);
  }

  if (billingSubMode === 'update') {
    console.log('UPDATING BILLING FILTER - PROTECT URGENT ALERTS\n');

    if (!keepImportantLabelId) {
      console.log('Keep Important label not found.\n');
      process.exit(1);
    }

    console.log('STEP 1: Creating urgent billing alert filter\n');
    try {
      const filterId = await createGmailFilter(gmail, { query: `subject:${BILLING_KEYWORDS} subject:${URGENT_KEYWORDS}` }, { addLabelIds: [billingLabelId, keepImportantLabelId] });
      console.log(filterId ? 'Filter created: Urgent billing alerts (KEEP IN INBOX)\n' : 'Filter already exists\n');
    } catch (error) {
      if (error.message.includes('Too many')) {
        console.log('Gmail label limit reached, using simplified approach\n');
      } else {
        throw error;
      }
    }

    console.log('STEP 2: Applying to existing urgent billing emails\n');
    const urgentCount = await cappedSweep(gmail, `subject:${BILLING_KEYWORDS} subject:${URGENT_KEYWORDS}`, { addLabelIds: [billingLabelId, keepImportantLabelId] }, 'urgent billing');
    if (urgentCount > 0) {
      console.log(`Applied to ${urgentCount} urgent billing emails (kept in inbox)\n`);
    } else {
      console.log('No urgent billing emails found\n');
    }

    printComplete();
  }

  if (billingSubMode === 'apply-only') {
    console.log('APPLYING BILLING FILTER TO UNREAD EMAILS\n');

    const urgentCount = await cappedSweep(gmail, `is:unread subject:${BILLING_KEYWORDS} subject:${URGENT_KEYWORDS}`, { addLabelIds: [billingLabelId, keepImportantLabelId] }, 'unread urgent billing');
    console.log(`Found ${urgentCount} unread urgent billing emails`);

    const regularCount = await cappedSweep(gmail, `is:unread subject:${BILLING_KEYWORDS} -"late fee" -overdue -"missed payment"`, { addLabelIds: [billingLabelId], removeLabelIds: [GMAIL_INBOX] }, 'unread regular billing');
    console.log(`Found ${regularCount} unread regular billing emails`);

    printComplete(`Urgent billing (kept in inbox): ${urgentCount}\nRegular billing (archived): ${regularCount}\nTotal processed: ${urgentCount + regularCount} emails\n`);
  }

  console.log(BANNER + '\n');
}

runMain(billingMode ? runBillingFilters : protectImportantItems);
