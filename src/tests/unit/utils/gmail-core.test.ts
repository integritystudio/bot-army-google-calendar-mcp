import { describe, it, expect } from 'vitest';
import { buildLabelChange } from '../../../shared/gmail-core.js';

describe('buildLabelChange', () => {
  it('maps archive to removing INBOX', () => {
    expect(buildLabelChange({ archive: true })).toEqual({ removeLabelIds: ['INBOX'] });
  });

  it('maps markAsRead to removing UNREAD', () => {
    expect(buildLabelChange({ markAsRead: true })).toEqual({ removeLabelIds: ['UNREAD'] });
  });

  it('maps markAsSpam to adding SPAM', () => {
    expect(buildLabelChange({ markAsSpam: true })).toEqual({ addLabelIds: ['SPAM'] });
  });

  it('maps markAsTrash to adding TRASH', () => {
    expect(buildLabelChange({ markAsTrash: true })).toEqual({ addLabelIds: ['TRASH'] });
  });

  it('maps neverMarkAsSpam to removing SPAM', () => {
    expect(buildLabelChange({ neverMarkAsSpam: true })).toEqual({ removeLabelIds: ['SPAM'] });
  });

  it('combines multiple remove-flags in flag-declaration order', () => {
    // Not load-bearing for filter-identity comparison (filterKey sorts before comparing),
    // but create-filters.mjs's describeFilter() displays this order, so it's pinned as
    // deliberate rather than an accident of LABEL_CHANGE_FLAGS's iteration order.
    expect(buildLabelChange({ archive: true, markAsRead: true }))
      .toEqual({ removeLabelIds: ['INBOX', 'UNREAD'] });
  });

  it('returns an empty object when no flag is set', () => {
    expect(buildLabelChange({})).toEqual({});
  });

  it('returns an empty object when every flag is explicitly false', () => {
    expect(buildLabelChange({
      archive: false,
      markAsRead: false,
      markAsSpam: false,
      markAsTrash: false,
      neverMarkAsSpam: false,
    })).toEqual({});
  });

  it('never emits an addLabelIds or removeLabelIds key with an empty array', () => {
    const result = buildLabelChange({ archive: true });
    expect(result).not.toHaveProperty('addLabelIds');
  });

  it('preserves explicit addLabelIds when no flags are set', () => {
    expect(buildLabelChange({ addLabelIds: ['Custom'] })).toEqual({ addLabelIds: ['Custom'] });
  });

  it('preserves explicit removeLabelIds when no flags are set', () => {
    expect(buildLabelChange({ removeLabelIds: ['Custom'] })).toEqual({ removeLabelIds: ['Custom'] });
  });

  it('appends a flag-derived label after explicit addLabelIds', () => {
    expect(buildLabelChange({ addLabelIds: ['Custom'], markAsSpam: true }))
      .toEqual({ addLabelIds: ['Custom', 'SPAM'] });
  });

  it('does not duplicate a label already present in explicit addLabelIds', () => {
    expect(buildLabelChange({ addLabelIds: ['SPAM'], markAsSpam: true }))
      .toEqual({ addLabelIds: ['SPAM'] });
  });

  it('does not duplicate a label already present in explicit removeLabelIds', () => {
    expect(buildLabelChange({ removeLabelIds: ['INBOX'], archive: true }))
      .toEqual({ removeLabelIds: ['INBOX'] });
  });

  // Not validated as mutually exclusive: the function folds each flag independently,
  // so contradictory flags produce a change that both adds and removes the same label.
  // Gmail applies removeLabelIds before addLabelIds, so this is not a no-op — pinned
  // here so a future "make these flags exclusive" change is a deliberate decision.
  it('applies markAsSpam and neverMarkAsSpam independently when both are set', () => {
    expect(buildLabelChange({ markAsSpam: true, neverMarkAsSpam: true }))
      .toEqual({ addLabelIds: ['SPAM'], removeLabelIds: ['SPAM'] });
  });
});
