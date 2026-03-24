/**
 * Timezone utilities for calendar operations.
 * Provides validation, offset calculation, and timezone-aware datetime formatting.
 * Consolidates timezone logic from GetCurrentTimeHandler and handlers/utils/datetime.ts
 */

import { formatRFC3339 } from './date-utils.js';

/**
 * Shared Intl.DateTimeFormat options for offset calculation.
 * Used by getTimezoneOffsetMinutes and convertLocalTimeToUTC.
 */
const DATETIME_OFFSET_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

/**
 * Check if a timezone string is a valid IANA timezone identifier.
 * @param timeZone Timezone string to validate (e.g., 'America/Los_Angeles')
 * @returns true if valid IANA timezone
 */
export function isValidIANATimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the system's configured timezone.
 * Falls back to UTC if detection fails.
 * @returns IANA timezone string (e.g., 'America/Los_Angeles')
 */
export function getSystemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Validate a timezone string, throwing if invalid.
 * @param timeZone Timezone string to validate
 * @throws Error if timezone is invalid
 */
export function validateTimeZone(timeZone: string): void {
  if (!isValidIANATimeZone(timeZone)) {
    throw new Error(
      `Invalid timezone: ${timeZone}. Use IANA timezone format like 'America/Los_Angeles' or 'UTC'.`
    );
  }
}

/**
 * Calculate the timezone offset in minutes for a specific timezone.
 * Positive for timezones east of UTC, negative for west of UTC.
 * @param timeZone IANA timezone identifier
 * @returns Offset in minutes (e.g., 330 for Asia/Kolkata, -420 for America/Los_Angeles)
 */
export function getTimezoneOffsetMinutes(timeZone: string): number {
  const date = new Date();

  // Get the target timezone's local time string
  const targetTimeString = new Intl.DateTimeFormat('sv-SE', {
    ...DATETIME_OFFSET_FORMAT_OPTIONS,
    timeZone: timeZone,
  }).format(date);

  // Get UTC time string
  const utcTimeString = new Intl.DateTimeFormat('sv-SE', {
    ...DATETIME_OFFSET_FORMAT_OPTIONS,
    timeZone: 'UTC',
  }).format(date);

  // Parse both times and calculate difference
  const targetTime = new Date(targetTimeString.replace(' ', 'T') + 'Z').getTime();
  const utcTimeParsed = new Date(utcTimeString.replace(' ', 'T') + 'Z').getTime();

  return (targetTime - utcTimeParsed) / (1000 * 60);
}

/**
 * Format a timezone offset as a string.
 * @param timeZone IANA timezone identifier
 * @returns Offset string: 'Z' for UTC, '+HH:MM' or '-HH:MM' for other timezones
 */
export function getTimezoneOffsetString(timeZone: string): string {
  try {
    const offsetMinutes = getTimezoneOffsetMinutes(timeZone);

    if (offsetMinutes === 0) {
      return 'Z';
    }

    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    const sign = offsetMinutes >= 0 ? '+' : '-';

    return `${sign}${offsetHours.toString().padStart(2, '0')}:${offsetMins.toString().padStart(2, '0')}`;
  } catch {
    return 'Z'; // Fallback to UTC if calculation fails
  }
}

/**
 * Format a date in a specific timezone with both RFC3339 and human-readable formats.
 * @param date Date to format
 * @param timeZone IANA timezone identifier
 * @returns Object with rfc3339, humanReadable, and offset fields
 */
export function formatDateInTimeZone(date: Date, timeZone: string): {
  rfc3339: string;
  humanReadable: string;
  offset: string;
} {
  const offset = getTimezoneOffsetString(timeZone);
  // Remove Z suffix from RFC3339 format and add timezone offset
  const isoString = formatRFC3339(date).slice(0, -1);
  const rfc3339 = isoString + offset;

  const humanReadable = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'long',
  }).format(date);

  return { rfc3339, humanReadable, offset };
}

/**
 * Resolve a timezone from preferred and calendar defaults.
 * Follows precedence: preferredTZ > calendarDefaultTZ > systemTimeZone > 'UTC'
 * @param preferredTZ User-specified timezone (optional)
 * @param calendarDefaultTZ Calendar's default timezone (optional)
 * @returns Valid IANA timezone string
 */
export function resolveTimeZone(
  preferredTZ: string | undefined,
  calendarDefaultTZ: string | undefined
): string {
  if (preferredTZ && isValidIANATimeZone(preferredTZ)) {
    return preferredTZ;
  }

  if (calendarDefaultTZ && isValidIANATimeZone(calendarDefaultTZ)) {
    return calendarDefaultTZ;
  }

  const systemTZ = getSystemTimeZone();
  if (isValidIANATimeZone(systemTZ)) {
    return systemTZ;
  }

  return 'UTC';
}

