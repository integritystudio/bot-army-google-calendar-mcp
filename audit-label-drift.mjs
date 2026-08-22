/**
 * Audit label drift: for every sender rule in the config, compare three things that
 * are supposed to agree — what the config says the label should be, what Gmail's live
 * filters actually do, and what the mail actually carries.
 *
 * Four findings, in descending order of how actionable they are:
 *   NO_FILTER     - config claims the label but no live filter on those senders adds it
 *   MISSING_LABEL - matching mail lacks the expected label (filters run only on arrival,
 *                   so a rule added after the mail arrived needs a backfill)
 *   STRAY_LABEL   - mail carries a user label that no rule on these senders explains,
 *                   i.e. residue from a config the repo no longer describes
 *   NO_MAIL       - the rule matches nothing (dead sender, or a typo in the query)
 *
 * Rules are matched to each other by sender, so STRAY_LABEL over-reports labels applied by
 * SUBJECT rather than sender — organize-emails.mjs routes `subject:workshop` mail to Events
 * from any sender, and no sender-keyed rule here can account for that. Confirm a stray is
 * real (as Product Updates on AlphaSignal was) before stripping it.
 *
 * MISSING_LABEL needs --exact to be trusted. Without it the check reads a sample, and
 * messages.list returns NEWEST first while a backfill gap sits in the OLDEST mail — so the
 * sample is drawn from precisely the messages a filter has already handled. A 10-message
 * sample of info@email.meetup.com reported 0 missing against a real gap of 6,381 of 10,475.
 * --exact counts by labelIds instead (never a label:"…" query, which is unsafe input).
 *
 * Usage:
 *   node audit-label-drift.mjs                                  # every source
 *   node audit-label-drift.mjs --source filters --only "Product Updates"
 *   node audit-label-drift.mjs --query "from:alphasignal.ai" --expect "Newsletters"
 *   node audit-label-drift.mjs --sample 10 --exact               # true counts, slow
 */
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createGmailClient } from './lib/gmail-client.mjs';
import { getHeader } from './lib/email-utils.mjs';
import { buildLabelIndex } from './lib/gmail-label-utils.mjs';
import { mapWithConcurrency, countMessagesMatching } from './lib/gmail-message-utils.mjs';
import { USER_ID } from './lib/constants.mjs';
import { CATEGORIES } from './config/categories.mjs';
import { ORG_TAGS } from './config/org-tags.mjs';
import { COUNTRY_TAGS } from './config/country-tags.mjs';

const DEFAULT_SAMPLE = 5;
const RULE_CONCURRENCY = 8;
const SOURCE_ALL = 'all';
const AD_HOC_SOURCE = 'ad-hoc';
const MAX_SENDERS_SHOWN = 3;
const MAX_FILTERS_SHOWN = 4;
const SUMMARY_PAD = 46;

/**
 * The three config sources disagree on what the entry array is called
 * (filters / orgs / entries), so each source names its own field.
 */
// All three config sources expose their rules as `entries`, so no per-source field map.
const RULE_SOURCES = {
  filters: CATEGORIES,
  'org-tags': ORG_TAGS,
  'country-tags': COUNTRY_TAGS,
};

const FINDING = {
  NO_FILTER: 'no live filter adds the expected label',
  MISSING_LABEL: 'mail missing the expected label',
  STRAY_LABEL: 'stray labels no rule on these senders explains',
  NO_MAIL: 'rules matching no mail',
};

/** Flatten one or all config sources into comparable {source, labelName, name, query} rules. */
export function loadRules(sourceName = SOURCE_ALL) {
  const names = sourceName === SOURCE_ALL ? Object.keys(RULE_SOURCES) : [sourceName];
  return names.flatMap((source) => {
    const groups = RULE_SOURCES[source];
    if (!groups) throw new Error(`Unknown --source "${source}" (expected: ${Object.keys(RULE_SOURCES).join(', ')}, ${SOURCE_ALL})`);
    return groups.flatMap((group) =>
      (group.entries ?? []).map((entry) => ({
        source,
        labelName: entry.label ?? group.labelName,
        name: entry.name,
        query: entry.query,
      })),
    );
  });
}

