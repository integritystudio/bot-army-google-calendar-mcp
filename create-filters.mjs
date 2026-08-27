/**
 * Create every Gmail routing filter and backfill existing mail into its label.
 * Category routing is defined in config/categories.mjs; this is the sync engine.
 *
 * Usage:
 *   node create-filters.mjs                       # all categories
 *   node create-filters.mjs --only "Promotions"   # only categories whose label starts with the prefix
 *   node create-filters.mjs --dry-run             # print the create/delete plan without mutating
 *   node create-filters.mjs --prune               # also delete stale filters (see diffFilters)
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, runIfMain } from './lib/cli-utils.mjs';
import {
  ensureLabelExists,
  createGmailFilter,
  deleteGmailFilter,
  diffFilters,
  filterKey,
  chunkQueries,
  buildLabelChange,
} from './lib/gmail-filter-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';
import { withRetry } from './lib/gmail-retry.mjs';
import { BANNER } from './lib/console-utils.mjs';
import { USER_ID } from './lib/constants.mjs';
import { CATEGORIES } from './config/categories.mjs';

// Gmail's per-filter query length limit is undocumented; 500 sits well inside
// every reported bound while still collapsing ~30 senders into 2 filters
const MAX_CONSOLIDATED_QUERY_LENGTH = 500;

function describeFilter(filter, labelNameById) {
  const criteria = filter.criteria?.query ?? JSON.stringify(filter.criteria);
  const adds = (filter.action?.addLabelIds ?? []).map(id => labelNameById.get(id) ?? id);
  const removes = (filter.action?.removeLabelIds ?? []).map(id => labelNameById.get(id) ?? id);
  const parts = [];
  if (adds.length) parts.push(`+[${adds.join(', ')}]`);
  if (removes.length) parts.push(`-[${removes.join(', ')}]`);
  return `${criteria} → ${parts.join(' ')}`;
}

/**
 * A consolidated category's sender entries collapse into OR-joined chunk
 * filters; everything else keeps one filter per entry. Per-filter markRead
 * cannot survive a merge, so consolidate rejects it.
 */
function planEntriesFor(category) {
  if (!category.consolidate) return category.entries;
  const overridden = category.entries.find(f => f.markRead !== undefined);
  if (overridden) {
    throw new Error(
      `${category.labelName}: per-filter markRead ("${overridden.name}") is incompatible with consolidate`
    );
  }
  const chunks = chunkQueries(category.entries.map(f => f.query), MAX_CONSOLIDATED_QUERY_LENGTH);
  return chunks.map((query, i) => ({ name: `chunk ${i + 1}/${chunks.length}`, query }));
}

function removalIdsFor(category, markRead) {
  return buildLabelChange({ archive: category.archive, markAsRead: markRead }).removeLabelIds ?? [];
}

/**
 * The filters one plan entry wants live, with resolved label IDs.
 *
 * Gmail rejects a filter action carrying more than one user label ("Too many
 * user labels in filter"), so each extra label needs its own filter on the
 * same query. messages.modify has no such limit, so the backfill still applies
 * every label in a single pass.
 */
function desiredFiltersForEntry(entry, category, addIds) {
  const markRead = Boolean(entry.markRead ?? category.markRead);
  const removeIds = removalIdsFor(category, markRead);
  const desired = [];
  if (addIds.length === 0 && removeIds.length) {
    // Label-less category: archive/mark-read only
    desired.push({
      entryName: entry.name,
      criteria: { query: entry.query },
      action: { removeLabelIds: removeIds },
    });
  }
  for (const [index, addId] of addIds.entries()) {
    desired.push({
      entryName: entry.name,
      criteria: { query: entry.query },
      action: {
        addLabelIds: [addId],
        // Only the first filter needs to move the message out of INBOX/UNREAD
        ...(index === 0 && removeIds.length ? { removeLabelIds: removeIds } : {}),
      },
    });
  }
  return desired;
}

/**
 * filterKey set for every filter the whole config wants, resolved against the
 * label snapshot only (no label creation — a label that doesn't exist yet
 * cannot have live filters, so skipping it changes nothing). Staleness is
 * judged against this set rather than one category's: categories may share a
 * label (Events has keep-in-inbox and archive-on-arrival blocks), and a
 * category-scoped expectation set reads the sibling block's correct filters
 * as stale, which --prune would then delete.
 */
function allDesiredFilterKeys(labelIdByName) {
  const keys = new Set();
  for (const category of CATEGORIES) {
    const addIds = [];
    if (category.labelName) {
      const id = labelIdByName.get(category.labelName);
      if (!id) continue;
      addIds.push(id);
    }
    for (const extra of category.extraLabels ?? []) {
      const id = labelIdByName.get(extra);
      if (id) addIds.push(id);
    }
    for (const entry of planEntriesFor(category)) {
      for (const d of desiredFiltersForEntry(entry, category, addIds)) {
        keys.add(filterKey(d.criteria, d.action));
      }
    }
  }
  return keys;
}

const USAGE = 'Usage: node create-filters.mjs [--only <label-prefix>] [--dry-run] [--prune]';

