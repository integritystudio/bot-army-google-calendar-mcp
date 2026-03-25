import { describe, it, expect } from 'vitest';
import { ToolSchemas } from '../../../tools/registry.js';
import { makeFutureDateString, makePastDateString } from '../helpers/factories.js';
import { TIME_MIN, TIME_MAX } from '../helpers/test-configs.js';
import {
  createUpdateEventArgs,
  createComplexUpdateEventArgs,
  DEFAULT_CALENDAR_ID,
  DEFAULT_EVENT_ID
} from '../helpers/event-test-data.js';
import { TEST_EVENT_DEFAULTS, TEST_TIMEZONE } from '../../../testing/constants.js';

const UpdateEventArgumentsSchema = ToolSchemas['update-event'];
const ListEventsArgumentsSchema = ToolSchemas['list-events'];

const MODIFICATION_SCOPES = ['thisEventOnly', 'all', 'thisAndFollowing'] as const;
const VALID_DATETIMES = [
  '2024-06-15T10:00:00',
  '2024-12-31T23:59:59',
  '2024-01-01T00:00:00',
  '2024-06-15T10:00:00Z',
  '2024-06-15T10:00:00-07:00',
  '2024-06-15T10:00:00+05:30'
] as const;

const INVALID_DATETIMES = [
  '2024-06-15 10:00:00',
  '24-06-15T10:00:00',
  '2024-6-15T10:00:00',
  '2024-06-15T10:00'
] as const;

