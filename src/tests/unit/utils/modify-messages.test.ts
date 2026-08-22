import { describe, it, expect, vi, afterEach } from 'vitest';
// @ts-expect-error - plain .mjs CLI script with no type declarations
import { modifyMessages } from '../../../../modify-messages.mjs';

interface ListParams {
  q?: string;
  labelIds?: string[];
  pageToken?: string;
}

interface ModifyCall {
  ids: string[];
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

const LABELS = [
  { id: 'Label_1', name: 'Keep Important', type: 'user' },
  { id: 'Label_2', name: 'Newsletters', type: 'user' },
  { id: 'INBOX', name: 'INBOX', type: 'system' },
  { id: 'UNREAD', name: 'UNREAD', type: 'system' },
];

/**
 * Gmail stub whose messages.list answers by label membership, the way the real API
 * does: labelIds are ANDed, so asking for the selection plus a protected label returns
 * their intersection. `membership` maps a message id to the labels it carries.
 */
const gmailStub = (membership: Record<string, string[]>) => {
  const modifyCalls: ModifyCall[] = [];
  const listParams: ListParams[] = [];
  return {
    modifyCalls,
    listParams,
    users: {
      labels: {
        list: async () => ({ data: { labels: LABELS } }),
      },
      messages: {
        list: async (params: ListParams) => {
          listParams.push(params);
          const required = params.labelIds ?? [];
          const matched = Object.entries(membership)
            .filter(([, labels]) => required.every(id => labels.includes(id)))
            .map(([id]) => ({ id }));
          return { data: { messages: matched } };
        },
        get: async ({ id }: { id: string }) => ({
          data: {
            id,
            labelIds: membership[id],
            internalDate: '0',
            payload: { headers: [{ name: 'From', value: `${id}@example.com` }] },
          },
        }),
        batchModify: async ({ requestBody }: { requestBody: ModifyCall }) => {
          modifyCalls.push(requestBody);
          return { data: {} };
        },
      },
    },
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('modifyMessages --exclude-label', () => {
  // The capability inherited from bulk-archive-unread.mjs. It cannot be a
  // `-label:"Keep Important"` clause: a label name is unsafe search input, and this one
  // contains a space (see README.md#known-issues).
  it('leaves messages carrying the excluded label alone', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const gmail = gmailStub({
      keep: ['INBOX', 'UNREAD', 'Label_1'],
      archive1: ['INBOX', 'UNREAD'],
      archive2: ['INBOX', 'UNREAD'],
    });

    const { matched, modified } = await modifyMessages(gmail, {
      query: 'is:unread in:inbox',
      excludeLabel: 'Keep Important',
      remove: ['INBOX'],
      apply: true,
    });

    expect(matched).toBe(2);
    expect(modified).toBe(2);
    expect(gmail.modifyCalls).toHaveLength(1);
    expect(gmail.modifyCalls[0].ids.sort()).toEqual(['archive1', 'archive2']);
    expect(gmail.modifyCalls[0].removeLabelIds).toEqual(['INBOX']);
  });

  it('selects the protected set by label id, never a label: query', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const gmail = gmailStub({ keep: ['INBOX', 'Label_1'], other: ['INBOX'] });

    await modifyMessages(gmail, {
      query: 'in:inbox',
      excludeLabel: 'Keep Important',
      remove: ['INBOX'],
      apply: true,
    });

    const exclusionList = gmail.listParams.find(p => p.labelIds?.includes('Label_1'));
    expect(exclusionList).toBeDefined();
    expect(gmail.listParams.every(p => !(p.q ?? '').includes('label:'))).toBe(true);
  });

  it('carries the rest of the selection into the exclusion query', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const gmail = gmailStub({ a: ['Label_2', 'UNREAD'] });

    await modifyMessages(gmail, {
      labelName: 'Newsletters',
      unreadOnly: true,
      excludeLabel: 'Keep Important',
      remove: ['UNREAD'],
      apply: true,
    });

    // Without the selection's own labelIds the exclusion would protect every message
    // carrying "Keep Important" anywhere in the mailbox, not just those in this sweep.
    const exclusionList = gmail.listParams.find(p => p.labelIds?.includes('Label_1'));
    expect(exclusionList?.labelIds).toEqual(['Label_2', 'UNREAD', 'Label_1']);
  });

  it('fails before the paging spend when the excluded label does not exist', async () => {
    const gmail = gmailStub({ a: ['INBOX'] });

    await expect(modifyMessages(gmail, {
      query: 'in:inbox',
      excludeLabel: 'Typoed Label',
      remove: ['INBOX'],
      apply: true,
    })).rejects.toThrow('Label not found: "Typoed Label"');
  });

  it('changes nothing when every match is protected', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const gmail = gmailStub({ keep: ['INBOX', 'UNREAD', 'Label_1'] });

    const { matched, modified } = await modifyMessages(gmail, {
      query: 'is:unread in:inbox',
      excludeLabel: 'Keep Important',
      remove: ['INBOX'],
      apply: true,
    });

    expect({ matched, modified }).toEqual({ matched: 0, modified: 0 });
    expect(gmail.modifyCalls).toHaveLength(0);
  });
});
