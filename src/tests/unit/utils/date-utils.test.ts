import { describe, it, expect } from 'vitest';
import {
  TIME_DURATIONS,
  addDays,
  addMilliseconds,
  durationMs,
  formatBasicDateTime,
  formatISODateTime,
  formatTZNaiveDateTime,
  formatRFC3339,
  getFutureDate,
  getPastDate,
  isFutureDate,
  isPastDate,
  oneDayBefore,
  getOneDayBeforeFormatted,
  RRULE_PATTERNS,
  stripUntilAndCount,
  buildUntilClause,
  isRRuleString,
  extractAndPreserveNonRRuleRecurrence,
  DATETIME_FORMATS,
  DATETIME_ERRORS,
  isValidISODateTime,
  isValidISODate,
  isTimeZoneAware,
  isTimeZoneNaive,
  isAllDayEvent,
  parseDateTimeString,
  parseBasicDateTime,
} from '../../../utils/date-utils.js';

const BASE_DATE = new Date('2024-06-15T10:00:00Z');
const BASE_DATE_WITH_MS = new Date('2024-06-15T10:00:00.123Z');
const TIMING_TOLERANCE_MS = 1000;
const TIMING_VARIANCE_RATIO = 0.05;

describe('date-utils', () => {

  describe('TIME_DURATIONS constants', () => {
    it('should define correct time duration values in milliseconds', () => {
      expect(TIME_DURATIONS.HOUR).toBe(1000 * 60 * 60);
      expect(TIME_DURATIONS.DAY).toBe(86400000);
      expect(TIME_DURATIONS.WEEK).toBe(1000 * 60 * 60 * 24 * 7);
      expect(TIME_DURATIONS.MONTH).toBe(1000 * 60 * 60 * 24 * 30);
    });
  });

  describe('addDays', () => {
    it('should add positive days to a date', () => {
      const result = addDays(BASE_DATE, 5);

      expect(result.getDate()).toBe(20);
      expect(result.getMonth()).toBe(5);
      expect(result.getFullYear()).toBe(2024);
    });

    it('should subtract days when given negative number', () => {
      const result = addDays(BASE_DATE, -5);

      expect(result.getDate()).toBe(10);
    });

    it('should not modify the original date', () => {
      const originalTime = BASE_DATE.getTime();
      addDays(BASE_DATE, 5);

      expect(BASE_DATE.getTime()).toBe(originalTime);
    });
  });

  describe('addMilliseconds', () => {
    it('should add milliseconds to a date', () => {
      const result = addMilliseconds(BASE_DATE, 5000);

      expect(result.getTime()).toBe(BASE_DATE.getTime() + 5000);
    });

    it('should subtract milliseconds with negative values', () => {
      const result = addMilliseconds(BASE_DATE, -5000);

      expect(result.getTime()).toBe(BASE_DATE.getTime() - 5000);
    });

    it('should not modify the original date', () => {
      const originalTime = BASE_DATE.getTime();
      addMilliseconds(BASE_DATE, 5000);

      expect(BASE_DATE.getTime()).toBe(originalTime);
    });
  });

  describe('durationMs', () => {
    it('should calculate positive duration between two dates', () => {
      const to = new Date('2024-06-15T11:00:00Z');

      expect(durationMs(BASE_DATE, to)).toBe(1000 * 60 * 60);
    });

    it('should return negative duration if from is after to', () => {
      const from = new Date('2024-06-15T11:00:00Z');

      expect(durationMs(from, BASE_DATE)).toBe(-(1000 * 60 * 60));
    });

    it('should return 0 for same date', () => {
      expect(durationMs(BASE_DATE, BASE_DATE)).toBe(0);
    });
  });

  describe('formatBasicDateTime', () => {
    it('should format date in basic ISO 8601 format with Z suffix', () => {
      expect(formatBasicDateTime(BASE_DATE_WITH_MS)).toBe('20240615T100000Z');
    });

    it('should remove colons and dashes from ISO string', () => {
      const date = new Date('2024-12-25T23:59:59.999Z');
      expect(formatBasicDateTime(date)).toBe('20241225T235959Z');
    });
  });

  describe('formatISODateTime', () => {
    it('should format date as ISO datetime without milliseconds', () => {
      expect(formatISODateTime(BASE_DATE_WITH_MS)).toBe('2024-06-15T10:00:00');
    });

    it('should not include timezone designator', () => {
      const result = formatISODateTime(BASE_DATE);

      expect(result).not.toContain('Z');
      expect(result).not.toContain('+');
      expect(result).not.toContain('-00:00');
    });
  });

  describe('formatTZNaiveDateTime', () => {
    it('should format date as timezone-naive ISO datetime', () => {
      expect(formatTZNaiveDateTime(BASE_DATE_WITH_MS)).toBe('2024-06-15T10:00:00');
    });

    it('should not include timezone designator', () => {
      const result = formatTZNaiveDateTime(BASE_DATE);

      expect(result).not.toContain('Z');
      expect(result).not.toContain('+');
    });
  });

  describe('formatRFC3339', () => {
    it('should format date with Z suffix', () => {
      expect(formatRFC3339(BASE_DATE_WITH_MS)).toBe('2024-06-15T10:00:00Z');
    });

    it('should always end with Z', () => {
      const result = formatRFC3339(BASE_DATE);

      expect(result.endsWith('Z')).toBe(true);
    });
  });

  describe('getFutureDate', () => {
    it('should return a future date', () => {
      const now = new Date();
      const future = getFutureDate(30);
      expect(future.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should return date 30 days in future by default', () => {
      const now = new Date();
      const future = getFutureDate(30);
      const duration = future.getTime() - now.getTime();

      expect(duration).toBeGreaterThanOrEqual(TIME_DURATIONS.DAY * 30 - TIMING_TOLERANCE_MS);
      expect(duration).toBeLessThanOrEqual(TIME_DURATIONS.DAY * 30 + TIMING_TOLERANCE_MS);
    });
  });

  describe('getPastDate', () => {
    it('should return a past date', () => {
      const before = new Date();
      const past = getPastDate(30);
      const after = new Date();

      expect(past.getTime()).toBeLessThan(before.getTime());
      expect(past.getTime()).toBeLessThan(after.getTime());
    });

    it('should return date approximately 30 days in past', () => {
      const before = new Date();
      const past = getPastDate(30);

      const duration = before.getTime() - past.getTime();
      const expectedDuration = TIME_DURATIONS.DAY * 30;
      const variance = expectedDuration * TIMING_VARIANCE_RATIO;

      expect(duration).toBeGreaterThanOrEqual(expectedDuration - variance);
      expect(duration).toBeLessThanOrEqual(expectedDuration + variance);
    });
  });

  describe('isFutureDate', () => {
    it.each([
      [10, true],
      [-10, false],
    ])('should return %s for date offset %s days', (daysOffset, expected) => {
      const now = new Date();
      const date = addDays(now, daysOffset);
      expect(isFutureDate(date.toISOString())).toBe(expected);
    });
  });

  describe('isPastDate', () => {
    it.each([
      [-10, true],
      [10, false],
    ])('should return %s for date offset %s days', (daysOffset, expected) => {
      const now = new Date();
      const date = addDays(now, daysOffset);
      expect(isPastDate(date.toISOString())).toBe(expected);
    });
  });

  describe('oneDayBefore', () => {
    it('should subtract exactly one day from a date', () => {
      const result = oneDayBefore(BASE_DATE);

      const duration = BASE_DATE.getTime() - result.getTime();
      expect(duration).toBe(TIME_DURATIONS.DAY);
    });

    it('should handle month boundaries', () => {
      const date = new Date('2024-06-01T10:00:00Z');
      const result = oneDayBefore(date);

      expect(result.getDate()).toBe(31);
      expect(result.getMonth()).toBe(4);
    });

    it('should handle year boundaries', () => {
      const date = new Date('2024-01-01T10:00:00Z');
      const result = oneDayBefore(date);

      expect(result.getDate()).toBe(31);
      expect(result.getMonth()).toBe(11);
      expect(result.getFullYear()).toBe(2023);
    });
  });

  describe('getOneDayBeforeFormatted', () => {
    it('should return one day before in basic format', () => {
      const result = getOneDayBeforeFormatted(BASE_DATE);

      expect(result).toBe('20240614T100000Z');
    });

    it('should combine oneDayBefore and formatBasicDateTime', () => {
      expect(getOneDayBeforeFormatted(BASE_DATE))
        .toBe(formatBasicDateTime(oneDayBefore(BASE_DATE)));
    });
  });

  describe('RRULE_PATTERNS', () => {
    it('should have regex patterns for UNTIL, COUNT, and prefixes', () => {
      expect(RRULE_PATTERNS.UNTIL).toBeInstanceOf(RegExp);
      expect(RRULE_PATTERNS.COUNT).toBeInstanceOf(RegExp);
      expect(RRULE_PATTERNS.RRULE_PREFIX).toBeInstanceOf(RegExp);
      expect(RRULE_PATTERNS.EXDATE).toBeInstanceOf(RegExp);
      expect(RRULE_PATTERNS.RDATE).toBeInstanceOf(RegExp);
    });

    it('should match UNTIL clauses', () => {
      const rule = 'RRULE:FREQ=WEEKLY;UNTIL=20240620T100000Z;BYDAY=MO';
      expect(RRULE_PATTERNS.UNTIL.test(rule)).toBe(true);
    });

    it('should match COUNT clauses', () => {
      const rule = 'RRULE:FREQ=WEEKLY;COUNT=10;BYDAY=MO';
      expect(RRULE_PATTERNS.COUNT.test(rule)).toBe(true);
    });
  });

  describe('stripUntilAndCount', () => {
    it('should remove UNTIL clause from RRULE', () => {
      const rule = 'RRULE:FREQ=WEEKLY;UNTIL=20240620T100000Z;BYDAY=MO';
      const result = stripUntilAndCount(rule);

      expect(result).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO');
    });

    it('should remove COUNT clause from RRULE', () => {
      const rule = 'RRULE:FREQ=WEEKLY;COUNT=10;BYDAY=MO';
      const result = stripUntilAndCount(rule);

      expect(result).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO');
    });

    it('should remove both UNTIL and COUNT when present', () => {
      const rule = 'RRULE:FREQ=WEEKLY;UNTIL=20240620T100000Z;COUNT=10;BYDAY=MO';
      const result = stripUntilAndCount(rule);

      expect(result).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO');
    });

    it('should return unchanged rule if no UNTIL or COUNT', () => {
      const rule = 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR';
      const result = stripUntilAndCount(rule);

      expect(result).toBe(rule);
    });

    it('should handle multiple UNTIL clauses (replaces all)', () => {
      const rule = 'RRULE:FREQ=WEEKLY;UNTIL=20240620T100000Z;BYDAY=MO;UNTIL=20240627T100000Z';
      const result = stripUntilAndCount(rule);

      expect(result).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO');
    });
  });

  describe('buildUntilClause', () => {
    it('should build UNTIL clause with semicolon prefix and basic ISO format', () => {
      const result = buildUntilClause(BASE_DATE);

      expect(result).toBe(';UNTIL=20240615T100000Z');
    });
  });

  describe('isRRuleString', () => {
    it.each([
      ['RRULE:FREQ=WEEKLY', true],
      ['RRULE:FREQ=DAILY;COUNT=5', true],
      ['EXDATE:20240615T100000Z', false],
      ['RDATE:20240615T100000Z,20240616T100000Z', false],
      ['DTSTART:20240615T100000Z', false],
      ['', false],
    ])('should return %s for isRRuleString("%s")', (input, expected) => {
      expect(isRRuleString(input)).toBe(expected);
    });
  });

  describe('extractAndPreserveNonRRuleRecurrence', () => {
    it('should separate RRULE from other recurrence types', () => {
      const recurrence = [
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
        'EXDATE:20240615T100000Z',
        'RDATE:20240620T100000Z',
      ];
      const result = extractAndPreserveNonRRuleRecurrence(recurrence);

      expect(result.rrules).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO']);
      expect(result.otherRules).toEqual([
        'EXDATE:20240615T100000Z',
        'RDATE:20240620T100000Z',
      ]);
    });

    it('should handle only RRULE', () => {
      const recurrence = ['RRULE:FREQ=WEEKLY;BYDAY=MO'];
      const result = extractAndPreserveNonRRuleRecurrence(recurrence);

      expect(result.rrules).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO']);
      expect(result.otherRules).toEqual([]);
    });

    it('should handle only non-RRULE rules', () => {
      const recurrence = [
        'EXDATE:20240615T100000Z',
        'RDATE:20240620T100000Z',
      ];
      const result = extractAndPreserveNonRRuleRecurrence(recurrence);

      expect(result.rrules).toEqual([]);
      expect(result.otherRules).toEqual([
        'EXDATE:20240615T100000Z',
        'RDATE:20240620T100000Z',
      ]);
    });

    it('should handle empty recurrence array', () => {
      const result = extractAndPreserveNonRRuleRecurrence([]);

      expect(result.rrules).toEqual([]);
      expect(result.otherRules).toEqual([]);
    });

    it('should handle multiple RRULE strings', () => {
      const recurrence = [
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
        'RRULE:FREQ=MONTHLY;BYMONTHDAY=15',
        'EXDATE:20240615T100000Z',
      ];
      const result = extractAndPreserveNonRRuleRecurrence(recurrence);

      expect(result.rrules).toEqual([
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
        'RRULE:FREQ=MONTHLY;BYMONTHDAY=15',
      ]);
      expect(result.otherRules).toEqual(['EXDATE:20240615T100000Z']);
    });
  });

  describe('DATETIME_FORMATS patterns', () => {
    it('should have all required format patterns', () => {
      expect(DATETIME_FORMATS.ISO_DATETIME_TZ_AWARE).toBeInstanceOf(RegExp);
      expect(DATETIME_FORMATS.ISO_DATETIME_TZ_NAIVE).toBeInstanceOf(RegExp);
      expect(DATETIME_FORMATS.ISO_DATE_ONLY).toBeInstanceOf(RegExp);
      expect(DATETIME_FORMATS.ISO_BASIC_DATETIME).toBeInstanceOf(RegExp);
      expect(DATETIME_FORMATS.ISO_COMPONENTS).toBeInstanceOf(RegExp);
      expect(DATETIME_FORMATS.ISO_DATE_COMPONENTS).toBeInstanceOf(RegExp);
      expect(DATETIME_FORMATS.BASIC_DATETIME_COMPONENTS).toBeInstanceOf(RegExp);
    });

    it('should match timezone-aware datetime', () => {
      expect(DATETIME_FORMATS.ISO_DATETIME_TZ_AWARE.test('2024-06-15T10:00:00Z')).toBe(true);
      expect(DATETIME_FORMATS.ISO_DATETIME_TZ_AWARE.test('2024-06-15T10:00:00+05:30')).toBe(true);
      expect(DATETIME_FORMATS.ISO_DATETIME_TZ_AWARE.test('2024-06-15T10:00:00-07:00')).toBe(true);
    });

    it('should match timezone-naive datetime', () => {
      expect(DATETIME_FORMATS.ISO_DATETIME_TZ_NAIVE.test('2024-06-15T10:00:00')).toBe(true);
      expect(DATETIME_FORMATS.ISO_DATETIME_TZ_NAIVE.test('2024-06-15T10:00:00Z')).toBe(false);
    });

    it('should match date-only format', () => {
      expect(DATETIME_FORMATS.ISO_DATE_ONLY.test('2024-06-15')).toBe(true);
      expect(DATETIME_FORMATS.ISO_DATE_ONLY.test('2024-06-15T10:00:00')).toBe(false);
    });

    it('should match basic datetime format', () => {
      expect(DATETIME_FORMATS.ISO_BASIC_DATETIME.test('20240615T100000Z')).toBe(true);
      expect(DATETIME_FORMATS.ISO_BASIC_DATETIME.test('2024-06-15T10:00:00Z')).toBe(false);
    });
  });

  describe('DATETIME_ERRORS constants', () => {
    it('should have all error messages', () => {
      expect(DATETIME_ERRORS.INVALID_FORMAT).toBeDefined();
      expect(DATETIME_ERRORS.INVALID_TIMEZONE).toBeDefined();
      expect(DATETIME_ERRORS.INVALID_DATE).toBeDefined();
      expect(DATETIME_ERRORS.AMBIGUOUS_TIME).toBeDefined();
    });
  });

  describe('isValidISODateTime', () => {
    it('should validate timezone-aware datetime', () => {
      expect(isValidISODateTime('2024-06-15T10:00:00Z')).toBe(true);
      expect(isValidISODateTime('2024-06-15T10:00:00+05:30')).toBe(true);
      expect(isValidISODateTime('2024-06-15T10:00:00-07:00')).toBe(true);
    });

    it('should validate timezone-naive datetime', () => {
      expect(isValidISODateTime('2024-06-15T10:00:00')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidISODateTime('2024-06-15')).toBe(false);
      expect(isValidISODateTime('20240615T100000Z')).toBe(false);
      expect(isValidISODateTime('invalid')).toBe(false);
    });
  });

  describe('isValidISODate', () => {
    it('should validate ISO 8601 date format', () => {
      expect(isValidISODate('2024-06-15')).toBe(true);
      expect(isValidISODate('2024-01-01')).toBe(true);
      expect(isValidISODate('2024-12-31')).toBe(true);
    });

    it('should reject datetime strings', () => {
      expect(isValidISODate('2024-06-15T10:00:00')).toBe(false);
      expect(isValidISODate('2024-06-15T10:00:00Z')).toBe(false);
    });

    it('should reject malformed dates', () => {
      expect(isValidISODate('2024/06/15')).toBe(false);
      expect(isValidISODate('06-15-2024')).toBe(false);
      expect(isValidISODate('invalid')).toBe(false);
    });

    it('should validate format only, not semantic correctness', () => {
      // These match the format pattern but have invalid date values
      // Semantic validation happens in parsing functions
      expect(isValidISODate('2024-13-01')).toBe(true);
      expect(isValidISODate('2024-06-32')).toBe(true);
    });
  });

  describe('isTimeZoneAware', () => {
    it.each([
      ['2024-06-15T10:00:00Z', true],
      ['2024-06-15T10:00:00+05:30', true],
      ['2024-06-15T10:00:00-07:00', true],
      ['2024-06-15T10:00:00', false],
    ])('should return %s for isTimeZoneAware("%s")', (input, expected) => {
      expect(isTimeZoneAware(input)).toBe(expected);
    });
  });

  describe('isTimeZoneNaive', () => {
    it.each([
      ['2024-06-15T10:00:00', true],
      ['2024-06-15T10:00:00Z', false],
      ['2024-06-15T10:00:00+05:30', false],
    ])('should return %s for isTimeZoneNaive("%s")', (input, expected) => {
      expect(isTimeZoneNaive(input)).toBe(expected);
    });
  });

  describe('isAllDayEvent', () => {
    it.each([
      ['2024-06-15', true],
      ['2024-01-01', true],
      ['2024-06-15T10:00:00', false],
      ['2024-06-15T10:00:00Z', false],
    ])('should return %s for isAllDayEvent("%s")', (input, expected) => {
      expect(isAllDayEvent(input)).toBe(expected);
    });
  });

  describe('parseDateTimeString', () => {
    const EXPECTED_DATE_TIME = {
      year: 2024,
      month: 6,
      day: 15,
      hour: 10,
      minute: 0,
      second: 0,
    };

    it.each([
      ['2024-06-15T10:00:00Z', 'Z'],
      ['2024-06-15T10:00:00+05:30', '+05:30'],
      ['2024-06-15T10:00:00-07:00', '-07:00'],
    ])('should parse datetime with timezone %s', (input, timezone) => {
      const result = parseDateTimeString(input);

      expect(result).toEqual({
        ...EXPECTED_DATE_TIME,
        timezone,
      });
    });

    it('should parse timezone-naive datetime', () => {
      const result = parseDateTimeString('2024-06-15T10:00:00');

      expect(result).toEqual({
        ...EXPECTED_DATE_TIME,
        timezone: undefined,
      });
    });

    it('should reject invalid format', () => {
      expect(() => parseDateTimeString('2024-06-15')).toThrow();
      expect(() => parseDateTimeString('invalid')).toThrow();
    });

    it('should reject invalid date values', () => {
      expect(() => parseDateTimeString('2024-13-01T10:00:00Z')).toThrow();
      expect(() => parseDateTimeString('2024-06-32T10:00:00Z')).toThrow();
      expect(() => parseDateTimeString('2024-06-15T25:00:00Z')).toThrow();
    });
  });

  describe('parseBasicDateTime', () => {
    const EXPECTED_DATE_TIME_BASIC = {
      year: 2024,
      month: 6,
      day: 15,
      hour: 10,
      minute: 0,
      second: 0,
    };

    it('should parse basic format datetime', () => {
      const result = parseBasicDateTime('20240615T100000Z');

      expect(result).toEqual({
        ...EXPECTED_DATE_TIME_BASIC,
        timezone: 'Z',
      });
    });

    it('should reject non-basic format', () => {
      expect(() => parseBasicDateTime('2024-06-15T10:00:00Z')).toThrow();
      expect(() => parseBasicDateTime('20240615T100000')).toThrow();
    });

    it('should reject invalid date values', () => {
      expect(() => parseBasicDateTime('20241301T100000Z')).toThrow();
      expect(() => parseBasicDateTime('20240632T100000Z')).toThrow();
      expect(() => parseBasicDateTime('20240615T250000Z')).toThrow();
    });
  });
});
