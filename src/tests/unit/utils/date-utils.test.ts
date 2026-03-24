import { describe, it, expect, beforeEach } from 'vitest';
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
} from '../../../utils/date-utils.js';

describe('date-utils', () => {
  let now: Date;

  beforeEach(() => {
    now = new Date();
  });

  describe('TIME_DURATIONS constants', () => {
    it('should define correct time duration values in milliseconds', () => {
      expect(TIME_DURATIONS.HOUR).toBe(1000 * 60 * 60);
      expect(TIME_DURATIONS.DAY).toBe(1000 * 60 * 60 * 24);
      expect(TIME_DURATIONS.WEEK).toBe(1000 * 60 * 60 * 24 * 7);
      expect(TIME_DURATIONS.MONTH).toBe(1000 * 60 * 60 * 24 * 30);
    });

    it('should have 86400000 milliseconds per day', () => {
      expect(TIME_DURATIONS.DAY).toBe(86400000);
    });
  });

  describe('addDays', () => {
    it('should add positive days to a date', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = addDays(date, 5);

      expect(result.getDate()).toBe(20);
      expect(result.getMonth()).toBe(5); // June is month 5
      expect(result.getFullYear()).toBe(2024);
    });

    it('should subtract days when given negative number', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = addDays(date, -5);

      expect(result.getDate()).toBe(10);
    });

    it('should not modify the original date', () => {
      const original = new Date('2024-06-15T10:00:00Z');
      const originalTime = original.getTime();
      addDays(original, 5);

      expect(original.getTime()).toBe(originalTime);
    });
  });

  describe('addMilliseconds', () => {
    it('should add milliseconds to a date', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = addMilliseconds(date, 5000);

      expect(result.getTime()).toBe(date.getTime() + 5000);
    });

    it('should subtract milliseconds with negative values', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = addMilliseconds(date, -5000);

      expect(result.getTime()).toBe(date.getTime() - 5000);
    });

    it('should not modify the original date', () => {
      const original = new Date('2024-06-15T10:00:00Z');
      const originalTime = original.getTime();
      addMilliseconds(original, 5000);

      expect(original.getTime()).toBe(originalTime);
    });
  });

  describe('durationMs', () => {
    it('should calculate positive duration between two dates', () => {
      const from = new Date('2024-06-15T10:00:00Z');
      const to = new Date('2024-06-15T11:00:00Z');

      expect(durationMs(from, to)).toBe(1000 * 60 * 60);
    });

    it('should return negative duration if from is after to', () => {
      const from = new Date('2024-06-15T11:00:00Z');
      const to = new Date('2024-06-15T10:00:00Z');

      expect(durationMs(from, to)).toBe(-(1000 * 60 * 60));
    });

    it('should return 0 for same date', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      expect(durationMs(date, date)).toBe(0);
    });
  });

  describe('formatBasicDateTime', () => {
    it('should format date in basic ISO 8601 format with Z suffix', () => {
      const date = new Date('2024-06-15T10:00:00.123Z');
      expect(formatBasicDateTime(date)).toBe('20240615T100000Z');
    });

    it('should remove colons and dashes from ISO string', () => {
      const date = new Date('2024-12-25T23:59:59.999Z');
      expect(formatBasicDateTime(date)).toBe('20241225T235959Z');
    });
  });

  describe('formatISODateTime', () => {
    it('should format date as ISO datetime without milliseconds', () => {
      const date = new Date('2024-06-15T10:00:00.123Z');
      expect(formatISODateTime(date)).toBe('2024-06-15T10:00:00');
    });

    it('should not include timezone designator', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = formatISODateTime(date);

      expect(result).not.toContain('Z');
      expect(result).not.toContain('+');
      expect(result).not.toContain('-00:00');
    });
  });

  describe('formatTZNaiveDateTime', () => {
    it('should format date as timezone-naive ISO datetime', () => {
      const date = new Date('2024-06-15T10:00:00.123Z');
      expect(formatTZNaiveDateTime(date)).toBe('2024-06-15T10:00:00');
    });

    it('should alias to formatISODateTime', () => {
      const date = new Date('2024-06-15T10:00:00.999Z');
      expect(formatTZNaiveDateTime(date)).toBe(formatISODateTime(date));
    });
  });

  describe('formatRFC3339', () => {
    it('should format date with Z suffix', () => {
      const date = new Date('2024-06-15T10:00:00.123Z');
      expect(formatRFC3339(date)).toBe('2024-06-15T10:00:00Z');
    });

    it('should always end with Z', () => {
      const date = new Date();
      const result = formatRFC3339(date);

      expect(result.endsWith('Z')).toBe(true);
    });
  });

  describe('getFutureDate', () => {
    it('should return a future date', () => {
      const future = getFutureDate(30);
      expect(future.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should return date 30 days in future by default', () => {
      const future = getFutureDate(30);
      const duration = future.getTime() - now.getTime();

      expect(duration).toBeGreaterThanOrEqual(TIME_DURATIONS.DAY * 30 - 1000);
      expect(duration).toBeLessThanOrEqual(TIME_DURATIONS.DAY * 30 + 1000);
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
      const past = getPastDate(30);
      const checkTime = new Date();

      const duration = checkTime.getTime() - past.getTime();
      const expectedDuration = TIME_DURATIONS.DAY * 30;

      // Allow ±5% variance for execution timing and date calculations
      const variance = expectedDuration * 0.05;
      expect(duration).toBeGreaterThanOrEqual(expectedDuration - variance);
      expect(duration).toBeLessThanOrEqual(expectedDuration + variance);
    });
  });

  describe('isFutureDate', () => {
    it('should return true for future date string', () => {
      const futureDate = addDays(now, 10);
      const dateString = futureDate.toISOString();

      expect(isFutureDate(dateString)).toBe(true);
    });

    it('should return false for past date string', () => {
      const pastDate = addDays(now, -10);
      const dateString = pastDate.toISOString();

      expect(isFutureDate(dateString)).toBe(false);
    });
  });

  describe('isPastDate', () => {
    it('should return true for past date string', () => {
      const pastDate = addDays(now, -10);
      const dateString = pastDate.toISOString();

      expect(isPastDate(dateString)).toBe(true);
    });

    it('should return false for future date string', () => {
      const futureDate = addDays(now, 10);
      const dateString = futureDate.toISOString();

      expect(isPastDate(dateString)).toBe(false);
    });
  });

  describe('oneDayBefore', () => {
    it('should subtract exactly one day from a date', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = oneDayBefore(date);

      const duration = date.getTime() - result.getTime();
      expect(duration).toBe(TIME_DURATIONS.DAY);
    });

    it('should handle month boundaries', () => {
      const date = new Date('2024-06-01T10:00:00Z');
      const result = oneDayBefore(date);

      expect(result.getDate()).toBe(31);
      expect(result.getMonth()).toBe(4); // May
    });

    it('should handle year boundaries', () => {
      const date = new Date('2024-01-01T10:00:00Z');
      const result = oneDayBefore(date);

      expect(result.getDate()).toBe(31);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getFullYear()).toBe(2023);
    });
  });

  describe('getOneDayBeforeFormatted', () => {
    it('should return one day before in basic format', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = getOneDayBeforeFormatted(date);

      expect(result).toBe('20240614T100000Z');
    });

    it('should combine oneDayBefore and formatBasicDateTime', () => {
      const date = new Date('2024-06-15T10:00:00Z');

      expect(getOneDayBeforeFormatted(date))
        .toBe(formatBasicDateTime(oneDayBefore(date)));
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
    it('should build UNTIL clause with basic format', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = buildUntilClause(date);

      expect(result).toBe(';UNTIL=20240615T100000Z');
    });

    it('should include semicolon prefix', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = buildUntilClause(date);

      expect(result.startsWith(';UNTIL=')).toBe(true);
    });

    it('should format date in basic ISO format', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = buildUntilClause(date);

      expect(result).toMatch(/^\;UNTIL=\d{8}T\d{6}Z$/);
    });
  });

  describe('isRRuleString', () => {
    it('should return true for RRULE strings', () => {
      expect(isRRuleString('RRULE:FREQ=WEEKLY')).toBe(true);
      expect(isRRuleString('RRULE:FREQ=DAILY;COUNT=5')).toBe(true);
    });

    it('should return false for EXDATE strings', () => {
      expect(isRRuleString('EXDATE:20240615T100000Z')).toBe(false);
    });

    it('should return false for RDATE strings', () => {
      expect(isRRuleString('RDATE:20240615T100000Z,20240616T100000Z')).toBe(false);
    });

    it('should return false for non-RRULE strings', () => {
      expect(isRRuleString('DTSTART:20240615T100000Z')).toBe(false);
      expect(isRRuleString('')).toBe(false);
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
});
