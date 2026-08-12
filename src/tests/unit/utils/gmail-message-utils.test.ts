import { describe, it, expect, vi } from 'vitest';
// @ts-expect-error - plain .mjs utility with no type declarations
import { htmlToText, extractBodyText, decodeMessageBody, countMessagesMatching, fetchMessageHeaders, listAllMessageIds, messagePages } from '../../../../lib/gmail-message-utils.mjs';

/** Gmail stub returning the given pages of message ids, one per list() call. */
const gmailWithPages = (pages: string[][]) => {
  let call = 0;
  return {
    users: {
      messages: {
        list: async () => {
          const page = pages[call++] ?? [];
          return {
            data: {
              messages: page.map((id) => ({ id })),
              nextPageToken: call < pages.length ? `t${call}` : undefined,
            },
          };
        },
      },
    },
  };
};

const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64');
const part = (mimeType: string, body: string) => ({ mimeType, body: { data: b64(body) } });

describe('htmlToText', () => {
  it('drops style and script content', () => {
    const html = '<html><style>.a { margin: 0 !important; }</style><body>Event on Oct 30'
      + '<script>var x = 1;</script></body></html>';
    expect(htmlToText(html)).toBe('Event on Oct 30');
  });

  // The regex this replaced was /<style[\s\S]*?<\/style>/ — a '>' inside an attribute
  // ends the tag match early for a tag-stripper, leaking the rules as text.
  it('drops a style block whose attribute contains a angle bracket', () => {
    const html = '<style media="all and (min-width: 1px)" data-x="a>b">.c { color: red; }</style><p>Real text</p>';
    const text = htmlToText(html);
    expect(text).toBe('Real text');
    expect(text).not.toContain('color');
  });

  it('decodes entities beyond the two the regex version handled', () => {
    expect(htmlToText('<p>Tom &amp; Jerry&nbsp;&mdash;&nbsp;7&nbsp;PM &lt;live&gt;</p>'))
      .toBe('Tom & Jerry — 7 PM <live>');
  });

  it('does not insert a space where a decoded entity splits a word', () => {
    expect(htmlToText('<p>caf&eacute; opens</p>')).toBe('café opens');
  });

  it('collapses whitespace and separates block content', () => {
    expect(htmlToText('<div>One</div>\n\n<div>Two</div>')).toBe('One Two');
  });

  it('returns empty string for empty input', () => {
    expect(htmlToText('')).toBe('');
    expect(htmlToText(null)).toBe('');
  });
});

describe('decodeMessageBody', () => {
  it('finds a text/plain part nested inside multipart/alternative', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [{ mimeType: 'multipart/alternative', parts: [part('text/plain', 'nested body')] }],
    };
    expect(decodeMessageBody(payload)).toBe('nested body');
  });

  it('returns empty string when there is no text part', () => {
    expect(decodeMessageBody({ mimeType: 'multipart/mixed', parts: [] })).toBe('');
    expect(decodeMessageBody(undefined)).toBe('');
  });
});

describe('extractBodyText', () => {
  const html = '<html><style>.h { padding: 0 !important; }</style><body>Robotics Club '
    + 'Thursday, October 30, 2025</body></html>';

  it('uses text/plain when it carries prose', () => {
    const payload = { mimeType: 'multipart/alternative', parts: [part('text/plain', 'Plain prose body'), part('text/html', html)] };
    expect(extractBodyText(payload)).toBe('Plain prose body');
  });

  // Both of the next two were returned verbatim by the previous `if (plain) return plain`,
  // so the HTML holding the event date was never parsed.
  it('falls back to HTML when the plain part is only whitespace', () => {
    const payload = { mimeType: 'multipart/alternative', parts: [part('text/plain', '\r\n\r\n\r\n'), part('text/html', html)] };
    expect(extractBodyText(payload)).toBe('Robotics Club Thursday, October 30, 2025');
  });

  it('falls back to HTML when the plain part is a stylesheet dump', () => {
    const css = '.hero { margin: 0 30px !important; } @media only screen { .x { display: none; } }';
    const payload = { mimeType: 'multipart/alternative', parts: [part('text/plain', css), part('text/html', html)] };
    const text = extractBodyText(payload);
    expect(text).toBe('Robotics Club Thursday, October 30, 2025');
    expect(text).not.toContain('!important');
  });

  it('returns the plain part when there is no HTML to fall back to', () => {
    const payload = { mimeType: 'multipart/alternative', parts: [part('text/plain', '   ')] };
    expect(extractBodyText(payload)).toBe('');
  });
});