async function run() {
  const { values } = parseCli({
    only: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    prune: { type: 'boolean', default: false },
  }, USAGE);
  const onlyPrefix = values.only ?? null;
  const dryRun = values['dry-run'];
  const prune = values.prune;
  const gmail = await createGmailClient();

  console.log(`CREATING CATEGORY FILTERS${dryRun ? ' (DRY RUN)' : ''}\n`);
  console.log(BANNER + '\n');

  // One live snapshot for diffing. Creations during the run aren't re-listed,
  // which is fine — only what the snapshot lacked gets created.
  const [{ data: filterData }, { data: labelData }] = await Promise.all([
    withRetry(() => gmail.users.settings.filters.list({ userId: USER_ID })),
    withRetry(() => gmail.users.labels.list({ userId: USER_ID })),
  ]);
  const liveFilters = filterData.filter ?? [];
  const labelNameById = new Map(labelData.labels.map(l => [l.id, l.name]));
  const labelIdByName = new Map(labelData.labels.map(l => [l.name, l.id]));

  // Existing labels resolve from the snapshot; missing ones are only created
  // outside --dry-run (a dry run must not mutate anything, labels included)
  const resolveLabelId = async name => {
    const existing = labelIdByName.get(name);
    if (existing) return existing;
    if (dryRun) {
      console.log(`  + would create label ${name}`);
      return null;
    }
    return ensureLabelExists(gmail, name);
  };

  let totalFilters = 0;
  let totalDeleted = 0;
  let totalEmails = 0;
  const failedBackfills = new Set();
  const allDesiredKeys = allDesiredFilterKeys(labelIdByName);
  // Two categories sharing a label both list the same stale filter; the first
  // deletion succeeds, the second 404s and aborted the run before this guard.
  const deletedFilterIds = new Set();

  for (const category of CATEGORIES) {
    if (onlyPrefix && !(category.labelName ?? '').startsWith(onlyPrefix)) continue;
    const displayName = category.labelName ?? 'Auto-archive (no label)';
    console.log(`\n${displayName.toUpperCase()}`);

    const labelId = category.labelName
      ? await resolveLabelId(category.labelName).catch(err => {
          console.warn(`  Warning: ${err.message}`);
          return null;
        })
      : null;

    if (category.labelName && !labelId) continue;

    const extraLabelIds = [];
    for (const extra of category.extraLabels ?? []) {
      const extraId = await resolveLabelId(extra);
      if (extraId) extraLabelIds.push(extraId);
    }
    const addIds = [...(labelId ? [labelId] : []), ...extraLabelIds];

    const planEntries = planEntriesFor(category);
    // Backfill runs once per distinct markRead value, so per-filter overrides
    // get their own searchAndModify pass with the matching removals
    const queriesByMarkRead = new Map();
    const desired = [];

    for (const entry of planEntries) {
      desired.push(...desiredFiltersForEntry(entry, category, addIds));
      const markRead = Boolean(entry.markRead ?? category.markRead);
      const group = queriesByMarkRead.get(markRead) ?? [];
      group.push(`(${entry.query})`);
      queriesByMarkRead.set(markRead, group);
    }

    const { missing, stale, foreign } = diffFilters({
      desired,
      liveAll: liveFilters,
      ownLabelId: labelId,
      allDesiredKeys,
    });

    // Stale deletions run BEFORE creations: at Gmail's 1,000-filter cap there is
    // no free slot until old filters go. Mail arriving in the gap lands unlabeled
    // in the inbox; the backfill below sweeps it up.
    for (const filter of stale) {
      if (deletedFilterIds.has(filter.id)) continue;
      const summary = describeFilter(filter, labelNameById);
      if (!prune) {
        console.log(`  ! stale (rerun with --prune to delete): ${summary}`);
      } else if (dryRun) {
        console.log(`  - would delete stale: ${summary}`);
      } else {
        await deleteGmailFilter(gmail, filter.id);
        deletedFilterIds.add(filter.id);
        console.log(`  - deleted stale: ${summary}`);
        totalDeleted++;
      }
    }
    for (const filter of foreign) {
      console.log(`  ! unmatched filter also adds other labels — left alone: ${describeFilter(filter, labelNameById)}`);
    }

    for (const entry of planEntries) {
      const toCreate = missing.filter(m => m.entryName === entry.name);
      if (toCreate.length === 0) {
        console.log(`  ~ ${entry.name}`);
        continue;
      }
      if (dryRun) {
        console.log(`  + would create ${entry.name}: ${entry.query}`);
        continue;
      }
      let created = false;
      for (const d of toCreate) {
        if (await createGmailFilter(gmail, d.criteria, d.action)) created = true;
      }
      console.log(`  ${created ? '✓' : '~'} ${entry.name}`);
      if (created) totalFilters++;
    }

    if (dryRun) continue;

    const labelClause = category.labelName && !category.archive ? ` -label:"${category.labelName}"` : '';
    const readClause = category.includeRead ? '' : ' is:unread';
    for (const [markRead, queries] of queriesByMarkRead) {
      const removeIds = removalIdsFor(category, markRead);
      const combinedQuery = `(${queries.join(' OR ')})${readClause}${labelClause}`;
      const modifications = {
        ...(addIds.length ? { addLabelIds: addIds } : {}),
        ...(removeIds.length ? { removeLabelIds: removeIds } : {}),
      };

      try {
        const count = await searchAndModify(gmail, combinedQuery, modifications, category.maxResults);
        if (count > 0) {
          console.log(`  → ${count} existing emails processed`);
          totalEmails += count;
        }
      } catch (error) {
        console.error(`  ✗ Backfill failed: ${error?.message ?? String(error)}`);
        failedBackfills.add(displayName);
      }
    }
  }

  console.log('\n' + BANNER);
  console.log(`Filters created: ${totalFilters} | Filters deleted: ${totalDeleted} | Emails processed: ${totalEmails}`);
  if (failedBackfills.size > 0) {
    console.error(`Backfill FAILED for ${failedBackfills.size} categor${failedBackfills.size === 1 ? 'y' : 'ies'}: ${[...failedBackfills].join(', ')}`);
    console.error('Filters above may be created but existing mail in these categories was not relabeled — rerun to retry.');
    process.exitCode = 1;
  }
  console.log(BANNER + '\n');
}

runIfMain(import.meta.url, run);
