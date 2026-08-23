/**
 * Keep a hand-picked set of senders in the inbox, labeled "Keep Important".
 *
 * The --billing modes that used to live here are route-billing-mail.mjs. The two shared
 * only cappedSweep (now in lib/gmail-batch-utils.mjs): one names four senders and keeps
 * their mail, the other matches billing keywords and archives most of what it finds.
 *
 * Usage: node protect-important-inbox.mjs
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, runIfMain } from './lib/cli-utils.mjs';
import { LABEL_KEEP_IMPORTANT } from './lib/constants.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { cappedSweep } from './lib/gmail-batch-utils.mjs';
import { BANNER, printComplete } from './lib/console-utils.mjs';

const USAGE = 'Usage: node protect-important-inbox.mjs';

const IMPORTANT_FILTERS = [
  { name: 'Cloudflare Alerts', query: 'from:noreply@notify.cloudflare.com' },
  { name: 'Calendly Refunds & Support', query: 'from:(support@calendly.zendesk.com OR invoice+statements@calendly.com) OR subject:(refund OR "Added to a team")' },
  { name: 'Investment Banking Meetings', query: 'from:notification@calendly.com subject:"Introductory Meeting"' },
  { name: 'Capital City Village Services', query: 'from:(capitalcity@a.helpfulvillage.com OR info@capitalcityvillage.org)' },
];

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
async function main() {
  parseCli({}, USAGE);
  return protectImportantItems();
}

runIfMain(import.meta.url, main);
