import { describe, it, expect, vi, afterEach } from 'vitest';
// @ts-expect-error - plain .mjs utility with no type declarations
import { batchModifyMessages } from '../../../../lib/gmail-batch-utils.mjs';

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
});
