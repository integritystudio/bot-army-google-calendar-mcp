import { describe, it, expect, vi, afterEach } from 'vitest';
// @ts-expect-error - plain .mjs utility with no type declarations
import { eventTitleFromSubject, windowAfterTitle, classifyEmail, extractEventDate, isPastEvent, toGmailDate, gmailDateDaysAgo } from '../../../../lib/date-based-filter.mjs';

const FAR_FUTURE_YEAR = new Date().getFullYear() + 2;
const FAR_PAST_YEAR = new Date().getFullYear() - 2;

describe('extractEventDate', () => {
  const REF = new Date(2026, 0, 15);

  it.each([
    ['2026-03-25', 2026, 2, 25],
    ['03/25/2026', 2026, 2, 25],
    ['March 25, 2026', 2026, 2, 25],
    ['@ Mon, Mar 23 2026', 2026, 2, 23],
    ['Sunday, October 12, 2025 7:00 PM', 2025, 9, 12],
  ])('parses %s', (text, year, month, day) => {
    const d = extractEventDate(text, REF);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([year, month, day]);
  });

  // The regex parser this replaced looked up months by the first three letters, so any
  // word starting with a month abbreviation became a date: "Marathon 5" -> Mar 5.
  it.each(['Marathon 5 miles', 'Maybe 3 people', 'Mayor 12 speaks', 'Augment 7 tips', 'Deck 9 opens'])(
    'does not invent a date from %s',
    (text) => expect(extractEventDate(text, REF)).toBeNull(),
  );

  // Default (non-strict) chrono resolves these against the reference date, which would
  // date every backfilled email to whenever the script last ran.
  it.each(['Hide ads Saturday Morning Run', 'tomorrow at the usual place', 'Your new group is waiting'])(
    'ignores the relative/bare-weekday phrase %s',
    (text) => expect(extractEventDate(text, REF)).toBeNull(),
  );

  it('reads a year-less date as the next occurrence after the reference', () => {
    // Jan 15 is the reference; Jan 5 has passed, so it belongs to the following year.
    expect(extractEventDate('January 5', REF).getFullYear()).toBe(REF.getFullYear() + 1);
    expect(extractEventDate('March 25', REF).getFullYear()).toBe(REF.getFullYear());
  });

  it('anchors to the reference date, not to now', () => {
    const oldMail = new Date(2021, 5, 1);
    expect(extractEventDate('June 15', oldMail).getFullYear()).toBe(2021);
  });

  it('returns null for empty input', () => {
    expect(extractEventDate('', REF)).toBeNull();
    expect(extractEventDate(null, REF)).toBeNull();
  });
});

describe('isPastEvent', () => {
  const NOW = new Date(2026, 5, 15, 12, 0, 0);

  it('compares by day, so an event earlier today is not past', () => {
    expect(isPastEvent(new Date(2026, 5, 15, 9, 0, 0), NOW)).toBe(false);
  });

  it('reports yesterday as past and tomorrow as not', () => {
    expect(isPastEvent(new Date(2026, 5, 14, 23, 59), NOW)).toBe(true);
    expect(isPastEvent(new Date(2026, 5, 16, 0, 1), NOW)).toBe(false);
  });

  it('returns null when the date is unknown', () => {
    expect(isPastEvent(null, NOW)).toBeNull();
  });

  it('does not mutate its argument', () => {
    const event = new Date(2026, 5, 14, 8, 30, 15);
    const before = event.getTime();
    isPastEvent(event, NOW);
    expect(event.getTime()).toBe(before);
  });
});

describe('eventTitleFromSubject', () => {
  it('takes the quoted phrase when the subject has one', () => {
    expect(eventTitleFromSubject('📅 Saturday: Can you make "Saturday Morning Run."?'))
      .toBe('Saturday Morning Run.');
  });

  it('takes the text after the first colon otherwise', () => {
    expect(eventTitleFromSubject('📅 Just scheduled: Austin Robotics Paper Club'))
      .toBe('Austin Robotics Paper Club');
  });

  it('returns empty string when no title is recognizable', () => {
    expect(eventTitleFromSubject('Your friends are waiting')).toBe('');
    expect(eventTitleFromSubject('')).toBe('');
  });
});

