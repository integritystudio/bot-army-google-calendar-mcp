/**
 * Audit Organization tag coverage: which senders in the mailbox carry no
 * Organization/* label and are not matched by any ORG_TAGS entry.
 *
 * --max bounds how many messages are read, paging to get there. It is a sample, and the
 * report says so: a domain absent from it is not a domain absent from the mailbox.
 *
 * Usage:
 *   node audit-org-tag-coverage.mjs [--max N] [--query "<gmail-query>"]
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, runIfMain } from './lib/cli-utils.mjs';
import { extractDisplayName, extractDomain, shareLeadingToken } from './lib/email-utils.mjs';
import { buildLabelIndex } from './lib/gmail-label-utils.mjs';
import { listAllMessageIds, fetchMessageHeaders } from './lib/gmail-message-utils.mjs';
import { ORG_TAGS } from './config/org-tags.mjs';
import { fromTokens } from './audit-label-drift.mjs';

const DEFAULT_MAX = 500;
const ORG_LABEL_PREFIX = 'Organization';
const MIN_REPORT_COUNT = 1;

/**
 * Every sender token named in an ORG_TAGS entry query, e.g. "from:github.com"
 * -> github.com. fromTokens also expands grouped `from:(a OR b)` queries, which
 * a plain from: regex reads as zero senders (the audit then reported every
 * domain written that way as unclaimed).
 */
function coveredDomains() {
  const domains = new Set();
  for (const tag of ORG_TAGS) {
    for (const entry of tag.entries) {
      for (const token of fromTokens(entry.query)) {
        domains.add(token);
      }
    }
  }
  return domains;
}

/** A tag entry for "meetup.com" should also cover mail from "info@email.meetup.com". */
const isCovered = (domain, covered) => {
  if (!domain) return false;
  for (const c of covered) {
    if (domain === c || domain.endsWith(`.${c}`)) return true;
  }
  return false;
};

const USAGE = 'Usage: node audit-org-tag-coverage.mjs [--max N] [--query "<gmail-query>"]';

async function main() {
  const { values } = parseCli({
    max: { type: 'string' },
    query: { type: 'string' },
  }, USAGE);
  const max = Number(values.max ?? DEFAULT_MAX);
  const query = values.query ?? 'is:unread';
  const gmail = await createGmailClient();

  const { byName: labelCache, byId: idToName } = await buildLabelIndex(gmail);
  const covered = coveredDomains();

  // Paged, not a single capped messages.list: Gmail caps maxResults at 500 per page, so
  // asking for more silently sampled 500 and reported the number requested as though it
  // were the number read. --max is now a real limit on how much is fetched.
  const ids = await listAllMessageIds(gmail, query, { limit: max });

  // fetchMessageHeaders retries and warns about what it could not fetch. The
  // hand-rolled fan-out this replaces had no retry, and a dropped message is one
  // fewer sender in the sample — so a rate-limited run under-reported the gaps it
  // exists to find.
  const rows = (await fetchMessageHeaders(gmail, ids))
    .map(({ from, subject, labelIds }) => {
      const names = labelIds.map((lid) => idToName.get(lid)).filter(Boolean);
      return {
        domain: extractDomain(from),
        from: from.replace(/\s+/g, ' ').trim(),
        subject: subject.replace(/\s+/g, ' ').trim(),
        orgLabels: names.filter((n) => n.startsWith(ORG_LABEL_PREFIX)),
      };
    });

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
    const dn = extractDisplayName(r.from);
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

runIfMain(import.meta.url, main);
