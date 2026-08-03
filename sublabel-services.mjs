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
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { getHeader } from './lib/email-utils.mjs';
import {
  USER_ID,
  LABEL_SERVICES,
  LABEL_SERVICES_REAL_ESTATE,
  LABEL_SERVICES_HEALTH,
  LABEL_SERVICES_UTILITIES,
} from './lib/constants.mjs';

const PAGE_SIZE = 500;
const CHUNK = 50;
const BATCH_LIMIT = 1000;

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
    sublabel: LABEL_SERVICES_UTILITIES,
    domains: ['coautilities.com', 'texasgasservice.com', 'email.informeddelivery.usps.com'],
  },
];

const includeRead = process.argv.includes('--all');
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
const ids = [];
let pageToken;
do {
  const res = await gmail.users.messages.list({ userId: USER_ID, labelIds: listLabels, maxResults: PAGE_SIZE, pageToken });
  for (const m of res.data.messages || []) ids.push(m.id);
  pageToken = res.data.nextPageToken;
} while (pageToken);

const domainToSublabel = new Map();
for (const { sublabel, domains } of SUBLABEL_DOMAINS) {
  for (const d of domains) domainToSublabel.set(d, sublabel);
}

const idsBySublabel = new Map();
let unmatched = 0;
for (let i = 0; i < ids.length; i += CHUNK) {
  const metas = await Promise.all(
    ids.slice(i, i + CHUNK).map(id =>
      gmail.users.messages.get({ userId: USER_ID, id, format: 'metadata', metadataHeaders: ['From'] })
    )
  );
  for (const m of metas) {
    const from = getHeader(m.data.payload?.headers || [], 'From', '');
    const domain = (from.match(/@([\w.-]+)/) || [])[1] || '';
    const sublabel = domainToSublabel.get(domain);
    if (!sublabel) { unmatched++; continue; }
    if (!idsBySublabel.has(sublabel)) idsBySublabel.set(sublabel, []);
    idsBySublabel.get(sublabel).push(m.data.id);
  }
}

for (const [sublabel, msgIds] of idsBySublabel) {
  const labelId = sublabelIds.get(sublabel);
  for (let i = 0; i < msgIds.length; i += BATCH_LIMIT) {
    await gmail.users.messages.batchModify({
      userId: USER_ID,
      requestBody: { ids: msgIds.slice(i, i + BATCH_LIMIT), addLabelIds: [labelId] },
    });
  }
  console.log(`  ${sublabel}: ${msgIds.length} labeled`);
}
console.log(`  Unmatched (left on parent only): ${unmatched}`);
