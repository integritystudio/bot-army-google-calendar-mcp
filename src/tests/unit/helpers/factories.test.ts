import { describe, it, expect } from 'vitest';
import {
  makeEvent,
  makeEventWithCalendarId,
  makeGaxiosError,
  makeEvents,
  makeFutureDateString,
  makePastDateString,
  makeWeeklyRecurringEvent,
  makeDailyRecurringEvent,
  makeMonthlyRecurringEvent,
  makeRecurringEventWithExceptions,
  makeRecurringEventWithAdditionalDates,
  makeRecurringEventInstance,
  makeRecurringEventInstances,
} from './factories.js';
import { getFutureDate, oneDayBefore, formatBasicDateTime } from '../../../utils/date-utils.js';

describe('Event Factories', () => {
  describe('makeEvent', () => {
    it('should create a basic event with defaults', () => {
      const event = makeEvent();
      expect(event.id).toBe('event1');
      expect(event.summary).toBe('Test Event');
      expect(event.start?.dateTime).toBe('2025-01-15T10:00:00Z');
      expect(event.end?.dateTime).toBe('2025-01-15T11:00:00Z');
    });

    it('should allow overriding event properties', () => {
      const event = makeEvent({
        id: 'custom-id',
        summary: 'Custom Event',
        description: 'Custom description',
      });
      expect(event.id).toBe('custom-id');
      expect(event.summary).toBe('Custom Event');
      expect(event.description).toBe('Custom description');
    });
  });

  describe('makeEventWithCalendarId', () => {
    it('should include calendarId property', () => {
      const event = makeEventWithCalendarId('calendar@example.com');
      expect(event.calendarId).toBe('calendar@example.com');
      expect(event.id).toBe('event1');
    });

    it('should allow overriding properties', () => {
      const event = makeEventWithCalendarId('calendar@example.com', {
        summary: 'Meeting',
      });
      expect(event.calendarId).toBe('calendar@example.com');
      expect(event.summary).toBe('Meeting');
    });
  });

  describe('makeGaxiosError', () => {
    it('should create an error with status code', () => {
      const error = makeGaxiosError(404, 'Not Found');
      expect(error.status).toBe(404);
      expect(error.message).toBe('Not Found');
    });

    it('should include error data', () => {
      const errorData = { errors: [{ message: 'Invalid request' }] };
      const error = makeGaxiosError(400, 'Bad Request', errorData);
      expect(error.data).toEqual(errorData);
    });
  });

  describe('makeEvents', () => {
    it('should create multiple events', () => {
      const events = makeEvents(3);
      expect(events).toHaveLength(3);
      expect(events[0].id).toBe('event1');
      expect(events[1].id).toBe('event2');
      expect(events[2].id).toBe('event3');
    });

    it('should apply base overrides to all events', () => {
      const events = makeEvents(2, { colorId: '1' });
      expect(events[0].colorId).toBe('1');
      expect(events[1].colorId).toBe('1');
    });

    it('should apply variant function to individual events', () => {
      const events = makeEvents(3, {}, (i) => ({
        summary: `Custom Event ${i}`,
      }));
      expect(events[0].summary).toBe('Custom Event 0');
      expect(events[1].summary).toBe('Custom Event 1');
    });
  });

  describe('makeFutureDateString', () => {
    it('should return future date without timezone', () => {
      const dateString = makeFutureDateString(0);
      expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(dateString).not.toContain('Z');
    });

    it('should be in the future', () => {
      const dateString = makeFutureDateString(30);
      const date = new Date(dateString);
      expect(date.getTime()).toBeGreaterThan(new Date().getTime());
    });
  });

  describe('makePastDateString', () => {
    it('should return past date with Z suffix', () => {
      const dateString = makePastDateString();
      expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    it('should be in the past', () => {
      const dateString = makePastDateString(1);
      const date = new Date(dateString);
      expect(date.getTime()).toBeLessThan(new Date().getTime());
    });
  });
});

describe('Recurrence Factories', () => {
  describe('makeWeeklyRecurringEvent', () => {
    it('should create weekly recurring event', () => {
      const event = makeWeeklyRecurringEvent();
      expect(event.summary).toBe('Weekly Meeting');
      expect(event.recurrence).toBeDefined();
      expect(event.recurrence![0]).toContain('FREQ=WEEKLY');
      expect(event.recurrence![0]).toContain('BYDAY=MO');
    });

    it('should support custom weekly pattern', () => {
      const event = makeWeeklyRecurringEvent(7, 'MO,WE,FR');
      expect(event.recurrence![0]).toContain('BYDAY=MO,WE,FR');
    });

    it('should include UNTIL clause when specified', () => {
      const event = makeWeeklyRecurringEvent(7, 'MO', 30);
      expect(event.recurrence![0]).toContain('UNTIL=');
      expect(event.recurrence![0]).toMatch(/UNTIL=\d{8}T\d{6}Z/);
    });

    it('should allow property overrides', () => {
      const event = makeWeeklyRecurringEvent(7, 'MO', undefined, {
        summary: 'Team Sync',
      });
      expect(event.summary).toBe('Team Sync');
    });
  });

  describe('makeDailyRecurringEvent', () => {
    it('should create daily recurring event', () => {
      const event = makeDailyRecurringEvent();
      expect(event.summary).toBe('Daily Standup');
      expect(event.recurrence![0]).toContain('FREQ=DAILY');
    });

    it('should include COUNT by default', () => {
      const event = makeDailyRecurringEvent();
      expect(event.recurrence![0]).toContain('COUNT=5');
    });

    it('should support custom COUNT', () => {
      const event = makeDailyRecurringEvent(1, 10);
      expect(event.recurrence![0]).toContain('COUNT=10');
    });

    it('should support UNTIL instead of COUNT', () => {
      const event = makeDailyRecurringEvent(1, undefined, 30);
      expect(event.recurrence![0]).toContain('UNTIL=');
      expect(event.recurrence![0]).not.toContain('COUNT=');
    });
  });

  describe('makeMonthlyRecurringEvent', () => {
    it('should create monthly recurring event', () => {
      const event = makeMonthlyRecurringEvent();
      expect(event.summary).toBe('Monthly Review');
      expect(event.recurrence![0]).toContain('FREQ=MONTHLY');
      expect(event.recurrence![0]).toContain('BYMONTHDAY=15');
    });

    it('should support custom month day', () => {
      const event = makeMonthlyRecurringEvent(30, 1);
      expect(event.recurrence![0]).toContain('BYMONTHDAY=1');
    });

    it('should include UNTIL clause when specified', () => {
      const event = makeMonthlyRecurringEvent(30, 15, 90);
      expect(event.recurrence![0]).toContain('UNTIL=');
    });
  });

  describe('makeRecurringEventWithExceptions', () => {
    it('should create recurring event without exceptions', () => {
      const event = makeRecurringEventWithExceptions();
      expect(event.summary).toBe('Meeting with Exceptions');
      expect(event.recurrence!.length).toBe(1); // Only RRULE, no EXDATE
    });

    it('should add EXDATE for exception dates', () => {
      const exceptionDates = [
        getFutureDate(8),
        getFutureDate(15),
      ];
      const event = makeRecurringEventWithExceptions(7, exceptionDates);
      expect(event.recurrence!.length).toBe(2);
      expect(event.recurrence![1]).toContain('EXDATE:');
      expect(event.recurrence![1]).toContain(formatBasicDateTime(exceptionDates[0]));
      expect(event.recurrence![1]).toContain(formatBasicDateTime(exceptionDates[1]));
    });
  });

  describe('makeRecurringEventWithAdditionalDates', () => {
    it('should create recurring event without additional dates', () => {
      const event = makeRecurringEventWithAdditionalDates();
      expect(event.recurrence!.length).toBe(1); // Only RRULE, no RDATE
    });

    it('should add RDATE for additional dates', () => {
      const additionalDates = [
        getFutureDate(10),
        getFutureDate(20),
      ];
      const event = makeRecurringEventWithAdditionalDates(7, additionalDates);
      expect(event.recurrence!.length).toBe(2);
      expect(event.recurrence![1]).toContain('RDATE:');
      expect(event.recurrence![1]).toContain(formatBasicDateTime(additionalDates[0]));
    });
  });

  describe('makeRecurringEventInstance', () => {
    it('should create a single event instance', () => {
      const instanceDate = getFutureDate(7);
      const event = makeRecurringEventInstance('parent-123', instanceDate);
      expect(event.recurringEventId).toBe('parent-123');
      expect(event.originalStartTime).toBeDefined();
    });

    it('should format instance ID with basic datetime', () => {
      const instanceDate = new Date('2025-06-15T10:00:00Z');
      const event = makeRecurringEventInstance('parent-123', instanceDate);
      expect(event.id).toContain('parent-123_');
      expect(event.id).toMatch(/parent-123_\d{8}T\d{6}Z/);
    });

    it('should allow property overrides', () => {
      const instanceDate = getFutureDate(7);
      const event = makeRecurringEventInstance('parent-123', instanceDate, {
        summary: 'Custom Instance',
      });
      expect(event.summary).toBe('Custom Instance');
    });
  });

  describe('makeRecurringEventInstances', () => {
    it('should create multiple instances', () => {
      const startDate = getFutureDate(7);
      const instances = makeRecurringEventInstances('parent-123', startDate, 3);
      expect(instances).toHaveLength(3);
      expect(instances[0].recurringEventId).toBe('parent-123');
      expect(instances[1].recurringEventId).toBe('parent-123');
    });

    it('should space instances by interval days', () => {
      const startDate = new Date('2025-06-01T10:00:00Z');
      const instances = makeRecurringEventInstances('parent-123', startDate, 3, 7);

      // First instance
      expect(instances[0].start!.dateTime).toBe('2025-06-01T10:00:00Z');
      // Second instance (7 days later)
      expect(instances[1].start!.dateTime).toBe('2025-06-08T10:00:00Z');
      // Third instance (14 days later)
      expect(instances[2].start!.dateTime).toBe('2025-06-15T10:00:00Z');
    });

    it('should support custom interval', () => {
      const startDate = new Date('2025-06-01T10:00:00Z');
      const instances = makeRecurringEventInstances('parent-123', startDate, 3, 1);

      // Daily interval
      expect(instances[0].start!.dateTime).toBe('2025-06-01T10:00:00Z');
      expect(instances[1].start!.dateTime).toBe('2025-06-02T10:00:00Z');
    });
  });
});
