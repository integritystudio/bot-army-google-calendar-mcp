/**
 * Sub-categorize "Services & Alerts" emails into nested sublabels by sender domain,
 * and create auto-label filters so incoming mail is sub-labeled going forward.
 *
 * Sublabels: Real Estate (Redfin/Zillow/realtor.com/Apartment List; auto-archived),
 *            Health (One Medical/Quest/Ascension), Utilities (CoA/Texas Gas/USPS).
 *
 * Usage:
 *   node sublabel-services.mjs             # retro-label unread + ensure filters
 *   node sublabel-services.mjs --all       # retro-label all parent-labeled mail, not just unread
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, runIfMain } from './lib/cli-utils.mjs';
import { extractDomain } from './lib/email-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { listAllMessageIds, fetchMessageHeaders } from './lib/gmail-message-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import {
  LABEL_SERVICES,
  LABEL_SERVICES_REAL_ESTATE,
  LABEL_SERVICES_HEALTH,
  LABEL_SERVICES_UTILITIES,
} from './lib/constants.mjs';

const SUBLABEL_DOMAINS = [
  {
    sublabel: LABEL_SERVICES_REAL_ESTATE,
    domains: ['redfin.com', 'mail.zillow.com', 'zillowrentals.com', 'e.mail.realtor.com', 'apartmentlist.com', 'emp.apartmentlist.com'],
    autoArchive: true,
  },
  {
    sublabel: LABEL_SERVICES_HEALTH,
    domains: ['access.onemedical.com', 'e.questdiagnostics.com', 'communication.ascension.org'],
  },
  {
    // USPS Informed Delivery is routed to Services & Alerts/USPS by create-filters.mjs,
    // which also marks it read — a disposition this script cannot express.
    sublabel: LABEL_SERVICES_UTILITIES,
    domains: ['coautilities.com', 'texasgasservice.com'],
  },
];

const USAGE = 'Usage: node sublabel-services.mjs [--all]';

async function run() {
  const { values } = parseCli({ all: { type: 'boolean', default: false } }, USAGE);
  const includeRead = values.all;
  const gmail = await createGmailClient();
  const labelMap = await buildLabelCache(gmail);
  const parentId = labelMap.get(LABEL_SERVICES);
  if (!parentId) {
    console.error(`Label "${LABEL_SERVICES}" not found`);
    process.exit(1);
  }

  const sublabelIds = new Map();
  for (const { sublabel } of SUBLABEL_DOMAINS) {
    sublabelIds.set(sublabel, await ensureLabelExists(gmail, sublabel));
  }

  console.log('1. ENSURING AUTO-LABEL FILTERS\n');
  for (const { sublabel, domains, autoArchive } of SUBLABEL_DOMAINS) {
    const action = { addLabelIds: [sublabelIds.get(sublabel)] };
    if (autoArchive) action.removeLabelIds = ['INBOX'];
    const created = await createGmailFilter(gmail, { from: domains.join(' OR ') }, action);
    console.log(`  ${created ? '+' : '~'} ${sublabel}${autoArchive ? ' (auto-archive)' : ''}`);
  }

  console.log('\n2. RETRO-LABELING EXISTING EMAILS\n');
  const listLabels = includeRead ? [parentId] : [parentId, 'UNREAD'];
  const ids = await listAllMessageIds(gmail, { labelIds: listLabels });

  const domainToSublabel = new Map();
  for (const { sublabel, domains } of SUBLABEL_DOMAINS) {
    for (const d of domains) domainToSublabel.set(d, sublabel);
  }

  const idsBySublabel = new Map();
  let unmatched = 0;
  // fetchMessageHeaders retries and bounds its own concurrency. The chunked
  // Promise.all this replaces did neither: one transient failure rejected the
  // whole chunk, and since labeling happens after the scan, the run discarded
  // every message it had already classified.
  for (const { id, from } of await fetchMessageHeaders(gmail, ids)) {
    const domain = extractDomain(from);
    const sublabel = domainToSublabel.get(domain);
    if (!sublabel) { unmatched++; continue; }
    if (!idsBySublabel.has(sublabel)) idsBySublabel.set(sublabel, []);
    idsBySublabel.get(sublabel).push(id);
  }

  for (const [sublabel, msgIds] of idsBySublabel) {
    await batchModifyMessages(gmail, msgIds, { addLabelIds: [sublabelIds.get(sublabel)] });
    console.log(`  ${sublabel}: ${msgIds.length} labeled`);
  }
  console.log(`  Unmatched (left on parent only): ${unmatched}`);
}

runIfMain(import.meta.url, run);
