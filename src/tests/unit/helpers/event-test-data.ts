import { calendar_v3 } from 'googleapis';
import { TEST_EVENT_DEFAULTS } from '../../../testing/constants.js';

/**
 * System-generated fields that should be removed during event duplication.
 * These are set by the Google Calendar API and should not be copied to new events.
 */
export const SYSTEM_FIELDS = [
  'id',
  'etag',
  'iCalUID',
  'created',
  'updated',
  'htmlLink',
  'hangoutLink'
] as const;

/**
 * Create a test event with standard start/end datetime.
 * Default: 2024-06-15, 1-hour duration.
 */
export function createTestEventWithDateTime(
  startTime: string = '2024-06-15T10:00:00Z',
  endTime: string = '2024-06-15T11:00:00Z',
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  return {
    start: { dateTime: startTime },
    end: { dateTime: endTime },
    ...overrides
  };
}

/**
 * Create a test event with timezone-aware datetime (with offset).
 * Used for testing timezone handling in RecurringEventHelpers.
 */
export function createTestEventWithTZOffset(
  startTime: string = '2024-06-15T10:00:00-07:00',
  endTime: string = '2024-06-15T11:00:00-07:00',
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  return {
    start: { dateTime: startTime },
    end: { dateTime: endTime },
    ...overrides
  };
}

/**
 * Create a complete test event with all standard fields for duplication tests.
 */
export function createCompleteTestEvent(overrides: Partial<calendar_v3.Schema$Event> = {}): calendar_v3.Schema$Event {
  return {
    id: 'event123',
    etag: '"abc123"',
    iCalUID: 'uid123@google.com',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    htmlLink: 'https://calendar.google.com/event?eid=...',
    hangoutLink: 'https://meet.google.com/...',
    conferenceData: { entryPoints: [] },
    creator: { email: 'creator@example.com' },
    organizer: { email: 'organizer@example.com' },
    sequence: 1,
    status: 'confirmed',
    transparency: 'opaque',
    visibility: 'default',
    summary: 'Meeting',
    description: 'Meeting description',
    location: 'Conference Room',
    start: { dateTime: '2024-06-15T10:00:00Z' },
    end: { dateTime: '2024-06-15T11:00:00Z' },
    attendees: [{ email: 'attendee@example.com' }],
    recurrence: ['RRULE:FREQ=WEEKLY'],
    ...overrides
  };
}

/**
 * Create test UpdateEvent arguments with all required fields.
 */
export function createUpdateEventArgs(
  calendarId: string = 'primary',
  eventId: string = 'event123',
  timeZone: string = 'America/Los_Angeles',
  overrides: Record<string, any> = {}
): Record<string, any> {
  return {
    calendarId,
    eventId,
    timeZone,
    ...overrides
  };
}

/**
 * Create test UpdateEvent arguments with time changes.
 */
export function createUpdateEventArgsWithTimes(
  start: string = '2024-06-15T10:00:00-07:00',
  end: string = '2024-06-15T11:00:00-07:00',
  timeZone: string = 'America/Los_Angeles',
  overrides: Record<string, any> = {}
): Record<string, any> {
  return {
    calendarId: 'primary',
    eventId: 'event123',
    start,
    end,
    timeZone,
    ...overrides
  };
}

/**
 * Create test UpdateEvent arguments with attendees and reminders.
 */
export function createUpdateEventArgsWithAttendees(
  overrides: Record<string, any> = {}
): Record<string, any> {
  return {
    calendarId: 'primary',
    eventId: 'event123',
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
    timeZone: 'UTC',
    ...overrides
  };
}

/**
 * Create test UpdateEvent arguments with complex nested objects.
 */
export function createComplexUpdateEventArgs(
  overrides: Record<string, any> = {}
): Record<string, any> {
  return {
    summary: 'Complex Meeting',
    attendees: [
      {
        email: 'user1@example.com',
        displayName: 'User One',
        responseStatus: 'accepted'
      },
      {
        email: 'user2@example.com',
        displayName: 'User Two',
        responseStatus: 'tentative'
      }
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: TEST_EVENT_DEFAULTS.RECURRING_EMAIL_REMINDER_MINUTES },
        { method: 'popup', minutes: 10 },
        { method: 'sms', minutes: 60 }
      ]
    },
    recurrence: [
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'EXDATE:20240610T100000Z'
    ],
    timeZone: 'America/Los_Angeles',
    ...overrides
  };
}

/**
 * Create test arguments for CreateEvent handler.
 * Base pattern for handler tests with standard calendar, summary, start/end times.
 */
export function createCreateEventArgs(
  calendarId: string = 'primary',
  overrides: Record<string, any> = {}
): Record<string, any> {
  return {
    calendarId,
    summary: 'Test Event',
    start: '2025-01-15T10:00:00',
    end: '2025-01-15T11:00:00',
    ...overrides
  };
}
