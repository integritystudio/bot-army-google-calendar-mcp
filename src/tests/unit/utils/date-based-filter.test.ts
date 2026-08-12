import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs utility with no type declarations
import { eventTitleFromSubject, windowAfterTitle, classifyEmail } from '../../../../lib/date-based-filter.mjs';

const FAR_FUTURE_YEAR = new Date().getFullYear() + 2;
const FAR_PAST_YEAR = new Date().getFullYear() - 2;

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
