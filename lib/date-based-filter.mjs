/**
 * Date-based email filter utility
 * Abstracts logic for organizing emails by event date (past vs future)
 */
import * as chrono from 'chrono-node';
import { isBefore, startOfDay } from 'date-fns';
import { GMAIL_INBOX } from './constants.mjs';

// Event mail prints the date immediately after the event title, then advertises other
// events further down. extractEventDate takes the FIRST date it finds, so searching a
// whole body reads a neighbouring event's date as this one's — a Meetup announcement
// runs ~1,300 characters, of which the event's own date block is the first ~250 after
// the title.
const TITLE_WINDOW_CHARS = 300;
// Match on a prefix so an entity-escaped or truncated tail cannot lose the anchor.
const TITLE_MATCH_PREFIX = 40;
const MIN_QUOTED_TITLE = 3;

/**
 * A Date as Gmail's search grammar wants it, for `before:` and `after:`.
 *
 * Hand-rolled twice with the same padStart expression — archive-old-emails' gmailDate
 * and mark-old-label-read's defaultBefore. Local components, not toISOString: Gmail
 * reads the date in the mailbox's own timezone, so a UTC conversion shifts the cutoff
 * by a day for anyone west of it.
 *
 * @param {Date} date
 * @returns {string} YYYY/MM/DD
 */