describe('UpdateEventArgumentsSchema with Recurring Event Support', () => {
  describe('Basic Validation', () => {
    it('should validate basic required fields', () => {
      const validArgs = createUpdateEventArgs();

      const result = UpdateEventArgumentsSchema.parse(validArgs);
      expect(result.modificationScope).toBeUndefined(); // optional with no default
      expect(result.calendarId).toBe('primary');
      expect(result.eventId).toBe('event123');
      expect(result.timeZone).toBe(TEST_TIMEZONE);
    });

    it('should reject missing required fields', () => {
      const invalidArgs = {
        calendarId: 'primary',
        // missing eventId and timeZone
      };

      expect(() => UpdateEventArgumentsSchema.parse(invalidArgs)).toThrow();
    });

    it('should validate optional fields when provided', () => {
      const validArgs = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        summary: 'Updated Meeting',
        description: 'Updated description',
        location: 'New Location',
        colorId: '9',
        start: '2024-06-15T10:00:00',
        end: '2024-06-15T11:00:00'
      });

      const result = UpdateEventArgumentsSchema.parse(validArgs);
      expect(result.summary).toBe('Updated Meeting');
      expect(result.description).toBe('Updated description');
      expect(result.location).toBe('New Location');
      expect(result.colorId).toBe('9');
    });
  });

  describe('Modification Scope Validation', () => {
    it('should leave modificationScope undefined when not provided', () => {
      const args = createUpdateEventArgs();

      const result = UpdateEventArgumentsSchema.parse(args);
      expect(result.modificationScope).toBeUndefined();
    });

    it('should accept valid modificationScope values', () => {
      MODIFICATION_SCOPES.forEach(scope => {
        const scopeOverrides: Record<string, any> = { modificationScope: scope };

        if (scope === 'thisEventOnly') {
          scopeOverrides.originalStartTime = '2024-06-15T10:00:00';
        } else if (scope === 'thisAndFollowing') {
          scopeOverrides.futureStartDate = makeFutureDateString(90);
        }

        const args = createUpdateEventArgs(DEFAULT_CALENDAR_ID, DEFAULT_EVENT_ID, TEST_TIMEZONE, scopeOverrides);
        const result = UpdateEventArgumentsSchema.parse(args);
        expect(result.modificationScope).toBe(scope);
      });
    });

    it('should reject invalid modificationScope values', () => {
      const args = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        modificationScope: 'invalid'
      });

      expect(() => UpdateEventArgumentsSchema.parse(args)).toThrow();
    });
  });

  describe('Single Instance Scope Validation', () => {
    it('should require originalStartTime when modificationScope is "thisEventOnly"', () => {
      const args = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        modificationScope: 'thisEventOnly'
        // missing originalStartTime
      });

      expect(() => UpdateEventArgumentsSchema.parse(args)).toThrow(
        /originalStartTime is required when modificationScope is 'thisEventOnly'/
      );
    });

    it('should accept valid originalStartTime for thisEventOnly scope', () => {
      const args = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        modificationScope: 'thisEventOnly',
        originalStartTime: '2024-06-15T10:00:00'
      });

      const result = UpdateEventArgumentsSchema.parse(args);
      expect(result.modificationScope).toBe('thisEventOnly');
      expect(result.originalStartTime).toBe('2024-06-15T10:00:00');
    });

    it('should reject invalid originalStartTime format', () => {
      const args = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        modificationScope: 'thisEventOnly',
        originalStartTime: '2024-06-15 10:00:00' // invalid format
      });

      expect(() => UpdateEventArgumentsSchema.parse(args)).toThrow();
    });

    it('should accept originalStartTime without timezone designator', () => {
      const args = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        modificationScope: 'thisEventOnly',
        originalStartTime: '2024-06-15T10:00:00' // timezone-naive format (expected)
      });

      expect(() => UpdateEventArgumentsSchema.parse(args)).not.toThrow();
    });
  });

  describe('Future Instances Scope Validation', () => {
    it('should require futureStartDate when modificationScope is "thisAndFollowing"', () => {
      const args = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        modificationScope: 'thisAndFollowing'
        // missing futureStartDate
      });

      expect(() => UpdateEventArgumentsSchema.parse(args)).toThrow(
        /futureStartDate is required when modificationScope is 'thisAndFollowing'/
      );
    });

    it('should accept valid futureStartDate for thisAndFollowing scope', () => {
      const futureDateString = makeFutureDateString(30); // 30 days from now

      const args = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        modificationScope: 'thisAndFollowing',
        futureStartDate: futureDateString
      });

      const result = UpdateEventArgumentsSchema.parse(args);
      expect(result.modificationScope).toBe('thisAndFollowing');
      expect(result.futureStartDate).toBe(futureDateString);
    });

    it('should reject futureStartDate in the past', () => {
      const pastDateString = makePastDateString(1);

      const args = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        modificationScope: 'thisAndFollowing',
        futureStartDate: pastDateString
      });

      expect(() => UpdateEventArgumentsSchema.parse(args)).toThrow(
        /futureStartDate must be in the future/
      );
    });

    it('should reject invalid futureStartDate format', () => {
      const args = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        modificationScope: 'thisAndFollowing',
        futureStartDate: '2024-12-31 10:00:00' // invalid format
      });

      expect(() => UpdateEventArgumentsSchema.parse(args)).toThrow();
    });
  });

  describe('Datetime Format Validation', () => {
    it.each(VALID_DATETIMES)('should accept valid datetime format: %s', (datetime) => {
      const args = createUpdateEventArgs(DEFAULT_CALENDAR_ID, DEFAULT_EVENT_ID, TEST_TIMEZONE, {
        start: datetime,
        end: datetime
      });

      expect(() => UpdateEventArgumentsSchema.parse(args)).not.toThrow();
    });

    it.each(INVALID_DATETIMES)('should reject invalid datetime format: %s', (datetime) => {
      const args = createUpdateEventArgs(DEFAULT_CALENDAR_ID, DEFAULT_EVENT_ID, TEST_TIMEZONE, {
        start: datetime
      });

      expect(() => UpdateEventArgumentsSchema.parse(args)).toThrow();
    });
  });

  describe('Complex Scenarios', () => {
    it('should validate complete update with all fields', () => {
      const args = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        modificationScope: 'thisAndFollowing',
        futureStartDate: makeFutureDateString(60), // 60 days from now
        summary: 'Updated Meeting',
        description: 'Updated description',
        location: 'New Conference Room',
        start: '2024-06-15T10:00:00',
        end: '2024-06-15T11:00:00',
        colorId: '9',
        attendees: [
          { email: 'user1@example.com' },
          { email: 'user2@example.com' }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: TEST_EVENT_DEFAULTS.RECURRING_EMAIL_REMINDER_MINUTES },
            { method: 'popup', minutes: 10 }
          ]
        },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO']
      });

      const result = UpdateEventArgumentsSchema.parse(args);
      expect(result).toMatchObject(args);
    });

    it('should not require conditional fields for "all" scope', () => {
      const args = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        modificationScope: 'all',
        summary: 'Updated Meeting'
        // no originalStartTime or futureStartDate required
      });

      expect(() => UpdateEventArgumentsSchema.parse(args)).not.toThrow();
    });

    it('should allow optional conditional fields when not required', () => {
      const args = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        modificationScope: 'all',
        originalStartTime: '2024-06-15T10:00:00', // optional for 'all' scope
        summary: 'Updated Meeting'
      });

      const result = UpdateEventArgumentsSchema.parse(args);
      expect(result.originalStartTime).toBe('2024-06-15T10:00:00');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing update calls', () => {
      // Existing call format without new parameters
      const legacyArgs = createUpdateEventArgs('primary', 'event123', TEST_TIMEZONE, {
        summary: 'Updated Meeting',
        location: 'Conference Room A'
      });

      const result = UpdateEventArgumentsSchema.parse(legacyArgs);
      expect(result.modificationScope).toBeUndefined(); // optional with no default
      expect(result.summary).toBe('Updated Meeting');
      expect(result.location).toBe('Conference Room A');
    });
  });
});

