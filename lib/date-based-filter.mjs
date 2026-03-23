/**
 * Date-based email filter utility
 * Abstracts logic for organizing emails by event date (past vs future)
 */

/**
 * Parse event date from email content
 * Looks for patterns like "@ Fri, Mar 22" or "Feb 26"
 * @param {string} content - Email subject or body text
 * @returns {Date|null} Parsed date or null if not found
 */
export function extractEventDate(content) {
  if (!content) return null;

  // Match patterns like:
  // - "@ Mon, Mar 23"
  // - "@ Feb 26"
  // - "Wed, February 26"
  // - "Friday Mar 22"
  const datePattern = /(?:@\s+)?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+([A-Za-z]+)\s+(\d{1,2})/i;
  const match = content.match(datePattern);

  if (!match) return null;

  const monthStr = match[1];
  const dayStr = parseInt(match[2]);

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

  const monthIndex = months[monthStr.toLowerCase().substring(0, 3)];
  if (monthIndex === undefined) return null;

  const today = new Date();
  const eventDate = new Date(today.getFullYear(), monthIndex, dayStr);

  return eventDate;
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
  eventDate.setHours(0, 0, 0, 0);

  return eventDate < today;
}

/**
 * Classify email by event recency
 * @param {string} emailSubject - Email subject line
 * @param {string} emailBody - Email body content
 * @returns {object} Classification result
 *   - status: 'future' | 'past' | 'unknown'
 *   - eventDate: Date|null
 *   - reason: string (explanation)
 */
export function classifyEmail(emailSubject, emailBody) {
  // Try to extract date from subject first, then body
  const eventDate = extractEventDate(emailSubject) || extractEventDate(emailBody);

  if (!eventDate) {
    return {
      status: 'unknown',
      eventDate: null,
      reason: 'Could not parse event date'
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
      reason: `Event was ${dateStr}`
    };
  }

  return {
    status: 'future',
    eventDate,
    reason: `Event is ${dateStr}`
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
    action.removeLabelIds.push('INBOX');
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
