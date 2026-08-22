import { describe, it, expect, vi, afterEach } from 'vitest';
// @ts-expect-error - plain .mjs utility with no type declarations
import { batchModifyMessages, searchAndModify } from '../../../../lib/gmail-batch-utils.mjs';

interface ModifyCall {
  ids: string[];
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

/** Gmail stub recording every batchModify request; `failures` rejections come first. */
const gmailStub = (failures: unknown[] = []) => {
  const calls: ModifyCall[] = [];
  let failed = 0;
  return {
    calls,
    users: {
      messages: {
        batchModify: async ({ requestBody }: { requestBody: ModifyCall }) => {
          if (failed < failures.length) {
            failed++;
            throw failures[failed - 1];
          }
          calls.push(requestBody);
          return { data: {} };
        },
      },
    },
  };
};

const ids = (n: number) => Array.from({ length: n }, (_, i) => `m${i}`);

/**
 * Gmail stub whose batchModify rejects any batch containing `poison`, however small.
 * Stands in for the message Gmail persistently refuses to modify — the failure the
 * bisect exists for, as opposed to a transient one withRetry absorbs.
 */
const poisonedStub = (poison: string) => {
  const applied: string[] = [];
  return {
    applied,
    users: {
      messages: {
        batchModify: async ({ requestBody }: { requestBody: ModifyCall }) => {
          if (requestBody.ids.includes(poison)) {
            throw Object.assign(new Error('Invalid message'), { code: 400 });
          }
          applied.push(...requestBody.ids);
          return { data: {} };
        },
      },
    },
  };
};

/** Gmail stub paging messages.list in fixed-size pages, recording batchModify calls. */
const listingStub = (total: number, pageSize = 2) => {
  const calls: ModifyCall[] = [];
  let listRequests = 0;
  return {
    calls,
    get listRequests() { return listRequests; },
    users: {
      messages: {
        list: async ({ pageToken }: { pageToken?: string }) => {
          listRequests++;
          const start = pageToken ? Number(pageToken) : 0;
          const page = ids(total).slice(start, start + pageSize);
          const next = start + pageSize;
          return {
            data: {
              messages: page.map(id => ({ id })),
              nextPageToken: next < total ? String(next) : undefined,
            },
          };
        },
        batchModify: async ({ requestBody }: { requestBody: ModifyCall }) => {
          calls.push(requestBody);
          return { data: {} };
        },
      },
    },
  };
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('batchModifyMessages', () => {
  it('sends one request per 1000 ids, Gmail\'s own cap', async () => {
    const gmail = gmailStub();
    const total = await batchModifyMessages(gmail, ids(2001), { removeLabelIds: ['UNREAD'] });

    expect(total).toBe(2001);
    expect(gmail.calls.map(c => c.ids.length)).toEqual([1000, 1000, 1]);
  });

  it('accepts message objects as well as id strings', async () => {
    const gmail = gmailStub();
    await batchModifyMessages(gmail, [{ id: 'a' }, 'b'], { addLabelIds: ['SPAM'] });

    expect(gmail.calls[0].ids).toEqual(['a', 'b']);
    expect(gmail.calls[0].addLabelIds).toEqual(['SPAM']);
  });

  it('makes no request for an empty selection', async () => {
    const gmail = gmailStub();
    expect(await batchModifyMessages(gmail, [], { addLabelIds: ['X'] })).toBe(0);
    expect(gmail.calls).toHaveLength(0);
  });

  // The old unconditional progress log is why six scripts hand-rolled this loop
  // instead of calling here: every caller prints its own totals.
  it('logs nothing unless a progress callback is given', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await batchModifyMessages(gmailStub(), ids(3), { addLabelIds: ['X'] });

    expect(log).not.toHaveBeenCalled();
  });

  it('reports cumulative progress against the total, clamped to it', async () => {
    const seen: Array<[number, number]> = [];
    await batchModifyMessages(gmailStub(), ids(1500), { addLabelIds: ['X'] }, {
      onProgress: (done: number, total: number) => seen.push([done, total]),
    });

    expect(seen).toEqual([[1000, 1500], [1500, 1500]]);
  });

  it('retries a transient failure rather than leaving the run half-applied', async () => {
    vi.useFakeTimers();
    const gmail = gmailStub([Object.assign(new Error('Rate limited'), { code: 429 })]);

    const pending = batchModifyMessages(gmail, ids(2), { removeLabelIds: ['UNREAD'] });
    await vi.runAllTimersAsync();

    expect(await pending).toBe(2);
    expect(gmail.calls).toHaveLength(1);
  });

  it('propagates a non-transient failure instead of reporting success', async () => {
    const gmail = gmailStub([Object.assign(new Error('Invalid label'), { code: 400 })]);

    await expect(batchModifyMessages(gmail, ids(2), { addLabelIds: ['nope'] }))
      .rejects.toThrow('Invalid label');
  });

  // googleapis surfaces FAILED_PRECONDITION as a typed cause, not in the message, so
  // the message-substring check alone read it as permanent and gave up on the batch.
  it('retries a FAILED_PRECONDITION carried on error.cause', async () => {
    vi.useFakeTimers();
    const gmail = gmailStub([Object.assign(new Error('Bad Request'), {
      code: 400,
      cause: { status: 'FAILED_PRECONDITION' },
    })]);

    const pending = batchModifyMessages(gmail, ids(2), { removeLabelIds: ['INBOX'] });
    await vi.runAllTimersAsync();

    expect(await pending).toBe(2);
    expect(gmail.calls).toHaveLength(1);
  });

  describe('with onSkipped', () => {
    it('bisects around the messages Gmail refuses and applies the rest', async () => {
      const gmail = poisonedStub('m0');
      const skipped: string[] = [];

      const modified = await batchModifyMessages(gmail, ids(100), { removeLabelIds: ['INBOX'] }, {
        batchSize: 100,
        onSkipped: (batch: string[]) => skipped.push(...batch),
      });

      // 100 -> 50 -> 25, which is the floor, so the poisoned quarter is skipped whole.
      expect(skipped).toHaveLength(25);
      expect(skipped).toContain('m0');
      expect(modified).toBe(75);
      expect(gmail.applied).toHaveLength(75);
      expect(gmail.applied).not.toContain('m0');
    });

    // The count is what callers print. Reporting the selection size would say a run
    // succeeded on messages it never touched.
    it('returns what applied, not what was selected', async () => {
      const gmail = poisonedStub('m0');
      const modified = await batchModifyMessages(gmail, ids(30), { addLabelIds: ['X'] }, {
        batchSize: 30,
        onSkipped: () => {},
      });

      expect(modified).toBeLessThan(30);
      expect(modified).toBe(gmail.applied.length);
    });

    it('reports the failure alongside the ids it gave up on', async () => {
      const gmail = poisonedStub('m0');
      const seen: unknown[] = [];
      await batchModifyMessages(gmail, ids(30), { addLabelIds: ['X'] }, {
        batchSize: 30,
        onSkipped: (_batch: string[], error: unknown) => seen.push(error),
      });

      expect(seen).toHaveLength(1);
      expect((seen[0] as Error).message).toBe('Invalid message');
    });
  });
});

describe('searchAndModify', () => {
  it('pages the query to exhaustion before modifying anything', async () => {
    const gmail = listingStub(5);
    const count = await searchAndModify(gmail, 'is:unread', { removeLabelIds: ['INBOX'] });

    expect(count).toBe(5);
    // One modify call, after all three pages: the modification changes whether later
    // pages still match, so collecting first is what keeps the sweep complete.
    expect(gmail.calls).toHaveLength(1);
    expect(gmail.calls[0].ids).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
    expect(gmail.listRequests).toBe(3);
  });

  it('stops at maxResults, for a query too broad to sweep unbounded', async () => {
    const gmail = listingStub(100);
    const count = await searchAndModify(gmail, 'subject:receipt', { addLabelIds: ['Billing'] }, 3);

    expect(count).toBe(3);
    expect(gmail.calls[0].ids).toEqual(['m0', 'm1', 'm2']);
  });

  it('makes no modify request when the query matches nothing', async () => {
    const gmail = listingStub(0);
    expect(await searchAndModify(gmail, 'from:nobody.example', { addLabelIds: ['X'] })).toBe(0);
    expect(gmail.calls).toHaveLength(0);
  });
});
