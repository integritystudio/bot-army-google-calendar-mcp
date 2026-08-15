/**
 * Audit Organization tag coverage: which senders in the mailbox carry no
 * Organization/* label and are not matched by any ORG_TAGS entry.
 *
 * Usage:
 *   node audit-org-tag-coverage.mjs [--max N] [--query "<gmail-query>"]
 */
import { parseArgs } from 'node:util';
import { createGmailClient } from './lib/gmail-client.mjs';
import { getHeader } from './lib/email-utils.mjs';
import { buildLabelIndex } from './lib/gmail-label-utils.mjs';
import { mapWithConcurrency } from './lib/gmail-message-utils.mjs';
import { USER_ID } from './lib/constants.mjs';
import { ORG_TAGS } from './create-org-tags.mjs';
import { displayNameOf, shareLeadingToken } from './audit-sender-signals.mjs';

const DEFAULT_MAX = 500;
const FETCH_CONCURRENCY = 20;
const ORG_LABEL_PREFIX = 'Organization';
const MIN_REPORT_COUNT = 1;

/** Every bare domain named in an ORG_TAGS entry query, e.g. "from:github.com" -> github.com */
function coveredDomains() {
  const domains = new Set();
  for (const tag of ORG_TAGS) {
    for (const entry of tag.orgs) {
      for (const match of entry.query.matchAll(/from:([^\s()]+)/g)) {
        domains.add(match[1].replace(/^\(/, '').toLowerCase());
      }
    }
  }
  return domains;
}

const senderDomain = (from) => (from.match(/@([^>\s]+)/)?.[1] ?? '').toLowerCase().replace(/[>,;]$/, '');

/** A tag entry for "meetup.com" should also cover mail from "info@email.meetup.com". */
const isCovered = (domain, covered) => {
  if (!domain) return false;
  for (const c of covered) {
    if (domain === c || domain.endsWith(`.${c}`)) return true;
  }
  return false;
};

async function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        max: { type: 'string' },
        query: { type: 'string' },
      },
    }));
  } catch (error) {
    console.error(error.message);
    console.error('Usage: node audit-org-tag-coverage.mjs [--max N] [--query "<gmail-query>"]');
    process.exit(1);
  }
  const max = Number(values.max ?? DEFAULT_MAX);
  const query = values.query ?? 'is:unread';
  const gmail = await createGmailClient();

  const { byName: labelCache, byId: idToName } = await buildLabelIndex(gmail);
  const covered = coveredDomains();

  const { data } = await gmail.users.messages.list({ userId: USER_ID, q: query, maxResults: max });
  const messages = data.messages ?? [];

  const rows = await mapWithConcurrency(messages, async ({ id }) => {
    const { data: msg } = await gmail.users.messages.get({
      userId: USER_ID, id, format: 'metadata', metadataHeaders: ['From', 'Subject'],
    });
    const from = getHeader(msg.payload.headers, 'From') || '';
    const names = (msg.labelIds ?? []).map((lid) => idToName.get(lid)).filter(Boolean);
    return {
      domain: senderDomain(from),
      from: from.replace(/\s+/g, ' ').trim(),
      subject: (getHeader(msg.payload.headers, 'Subject') || '').replace(/\s+/g, ' ').trim(),
      orgLabels: names.filter((n) => n.startsWith(ORG_LABEL_PREFIX)),
    };
  }, FETCH_CONCURRENCY);

  // A domain is a gap only if NO message from it carries an Organization label
  // and no ORG_TAGS entry claims it.
  const byDomain = new Map();
  for (const r of rows) {
    if (!r.domain) continue;
    const acc = byDomain.get(r.domain) ?? { count: 0, tagged: 0, samples: [], names: new Set() };
    acc.count++;
    if (r.orgLabels.length) acc.tagged++;
    // Free platform detection: the From headers are already fetched above, so distinct
    // display names cost nothing extra. A platform gap must not be tagged by domain —
    // express.medallia.com is 20 orgs (Airbnb, CVS, Marriott...), not one.
    const dn = displayNameOf(r.from);
    if (dn) acc.names.add(dn);
    if (acc.samples.length < 2) acc.samples.push(`${r.from} — ${r.subject.slice(0, 62)}`);
    byDomain.set(r.domain, acc);
  }

  const gaps = [...byDomain.entries()]
    .filter(([domain, a]) => a.tagged === 0 && !isCovered(domain, covered) && a.count >= MIN_REPORT_COUNT)
    .sort((a, b) => b[1].count - a[1].count);

  console.log(`ORG TAG COVERAGE AUDIT  (query: ${query} | sampled: ${rows.length})\n`);
  console.log(`ORG_TAGS label groups: ${ORG_TAGS.length} | domains claimed: ${covered.size}`);
  console.log(`distinct sender domains sampled: ${byDomain.size} | untagged & unclaimed: ${gaps.length}\n`);
  const gapMessages = gaps.reduce((sum, [, a]) => sum + a.count, 0);
  console.log(`messages in those gaps: ${gapMessages}\n`);

  for (const [domain, a] of gaps) {
    const names = [...a.names];
    const isPlatform = names.length > 1 && !shareLeadingToken(names);
    console.log(`${String(a.count).padStart(3)}  ${domain}${isPlatform ? '  [PLATFORM — run extract-platform-orgs.mjs]' : ''}`);
    for (const s of a.samples) console.log(`     ${s}`);
  }

  // Second check: any LABEL_ORG_* value referenced by ORG_TAGS with no Gmail label yet.
  const missingLabels = ORG_TAGS.map((t) => t.labelName).filter((n) => !labelCache.get(n));
  console.log(`\nORG_TAGS labels not yet created in Gmail: ${missingLabels.length}`);
  for (const n of missingLabels) console.log(`  ${n}`);
}

main();
