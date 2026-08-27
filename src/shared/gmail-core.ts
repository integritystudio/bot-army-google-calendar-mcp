/**
 * Gmail primitives shared by the MCP handlers (src/handlers/gmail) and the CLI
 * scripts (root *.mjs via lib/). Both stacks had their own copy of paging,
 * batching and retry; this is the single one.
 *
 * DUAL-CONSUMED, WHICH CONSTRAINS THE IMPORTS: the CLI loads this file as .ts
 * under Node's type stripping, and Node does not rewrite a '.js' specifier to
 * the '.ts' file that TypeScript resolves it to. So every import here must be
 * either `import type` or a bare package name — one relative './x.js' import
 * makes the whole module unloadable from .mjs with ERR_MODULE_NOT_FOUND.
 */
import type { gmail_v1 } from 'googleapis';

export const GMAIL_USER_ID = 'me';
export const GMAIL_BATCH_MODIFY_LIMIT = 1000;
export const LABEL_CONFLICT_STATUS = 409;

export const GMAIL_LABEL_INBOX = 'INBOX';
export const GMAIL_LABEL_SPAM = 'SPAM';
export const GMAIL_LABEL_TRASH = 'TRASH';
export const GMAIL_LABEL_UNREAD = 'UNREAD';

const LIST_PAGE_SIZE = 500;
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 3000;
const TRANSIENT_STATUS_CODES = [429, 500, 503];
const TRANSIENT_MESSAGE = 'Precondition';
/** googleapis surfaces the same condition as a typed cause rather than in the message. */
const TRANSIENT_CAUSE_STATUS = 'FAILED_PRECONDITION';

/**
 * Floor for the bisect in batchModifyMessages: below this, a failing batch is skipped
 * rather than split further. Bisecting to a single id would isolate the one bad message
 * exactly, but at log2(1000) ≈ 10 extra round trips per failure — this trades a few
 * skipped messages for the run finishing.
 */
const MIN_SPLIT_BATCH = 25;

export type MessageSelector = string | gmail_v1.Params$Resource$Users$Messages$List;