export function toGmailDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}/${month}/${day}`;
}

/**
 * The Gmail-format date `days` ago, for an age cutoff expressed as `before:`.
 *
 * Prefer Gmail's own `older_than:Nd` where a bare relative age is all that is wanted;
 * this is for the callers that also accept an explicit --before and need the two to be
 * the same kind of value.
 *
 * @param {number} days
 * @returns {string} YYYY/MM/DD
 */
export function gmailDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toGmailDate(date);
}

/**
 * Parse an event date out of free email text.
 *
 * Delegates to chrono-node in STRICT mode. Strict ignores bare weekdays and casual
 * phrases ("Saturday", "tomorrow"), which the default mode resolves against the
 * reference date — that invents an event date for mail carrying none, and dates every
 * backfilled 2025 email to whenever the script happens to run.
 *
 * `forwardDate` preserves the behaviour of the regex parser this replaced: a date with
 * no year that has already passed is read as next year's, since event mail announces
 * events ahead of them.
 *
 * @param {string} content - Email subject or body text
 * @param {Date} [referenceDate] - Anchor for year-less dates; pass the message's own
 *   arrival time (internalDate) so old mail does not resolve against today
 * @returns {Date|null} Parsed date (carrying the event's time of day when the text gave
 *   one), or null if no explicit date is present
 */
export function extractEventDate(content, referenceDate = new Date()) {
  if (!content) return null;
  const [result] = chrono.strict.parse(content, referenceDate, { forwardDate: true });
  return result?.start?.date() ?? null;
}

/**
 * The event title as written in the subject: a quoted phrase when there is one
 * (`Can you make "Yoga Nidra"?`), else whatever follows the first colon
 * (`Just scheduled: Austin Robotics Paper Club`).
 *
 * @param {string} subject - Email subject line
 * @returns {string} Title, or '' when the subject carries no recognizable one
 */
export function eventTitleFromSubject(subject) {
  if (!subject) return '';
  const quoted = subject.match(/"([^"]{3,})"/);
  if (quoted && quoted[1].trim().length >= MIN_QUOTED_TITLE) return quoted[1].trim();
  const afterColon = subject.match(/:\s*(\S.*)$/);
  return afterColon ? afterColon[1].trim() : '';
}

const normalizeWhitespace = (text) => text.replace(/\s+/g, ' ');

/**
 * The slice of body immediately following the event title — where the event's own date
 * sits, ahead of the other events the mail goes on to advertise.
 *
 * The window starts AFTER the title, so a title that itself names a month
 * ("Walk & Talk: Connection in Motion for August") cannot supply the date.
 *
 * @param {string} body - Email body text
 * @param {string} title - Event title, from eventTitleFromSubject()
 * @param {number} [windowChars] - How far past the title to look
 * @returns {string|null} Windowed text, or null when the title is not found in the body
 */
export function windowAfterTitle(body, title, windowChars = TITLE_WINDOW_CHARS) {
  if (!body || !title) return null;
  const haystack = normalizeWhitespace(body);
  const fullTitle = normalizeWhitespace(title);
  const needle = fullTitle.slice(0, TITLE_MATCH_PREFIX);
  if (!needle) return null;
  const index = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) return null;
  // Advance past the WHOLE title when the body carries it in full: skipping only the
  // match prefix would leave the title's tail in the window, and a title ending in
  // "…for August" would then supply the month itself.
  const carriesFullTitle = haystack.slice(index, index + fullTitle.length).toLowerCase()
    === fullTitle.toLowerCase();
  const start = index + (carriesFullTitle ? fullTitle.length : needle.length);
  return haystack.slice(start, start + windowChars);
}

/**
 * Determine if event is in the past. Compared by day, so an event earlier today is not
 * past — extractEventDate now returns the event's time of day when the text carries one.
 *
 * @param {Date|null} eventDate - Event date (null if unknown)
 * @param {Date} [now] - Treated as "today"; injectable so tests need not mock the clock
 * @returns {boolean|null} true if past, false if future, null if unknown
 */
export function isPastEvent(eventDate, now = new Date()) {
  if (!eventDate) return null;
  // startOfDay copies rather than mutating, unlike the setHours(0,0,0,0) pair it replaces
  // — which quietly rewrote any Date handed to it.
  return isBefore(startOfDay(eventDate), startOfDay(now));
}

/**
 * Classify email by event recency
 * @param {string} emailSubject - Email subject line
 * @param {string} emailBody - Email body content
 * @param {Date} [referenceDate] - Anchor for year-less dates; pass the message's arrival
 *   time so a backfilled email resolves against when it was sent, not when this runs
 * @returns {object} Classification result
 *   - status: 'future' | 'past' | 'unknown'
 *   - eventDate: Date|null
 *   - reason: string (explanation)
 *   - source: 'subject' | 'title-window' | 'body' | null (where the date came from)
 */
export function classifyEmail(emailSubject, emailBody, referenceDate = new Date()) {
  // Subject, then the window just after the title, then the whole body. The window is
  // the precise read; the full-body pass stays last so nothing that resolved before
  // stops resolving, but a date it finds may belong to another event in the same mail —
  // `source` is what tells the two apart afterwards.
  const window = windowAfterTitle(emailBody, eventTitleFromSubject(emailSubject));
  const attempts = [
    ['subject', emailSubject],
    ['title-window', window],
    ['body', emailBody],
  ];

  let eventDate = null;
  let source = null;
  for (const [attemptSource, content] of attempts) {
    eventDate = extractEventDate(content, referenceDate);
    if (eventDate) {
      source = attemptSource;
      break;
    }
  }

  if (!eventDate) {
    return {
      status: 'unknown',
      eventDate: null,
      reason: 'Could not parse event date',
      source: null
    };
  }

  // Deliberately NOT referenceDate: that anchors year-less dates to when the mail
  // arrived, but past-vs-future is always relative to now — a 2025 event is past today
  // however recent it was when it landed.
  const isPast = isPastEvent(eventDate);
  const dateStr = eventDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  if (isPast) {
    return {
      status: 'past',
      eventDate,
      reason: `Event was ${dateStr}`,
      source
    };
  }

  return {
    status: 'future',
    eventDate,
    reason: `Event is ${dateStr}`,
    source
  };
}

/**
 * Determine Gmail actions based on email classification
 * @param {string} status - Classification status ('future' | 'past' | 'unknown')
 * @param {string} futureLabel - Label ID to apply to future events
 * @param {boolean} archivePast - Whether to archive past events (default: true)
 * @returns {object} Gmail API action object
 *   - addLabelIds: [label IDs to add]
 *   - removeLabelIds: [label IDs to remove]
 */
export function getGmailAction(status, futureLabel, archivePast = true) {
  const action = {
    addLabelIds: futureLabel ? [futureLabel] : [],
    removeLabelIds: []
  };

  if (status === 'past' && archivePast) {
    action.removeLabelIds.push(GMAIL_INBOX);
  }

  return action;
}

/**
 * Process a batch of emails with date-based filtering
 * @param {object[]} emails - Array of email objects with id, subject, body
 * @param {string} futureLabel - Label ID for future events
 * @param {boolean} archivePast - Whether to archive past events
 * @returns {object} Results with categorized emails
 *   - future: [email ids]
 *   - past: [email ids]
 *   - unknown: [email ids]
 *   - classifications: [email classifications]
 */
export function classifyEmails(emails, futureLabel, archivePast = true) {
  const results = {
    future: [],
    past: [],
    unknown: [],
    classifications: []
  };

  for (const email of emails) {
    const classification = classifyEmail(email.subject, email.body);
    classification.id = email.id;
    classification.action = getGmailAction(classification.status, futureLabel, archivePast);

    results.classifications.push(classification);
    results[classification.status].push(email.id);
  }

  return results;
}
