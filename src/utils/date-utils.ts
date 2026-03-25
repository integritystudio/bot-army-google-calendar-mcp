/**
 * Date and time utilities for calendar operations.
 * Provides semantic, type-safe abstractions for common date calculations.
 */

import {
  addDays as _addDays,
  addMilliseconds as _addMilliseconds,
  addMonths as _addMonths,
  addYears as _addYears,
  differenceInDays as _differenceInDays,
  differenceInHours as _differenceInHours,
  differenceInMilliseconds,
  differenceInMinutes as _differenceInMinutes,
  differenceInSeconds as _differenceInSeconds,
  isBefore,
  toRRuleDateString,
} from 'simple-rrule';

// Time duration constants (in milliseconds)
export const TIME_DURATIONS = {
  HOUR: 1000 * 60 * 60,
  DAY: 1000 * 60 * 60 * 24,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  QUARTER: 90 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Add days to a date, returning a new Date object.
 * @param date Base date
 * @param days Number of days to add (can be negative)
 * @returns New Date object offset by days
 */
export function addDays(date: Date, days: number): Date {
  return _addDays(date, days);
}

/**
 * Add milliseconds to a date, returning a new Date object.
 * @param date Base date
 * @param ms Milliseconds to add (can be negative)
 * @returns New Date object offset by milliseconds
 */
export function addMilliseconds(date: Date, ms: number): Date {
  return _addMilliseconds(date, ms);
}

/**
 * Add months to a date, returning a new Date object.
 * @param date Base date
 * @param months Number of months to add (can be negative)
 * @returns New Date object offset by months
 */
export function addMonths(date: Date, months: number): Date {
  return _addMonths(date, months);
}

/**
 * Add years to a date, returning a new Date object.
 * @param date Base date
 * @param years Number of years to add (can be negative)
 * @returns New Date object offset by years
 */
export function addYears(date: Date, years: number): Date {
  return _addYears(date, years);
}

/**
 * Calculate the duration between two dates in milliseconds.
 * @param from Start date
 * @param to End date
 * @returns Duration in milliseconds (negative if from > to)
 */
export function durationMs(from: Date, to: Date): number {
  return differenceInMilliseconds(to, from);
}

/**
 * Calculate the duration between two dates in days.
 * @param from Start date
 * @param to End date
 * @returns Duration in days (negative if from > to)
 */
export function durationDays(from: Date, to: Date): number {
  return _differenceInDays(to, from);
}

/**
 * Calculate the duration between two dates in hours.
 * @param from Start date
 * @param to End date
 * @returns Duration in hours (negative if from > to)
 */
export function durationHours(from: Date, to: Date): number {
  return _differenceInHours(to, from);
}

/**
 * Calculate the duration between two dates in minutes.
 * @param from Start date
 * @param to End date
 * @returns Duration in minutes (negative if from > to)
 */
export function durationMinutes(from: Date, to: Date): number {
  return _differenceInMinutes(to, from);
}

/**
 * Calculate the duration between two dates in seconds.
 * @param from Start date
 * @param to End date
 * @returns Duration in seconds (negative if from > to)
 */
export function durationSeconds(from: Date, to: Date): number {
  return _differenceInSeconds(to, from);
}

/**
 * Format a date as ISO 8601 basic time format (used for Google Calendar instance IDs).
 * Example: "20240615T100000Z"
 * @param date Date to format
 * @returns Basic ISO 8601 format string
 */
export function formatBasicDateTime(date: Date): string {
  return toRRuleDateString(date.toISOString());
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
  return isBefore(new Date(), date);
}

/**
 * Check if a date string represents a past date.
 * @param dateString ISO date string to check
 * @returns true if the date is in the past
 */
export function isPastDate(dateString: string): boolean {
  const date = new Date(dateString);
  return isBefore(date, new Date());
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

/**
 * ISO 8601 datetime format validation patterns.
 * Used to validate and parse datetime strings in various formats.
 */
export const DATETIME_FORMATS = {
  /** ISO 8601 datetime with timezone info (Z or ±HH:MM) */
  ISO_DATETIME_TZ_AWARE: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/,
  /** ISO 8601 datetime without timezone (naive) */
  ISO_DATETIME_TZ_NAIVE: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
  /** ISO 8601 date only (all-day events) */
  ISO_DATE_ONLY: /^\d{4}-\d{2}-\d{2}$/,
  /** Basic ISO datetime format used in RRULE UNTIL clauses */
  ISO_BASIC_DATETIME: /^\d{8}T\d{6}Z$/,
  /** Parse ISO 8601 datetime components */
  ISO_COMPONENTS: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
  /** Parse ISO 8601 date components */
  ISO_DATE_COMPONENTS: /^(\d{4})-(\d{2})-(\d{2})$/,
  /** Parse basic format datetime components */
  BASIC_DATETIME_COMPONENTS: /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
} as const;

/**
 * Error messages for datetime validation failures.
 */
export const DATETIME_ERRORS = {
  INVALID_FORMAT: 'Invalid ISO 8601 datetime format',
  INVALID_TIMEZONE: 'Invalid timezone designator (must be Z or ±HH:MM)',
  INVALID_DATE: 'Invalid date values',
  AMBIGUOUS_TIME: 'Timezone-naive datetime requires fallback timezone',
} as const;

/**
 * Components parsed from an ISO 8601 datetime string.
 */
export interface DateTimeComponents {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timezone?: string; // 'Z', '+HH:MM', or '-HH:MM'
}

/**
 * Check if a datetime string is in valid ISO 8601 format with or without timezone.
 * @param datetime Datetime string to validate
 * @returns true if valid ISO 8601 datetime
 */
export function isValidISODateTime(datetime: string): boolean {
  return DATETIME_FORMATS.ISO_DATETIME_TZ_AWARE.test(datetime) ||
    DATETIME_FORMATS.ISO_DATETIME_TZ_NAIVE.test(datetime);
}

/**
 * Check if a date string is in valid ISO 8601 date format (YYYY-MM-DD).
 * @param date Date string to validate
 * @returns true if valid ISO 8601 date
 */
export function isValidISODate(date: string): boolean {
  return DATETIME_FORMATS.ISO_DATE_ONLY.test(date);
}

/**
 * Check if a datetime string includes timezone information.
 * @param datetime Datetime string to check
 * @returns true if has timezone (Z or ±HH:MM), false if timezone-naive
 */
export function isTimeZoneAware(datetime: string): boolean {
  return DATETIME_FORMATS.ISO_DATETIME_TZ_AWARE.test(datetime);
}

/**
 * Check if a datetime string is timezone-naive (no timezone designator).
 * @param datetime Datetime string to check
 * @returns true if timezone-naive, false if has timezone info
 */
export function isTimeZoneNaive(datetime: string): boolean {
  return DATETIME_FORMATS.ISO_DATETIME_TZ_NAIVE.test(datetime);
}

/**
 * Check if a datetime string represents an all-day event (date only, no time).
 * @param datetime Datetime or date string to check
 * @returns true if date-only format (all-day event)
 */
export function isAllDayEvent(datetime: string): boolean {
  return DATETIME_FORMATS.ISO_DATE_ONLY.test(datetime) && !datetime.includes('T');
}

/**
 * Parse an ISO 8601 datetime string into components.
 * Supports both timezone-aware and timezone-naive formats.
 * @param datetime ISO 8601 datetime string
 * @returns Parsed date/time components
 * @throws Error if datetime format is invalid
 */
export function parseDateTimeString(datetime: string): DateTimeComponents {
  if (!isValidISODateTime(datetime)) {
    throw new Error(`${DATETIME_ERRORS.INVALID_FORMAT}: ${datetime}`);
  }

  // Extract timezone if present
  let timezone: string | undefined;
  let dateTimeWithoutTZ = datetime;

  if (datetime.endsWith('Z')) {
    timezone = 'Z';
    dateTimeWithoutTZ = datetime.slice(0, -1);
  } else {
    const tzMatch = datetime.match(/([+-]\d{2}:\d{2})$/);
    if (tzMatch) {
      timezone = tzMatch[1];
      dateTimeWithoutTZ = datetime.slice(0, -timezone.length);
    }
  }

  // Parse the datetime components
  const match = dateTimeWithoutTZ.match(DATETIME_FORMATS.ISO_COMPONENTS);
  if (!match) {
    throw new Error(`${DATETIME_ERRORS.INVALID_FORMAT}: ${datetime}`);
  }

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const second = parseInt(secondStr, 10);

  // Validate date ranges
  if (month < 1 || month > 12 || day < 1 || day > 31 ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new Error(`${DATETIME_ERRORS.INVALID_DATE}: ${datetime}`);
  }

  return { year, month, day, hour, minute, second, timezone };
}

/**
 * Parse a basic format datetime string (used in RRULE UNTIL clauses).
 * Format: YYYYMMDDTHHMMSSZ
 * @param basicFormat Basic format datetime string
 * @returns Parsed date/time components
 * @throws Error if format is invalid
 */
export function parseBasicDateTime(basicFormat: string): DateTimeComponents {
  if (!DATETIME_FORMATS.ISO_BASIC_DATETIME.test(basicFormat)) {
    throw new Error(`${DATETIME_ERRORS.INVALID_FORMAT}: ${basicFormat}`);
  }

  const match = basicFormat.match(DATETIME_FORMATS.BASIC_DATETIME_COMPONENTS);
  if (!match) {
    throw new Error(`${DATETIME_ERRORS.INVALID_FORMAT}: ${basicFormat}`);
  }

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const second = parseInt(secondStr, 10);

  // Validate date ranges
  if (month < 1 || month > 12 || day < 1 || day > 31 ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new Error(`${DATETIME_ERRORS.INVALID_DATE}: ${basicFormat}`);
  }

  return { year, month, day, hour, minute, second, timezone: 'Z' };
}