describe('windowAfterTitle', () => {
  const body = 'Group X scheduled a new event Robotics Paper Club Thursday, October 30, 2025 1:00 PM '
    + 'RSVP now Details: something. Other events you might like: Kickball Sunday, March 2, 2026';

  it('returns the slice following the title, not the whole body', () => {
    const window = windowAfterTitle(body, 'Robotics Paper Club', 40);
    expect(window).toContain('Thursday, October 30, 2025');
    expect(window).not.toContain('March 2, 2026');
  });

  it('starts after the title so a month inside the title cannot supply the date', () => {
    const augustBody = 'Walk & Talk: Connection in Motion for August Monday, August 11, 2025 6:30 PM';
    const window = windowAfterTitle(augustBody, 'Walk & Talk: Connection in Motion for August');
    expect(window?.trim()).toBe('Monday, August 11, 2025 6:30 PM');
  });

  it('matches across differing whitespace', () => {
    expect(windowAfterTitle('a  Darden   Smith:  A  Common Prayer Friday', 'Darden Smith: A Common Prayer'))
      .toContain('Friday');
  });

  it('returns null when the title is absent or inputs are empty', () => {
    expect(windowAfterTitle(body, 'Nowhere To Be Found')).toBeNull();
    expect(windowAfterTitle('', 'title')).toBeNull();
    expect(windowAfterTitle(body, '')).toBeNull();
  });
});

describe('classifyEmail date source', () => {
  it('prefers the window over a later date belonging to another event', () => {
    const body = `Group scheduled a new event Paper Club Thursday, October 30, ${FAR_PAST_YEAR} 1:00 PM `
      + `RSVP now. Other events: Kickball Sunday, March 2, ${FAR_FUTURE_YEAR}`;
    const result = classifyEmail('📅 Just scheduled: Paper Club', body);
    expect(result.source).toBe('title-window');
    expect(result.status).toBe('past');
    expect(result.eventDate.getFullYear()).toBe(FAR_PAST_YEAR);
  });

  it('still reads the subject first', () => {
    const result = classifyEmail(`Event on March 5, ${FAR_FUTURE_YEAR}`, 'body with January 1, 2020');
    expect(result.source).toBe('subject');
    expect(result.status).toBe('future');
  });

  it('falls back to the whole body when the title is not found there', () => {
    const result = classifyEmail('📅 Just scheduled: Absent Title', `Some text March 5, ${FAR_FUTURE_YEAR}`);
    expect(result.source).toBe('body');
    expect(result.status).toBe('future');
  });

  it('reports unknown with a null source when no date exists', () => {
    const result = classifyEmail('📅 Just scheduled: Trivia Night', '');
    expect(result.status).toBe('unknown');
    expect(result.source).toBeNull();
  });
});

describe('toGmailDate', () => {
  it.each([
    [new Date(2026, 0, 5), '2026/01/05'],
    [new Date(2026, 11, 31), '2026/12/31'],
    [new Date(2026, 8, 9), '2026/09/09'],
  ])('renders %s as %s', (date: Date, expected: string) => {
    expect(toGmailDate(date)).toBe(expected);
  });

  // Gmail reads before:/after: in the mailbox's timezone. toISOString would convert to
  // UTC first and shift the cutoff by a day for anyone west of it — this date is the
  // 31st locally and the 1st in UTC.
  it('uses local components, not the UTC date', () => {
    const lateEvening = new Date(2026, 11, 31, 23, 30);
    expect(toGmailDate(lateEvening)).toBe('2026/12/31');
  });
});

describe('gmailDateDaysAgo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts back the given number of days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 12, 0));
    expect(gmailDateDaysAgo(30)).toBe('2026/07/23');
  });

  it('crosses a month boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 3, 12, 0));
    expect(gmailDateDaysAgo(7)).toBe('2026/02/24');
  });

  it('is today for 0 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 3, 12, 0));
    expect(gmailDateDaysAgo(0)).toBe('2026/03/03');
  });
});
