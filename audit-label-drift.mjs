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
 * Rules are matched to each other by sender, so STRAY_LABEL over-reports any label applied by
 * SUBJECT rather than sender: no sender-keyed rule here can account for one. organize-emails.mjs
 * was the last source of sender-unconstrained subject rules and is gone, but live Gmail filters
 * it created may outlast it. Confirm a stray is real (as Product Updates on AlphaSignal was)
 * before stripping it.
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
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, runIfMain } from './lib/cli-utils.mjs';
import { buildLabelIndex } from './lib/gmail-label-utils.mjs';
import { mapWithConcurrency, countMessagesMatching, fetchMessageHeaders } from './lib/gmail-message-utils.mjs';
import { fromTokens, criteriaTokens, tokensOverlap } from './lib/gmail-query-tokens.mjs';
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

/** All three config sources expose their rules as `entries`, so no per-source field map. */
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

  // fetchMessageHeaders retries and reports what it could not fetch. The hand-rolled
  // fan-out this replaces dropped a failure to null, so a rate-limited run shrank the
  // sample instead of erroring — and a smaller sample reads as less drift, not as a
  // failed audit.
  const messages = await fetchMessageHeaders(gmail, ids);

  const labelCounts = new Map();
  const senders = new Set();
  for (const { from, labelIds } of messages) {
    senders.add(from.replace(/\s+/g, ' ').trim());
    for (const id of labelIds) {
      const name = nameById.get(id) ?? id;
      labelCounts.set(name, (labelCounts.get(name) ?? 0) + 1);
    }
  }
  const sampled = messages.length;
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

const USAGE = 'Usage: node audit-label-drift.mjs [--source filters|org-tags|country-tags|all]'
  + ' [--only <label-prefix>] [--query "<gmail-query>" [--expect "<label>"]] [--sample N] [--exact]';

async function main() {
  const { values } = parseCli({
    source: { type: 'string' },
    only: { type: 'string' },
    query: { type: 'string' },
    expect: { type: 'string' },
    sample: { type: 'string' },
    exact: { type: 'boolean', default: false },
  }, USAGE);
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

runIfMain(import.meta.url, main);
