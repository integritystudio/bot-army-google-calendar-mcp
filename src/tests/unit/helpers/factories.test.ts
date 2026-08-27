import { describe, it, expect } from 'vitest';
import {
  makeGaxiosError,
  makeWeeklyRecurringEvent,
  makeRecurringEventInstances,
} from './factories.js';

describe('Event Factories', () => {
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
});

describe('Recurrence Factories', () => {
  describe('makeWeeklyRecurringEvent', () => {
    it('should include UNTIL clause when specified', () => {
      const event = makeWeeklyRecurringEvent(7, 'MO', 30);
      expect(event.recurrence![0]).toContain('UNTIL=');
      expect(event.recurrence![0]).toMatch(/UNTIL=\d{8}T\d{6}Z/);
    });
  });

  describe('makeRecurringEventInstances', () => {
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
  });
});