describe('ListEventsArgumentsSchema JSON String Handling', () => {
  it('should parse JSON string calendarId into array', () => {
    const input = {
      calendarId: '["primary", "secondary@gmail.com"]',
      timeMin: TIME_MIN,
      timeMax: TIME_MAX
    };

    const result = ListEventsArgumentsSchema.parse(input);
    // The new schema keeps JSON strings as strings (they are parsed in the handler)
    expect(result.calendarId).toBe('["primary", "secondary@gmail.com"]');
  });

  it('should handle regular string calendarId', () => {
    const input = {
      calendarId: 'primary',
      timeMin: TIME_MIN,
      timeMax: TIME_MAX
    };

    const result = ListEventsArgumentsSchema.parse(input);
    expect(result.calendarId).toBe('primary');
  });

  it('should handle regular array calendarId', () => {
    // Arrays are no longer directly supported - they must be JSON strings
    const input = {
      calendarId: ['primary', 'secondary@gmail.com'],
      timeMin: TIME_MIN,
      timeMax: TIME_MAX
    };

    // This should now throw because arrays aren't accepted directly
    expect(() => ListEventsArgumentsSchema.parse(input)).toThrow();
  });

  it('should pass through invalid JSON strings for handler validation', () => {
    // Invalid JSON strings are accepted by the schema but will fail in the handler
    const input = {
      calendarId: '["primary", invalid]',
      timeMin: TIME_MIN,
      timeMax: TIME_MAX
    };

    // The schema accepts any string - validation happens in the handler
    const result = ListEventsArgumentsSchema.parse(input);
    expect(result.calendarId).toBe('["primary", invalid]');
  });

  it('should pass through JSON strings with non-string elements for handler validation', () => {
    // Schema accepts any string - validation happens in the handler
    const input = {
      calendarId: '["primary", 123]',
      timeMin: TIME_MIN,
      timeMax: TIME_MAX
    };

    // The schema accepts any string - validation happens in the handler
    const result = ListEventsArgumentsSchema.parse(input);
    expect(result.calendarId).toBe('["primary", 123]');
  });
}); 