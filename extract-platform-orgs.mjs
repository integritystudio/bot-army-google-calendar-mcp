/**
 * Enumerate every organization sending through a platform domain.
 *
 * `audit-sender-signals.mjs` flags a domain [PLATFORM] from a 25-message header sample,
 * which is enough to detect one but never to enumerate it: on express.medallia.com that
 * sample found 3 of 20 orgs and would have missed 46% of the mail. Extraction therefore
 * pages the whole domain, which is too expensive to fold into the wide scan.
 *
 * Usage:
 *   node extract-platform-orgs.mjs --domain express.medallia.com
 *   node extract-platform-orgs.mjs --domain X --max 2000   # raise the refusal threshold
 *   node extract-platform-orgs.mjs --domain X --emit       # print ORG_TAGS entries
 */
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createGmailClient } from './lib/gmail-client.mjs';
import { getHeader } from './lib/email-utils.mjs';
import { listAllMessageIds, mapWithConcurrency } from './lib/gmail-message-utils.mjs';
import { USER_ID } from './lib/constants.mjs';
import { localPartOf, displayNameOf, GENERIC_LOCAL_PARTS } from './audit-sender-signals.mjs';

const FETCH_CONCURRENCY = 15;
/** Above this, a domain is too fragmented to tag per-org (substack.com is ~8,900). */
const DEFAULT_MAX_MESSAGES = 400;
/** A local part carrying more distinct names than this is a parent brand, not one org. */
const FANOUT_THRESHOLD = 3;

/** Every message id from the domain — sampling cannot enumerate a platform. */
const allMessageIds = (gmail, domain) => listAllMessageIds(gmail, `from:${domain}`);

export async function extractPlatformOrgs(gmail, domain, { maxMessages = DEFAULT_MAX_MESSAGES } = {}) {
  const ids = await allMessageIds(gmail, domain);
  if (ids.length > maxMessages) {
    return { domain, total: ids.length, tooFragmented: true, orgs: [] };
  }

  const froms = await mapWithConcurrency(ids, async (id) => {
    const { data } = await gmail.users.messages.get({
      userId: USER_ID, id, format: 'metadata', metadataHeaders: ['From'],
    });
    return getHeader(data.payload?.headers ?? [], 'From') ?? '';
  }, FETCH_CONCURRENCY);

  const byLocalPart = new Map();
  for (const from of froms) {
    const lp = localPartOf(from);
    if (!lp) continue;
    const entry = byLocalPart.get(lp) ?? { count: 0, names: new Map() };
    entry.count++;
    const dn = displayNameOf(from);
    if (dn) entry.names.set(dn, (entry.names.get(dn) ?? 0) + 1);
    byLocalPart.set(lp, entry);
  }

  const orgs = [...byLocalPart.entries()]
    .map(([localPart, e]) => {
      const names = [...e.names.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
      return {
        localPart,
        count: e.count,
        names,
        // marriott@ carries 16 hotel properties: the local part names a parent brand,
        // so per-property tagging needs display names, not the address.
        fansOut: names.length > FANOUT_THRESHOLD,
        // posadas@ -> Fiesta Inn, launchpad@ -> Hotel Keen, noreply@ -> Avianca: the
        // address is no guide to the org, so the display name is the only usable label.
        addressMisleading: GENERIC_LOCAL_PARTS.has(localPart)
          || (names[0] ? !names[0].toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(localPart.slice(0, 5)) : false),
        suggestedName: names[0] ?? localPart,
        suggestedQuery: `from:${localPart}@${domain}`,
      };
    })
    .sort((a, b) => b.count - a.count);

  return { domain, total: ids.length, tooFragmented: false, orgs };
}

function report(result, { emit }) {
  const { domain, total, tooFragmented, orgs } = result;
  console.log(`PLATFORM ORG EXTRACTION — ${domain}\n`);
  if (tooFragmented) {
    console.log(`${total} messages exceeds the per-org threshold.`);
    console.log('Too fragmented to tag by sender; treat the domain as untaggable.');
    return;
  }
  console.log(`${total} messages · ${orgs.length} distinct senders\n`);
  console.log('  n  local part            org');
  for (const o of orgs) {
    const flags = [o.fansOut ? 'FANS-OUT' : '', o.addressMisleading ? 'NAME-ONLY' : ''].filter(Boolean).join(' ');
    console.log(`${String(o.count).padStart(3)}  ${o.localPart.padEnd(20)}  ${o.suggestedName}${flags ? `  [${flags}]` : ''}`);
    if (o.fansOut) console.log(`     └─ ${o.names.length} distinct names, e.g. ${o.names.slice(1, 3).join(' / ')}`);
  }

  const fanOut = orgs.filter((o) => o.fansOut);
  if (fanOut.length) {
    console.log(`\n${fanOut.length} local part(s) fan out to many orgs — collapse to the parent brand,`);
    console.log('or tag per-org with from:"Display Name" queries. Decide before emitting.');
  }

  if (emit) {
    console.log('\n// ORG_TAGS entries:');
    for (const o of orgs.filter((x) => !x.fansOut)) {
      console.log(`      { name: '${o.suggestedName.replace(/'/g, "\\'")}', query: '${o.suggestedQuery}' },`);
    }
  }
}

const USAGE = 'Usage: node extract-platform-orgs.mjs --domain <domain> [--max N] [--emit]';

async function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        domain: { type: 'string' },
        max: { type: 'string' },
        emit: { type: 'boolean', default: false },
      },
    }));
  } catch (error) {
    console.error(error.message);
    console.error(USAGE);
    process.exit(1);
  }
  const domain = values.domain;
  const maxMessages = Number(values.max ?? DEFAULT_MAX_MESSAGES);
  const emit = values.emit;
  if (!domain) {
    console.error(USAGE);
    process.exit(1);
  }
  const gmail = createGmailClient();
  report(await extractPlatformOrgs(gmail, domain, { maxMessages }), { emit });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
