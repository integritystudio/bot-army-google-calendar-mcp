/**
 * Classify senders by scanning message bodies for schema.org-type signals.
 *
 * Inferring an org's type from its domain name is unreliable — fuegodance.com is a
 * shoe brand, tinyminotaur.com is a tavern, experiencehouse.co is a design cohort.
 * This reads what the sender actually writes instead.
 *
 * Usage:
 *   node audit-sender-signals.mjs --domains-file gaps.txt [--sample 3]
 *   node audit-sender-signals.mjs --domains a.com,b.com
 */
import { readFileSync } from 'node:fs';
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, exitWithUsage, runIfMain } from './lib/cli-utils.mjs';
import {
  extractDisplayName,
  extractLocalPart,
  GENERIC_LOCAL_PARTS,
  looksLikePlatform,
} from './lib/email-utils.mjs';
import {
  countMessagesMatching,
  listAllMessageIds,
  fetchMessageHeaders,
  fetchFullMessages,
  mapWithConcurrency,
} from './lib/gmail-message-utils.mjs';

const DEFAULT_SAMPLE = 3;
const HEADER_SAMPLE = 25;
const DOMAIN_CONCURRENCY = 4;
const MIN_SCORE = 2;
const MAX_ORGS_SHOWN = 4;

/**
 * A stand-in local part must not reach far beyond the domain it replaces. Austin Westie
 * Academy's reaches 40 vs 30 (1.3x) and is a real win; axios.com's `austin@` reaches
 * 21,191 vs 662 (32x) because "austin" is a common word, not an identifier.
 */
const MAX_LOCAL_PART_REACH_RATIO = 2;

/** Signal terms per candidate schema.org type. Order is report order. */
const SIGNALS = {
  NewsMediaOrganization: /\b(newsroom|reporter|journalis[mt]|editorial|our coverage|subscriber|paywall|breaking news|op-?ed)\b/gi,
  NGO: /\b(donate|donation|nonprofit|non-profit|501\(c\)|volunteer|fundrais\w+|charit\w+|our mission|pledge)\b/gi,
  MedicalOrganization: /\b(patient|prescription|clinic|provider|lab result|test result|copay|insurance claim|physician|diagnos\w+)\b/gi,
  EducationalOrganization: /\b(cohort|curriculum|enroll|tuition|workshop|course|certificat\w+|syllabus|alumni|apply by|scholarship)\b/gi,
  SportsOrganization: /\b(league|tournament|playoff|roster|team registration|season|match|standings)\b/gi,
  Store: /\b(add to cart|checkout|free shipping|your order|shop now|in stock|restock|promo code|sale ends)\b/gi,
  FoodEstablishment: /\b(menu|reservation|dine|table for|entr[ée]e|happy hour|tasting|winery|brunch)\b/gi,
  LodgingBusiness: /\b(check-?in|check-?out|nights?\b|reservation|suite|room rate|stay with us|co-?living)\b/gi,
  TravelAgency: /\b(flight|itinerary|boarding|hotel|destination|departure|round-?trip|book your trip)\b/gi,
  HomeAndConstructionBusiness: /\b(estimate|quote|technician|service call|install\w*|repair|lawn|hvac|plumb\w+|contractor)\b/gi,
  HealthAndBeautyBusiness: /\b(salon|spa|stylist|appointment reminder|treatment|facial|massage|botox|book your appointment)\b/gi,
  RealEstateAgent: /\b(listing|square feet|sq\.? ?ft|mls|open house|lease|tenant|mortgage|closing|escrow)\b/gi,
  Corporation_Software: /\b(api|sdk|dashboard|deploy\w*|changelog|release notes|integration|webhook|uptime|repositor\w+)\b/gi,
  EntertainmentBusiness: /\b(tickets?|doors open|lineup|venue|rsvp|live show|cover charge|dj\b)\b/gi,
  PerformingGroup: /\b(performance|ensemble|cast|rehearsal|our dancers|troupe|on tour|choreograph\w+)\b/gi,
};

/**
 * Distinct local parts on one domain mean the domain is a sending platform, not an
 * organization: express.medallia.com carries Airbnb, secure-booker.com a nail salon.
 * Tagging those by domain files the mail under the ESP's name.
 */
export async function scanSenders(gmail, domain) {
  const ids = await listAllMessageIds(gmail, `from:${domain}`, { limit: HEADER_SAMPLE });
  const byLocalPart = new Map();
  // fetchMessageHeaders retries; the hand-rolled fan-out this replaces did not, and a
  // dropped message is one fewer local part — which is what decides [PLATFORM].
  for (const { from } of await fetchMessageHeaders(gmail, ids)) {
    const lp = extractLocalPart(from);
    if (!lp) continue;
    const entry = byLocalPart.get(lp) ?? { names: new Set(), count: 0 };
    entry.count++;
    const dn = extractDisplayName(from);
    if (dn) entry.names.add(dn);
    byLocalPart.set(lp, entry);
  }
  return byLocalPart;
}