export interface GmailLabelChange {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export interface GmailLabelChangeFlags extends GmailLabelChange {
  archive?: boolean;
  markAsRead?: boolean;
  markAsSpam?: boolean;
  markAsTrash?: boolean;
  neverMarkAsSpam?: boolean;
}

/**
 * Gmail has no "archive" or "mark as read" primitive — both the Filter action resource
 * and messages.modify express every such action purely as a label change, accepting only
 * addLabelIds/removeLabelIds (plus forward, on filters). A field the API does not
 * recognise is dropped without error, so a filter carrying one is created and then does
 * nothing.
 *
 * The MCP filter handlers (src/handlers/gmail) and create-filters.mjs each grew this same
 * archive/mark-read -> label-change mapping independently, under different flag names
 * (markAsRead here, markRead there) — this is the one copy.
 *
 * Key order below determines the order labels appear in the returned arrays (archive's
 * INBOX removal before markAsRead's UNREAD removal, when both are set). Not functionally
 * load-bearing today — lib/gmail-filter-utils.mjs's filterKey() sorts both arrays before
 * comparing, so create-filters.mjs's filter-identity check is order-independent — but the
 * order is pinned by test as the documented, deliberate output rather than an accident of
 * iteration, since create-filters.mjs also uses it for display (describeFilter()).
 */
type LabelChangeFlagName = 'archive' | 'markAsRead' | 'markAsSpam' | 'markAsTrash' | 'neverMarkAsSpam';

const LABEL_CHANGE_FLAGS: Record<LabelChangeFlagName, { add?: string; remove?: string }> = {
  archive: { remove: GMAIL_LABEL_INBOX },
  markAsRead: { remove: GMAIL_LABEL_UNREAD },
  markAsSpam: { add: GMAIL_LABEL_SPAM },
  markAsTrash: { add: GMAIL_LABEL_TRASH },
  neverMarkAsSpam: { remove: GMAIL_LABEL_SPAM },
};

/**
 * Fold the boolean convenience flags into explicit label IDs, preserving any
 * addLabelIds/removeLabelIds the caller supplied directly.
 */
export function buildLabelChange(flags: GmailLabelChangeFlags): GmailLabelChange {
  const addLabelIds = [...(flags.addLabelIds ?? [])];
  const removeLabelIds = [...(flags.removeLabelIds ?? [])];

  for (const [flag, { add, remove }] of Object.entries(LABEL_CHANGE_FLAGS) as Array<
    [LabelChangeFlagName, { add?: string; remove?: string }]
  >) {
    if (!flags[flag]) continue;
    if (add && !addLabelIds.includes(add)) addLabelIds.push(add);
    if (remove && !removeLabelIds.includes(remove)) removeLabelIds.push(remove);
  }

  const change: GmailLabelChange = {};
  if (addLabelIds.length) change.addLabelIds = addLabelIds;
  if (removeLabelIds.length) change.removeLabelIds = removeLabelIds;
  return change;
}

/** Gmail intermittently throws FAILED_PRECONDITION / 429 on rapid bulk operations. */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      const causeStatus = (error as { cause?: { status?: unknown } })?.cause?.status;
      const transient =
        (error instanceof Error && error.message.includes(TRANSIENT_MESSAGE)) ||
        causeStatus === TRANSIENT_CAUSE_STATUS ||
        (typeof code === 'number' && TRANSIENT_STATUS_CODES.includes(code));
      if (!transient || attempt >= MAX_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
}

/**
 * Yields each page of messages.list results, following nextPageToken.
 *
 * NOT usable when the work REMOVES what the selector matches. Page tokens are positions
 * in a result set, so deleting or unlabelling as you go invalidates them and silently
 * skips messages — strip-label.mjs re-queries the first page each round for exactly this
 * reason and must keep doing so. Adding a label is fine: the source set is unchanged,
 * which is why merge-label.mjs can page normally.
 */
export async function* messagePages(
  gmail: gmail_v1.Gmail,
  selector: MessageSelector
): AsyncGenerator<gmail_v1.Schema$Message[]> {
  const params = typeof selector === 'string' ? { q: selector } : selector;
  let pageToken: string | undefined;

  do {
    const res = await withRetry(() =>
      gmail.users.messages.list({
        userId: GMAIL_USER_ID,
        maxResults: LIST_PAGE_SIZE,
        pageToken,
        ...params,
      })
    );
    yield res.data.messages ?? [];
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
}

/**
 * Exact count of the messages matching a selector, paging past the per-page cap
 * (one API call per 500 matches).
 *
 * Gmail's own resultSizeEstimate is an estimate and is routinely wrong by a wide
 * margin — 201 reported against a true 433 — so it cannot be reported as a total.
 *
 * @param selector A Gmail query ('is:unread'), or any messages.list selector for what a
 *   query cannot express — notably `{ labelIds: [id], q }`, since a label name is unsafe
 *   as search input (parentheses match nothing; `&` and spaces tokenize into a sibling).
 */
export async function countMessagesMatching(
  gmail: gmail_v1.Gmail,
  selector: MessageSelector,
  { sampleSize = 0 }: { sampleSize?: number } = {}
): Promise<{ count: number; sampleIds: string[] }> {
  let count = 0;
  const sampleIds: string[] = [];

  for await (const messages of messagePages(gmail, selector)) {
    for (const message of messages) {
      if (sampleIds.length >= sampleSize) break;
      if (message.id) sampleIds.push(message.id);
    }
    count += messages.length;
  }

  return { count, sampleIds };
}

/**
 * Every message id matching a selector, paging until exhausted.
 *
 * Collect before mutating, never interleaved: an action that removes INBOX or UNREAD
 * can change whether later pages still match the selector that found them.
 *
 * `limit` is tested BEFORE each id is taken, not after. Testing after meant a limit of 0
 * returned one id, and a NaN limit — `Number('abc')` from a --max flag — compared false
 * forever and swept the entire mailbox. Both are rejected rather than interpreted: a
 * caller whose arithmetic produced one of them would otherwise get a sweep that looks
 * like a clean run over nothing, or over everything.
 */
export async function listAllMessageIds(
  gmail: gmail_v1.Gmail,
  selector: MessageSelector,
  { limit = Infinity }: { limit?: number } = {}
): Promise<string[]> {
  if (Number.isNaN(limit) || limit < 0) {
    throw new Error(`listAllMessageIds: limit must be a non-negative number, got ${limit}`);
  }

  const ids: string[] = [];
  // A limit of 0 is a coherent request for nothing, and costs no API call to honour.
  if (limit === 0) return ids;

  for await (const messages of messagePages(gmail, selector)) {
    for (const message of messages) {
      if (!message.id) continue;
      ids.push(message.id);
      if (ids.length >= limit) return ids;
    }
  }

  return ids;
}

/**
 * One batchModify request, bisecting on a failure the retries could not absorb.
 *
 * Without `onSkipped` a persistent failure propagates, which is what a caller applying
 * a specific label wants: a 400 "Invalid label" is permanent and every batch will hit
 * it. With it, the batch is halved until the failure is cornered in at most
 * MIN_SPLIT_BATCH ids, and those are skipped — so one message Gmail refuses to modify
 * costs a handful of skips instead of ending a 12,000-message run partway through.
 */
async function modifyOneBatch(
  gmail: gmail_v1.Gmail,
  ids: string[],
  modifications: GmailLabelChange,
  onSkipped?: (skipped: string[], error: unknown) => void
): Promise<number> {
  try {
    // Retried here rather than at each call site: a 429 partway through a bulk
    // modify leaves the run half-applied, and four of the six callers had no
    // retry at all.
    await withRetry(() =>
      gmail.users.messages.batchModify({
        userId: GMAIL_USER_ID,
        requestBody: { ids, ...modifications },
      })
    );
    return ids.length;
  } catch (error) {
    if (!onSkipped) throw error;
    if (ids.length <= MIN_SPLIT_BATCH) {
      onSkipped(ids, error);
      return 0;
    }
    const mid = Math.ceil(ids.length / 2);
    return (
      (await modifyOneBatch(gmail, ids.slice(0, mid), modifications, onSkipped)) +
      (await modifyOneBatch(gmail, ids.slice(mid), modifications, onSkipped))
    );
  }
}

/**
 * Apply one label change to many messages, batched at Gmail's own cap rather than a
 * smaller round number: six scripts hand-rolled this loop because a small default
 * turned one request into twenty. Progress reporting is opt-in for the same reason —
 * an unconditional log made the helper unusable anywhere the caller prints its own
 * totals, which is every caller.
 *
 * `onSkipped` both enables the bisect-and-skip in modifyOneBatch and is how the caller
 * hears about it. Those are deliberately the same switch: skipping is only acceptable
 * when it is reported, and this module cannot report it itself — it is loaded by the
 * MCP server, where a stray console write corrupts the stdio transport.
 *
 * @param messages Message ids, or message objects carrying an id
 * @returns The number of messages actually modified, which is below the selection size
 *   when `onSkipped` fired
 */
export async function batchModifyMessages(
  gmail: gmail_v1.Gmail,
  messages: Array<string | { id?: string | null }>,
  modifications: GmailLabelChange,
  {
    batchSize = GMAIL_BATCH_MODIFY_LIMIT,
    onProgress,
    onSkipped,
  }: {
    batchSize?: number;
    onProgress?: (done: number, total: number) => void;
    onSkipped?: (skipped: string[], error: unknown) => void;
  } = {}
): Promise<number> {
  const ids = messages
    .map((m) => (typeof m === 'string' ? m : m.id))
    .filter((id): id is string => Boolean(id));

  let modified = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    modified += await modifyOneBatch(gmail, ids.slice(i, i + batchSize), modifications, onSkipped);
    // Progress is position in the selection, not the modified count: a caller printing
    // "600/1000" means it has been through 600, whatever Gmail refused along the way.
    onProgress?.(Math.min(i + batchSize, ids.length), ids.length);
  }

  return modified;
}

/** Gmail reports a duplicate label as 409, but not always with a typed code. */
export function isAlreadyExistsError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return (
    code === LABEL_CONFLICT_STATUS ||
    (error instanceof Error && error.message.includes('exists'))
  );
}

/**
 * Look up a label by exact name, with its message and thread counts.
 *
 * Two calls because labels.list omits messagesTotal/threadsTotal — resolving the id
 * through labels.get keeps an existing label's shape identical to a created one, so
 * callers do not have to special-case which path produced it.
 */
export async function getLabelByName(
  gmail: gmail_v1.Gmail,
  name: string
): Promise<gmail_v1.Schema$Label | null> {
  const res = await gmail.users.labels.list({
    userId: GMAIL_USER_ID,
    fields: 'labels(id,name)',
  });

  const match = (res.data.labels ?? []).find((label) => label.name === name);
  if (!match?.id) return null;

  const detail = await gmail.users.labels.get({ userId: GMAIL_USER_ID, id: match.id });
  return detail.data;
}