const normalizeToken = (raw) => raw.trim().replace(/^["'(]+|["')]+$/g, '').toLowerCase();

/**
 * Every sender token a query names. Handles both spellings the config uses:
 * `from:a.com OR from:b.com` and the grouped `from:(a.com OR b.com)` — a plain
 * /from:([^\s()]+)/ sweep silently returns nothing for the grouped form.
 */
export function fromTokens(query = '') {
  const tokens = new Set();
  const grouped = /from:\(([^)]*)\)/gi;
  for (const match of query.matchAll(grouped)) {
    for (const part of match[1].split(/\s+OR\s+/i)) {
      const token = normalizeToken(part);
      if (token) tokens.add(token);
    }
  }
  for (const match of query.replace(grouped, ' ').matchAll(/from:([^\s()]+)/gi)) {
    const token = normalizeToken(match[1]);
    if (token) tokens.add(token);
  }
  return tokens;
}

/** Sender tokens a live Gmail filter keys on; criteria carry either `from` or a raw `query`. */
export function criteriaTokens(criteria = {}) {
  const tokens = fromTokens(criteria.query ?? '');
  for (const part of (criteria.from ?? '').split(/\s+OR\s+/i)) {
    const token = normalizeToken(part);
    if (token) tokens.add(token);
  }
  return tokens;
}

const domainOf = (token) => token.split('@').pop();

/**
 * The config also matches senders by display name (`from:"AlphaSignal"`), which carries no
 * dot and so never suffix-matches a domain. Treat a bare word as naming a sender when it is
 * one of the domain's own segments, or the filter that uses that spelling looks absent.
 */
const namesDomain = (word, domain) => !word.includes('.') && domain.split('.').includes(word);

/** news@alphasignal.ai, alphasignal.ai and mail.alphasignal.ai all name the same sender. */
export function tokensOverlap(a, b) {
  for (const left of a) {
    for (const right of b) {
      const [x, y] = [domainOf(left), domainOf(right)];
      if (x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`)) return true;
      if (namesDomain(x, y) || namesDomain(y, x)) return true;
    }
  }
  return false;
}

/**
 * Labels legitimately expected on a rule's mail: its own, plus every other rule's whose
 * senders overlap. Without the union, a sender deliberately carrying two labels (github.com
 * is both Forums and Organization/OpenSource) reports each as a stray of the other.
 */
export function expectedLabels(rule, allRules) {
  const expected = new Set([rule.labelName]);
  for (const other of allRules) {
    if (other !== rule && tokensOverlap(rule.tokens, other.tokens)) expected.add(other.labelName);
  }
  return expected;
}

async function loadFilters(gmail, nameById) {
  const { data } = await gmail.users.settings.filters.list({ userId: USER_ID });
  return (data.filter ?? []).map((f) => ({
    tokens: criteriaTokens(f.criteria),
    adds: (f.action?.addLabelIds ?? []).map((id) => nameById.get(id) ?? id),
    criteria: f.criteria ?? {},
  }));
}

/** Sample a rule's mail and record which labels it actually carries. */
async function inspectRule(gmail, rule, { sample, exact, nameById, idByName }) {
  const listed = await gmail.users.messages.list({ userId: USER_ID, q: rule.query, maxResults: sample });
  const ids = (listed.data.messages ?? []).map((m) => m.id);
  // resultSizeEstimate is not a count — Gmail caps it at ~201, so any larger sender
  // reports that same ceiling. A true total costs a full paged walk.
  const total = exact ? (await countMessagesMatching(gmail, rule.query)).count : null;
  // Selected by labelIds, never a label:"…" query — a label name is unsafe search input.
  const labelId = idByName.get(rule.labelName);
  const labeled = exact && labelId
    ? (await countMessagesMatching(gmail, { q: rule.query, labelIds: [labelId] })).count
    : null;

  const messages = await mapWithConcurrency(ids, (id) =>
    gmail.users.messages
      .get({ userId: USER_ID, id, format: 'metadata', metadataHeaders: ['From'] })
      .then(({ data }) => data)
      .catch(() => null),
  );

  const labelCounts = new Map();
  const senders = new Set();
  let sampled = 0;
  for (const msg of messages.filter(Boolean)) {
    sampled++;
    const from = getHeader(msg.payload?.headers ?? [], 'From') || '';
    if (from) senders.add(from.replace(/\s+/g, ' ').trim());
    for (const id of msg.labelIds ?? []) {
      const name = nameById.get(id) ?? id;
      labelCounts.set(name, (labelCounts.get(name) ?? 0) + 1);
    }
  }
  return { sampled, total, labeled, labelCounts, senders: [...senders] };
}

function findingsFor(rule, observed, filters, expected, userLabels) {
  const findings = [];
  const matchingFilters = filters.filter((f) => tokensOverlap(rule.tokens, f.tokens));

  if (observed.sampled === 0) {
    findings.push({ type: FINDING.NO_MAIL, detail: '' });
    return { findings, matchingFilters };
  }
  if (!matchingFilters.some((f) => f.adds.includes(rule.labelName))) {
    const adds = [...new Set(matchingFilters.flatMap((f) => f.adds))];
    findings.push({ type: FINDING.NO_FILTER, detail: adds.length ? `live filters add instead: ${adds.join(', ')}` : 'no live filter matches these senders at all' });
  }
  // Prefer the exact figure: messages.list returns NEWEST first, and a backfill gap sits in
  // the OLDEST mail, so a sample of recent messages is precisely where the gap is not.
  if (observed.labeled !== null) {
    const missing = observed.total - observed.labeled;
    if (missing > 0) {
      findings.push({ type: FINDING.MISSING_LABEL, detail: `${missing}/${observed.total} lack it (exact)` });
    }
  } else {
    const withLabel = observed.labelCounts.get(rule.labelName) ?? 0;
    if (withLabel < observed.sampled) {
      findings.push({ type: FINDING.MISSING_LABEL, detail: `${observed.sampled - withLabel}/${observed.sampled} sampled lack it — sample is newest-first, rerun with --exact` });
    }
  }
  const strays = [...observed.labelCounts]
    .filter(([name, count]) => userLabels.has(name) && !expected.has(name) && count > 0)
    .map(([name, count]) => `${name} (${count}/${observed.sampled})`);
  if (strays.length) findings.push({ type: FINDING.STRAY_LABEL, detail: strays.join(', ') });
  return { findings, matchingFilters };
}

function report(results, { source, sample, exact }) {
  const flagged = results.filter((r) => r.findings.length);
  console.log(`LABEL DRIFT AUDIT  (source: ${source} | rules: ${results.length} | sample: ${sample}/rule${exact ? ' | exact counts' : ''})\n`);
  for (const type of Object.values(FINDING)) {
    const count = flagged.filter((r) => r.findings.some((f) => f.type === type)).length;
    console.log(`  ${type.padEnd(SUMMARY_PAD, '.')} ${count}`);
  }
  console.log(`\n  rules clean: ${results.length - flagged.length}/${results.length}`);

  for (const type of Object.values(FINDING)) {
    const rows = flagged.filter((r) => r.findings.some((f) => f.type === type));
    if (!rows.length) continue;
    console.log(`\n── ${type} ──`);
    for (const row of rows) {
      const total = row.observed.total === null ? `${row.observed.sampled} sampled` : `${row.observed.total} total`;
      console.log(`  ${row.rule.labelName} ← ${row.rule.name}  [${row.rule.source}]  (${total})`);
      console.log(`     query: ${row.rule.query}`);
      const detail = row.findings.find((f) => f.type === type).detail;
      if (detail) console.log(`     ${detail}`);
      for (const sender of row.observed.senders.slice(0, MAX_SENDERS_SHOWN)) console.log(`     from: ${sender}`);
      for (const f of row.matchingFilters.slice(0, MAX_FILTERS_SHOWN)) {
        console.log(`     filter ${JSON.stringify(f.criteria)} -> ${f.adds.join(', ') || '(no labels)'}`);
      }
    }
  }
}

async function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        source: { type: 'string' },
        only: { type: 'string' },
        query: { type: 'string' },
        expect: { type: 'string' },
        sample: { type: 'string' },
        exact: { type: 'boolean', default: false },
      },
    }));
  } catch (error) {
    console.error(error.message);
    console.error('Usage: node audit-label-drift.mjs [--source filters|org-tags|country-tags|all] [--only <label-prefix>] [--query "<gmail-query>" [--expect "<label>"]] [--sample N] [--exact]');
    process.exit(1);
  }
  const source = values.source ?? SOURCE_ALL;
  const only = values.only;
  const adHocQuery = values.query;
  const sample = Number(values.sample ?? DEFAULT_SAMPLE);
  const exact = values.exact;

  const withTokens = (rule) => ({ ...rule, tokens: fromTokens(rule.query) });
  // Expectations are always drawn from the WHOLE config, never the --source/--only subset:
  // a Newsletters-only run still has to know that org-tag rules explain the
  // Organization/* labels its mail carries, or every one reports as a stray.
  const allRules = adHocQuery
    ? [withTokens({ source: AD_HOC_SOURCE, labelName: values.expect ?? '', name: adHocQuery, query: adHocQuery })]
    : loadRules(SOURCE_ALL).map(withTokens);
  const rules = adHocQuery
    ? allRules
    : loadRules(source).map(withTokens).filter((rule) => !only || rule.labelName.startsWith(only));

  if (!rules.length) {
    console.log(`No rules matched (source: ${source}${only ? `, --only "${only}"` : ''}).`);
    return;
  }

  const gmail = createGmailClient();
  const { byId: nameById, byName: idByName, userLabelNames: userLabels } = await buildLabelIndex(gmail);
  const filters = await loadFilters(gmail, nameById);

  const results = await mapWithConcurrency(
    rules,
    async (rule) => {
      const observed = await inspectRule(gmail, rule, { sample, exact, nameById, idByName });
      // An ad-hoc query with no --expect has nothing to assert, so it only reports what it sees.
      if (!rule.labelName) {
        return { rule, observed, matchingFilters: filters.filter((f) => tokensOverlap(rule.tokens, f.tokens)), findings: [] };
      }
      const expected = expectedLabels(rule, allRules);
      return { rule, observed, ...findingsFor(rule, observed, filters, expected, userLabels) };
    },
    RULE_CONCURRENCY,
  );

  report(results, { source: adHocQuery ? AD_HOC_SOURCE : source, sample, exact });

  if (adHocQuery && !values.expect) {
    const [{ observed, matchingFilters }] = results;
    console.log(`\nObserved on ${observed.sampled} sampled message(s) for: ${adHocQuery}`);
    for (const [name, count] of [...observed.labelCounts].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(3)}/${observed.sampled}  ${name}`);
    }
    for (const f of matchingFilters) {
      console.log(`  filter ${JSON.stringify(f.criteria)} -> ${f.adds.join(', ') || '(no labels)'}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
