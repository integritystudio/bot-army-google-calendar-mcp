import {
  addDays as _addDays,
  addMilliseconds as _addMilliseconds,
  differenceInDays as _differenceInDays,
  differenceInMilliseconds,
  differenceInMinutes as _differenceInMinutes,
  isBefore,
} from 'date-fns';

// Time duration constants (in milliseconds)
export const TIME_DURATIONS = {
  HOUR: 1000 * 60 * 60,
  DAY: 1000 * 60 * 60 * 24,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  QUARTER: 90 * 24 * 60 * 60 * 1000,
} as const;

export function addDays(date: Date, days: number): Date {
  return _addDays(date, days);
}

export function addMilliseconds(date: Date, ms: number): Date {
  return _addMilliseconds(date, ms);
}

export function durationMs(from: Date, to: Date): number {
  return differenceInMilliseconds(to, from);
}

export function durationDays(from: Date, to: Date): number {
  return _differenceInDays(to, from);
}

export function durationMinutes(from: Date, to: Date): number {
  return _differenceInMinutes(to, from);
}

/** Format as basic ISO 8601 (e.g. "20240615T100000Z") for RRULE UNTIL / instance IDs. */
export function formatBasicDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
}

/** Format as timezone-naive ISO datetime (e.g. "2024-06-15T10:00:00"). */
export function formatTZNaiveDateTime(date: Date): string {
  return date.toISOString().slice(0, 19);
}

/** Format as RFC 3339 UTC datetime (e.g. "2024-06-15T10:00:00Z"). */
export function formatRFC3339(date: Date): string {
  return date.toISOString().slice(0, 19) + 'Z';
}

export function getFutureDate(daysFromNow: number): Date {
  return addDays(new Date(), daysFromNow);
}

export function getPastDate(daysAgo: number): Date {
  return addDays(new Date(), -daysAgo);
}

export function isFutureDate(dateString: string): boolean {
  return isBefore(new Date(), new Date(dateString));
}

export function isPastDate(dateString: string): boolean {
  return isBefore(new Date(dateString), new Date());
}

export function oneDayBefore(date: Date): Date {
  return addDays(date, -1);
}

export function getOneDayBeforeFormatted(date: Date): string {
  return formatBasicDateTime(oneDayBefore(date));
}

export const RRULE_PATTERNS = {
  UNTIL: /;UNTIL=\d{8}T\d{6}Z/g,
  COUNT: /;COUNT=\d+/g,
  RRULE_PREFIX: /^RRULE:/,
  EXDATE: /^EXDATE:/,
  RDATE: /^RDATE:/,
} as const;

export function stripUntilAndCount(rruleString: string): string {
  return rruleString
    .replace(RRULE_PATTERNS.UNTIL, '')
    .replace(RRULE_PATTERNS.COUNT, '');
}

export function buildUntilClause(date: Date): string {
  return `;UNTIL=${formatBasicDateTime(date)}`;
}

export function isRRuleString(ruleString: string): boolean {
  return RRULE_PATTERNS.RRULE_PREFIX.test(ruleString);
}

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

export const DATETIME_FORMATS = {
  ISO_DATETIME_TZ_AWARE: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/,
  ISO_DATETIME_TZ_NAIVE: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
  ISO_DATE_ONLY: /^\d{4}-\d{2}-\d{2}$/,
  ISO_BASIC_DATETIME: /^\d{8}T\d{6}Z$/,
  ISO_COMPONENTS: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
  ISO_DATE_COMPONENTS: /^(\d{4})-(\d{2})-(\d{2})$/,
  BASIC_DATETIME_COMPONENTS: /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
} as const;

export const DATETIME_ERRORS = {
  INVALID_FORMAT: 'Invalid ISO 8601 datetime format',
  INVALID_TIMEZONE: 'Invalid timezone designator (must be Z or ±HH:MM)',
  INVALID_DATE: 'Invalid date values',
  AMBIGUOUS_TIME: 'Timezone-naive datetime requires fallback timezone',
} as const;

export interface DateTimeComponents {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timezone?: string; // 'Z', '+HH:MM', or '-HH:MM'
}

export function isValidISODateTime(datetime: string): boolean {
  return DATETIME_FORMATS.ISO_DATETIME_TZ_AWARE.test(datetime) ||
    DATETIME_FORMATS.ISO_DATETIME_TZ_NAIVE.test(datetime);
}

export function isValidISODate(date: string): boolean {
  return DATETIME_FORMATS.ISO_DATE_ONLY.test(date);
}

export function isTimeZoneAware(datetime: string): boolean {
  return DATETIME_FORMATS.ISO_DATETIME_TZ_AWARE.test(datetime);
}

export function isTimeZoneNaive(datetime: string): boolean {
  return DATETIME_FORMATS.ISO_DATETIME_TZ_NAIVE.test(datetime);
}

export function isAllDayEvent(datetime: string): boolean {
  return DATETIME_FORMATS.ISO_DATE_ONLY.test(datetime);
}

function parseComponents(match: RegExpMatchArray, source: string): DateTimeComponents {
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const second = parseInt(secondStr, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31 ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new Error(`${DATETIME_ERRORS.INVALID_DATE}: ${source}`);
  }

  return { year, month, day, hour, minute, second };
}

export function parseDateTimeString(datetime: string): DateTimeComponents {
  if (!isValidISODateTime(datetime)) {
    throw new Error(`${DATETIME_ERRORS.INVALID_FORMAT}: ${datetime}`);
  }

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

  const match = dateTimeWithoutTZ.match(DATETIME_FORMATS.ISO_COMPONENTS);
  if (!match) {
    throw new Error(`${DATETIME_ERRORS.INVALID_FORMAT}: ${datetime}`);
  }

  return { ...parseComponents(match, datetime), timezone };
}

/** Parse basic format (YYYYMMDDTHHMMSSZ) used in RRULE UNTIL clauses. */
export function parseBasicDateTime(basicFormat: string): DateTimeComponents {
  if (!DATETIME_FORMATS.ISO_BASIC_DATETIME.test(basicFormat)) {
    throw new Error(`${DATETIME_ERRORS.INVALID_FORMAT}: ${basicFormat}`);
  }

  const match = basicFormat.match(DATETIME_FORMATS.BASIC_DATETIME_COMPONENTS);
  if (!match) {
    throw new Error(`${DATETIME_ERRORS.INVALID_FORMAT}: ${basicFormat}`);
  }

  return { ...parseComponents(match, basicFormat), timezone: 'Z' };
}