describe('countMessagesMatching', () => {
  it('counts across every page, not just the first', async () => {
    const { count } = await countMessagesMatching(gmailWithPages([['a', 'b'], ['c', 'd'], ['e']]), 'q');
    expect(count).toBe(5);
  });

  // The slice end is `sampleSize - sampleIds.length`; if collection could overshoot,
  // that would go negative and slice would read it as an offset from the end, taking
  // the wrong ids instead of none.
  it('stops collecting ids at exactly sampleSize and never overshoots', async () => {
    const { count, sampleIds } = await countMessagesMatching(
      gmailWithPages([['a', 'b'], ['c', 'd'], ['e', 'f']]), 'q', { sampleSize: 3 },
    );
    expect(sampleIds).toEqual(['a', 'b', 'c']);
    expect(count).toBe(6);
  });

  it('collects nothing when no sample is requested', async () => {
    const { sampleIds } = await countMessagesMatching(gmailWithPages([['a', 'b']]), 'q');
    expect(sampleIds).toEqual([]);
  });

  it('returns all ids when sampleSize exceeds the matches', async () => {
    const { sampleIds } = await countMessagesMatching(gmailWithPages([['a', 'b']]), 'q', { sampleSize: 10 });
    expect(sampleIds).toEqual(['a', 'b']);
  });
});

describe('fetchMessageHeaders', () => {
  const headers = (subject: string) => ({
    data: { payload: { headers: [{ name: 'Subject', value: subject }, { name: 'From', value: 'a@b.c' }] } },
  });

  it('retries a transient failure rather than dropping the message', async () => {
    let attempts = 0;
    const gmail = {
      users: {
        messages: {
          get: async () => {
            if (++attempts === 1) {
              const err: Error & { code?: number } = new Error('rate limited');
              err.code = 429;
              throw err;
            }
            return headers('Recovered');
          },
        },
      },
    };
    // Fake timers so the retry backoff does not cost the suite a real 3s sleep.
    vi.useFakeTimers();
    const pending = fetchMessageHeaders(gmail, ['id1']);
    await vi.runAllTimersAsync();
    const rows = await pending;
    vi.useRealTimers();

    expect(attempts).toBe(2);
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe('Recovered');
  });

  it('reports a permanent failure instead of silently shrinking the result', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const gmail = {
      users: { messages: { get: async ({ id }: { id: string }) => {
        if (id === 'bad') throw new Error('gone');
        return headers('Fine');
      } } },
    };
    const rows = await fetchMessageHeaders(gmail, ['ok', 'bad']);
    expect(rows).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1 of 2'));
    warn.mockRestore();
  });

  // Callers that label what they fetched cannot zip the result back against the
  // input ids, because a dropped failure shifts every later row by one.
  it('carries each message id so a dropped failure cannot misalign the rows', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const gmail = {
      users: { messages: { get: async ({ id }: { id: string }) => {
        if (id === 'bad') throw new Error('gone');
        return { data: { id, ...headers(`subject-${id}`).data } };
      } } },
    };
    const rows = await fetchMessageHeaders(gmail, ['first', 'bad', 'last']);

    expect(rows.map((r: { id: string }) => r.id)).toEqual(['first', 'last']);
    expect(rows[1].subject).toBe('subject-last');
    warn.mockRestore();
  });
});

describe('countMessagesMatching selectors', () => {
  const capturingGmail = (seen: Record<string, unknown>[]) => ({
    users: { messages: { list: async (params: Record<string, unknown>) => {
      seen.push(params);
      return { data: { messages: [{ id: 'a' }], nextPageToken: undefined } };
    } } },
  });

  it('treats a string as a query', async () => {
    const seen: Record<string, unknown>[] = [];
    await countMessagesMatching(capturingGmail(seen), 'is:unread');
    expect(seen[0]).toMatchObject({ q: 'is:unread' });
  });

  // A label name is unsafe as search input (parens return 0 matches), so counting a
  // label's mail has to go through labelIds, which a query-only signature cannot express.
  it('passes an object selector through to messages.list', async () => {
    const seen: Record<string, unknown>[] = [];
    await countMessagesMatching(capturingGmail(seen), { q: 'from:x.com', labelIds: ['Label_18'] });
    expect(seen[0]).toMatchObject({ q: 'from:x.com', labelIds: ['Label_18'] });
  });
});

describe('listAllMessageIds', () => {
  it('collects ids across every page', async () => {
    const ids = await listAllMessageIds(gmailWithPages([['a', 'b'], ['c'], ['d', 'e']]), 'q');
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('stops early once the limit is reached', async () => {
    const ids = await listAllMessageIds(gmailWithPages([['a', 'b'], ['c', 'd']]), 'q', { limit: 3 });
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array when nothing matches', async () => {
    expect(await listAllMessageIds(gmailWithPages([[]]), 'q')).toEqual([]);
  });

  it('accepts an object selector', async () => {
    const seen: Record<string, unknown>[] = [];
    const gmail = { users: { messages: { list: async (p: Record<string, unknown>) => {
      seen.push(p);
      return { data: { messages: [{ id: 'a' }], nextPageToken: undefined } };
    } } } };
    await listAllMessageIds(gmail, { labelIds: ['L1'] });
    expect(seen[0]).toMatchObject({ labelIds: ['L1'] });
  });
});

describe('messagePages', () => {
  it('yields one array per page, following the token', async () => {
    const pages = [];
    for await (const page of messagePages(gmailWithPages([['a'], ['b', 'c']]), 'q')) pages.push(page);
    expect(pages.map((p) => p.map((m: { id: string }) => m.id))).toEqual([['a'], ['b', 'c']]);
  });
});