/**
 * Check if a datetime string includes timezone information.
 * @param datetime ISO 8601 datetime string
 * @returns true if timezone is included, false if timezone-naive
 */
export function hasTimezoneInDatetime(datetime: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(datetime);
}

/**
 * Convert a flexible datetime string to RFC3339 format required by Google Calendar API.
 *
 * Precedence rules:
 * 1. If datetime already has timezone info (Z or ±HH:MM), use as-is
 * 2. If datetime is timezone-naive, interpret it as local time in fallbackTimezone and convert to UTC
 *
 * @param datetime ISO 8601 datetime string (with or without timezone)
 * @param fallbackTimezone Timezone to use if datetime is timezone-naive (IANA format)
 * @returns RFC3339 formatted datetime string in UTC
 */
export function convertToRFC3339(datetime: string, fallbackTimezone: string): string {
  if (hasTimezoneInDatetime(datetime)) {
    // Already has timezone, use as-is
    return datetime;
  } else {
    // Timezone-naive, interpret as local time in fallbackTimezone and convert to UTC
    try {
      // Parse the datetime components
      const match = datetime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
      if (!match) {
        throw new Error('Invalid datetime format');
      }

      const [, year, month, day, hour, minute, second] = match.map(Number);

      // Find what UTC time corresponds to the desired local time in the target timezone
      const targetDate = convertLocalTimeToUTC(year, month - 1, day, hour, minute, second, fallbackTimezone);

      return targetDate.toISOString().replace(/\.000Z$/, 'Z');
    } catch (error) {
      // Fallback: if timezone conversion fails, append Z for UTC
      return datetime + 'Z';
    }
  }
}

/**
 * Convert a local time in a specific timezone to UTC.
 * @param year Full year
 * @param month Month (0-11, where 0 is January)
 * @param day Day of month (1-31)
 * @param hour Hour (0-23)
 * @param minute Minute (0-59)
 * @param second Second (0-59)
 * @param timezone IANA timezone identifier
 * @returns Date object in UTC
 */
function convertLocalTimeToUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string
): Date {
  // Create a date that we'll use to find the correct UTC time
  // Start with the assumption that it's in UTC
  let testDate = new Date(Date.UTC(year, month, day, hour, minute, second));

  // Get what this UTC time looks like in the target timezone
  const options: Intl.DateTimeFormatOptions = {
    ...DATETIME_OFFSET_FORMAT_OPTIONS,
    timeZone: timezone,
    hour12: false,
  };

  // Format the test date in the target timezone
  const formatter = new Intl.DateTimeFormat('sv-SE', options);
  const formattedInTargetTZ = formatter.format(testDate);

  // Parse the formatted result to see what time it shows
  const [datePart, timePart] = formattedInTargetTZ.split(' ');
  const [targetYear, targetMonth, targetDay] = datePart.split('-').map(Number);
  const [targetHour, targetMinute, targetSecond] = timePart.split(':').map(Number);

  // Calculate the difference between what we want and what we got
  const wantedTime = new Date(year, month, day, hour, minute, second).getTime();
  const actualTime = new Date(targetYear, targetMonth - 1, targetDay, targetHour, targetMinute, targetSecond).getTime();
  const offsetMs = wantedTime - actualTime;

  // Adjust the UTC time by the offset
  return new Date(testDate.getTime() + offsetMs);
}

/**
 * Create a time object for Google Calendar API, handling both timezone-aware and timezone-naive datetime strings.
 * Also handles all-day events by using 'date' field instead of 'dateTime'.
 * @param datetime ISO 8601 datetime string (with or without timezone)
 * @param fallbackTimezone Timezone to use if datetime is timezone-naive (IANA format)
 * @returns Google Calendar API time object
 */
export function createTimeObject(
  datetime: string,
  fallbackTimezone: string
): {
  dateTime?: string;
  date?: string;
  timeZone?: string;
} {
  // Check if this is a date-only string (all-day event)
  // Date-only format: YYYY-MM-DD (no time component)
  if (!/T/.test(datetime)) {
    // This is a date-only string, use the 'date' field for all-day event
    return { date: datetime };
  }

  // This is a datetime string with time component
  if (hasTimezoneInDatetime(datetime)) {
    // Timezone included in datetime - use as-is, no separate timeZone property needed
    return { dateTime: datetime };
  } else {
    // Timezone-naive datetime - use fallback timezone
    return { dateTime: datetime, timeZone: fallbackTimezone };
  }
}
