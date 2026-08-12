/**
 * Date-based email filter utility
 * Abstracts logic for organizing emails by event date (past vs future)
 */
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
 * Parse event date from email content
 * Supports multiple date formats
 * @param {string} content - Email subject or body text
 * @returns {Date|null} Parsed date or null if not found
 */
export function extractEventDate(content) {
  if (!content) return null;

  const today = new Date();
  const currentYear = today.getFullYear();

  const months = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
  };

  // Try ISO format: 2026-03-25 or 2026/03/25
  let match = content.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const day = parseInt(match[3]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }

  // Try MM/DD/YYYY or MM-DD-YYYY
  match = content.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (match) {
    const month = parseInt(match[1]) - 1;
    const day = parseInt(match[2]);
    const year = parseInt(match[3]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }

  // Try M/D or MM/DD (assume current or next year)
  match = content.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\s|$)/);
  if (match) {
    const month = parseInt(match[1]) - 1;
    const day = parseInt(match[2]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      let year = currentYear;
      // If month/day has passed, assume next year
      const testDate = new Date(year, month, day);
      if (testDate < today) {
        year = currentYear + 1;
      }
      return new Date(year, month, day);
    }
  }

  // Try "Month Day, Year" or "Month Day" formats
  match = content.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})?/);
  if (match) {
    const monthStr = match[1];
    const day = parseInt(match[2]);
    const year = match[3] ? parseInt(match[3]) : currentYear;
    const monthIndex = months[monthStr.toLowerCase().substring(0, 3)];

    if (monthIndex !== undefined && day >= 1 && day <= 31) {
      return new Date(year, monthIndex, day);
    }
  }

  // Try "Day Mon DD" format: "@ Mon, Mar 23" or "@ Fri 25"
  match = content.match(/(?:@\s+)?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+([A-Za-z]+)?\s+(\d{1,2})/i);
  if (match) {
    const monthStr = match[1];
    const day = parseInt(match[2]);

    if (monthStr) {
      const monthIndex = months[monthStr.toLowerCase().substring(0, 3)];
      if (monthIndex !== undefined && day >= 1 && day <= 31) {
        let year = currentYear;
        const testDate = new Date(year, monthIndex, day);
        if (testDate < today) {
          year = currentYear + 1;
        }
        return new Date(year, monthIndex, day);
      }
    }
  }

  return null;
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
 * Determine if event is in the past
 * @param {Date|null} eventDate - Event date (null if unknown)
 * @returns {boolean|null} true if past, false if future, null if unknown
 */
export function isPastEvent(eventDate) {
  if (!eventDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalized = new Date(eventDate);
  normalized.setHours(0, 0, 0, 0);

  return normalized < today;
}

/**
 * Classify email by event recency
 * @param {string} emailSubject - Email subject line
 * @param {string} emailBody - Email body content
 * @returns {object} Classification result
 *   - status: 'future' | 'past' | 'unknown'
 *   - eventDate: Date|null
 *   - reason: string (explanation)
 *   - source: 'subject' | 'title-window' | 'body' | null (where the date came from)
 */
export function classifyEmail(emailSubject, emailBody) {
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
    eventDate = extractEventDate(content);
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
