import { describe, it, expect } from 'vitest';
import {
  isValidIANATimeZone,
  getSystemTimeZone,
  validateTimeZone,
  getTimezoneOffsetMinutes,
  getTimezoneOffsetString,
  formatDateInTimeZone,
  resolveTimeZone,
  hasTimezoneInDatetime,
  convertToRFC3339,
  createTimeObject,
  applyTimezone,
} from '../../../utils/timezone-utils.js';

describe('Timezone Utilities', () => {
  describe('isValidIANATimeZone', () => {
    it('should recognize valid UTC timezone', () => {
      expect(isValidIANATimeZone('UTC')).toBe(true);
      expect(isValidIANATimeZone('Etc/UTC')).toBe(true);
    });

    it('should recognize valid named timezones', () => {
      expect(isValidIANATimeZone('America/Los_Angeles')).toBe(true);
      expect(isValidIANATimeZone('Europe/London')).toBe(true);
      expect(isValidIANATimeZone('Asia/Tokyo')).toBe(true);
    });

    it('should reject invalid timezones', () => {
      expect(isValidIANATimeZone('Invalid/Timezone')).toBe(false);
      expect(isValidIANATimeZone('NotATimeZone')).toBe(false);
      expect(isValidIANATimeZone('')).toBe(false);
    });
  });

  describe('getSystemTimeZone', () => {
    it('should return a valid timezone string', () => {
      const tz = getSystemTimeZone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
      expect(isValidIANATimeZone(tz)).toBe(true);
    });
  });

  describe('validateTimeZone', () => {
    it('should not throw for valid timezones', () => {
      expect(() => validateTimeZone('UTC')).not.toThrow();
      expect(() => validateTimeZone('America/Los_Angeles')).not.toThrow();
    });

    it('should throw for invalid timezones', () => {
      expect(() => validateTimeZone('Invalid/Timezone')).toThrow();
      expect(() => validateTimeZone('NotValid')).toThrow();
    });

    it('should include timezone in error message', () => {
      expect(() => validateTimeZone('BadTZ')).toThrow(/BadTZ/);
    });
  });

  // getTimezoneOffsetMinutes and getTimezoneOffsetString derive from the same
  // underlying offset calculation, so each timezone case is verified through both.
  // Los Angeles' exact offset varies with DST (UTC-7 or UTC-8), so it's asserted
  // as a bound rather than an exact value; UTC and Tokyo don't observe DST.
  describe('offset calculation', () => {
    it.each([
      ['UTC', (offset: number) => expect(offset).toBe(0), 'Z'],
      ['Asia/Tokyo', (offset: number) => expect(offset).toBe(540), '+09:00'], // UTC+9
      ['America/Los_Angeles', (offset: number) => expect(Math.abs(offset)).toBeGreaterThanOrEqual(420), /^-\d{2}:\d{2}$/],
    ] as const)('should compute consistent minutes and string offset for %s', (timezone, assertMinutes, expectedString) => {
      assertMinutes(getTimezoneOffsetMinutes(timezone));

      const offsetString = getTimezoneOffsetString(timezone);
      if (typeof expectedString === 'string') {
        expect(offsetString).toBe(expectedString);
      } else {
        expect(offsetString).toMatch(expectedString);
      }
    });
  });

  describe('formatDateInTimeZone', () => {
    it('should return object with rfc3339, humanReadable, and offset', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = formatDateInTimeZone(date, 'UTC');

      expect(result).toHaveProperty('rfc3339');
      expect(result).toHaveProperty('humanReadable');
      expect(result).toHaveProperty('offset');
    });

    it('should have Z offset for UTC', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = formatDateInTimeZone(date, 'UTC');

      expect(result.offset).toBe('Z');
      expect(result.rfc3339).toMatch(/Z$/);
    });

    it('should format RFC3339 with timezone offset', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = formatDateInTimeZone(date, 'Asia/Tokyo');

      expect(result.rfc3339).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    });

    it('should include human-readable format', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const result = formatDateInTimeZone(date, 'America/Los_Angeles');

      expect(result.humanReadable).toMatch(/\d{4}/); // Should include year
      expect(result.humanReadable).toMatch(/[A-Z]/); // Should include text
    });
  });

  describe('resolveTimeZone', () => {
    it('should return preferred timezone if valid', () => {
      const result = resolveTimeZone('America/Los_Angeles', 'UTC');
      expect(result).toBe('America/Los_Angeles');
    });

    it('should use calendar default if preferred not valid', () => {
      const result = resolveTimeZone(undefined, 'Europe/London');
      expect(result).toBe('Europe/London');
    });

    it('should fall back to system timezone if both not provided', () => {
      const result = resolveTimeZone(undefined, undefined);
      expect(isValidIANATimeZone(result)).toBe(true);
    });

    it('should fall back to system timezone when all invalid', () => {
      // This tests the fallback chain
      const result = resolveTimeZone('Invalid', 'AlsoInvalid');
      // Should use system timezone which is always valid
      expect(isValidIANATimeZone(result)).toBe(true);
    });

    it('should validate timezones before using', () => {
      const result = resolveTimeZone('Invalid/TZ', 'America/Chicago');
      expect(result).toBe('America/Chicago');
    });
  });

  describe('hasTimezoneInDatetime', () => {
    it('should detect timezone with Z suffix', () => {
      expect(hasTimezoneInDatetime('2024-06-15T10:00:00Z')).toBe(true);
    });

    it('should detect timezone with positive offset', () => {
      expect(hasTimezoneInDatetime('2024-06-15T10:00:00+05:30')).toBe(true);
    });

    it('should detect timezone with negative offset', () => {
      expect(hasTimezoneInDatetime('2024-06-15T10:00:00-07:00')).toBe(true);
    });

    it('should not detect timezone-naive datetime', () => {
      expect(hasTimezoneInDatetime('2024-06-15T10:00:00')).toBe(false);
    });

    it('should not detect date-only strings', () => {
      expect(hasTimezoneInDatetime('2024-06-15')).toBe(false);
    });
  });

  describe('convertToRFC3339', () => {
    it('should return timezone-aware datetime unchanged', () => {
      const input = '2024-06-15T10:00:00Z';
      const result = convertToRFC3339(input, 'UTC');
      expect(result).toBe(input);
    });

    it('should return timezone-aware with offset unchanged', () => {
      const input = '2024-06-15T10:00:00+05:30';
      const result = convertToRFC3339(input, 'UTC');
      expect(result).toBe(input);
    });

    it('should convert timezone-naive datetime with fallback timezone', () => {
      const input = '2024-06-15T10:00:00';
      const result = convertToRFC3339(input, 'UTC');
      // Should convert to RFC3339 format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    it('should append Z on invalid input', () => {
      const input = '2024-06-15';
      const result = convertToRFC3339(input, 'UTC');
      expect(result).toBe('2024-06-15Z');
    });

    it('should fall back to UTC when fallback timezone is invalid', () => {
      const input = '2024-01-01T10:00:00';
      const result = convertToRFC3339(input, 'Invalid/Timezone');
      expect(result).toBe('2024-01-01T10:00:00Z');
    });
  });

  describe('createTimeObject', () => {
    it('should use date field for date-only strings', () => {
      const result = createTimeObject('2024-06-15', 'UTC');
      expect(result.date).toBe('2024-06-15');
      expect(result.dateTime).toBeUndefined();
      expect(result.timeZone).toBeUndefined();
    });

    it('should use dateTime field for timezone-aware datetime', () => {
      const result = createTimeObject('2024-06-15T10:00:00Z', 'UTC');
      expect(result.dateTime).toBe('2024-06-15T10:00:00Z');
      expect(result.timeZone).toBeUndefined();
    });

    it('should include timeZone for timezone-naive datetime', () => {
      const result = createTimeObject('2024-06-15T10:00:00', 'America/Los_Angeles');
      expect(result.dateTime).toBe('2024-06-15T10:00:00');
      expect(result.timeZone).toBe('America/Los_Angeles');
    });

    it('should not include timeZone for datetime with offset', () => {
      const result = createTimeObject('2024-06-15T10:00:00+05:30', 'UTC');
      expect(result.dateTime).toBe('2024-06-15T10:00:00+05:30');
      expect(result.timeZone).toBeUndefined();
    });
  });

  describe('applyTimezone', () => {
    it('should apply timezone to both start and end objects', () => {
      const start = { dateTime: '2024-06-15T10:00:00' };
      const end = { dateTime: '2024-06-15T11:00:00' };
      const result = applyTimezone(start, end, 'America/Los_Angeles');

      expect(result.start.timeZone).toBe('America/Los_Angeles');
      expect(result.end.timeZone).toBe('America/Los_Angeles');
      expect(result.start.dateTime).toBe('2024-06-15T10:00:00');
      expect(result.end.dateTime).toBe('2024-06-15T11:00:00');
    });

    it('should create start/end objects if undefined', () => {
      const result = applyTimezone(undefined, undefined, 'UTC');

      expect(result.start).toEqual({ timeZone: 'UTC' });
      expect(result.end).toEqual({ timeZone: 'UTC' });
    });

    it('should handle partial start/end objects', () => {
      const start = { dateTime: '2024-06-15T10:00:00' };
      const result = applyTimezone(start, undefined, 'Europe/London');

      expect(result.start.timeZone).toBe('Europe/London');
      expect(result.start.dateTime).toBe('2024-06-15T10:00:00');
      expect(result.end).toEqual({ timeZone: 'Europe/London' });
    });

    it('should handle date-only objects', () => {
      const start = { date: '2024-06-15' };
      const end = { date: '2024-06-16' };
      const result = applyTimezone(start, end, 'Asia/Tokyo');

      expect(result.start.timeZone).toBe('Asia/Tokyo');
      expect(result.start.date).toBe('2024-06-15');
      expect(result.end.timeZone).toBe('Asia/Tokyo');
      expect(result.end.date).toBe('2024-06-16');
    });

    it('should preserve existing timezone properties when overwriting', () => {
      const start = { dateTime: '2024-06-15T10:00:00', timeZone: 'UTC' };
      const end = { dateTime: '2024-06-15T11:00:00', timeZone: 'UTC' };
      const result = applyTimezone(start, end, 'America/New_York');

      expect(result.start.timeZone).toBe('America/New_York');
      expect(result.end.timeZone).toBe('America/New_York');
    });
  });
});
