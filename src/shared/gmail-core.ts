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

const LIST_PAGE_SIZE = 500;
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 3000;
const TRANSIENT_STATUS_CODES = [429, 500, 503];
const TRANSIENT_MESSAGE = 'Precondition';

export type MessageSelector = string | gmail_v1.Params$Resource$Users$Messages$List;

export interface GmailLabelChange {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

/** Gmail intermittently throws FAILED_PRECONDITION / 429 on rapid bulk operations. */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      const transient =
        (error instanceof Error && error.message.includes(TRANSIENT_MESSAGE)) ||
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
 */
export async function listAllMessageIds(
  gmail: gmail_v1.Gmail,
  selector: MessageSelector,
  { limit = Infinity }: { limit?: number } = {}
): Promise<string[]> {
  const ids: string[] = [];

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
 * Apply one label change to many messages, batched at Gmail's own cap rather than a
 * smaller round number: six scripts hand-rolled this loop because a small default
 * turned one request into twenty. Progress reporting is opt-in for the same reason —
 * an unconditional log made the helper unusable anywhere the caller prints its own
 * totals, which is every caller.
 *
 * @param messages Message ids, or message objects carrying an id
 */
export async function batchModifyMessages(
  gmail: gmail_v1.Gmail,
  messages: Array<string | { id?: string | null }>,
  modifications: GmailLabelChange,
  {
    batchSize = GMAIL_BATCH_MODIFY_LIMIT,
    onProgress,
  }: { batchSize?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<number> {
  const ids = messages
    .map((m) => (typeof m === 'string' ? m : m.id))
    .filter((id): id is string => Boolean(id));

  for (let i = 0; i < ids.length; i += batchSize) {
    // Retried here rather than at each call site: a 429 partway through a bulk
    // modify leaves the run half-applied, and four of the six callers had no
    // retry at all.
    await withRetry(() =>
      gmail.users.messages.batchModify({
        userId: GMAIL_USER_ID,
        requestBody: { ids: ids.slice(i, i + batchSize), ...modifications },
      })
    );
    onProgress?.(Math.min(i + batchSize, ids.length), ids.length);
  }

  return ids.length;
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
