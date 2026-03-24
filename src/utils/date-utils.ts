/**
 * Date and time utilities for calendar operations.
 * Provides semantic, type-safe abstractions for common date calculations.
 */

// Time duration constants (in milliseconds)
export const TIME_DURATIONS = {
  HOUR: 1000 * 60 * 60,
  DAY: 1000 * 60 * 60 * 24,
  WEEK: 1000 * 60 * 60 * 24 * 7,
  MONTH: 1000 * 60 * 60 * 24 * 30, // Approximate
} as const;

/**
 * Add days to a date, returning a new Date object.
 * @param date Base date
 * @param days Number of days to add (can be negative)
 * @returns New Date object offset by days
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add milliseconds to a date, returning a new Date object.
 * @param date Base date
 * @param ms Milliseconds to add (can be negative)
 * @returns New Date object offset by milliseconds
 */
export function addMilliseconds(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

/**
 * Calculate the duration between two dates in milliseconds.
 * @param from Start date
 * @param to End date
 * @returns Duration in milliseconds (negative if from > to)
 */
export function durationMs(from: Date, to: Date): number {
  return to.getTime() - from.getTime();
}

/**
 * Format a date as ISO 8601 basic time format (used for Google Calendar instance IDs).
 * Example: "20240615T100000Z"
 * @param date Date to format
 * @returns Basic ISO 8601 format string
 */
export function formatBasicDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Format a date as ISO 8601 datetime string without milliseconds.
 * Example: "2024-06-15T10:00:00"
 * @param date Date to format
 * @returns ISO datetime string without milliseconds
 */
export function formatISODateTime(date: Date): string {
  return date.toISOString().split('.')[0];
}

/**
 * Format a date as timezone-naive ISO datetime (useful for test data).
 * Example: "2024-06-15T10:00:00" (no timezone suffix)
 * @param date Date to format
 * @returns ISO datetime string without timezone designator
 */
export function formatTZNaiveDateTime(date: Date): string {
  return date.toISOString().split('.')[0];
}

/**
 * Format a date with Z suffix for RFC 3339 compliance.
 * Example: "2024-06-15T10:00:00Z"
 * @param date Date to format
 * @returns ISO datetime string with Z suffix
 */
export function formatRFC3339(date: Date): string {
  return date.toISOString().split('.')[0] + 'Z';
}

/**
 * Get a future date relative to now.
 * @param daysFromNow Number of days in the future
 * @returns Future date object
 */
export function getFutureDate(daysFromNow: number): Date {
  return addDays(new Date(), daysFromNow);
}

/**
 * Get a past date relative to now.
 * Accounts for leap years and month boundaries correctly.
 * @param daysAgo Number of days in the past
 * @returns Past date object
 */
export function getPastDate(daysAgo: number): Date {
  return addDays(new Date(), -daysAgo);
}

/**
 * Check if a date string represents a future date.
 * @param dateString ISO date string to check
 * @returns true if the date is in the future
 */
export function isFutureDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date.getTime() > new Date().getTime();
}

/**
 * Check if a date string represents a past date.
 * @param dateString ISO date string to check
 * @returns true if the date is in the past
 */
export function isPastDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date.getTime() < new Date().getTime();
}

/**
 * Calculate the day-of-month for one day before a given date.
 * Useful for UNTIL clauses in recurrence rules.
 * @param date Date to calculate from
 * @returns New Date object one day earlier
 */
export function oneDayBefore(date: Date): Date {
  return addMilliseconds(date, -TIME_DURATIONS.DAY);
}

/**
 * Get the ISO string of a date one day before the given date.
 * @param date Date to calculate from
 * @returns ISO datetime string one day earlier
 */
export function getOneDayBeforeFormatted(date: Date): string {
  return formatBasicDateTime(oneDayBefore(date));
}

/**
 * RRULE (iCalendar recurrence rule) patterns for manipulation.
 * Used to parse and modify recurrence rules in Google Calendar events.
 */
export const RRULE_PATTERNS = {
  /** Matches UNTIL clause with basic format (e.g., ;UNTIL=20240615T100000Z) */
  UNTIL: /;UNTIL=\d{8}T\d{6}Z/g,
  /** Matches COUNT clause limiting recurrences (e.g., ;COUNT=10) */
  COUNT: /;COUNT=\d+/g,
  /** Matches RRULE prefix to detect recurrence rules */
  RRULE_PREFIX: /^RRULE:/,
  /** Matches EXDATE (exception dates) prefix */
  EXDATE: /^EXDATE:/,
  /** Matches RDATE (additional dates) prefix */
  RDATE: /^RDATE:/,
} as const;

/**
 * Remove UNTIL and COUNT clauses from an RRULE string.
 * Used when splitting recurring series to update the original series end date.
 * @param rruleString RRULE string (e.g., "RRULE:FREQ=WEEKLY;UNTIL=20240620T100000Z;BYDAY=MO,WE")
 * @returns Cleaned RRULE without UNTIL and COUNT clauses
 */
export function stripUntilAndCount(rruleString: string): string {
  return rruleString
    .replace(RRULE_PATTERNS.UNTIL, '')
    .replace(RRULE_PATTERNS.COUNT, '');
}

/**
 * Build an UNTIL clause for an RRULE in basic format.
 * @param date Date to use as the UNTIL boundary
 * @returns UNTIL clause string (e.g., ";UNTIL=20240615T100000Z")
 */
export function buildUntilClause(date: Date): string {
  return `;UNTIL=${formatBasicDateTime(date)}`;
}

/**
 * Check if a rule string is an RRULE (vs EXDATE/RDATE/other).
 * @param ruleString Recurrence rule string to check
 * @returns true if the string starts with "RRULE:"
 */
export function isRRuleString(ruleString: string): boolean {
  return RRULE_PATTERNS.RRULE_PREFIX.test(ruleString);
}

/**
 * Separate RRULE strings from other recurrence types (EXDATE, RDATE).
 * Preserves non-RRULE recurrence patterns when splitting series.
 * @param recurrence Array of recurrence rule strings
 * @returns Object with separated rrules and other recurrence types
 */
export function extractAndPreserveNonRRuleRecurrence(recurrence: string[]): {
  rrules: string[];
  otherRules: string[];
} {
  const rrules: string[] = [];
  const otherRules: string[] = [];

  for (const rule of recurrence) {
    if (isRRuleString(rule)) {
      rrules.push(rule);
    } else {
      otherRules.push(rule);
    }
  }

  return { rrules, otherRules };
}
