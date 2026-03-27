import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calendar_v3 } from 'googleapis';
import { RecurringEventHelpers } from '../../../handlers/core/RecurringEventHelpers.js';
import {
  makeCalendarMock,
  makeEvent,
  SYSTEM_FIELDS,
  createTestEventWithTZOffset,
  createCompleteTestEvent,
  createUpdateEventArgsWithTimes,
  createUpdateEventArgsWithAttendees,
  createComplexUpdateEventArgs
} from '../helpers/index.js';

// Test constants
const CALENDAR_ID = 'primary';
const EVENT_ID = 'event123';

describe('RecurringEventHelpers', () => {
  let helpers: RecurringEventHelpers;
  let mockCalendar: ReturnType<typeof makeCalendarMock>;

  beforeEach(() => {
    mockCalendar = makeCalendarMock();
    helpers = new RecurringEventHelpers(mockCalendar as unknown as calendar_v3.Calendar);
  });

  describe('detectEventType', () => {
    function resolveWith(overrides: Partial<calendar_v3.Schema$Event>) {
      mockCalendar.events.get.mockResolvedValue({ data: makeEvent(overrides) });
    }

    it('should detect recurring events', async () => {
      resolveWith({
        id: EVENT_ID,
        summary: 'Weekly Meeting',
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO']
      });

      const result = await helpers.detectEventType(EVENT_ID, CALENDAR_ID);
      expect(result).toBe('recurring');
      expect(mockCalendar.events.get).toHaveBeenCalledWith({
        calendarId: CALENDAR_ID,
        eventId: EVENT_ID
      });
    });

    it('should detect single events', async () => {
      resolveWith({
        id: EVENT_ID,
        summary: 'One-time Meeting'
      });

      const result = await helpers.detectEventType(EVENT_ID, CALENDAR_ID);
      expect(result).toBe('single');
    });

    it('should detect single events with empty recurrence array', async () => {
      resolveWith({
        id: EVENT_ID,
        summary: 'One-time Meeting',
        recurrence: []
      });

      const result = await helpers.detectEventType(EVENT_ID, CALENDAR_ID);
      expect(result).toBe('single');
    });

    it('should handle API errors', async () => {
      mockCalendar.events.get.mockRejectedValue(new Error('Event not found'));

      await expect(helpers.detectEventType('invalid123', CALENDAR_ID))
        .rejects.toThrow('Event not found');
    });
  });

  describe('formatInstanceId', () => {
    it.each([
      ['event123', '2024-06-15T10:00:00-07:00', 'event123_20240615T170000Z'],
      ['meeting456', '2024-12-31T23:59:59Z', 'meeting456_20241231T235959Z'],
      ['recurring_event', '2024-06-15T14:30:00+05:30', 'recurring_event_20240615T090000Z'],
    ])('should format instance ID for %s at %s', (eventId, originalStartTime, expected) => {
      const result = helpers.formatInstanceId(eventId, originalStartTime);
      expect(result).toBe(expected);
    });

    it('should handle datetime with milliseconds', () => {
      const result = helpers.formatInstanceId(EVENT_ID, '2024-06-15T10:00:00.000Z');
      expect(result).toBe('event123_20240615T100000Z');
    });

    it.each([
      ['leap123', '2024-02-29T10:00:00Z', 'leap123_20240229T100000Z'],
      ['leap456', '2024-02-29T23:59:59-12:00', 'leap456_20240301T115959Z'],
    ])('should handle leap year dates in %s', (eventId, originalStartTime, expected) => {
      const result = helpers.formatInstanceId(eventId, originalStartTime);
      expect(result).toBe(expected);
    });

    it.each([
      ['extreme1', '2024-06-15T10:00:00+14:00', 'extreme1_20240614T200000Z'],
      ['extreme2', '2024-06-15T10:00:00-12:00', 'extreme2_20240615T220000Z'],
    ])('should handle extreme timezone offsets in %s', (eventId, originalStartTime, expected) => {
      const result = helpers.formatInstanceId(eventId, originalStartTime);
      expect(result).toBe(expected);
    });
  });

  describe('calculateUntilDate', () => {
    it.each([
      ['2024-06-20T10:00:00-07:00', '20240619T170000Z'],
      ['2024-06-20T00:00:00Z', '20240619T000000Z'],
      ['2024-06-20T10:00:00+05:30', '20240619T043000Z'],
    ])('should calculate UNTIL date one day before %s', (futureStartDate, expected) => {
      const result = helpers.calculateUntilDate(futureStartDate);
      expect(result).toBe(expected);
    });

    it.each([
      ['2024-01-01T00:00:00Z', '20231231T000000Z'],
      ['2024-12-31T23:59:59Z', '20241230T235959Z'],
      ['2024-03-01T00:00:00Z', '20240229T000000Z'],
    ])('should handle edge dates like %s', (futureStartDate, expected) => {
      const result = helpers.calculateUntilDate(futureStartDate);
      expect(result).toBe(expected);
    });
  });

  describe('calculateEndTime', () => {
    it('should calculate end time based on original duration', () => {
      const originalEvent = createTestEventWithTZOffset('2024-06-15T10:00:00-07:00', '2024-06-15T11:00:00-07:00');
      const newStartTime = '2024-06-15T14:00:00-07:00';

      const result = helpers.calculateEndTime(newStartTime, originalEvent);
      expect(result).toBe('2024-06-15T22:00:00Z');
    });

    it('should handle different durations', () => {
      const originalEvent = createTestEventWithTZOffset('2024-06-15T10:00:00Z', '2024-06-15T12:30:00Z');
      const newStartTime = '2024-06-16T09:00:00Z';

      const result = helpers.calculateEndTime(newStartTime, originalEvent);
      expect(result).toBe('2024-06-16T11:30:00Z');
    });

    it('should handle cross-timezone calculations', () => {
      const originalEvent = createTestEventWithTZOffset('2024-06-15T10:00:00-07:00', '2024-06-15T11:00:00-07:00');
      const newStartTime = '2024-06-15T10:00:00+05:30';

      const result = helpers.calculateEndTime(newStartTime, originalEvent);
      expect(result).toBe('2024-06-15T05:30:00Z');
    });

    it.each([
      ['1 minute', '2024-06-15T10:00:00Z', '2024-06-15T10:01:00Z', '2024-06-16T15:30:00Z', '2024-06-16T15:31:00Z'],
      ['8 hours', '2024-06-15T09:00:00Z', '2024-06-15T17:00:00Z', '2024-06-16T10:00:00Z', '2024-06-16T18:00:00Z'],
      ['48 hours', '2024-06-15T10:00:00Z', '2024-06-17T10:00:00Z', '2024-06-20T10:00:00Z', '2024-06-22T10:00:00Z'],
    ])('should preserve %s duration', (_, origStart, origEnd, newStart, expected) => {
      const event = { start: { dateTime: origStart }, end: { dateTime: origEnd } };
      expect(helpers.calculateEndTime(newStart, event)).toBe(expected);
    });
  });

  describe('updateRecurrenceWithUntil', () => {
    const UNTIL_DATE = '20240630T170000Z';

    it('should add UNTIL clause to simple recurrence rule', () => {
      const recurrence = ['RRULE:FREQ=WEEKLY;BYDAY=MO'];
      const result = helpers.updateRecurrenceWithUntil(recurrence, UNTIL_DATE);
      expect(result).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20240630T170000Z']);
    });

    it('should replace existing UNTIL clause', () => {
      const recurrence = ['RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20240531T170000Z'];
      const result = helpers.updateRecurrenceWithUntil(recurrence, UNTIL_DATE);
      expect(result).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20240630T170000Z']);
    });

    it('should replace COUNT with UNTIL', () => {
      const recurrence = ['RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10'];
      const result = helpers.updateRecurrenceWithUntil(recurrence, UNTIL_DATE);
      expect(result).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20240630T170000Z']);
    });

    it('should handle complex recurrence rules', () => {
      const recurrence = ['RRULE:FREQ=DAILY;INTERVAL=2;BYHOUR=10;BYMINUTE=0;COUNT=20'];
      const result = helpers.updateRecurrenceWithUntil(recurrence, UNTIL_DATE);
      expect(result).toEqual(['RRULE:FREQ=DAILY;INTERVAL=2;BYHOUR=10;BYMINUTE=0;UNTIL=20240630T170000Z']);
    });

    it('should throw error for empty recurrence', () => {
      expect(() => helpers.updateRecurrenceWithUntil([], UNTIL_DATE))
        .toThrow('No recurrence rule found');

      expect(() => helpers.updateRecurrenceWithUntil(undefined as any, UNTIL_DATE))
        .toThrow('No recurrence rule found');
    });

    it('should handle recurrence with EXDATE rules', () => {
      const recurrence = [
        'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
        'EXDATE:20240610T100000Z',
        'EXDATE:20240612T100000Z'
      ];

      const result = helpers.updateRecurrenceWithUntil(recurrence, UNTIL_DATE);
      expect(result).toEqual([
        'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20240630T170000Z',
        'EXDATE:20240610T100000Z',
        'EXDATE:20240612T100000Z'
      ]);
    });

    it('should handle EXDATE rules appearing before RRULE', () => {
      const recurrence = [
        'EXDATE:20240610T100000Z',
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
        'EXDATE:20240612T100000Z'
      ];

      const result = helpers.updateRecurrenceWithUntil(recurrence, UNTIL_DATE);
      expect(result).toEqual([
        'EXDATE:20240610T100000Z',
        'RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20240630T170000Z',
        'EXDATE:20240612T100000Z'
      ]);
    });

    it('should throw error when no RRULE found', () => {
      const recurrence = [
        'EXDATE:20240610T100000Z',
        'EXDATE:20240612T100000Z'
      ];

      expect(() => helpers.updateRecurrenceWithUntil(recurrence, UNTIL_DATE))
        .toThrow('No RRULE found in recurrence rules');
    });

    it('should handle complex recurrence with multiple EXDATE rules', () => {
      const recurrence = [
        'EXDATE;TZID=America/Los_Angeles:20250702T130500',
        'EXDATE;TZID=America/Los_Angeles:20250704T130500',
        'EXDATE;TZID=America/Los_Angeles:20250707T130500',
        'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
        'EXDATE;TZID=America/Los_Angeles:20250709T130500',
        'EXDATE;TZID=America/Los_Angeles:20250711T130500'
      ];

      const result = helpers.updateRecurrenceWithUntil(recurrence, '20251102T210500Z');
      expect(result).toEqual([
        'EXDATE;TZID=America/Los_Angeles:20250702T130500',
        'EXDATE;TZID=America/Los_Angeles:20250704T130500',
        'EXDATE;TZID=America/Los_Angeles:20250707T130500',
        'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20251102T210500Z',
        'EXDATE;TZID=America/Los_Angeles:20250709T130500',
        'EXDATE;TZID=America/Los_Angeles:20250711T130500'
      ]);
    });

    it.each([
      [['RRULE:FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=10;BYMINUTE=30'], '20241215T103000Z', ['RRULE:FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=10;BYMINUTE=30;UNTIL=20241215T103000Z']],
      [['RRULE:FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=15;COUNT=5'], '20291215T103000Z', ['RRULE:FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=15;UNTIL=20291215T103000Z']],
      [['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=2;UNTIL=20241201T100000Z'], '20241115T100000Z', ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=2;UNTIL=20241115T100000Z']],
    ])('should handle various RRULE formats', (original, untilDate, expected) => {
      const result = helpers.updateRecurrenceWithUntil(original, untilDate);
      expect(result).toEqual(expected);
    });
  });

  describe('cleanEventForDuplication', () => {
    function expectSystemFieldsRemoved(result: calendar_v3.Schema$Event): void {
      SYSTEM_FIELDS.forEach(field => {
        expect(result[field as keyof typeof result]).toBeUndefined();
      });
    }

    it('should remove system-generated fields', () => {
      const originalEvent = createCompleteTestEvent({
        id: EVENT_ID,
        summary: 'Meeting',
        description: 'Meeting description',
        location: 'Conference Room',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' }
      });

      const result = helpers.cleanEventForDuplication(originalEvent);
      expectSystemFieldsRemoved(result);
      expect(result.summary).toBe('Meeting');
      expect(result.description).toBe('Meeting description');
      expect(result.location).toBe('Conference Room');
      expect(result.start).toEqual({ dateTime: '2024-06-15T10:00:00Z' });
      expect(result.end).toEqual({ dateTime: '2024-06-15T11:00:00Z' });
    });

    it('should not modify original event object', () => {
      const originalEvent: calendar_v3.Schema$Event = {
        id: EVENT_ID,
        summary: 'Meeting'
      };

      const result = helpers.cleanEventForDuplication(originalEvent);

      expect(originalEvent.id).toBe(EVENT_ID);
      expect(result.id).toBeUndefined();
      expect(result.summary).toBe('Meeting');
    });

    it('should handle all possible system fields', () => {
      const eventWithAllSystemFields = createCompleteTestEvent({
        id: EVENT_ID,
        summary: 'Meeting',
        description: 'Meeting description',
        location: 'Conference Room',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' }
      });

      const result = helpers.cleanEventForDuplication(eventWithAllSystemFields);
      expectSystemFieldsRemoved(result);
      expect(result.summary).toBe('Meeting');
      expect(result.description).toBe('Meeting description');
      expect(result.location).toBe('Conference Room');
      expect(result.attendees).toEqual([{ email: 'attendee@example.com' }]);
      expect(result.recurrence).toEqual(['RRULE:FREQ=WEEKLY']);
    });
  });

  describe('buildUpdateRequestBody', () => {
    it('should build request body with provided fields', () => {
      const args = {
        summary: 'Updated Meeting',
        description: 'Updated description',
        location: 'New Location',
        colorId: '9',
        timeZone: 'America/Los_Angeles'
      };

      const result = helpers.buildUpdateRequestBody(args);

      expect(result).toEqual({
        summary: 'Updated Meeting',
        description: 'Updated description',
        location: 'New Location',
        colorId: '9',
        start: { timeZone: 'America/Los_Angeles' },
        end: { timeZone: 'America/Los_Angeles' }
      });
    });

    it('should handle time changes correctly', () => {
      const args = createUpdateEventArgsWithTimes(
        '2024-06-15T10:00:00-07:00',
        '2024-06-15T11:00:00-07:00',
        'America/Los_Angeles',
        { summary: 'Meeting' }
      );

      const result = helpers.buildUpdateRequestBody(args);

      expect(result).toEqual({
        summary: 'Meeting',
        start: {
          dateTime: '2024-06-15T10:00:00-07:00',
          timeZone: 'America/Los_Angeles'
        },
        end: {
          dateTime: '2024-06-15T11:00:00-07:00',
          timeZone: 'America/Los_Angeles'
        }
      });
    });

    it('should handle partial time changes', () => {
      const args = {
        start: '2024-06-15T10:00:00-07:00',
        timeZone: 'America/Los_Angeles',
        summary: 'Meeting'
      };

      const result = helpers.buildUpdateRequestBody(args);

      expect(result.start).toEqual({
        dateTime: '2024-06-15T10:00:00-07:00',
        timeZone: 'America/Los_Angeles'
      });
      expect(result.end).toEqual({
        timeZone: 'America/Los_Angeles'
      });
    });

    it('should use default timezone when no timezone provided', () => {
      const args = {
        start: '2024-06-15T10:00:00',
        end: '2024-06-15T11:00:00',
        summary: 'Meeting'
      };

      const defaultTimeZone = 'Europe/London';
      const result = helpers.buildUpdateRequestBody(args, defaultTimeZone);

      expect(result).toEqual({
        summary: 'Meeting',
        start: {
          dateTime: '2024-06-15T10:00:00',
          timeZone: 'Europe/London'
        },
        end: {
          dateTime: '2024-06-15T11:00:00',
          timeZone: 'Europe/London'
        }
      });
    });

    it('should handle attendees and reminders', () => {
      const args = createUpdateEventArgsWithAttendees({
        timeZone: 'UTC'
      });

      const result = helpers.buildUpdateRequestBody(args);

      expect(result.attendees).toEqual(args.attendees);
      expect(result.reminders).toEqual(args.reminders);
    });

    it('should not include undefined fields', () => {
      const args = {
        summary: 'Meeting',
        description: undefined,
        location: null,
        timeZone: 'UTC'
      };

      const result = helpers.buildUpdateRequestBody(args);

      expect(result.summary).toBe('Meeting');
      expect('description' in result).toBe(false);
      expect('location' in result).toBe(false);
    });

    it('should handle complex nested objects', () => {
      const complexArgs = createComplexUpdateEventArgs();

      const result = helpers.buildUpdateRequestBody(complexArgs);

      expect(result.attendees).toEqual(complexArgs.attendees);
      expect(result.reminders).toEqual(complexArgs.reminders);
      expect(result.recurrence).toEqual(complexArgs.recurrence);
      expect(result.start).toEqual({ timeZone: 'America/Los_Angeles' });
      expect(result.end).toEqual({ timeZone: 'America/Los_Angeles' });
    });

    it('should handle mixed null, undefined, and valid values', () => {
      const mixedArgs = {
        summary: 'Valid Summary',
        description: null,
        location: undefined,
        colorId: '',
        attendees: [],
        reminders: null,
        start: '2024-06-15T10:00:00Z',
        end: null,
        timeZone: 'UTC'
      };

      const result = helpers.buildUpdateRequestBody(mixedArgs);

      expect(result.summary).toBe('Valid Summary');
      expect('description' in result).toBe(false);
      expect('location' in result).toBe(false);
      expect(result.colorId).toBe('');
      expect(result.attendees).toEqual([]);
      expect('reminders' in result).toBe(false);
      expect(result.start).toEqual({
        dateTime: '2024-06-15T10:00:00Z',
        timeZone: 'UTC'
      });
      expect(result.end).toEqual({ timeZone: 'UTC' });
    });
  });
});