export async function scanDomain(gmail, domain, sampleSize) {
  const { count: total } = await countMessagesMatching(gmail, `from:${domain}`);
  const byLocalPart = await scanSenders(gmail, domain);
  // Austin Westie Academy sends from a dedicated Mailchimp subdomain, a *shared*
  // Mailchimp domain, and its own Gmail — matching the local part caught all 40 where
  // no single domain could. Test whether that is true here before recommending a query.
  const dominant = [...byLocalPart.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  let localPartReach = 0;
  if (dominant) {
    ({ count: localPartReach } = await countMessagesMatching(gmail, `from:${dominant[0]}`));
  }
  const ids = await listAllMessageIds(gmail, `from:${domain}`, { limit: sampleSize });
  // fetchFullMessages retries and is concurrency-bounded. The sequential one-at-a-time
  // loop this replaces had neither — no retry, and each fetch waited on the last.
  const fullMsgs = await fetchFullMessages(gmail, ids);
  let text = '';
  let sender = '';
  const subjects = [];
  for (const { subject, from, bodyText } of fullMsgs) {
    sender ||= from;
    subjects.push(subject.replace(/\s+/g, ' ').trim());
    text += ` ${subject} ${bodyText}`;
  }
  text = text.replace(/\s+/g, ' ');

  const scores = Object.entries(SIGNALS)
    .map(([type, re]) => [type, [...text.matchAll(re)].length])
    .filter(([, n]) => n >= MIN_SCORE)
    .sort((a, b) => b[1] - a[1]);

  const orgs = [...byLocalPart.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([lp, v]) => ({ localPart: lp, names: [...v.names], count: v.count }));
  // Classify by distinct display names, not local parts: a platform can route many orgs
  // through one generic local part (zenoti.com's noreply@), and one org can use several
  // local parts (axios.com's austin@ / partners@).
  const allNames = [...new Set(orgs.flatMap((o) => o.names))];
  const dominantLocalPart = dominant?.[0] ?? '';
  const localPartIsDistinctive = Boolean(dominantLocalPart)
    && !GENERIC_LOCAL_PARTS.has(dominantLocalPart)
    && dominantLocalPart.length > 3;
  // One distinctive local part is one org however many display names it signs with —
  // Austin Westie Academy also mails as "Liz" from austinwestieacademy@.
  const singleDistinctiveSender = orgs.length === 1 && localPartIsDistinctive;
  const isPlatform = !singleDistinctiveSender && looksLikePlatform(allNames);
  const localPartWins = !isPlatform
    && localPartIsDistinctive
    && localPartReach > total
    && localPartReach <= total * MAX_LOCAL_PART_REACH_RATIO;

  let suggestedQuery;
  if (isPlatform && orgs.length > 1) {
    // Distinct local parts per org — address matching is enough
    suggestedQuery = orgs.map((o) => `from:${o.localPart}@${domain}`).join(' OR ');
  } else if (isPlatform) {
    // One shared generic local part: only the display name separates the orgs
    suggestedQuery = allNames.map((n) => `from:"${n}"`).join(' OR ');
  } else if (localPartWins) {
    suggestedQuery = `from:${dominantLocalPart}`;
  } else {
    suggestedQuery = `from:${domain}`;
  }

  return {
    // fullMsgs.length, not ids.length — a message fetchFullMessages dropped after
    // retrying was not sampled, and counting it would overstate the evidence for scores.
    domain, total, sampled: fullMsgs.length, subjects, scores,
    sender: sender.replace(/\s+/g, ' ').trim(),
    orgs, isPlatform, localPartReach, localPartWins, suggestedQuery,
  };
}

async function main() {
  const usage = 'Usage: node audit-sender-signals.mjs --domains-file <path> | --domains a.com,b.com [--sample N]';
  const { values } = parseCli({
    'domains-file': { type: 'string' },
    domains: { type: 'string' },
    sample: { type: 'string' },
  }, usage);
  const file = values['domains-file'];
  const inline = values.domains;
  const sampleSize = Number(values.sample ?? DEFAULT_SAMPLE);
  const domains = file
    ? readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    : (inline ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (domains.length === 0) exitWithUsage(usage);

  const gmail = createGmailClient();
  const results = await mapWithConcurrency(
    domains,
    (d) => scanDomain(gmail, d, sampleSize).catch((e) => ({ domain: d, error: e.message })),
    DOMAIN_CONCURRENCY,
  );

  console.log(`SENDER SIGNAL SCAN  (${domains.length} domains, sample ${sampleSize}/domain)\n`);
  for (const r of results.sort((a, b) => (b.total ?? 0) - (a.total ?? 0))) {
    if (r.error) { console.log(`${r.domain}: ERROR ${r.error}`); continue; }
    const top = r.scores.slice(0, 3).map(([t, n]) => `${t}:${n}`).join('  ') || '(no signal)';
    const flag = r.isPlatform ? ' [PLATFORM]' : (r.localPartWins ? ' [LOCAL-PART WINS]' : '');
    console.log(`${String(r.total).padStart(5)}  ${r.domain.padEnd(44)} ${top}${flag}`);
    for (const o of r.orgs.slice(0, MAX_ORGS_SHOWN)) {
      console.log(`       ${String(o.count).padStart(3)}x ${o.localPart}@ — ${(o.names.join(' / ') || '(no display name)').slice(0, 60)}`);
    }
    if (r.orgs.length > MAX_ORGS_SHOWN) console.log(`       … and ${r.orgs.length - MAX_ORGS_SHOWN} more distinct senders`);
    if (r.localPartWins) console.log(`       local part reaches ${r.localPartReach} vs ${r.total} on the domain`);
    if (r.isPlatform) console.log(`       platform: tag per-org, never by domain`);
    console.log(`       query: ${r.suggestedQuery.slice(0, 100)}`);
    for (const sub of r.subjects.slice(0, 2)) console.log(`       · ${sub.slice(0, 82)}`);
  }
}

runIfMain(import.meta.url, main);
