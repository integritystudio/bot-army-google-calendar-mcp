/**
 * Route billing mail: keep the urgent alerts in the inbox, archive the routine rest.
 *
 * Split out of protect-important-inbox.mjs, which it shared nothing with but cappedSweep
 * (now in lib/gmail-batch-utils.mjs). Three sub-modes, because the rules were built up
 * over time and each needs to be re-runnable on its own:
 *   (default)     create both filters and apply them to existing mail
 *   --update      add the urgent-alert filter (late fee / overdue / missed payment)
 *   --apply-only  apply the existing rules to unread mail, creating no filters
 *
 * Every query here matches subject words rather than senders, so each sweep is capped —
 * unbounded, they would archive any mail that merely says "statement" or "receipt".
 *
 * Usage:
 *   node route-billing-mail.mjs               # create filters + apply to existing mail
 *   node route-billing-mail.mjs --update      # add the urgent billing alert filter
 *   node route-billing-mail.mjs --apply-only  # apply to unread mail only
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, runIfMain } from './lib/cli-utils.mjs';
import { GMAIL_INBOX, LABEL_BILLING, LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { cappedSweep } from './lib/gmail-batch-utils.mjs';
import { BANNER, printComplete } from './lib/console-utils.mjs';

const USAGE = 'Usage: node route-billing-mail.mjs [--update | --apply-only]';

const BILLING_KEYWORDS = '(invoice OR billing OR payment OR charge OR receipt OR statement)';
const URGENT_KEYWORDS = '(late fee OR overdue OR "missed payment")';

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

async function runBillingFilters(billingSubMode) {
  const gmail = createGmailClient();

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
async function main() {
  const { values } = parseCli({
    update: { type: 'boolean', default: false },
    'apply-only': { type: 'boolean', default: false },
  }, USAGE);

  return runBillingFilters(
    values.update ? 'update' : values['apply-only'] ? 'apply-only' : 'create'
  );
}

runIfMain(import.meta.url, main);
