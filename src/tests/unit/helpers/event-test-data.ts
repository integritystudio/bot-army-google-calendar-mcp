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

export const DEFAULT_CALENDAR_ID = 'primary';
export const DEFAULT_EVENT_ID = 'event123';
export const DEFAULT_POPUP_REMINDER_MINUTES = 10;

/**
 * Create a test event with standard start/end datetime.
 * Default: 2024-06-15, 1-hour duration.
 * Pass TZ-offset in startTime/endTime as needed (e.g., '2024-06-15T10:00:00-07:00').
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
 * Convenience alias for createTestEventWithDateTime with TZ-offset defaults.
 * Used for testing timezone handling in RecurringEventHelpers.
 */
export function createTestEventWithTZOffset(
  startTime: string = '2024-06-15T10:00:00-07:00',
  endTime: string = '2024-06-15T11:00:00-07:00',
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  return createTestEventWithDateTime(startTime, endTime, overrides);
}

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

export function createUpdateEventArgs(
  calendarId: string = DEFAULT_CALENDAR_ID,
  eventId: string = DEFAULT_EVENT_ID,
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

export function createUpdateEventArgsWithTimes(
  start: string = '2024-06-15T10:00:00-07:00',
  end: string = '2024-06-15T11:00:00-07:00',
  timeZone: string = 'America/Los_Angeles',
  overrides: Record<string, any> = {}
): Record<string, any> {
  return createUpdateEventArgs(DEFAULT_CALENDAR_ID, DEFAULT_EVENT_ID, timeZone, {
    start,
    end,
    ...overrides
  });
}

export function createUpdateEventArgsWithAttendees(
  overrides: Record<string, any> = {}
): Record<string, any> {
  return createUpdateEventArgs(DEFAULT_CALENDAR_ID, DEFAULT_EVENT_ID, 'UTC', {
    attendees: [
      { email: 'user1@example.com' },
      { email: 'user2@example.com' }
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: TEST_EVENT_DEFAULTS.RECURRING_EMAIL_REMINDER_MINUTES },
        { method: 'popup', minutes: DEFAULT_POPUP_REMINDER_MINUTES }
      ]
    },
    ...overrides
  });
}

export function createComplexUpdateEventArgs(
  overrides: Record<string, any> = {}
): Record<string, any> {
  return createUpdateEventArgs(DEFAULT_CALENDAR_ID, DEFAULT_EVENT_ID, 'America/Los_Angeles', {
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
        { method: 'popup', minutes: DEFAULT_POPUP_REMINDER_MINUTES },
        { method: 'sms', minutes: 60 }
      ]
    },
    recurrence: [
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'EXDATE:20240610T100000Z'
    ],
    ...overrides
  });
}

export function createCreateEventArgs(
  calendarId: string = DEFAULT_CALENDAR_ID,
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

export function createConflictEventArgs(
  eventId: string = 'existing-event',
  overrides: Record<string, any> = {}
): Record<string, any> {
  return createCreateEventArgs(DEFAULT_CALENDAR_ID, {
    eventId,
    ...overrides
  });
}

export function createEventWithAttendeesAndReminders(
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  return {
    id: 'full-event',
    summary: 'Full Event',
    description: 'Event description',
    location: 'Conference Room A',
    attendees: [{ email: 'test@example.com' }],
    colorId: '5',
    reminders: {
      useDefault: false,
      overrides: [{ method: 'email', minutes: 30 }]
    },
    ...overrides
  };
}

export function createEventWithExtendedProperties(
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  return {
    id: 'event-with-props',
    summary: 'Event with Extended Properties',
    extendedProperties: {
      private: {
        appId: '12345',
        customField: 'value1'
      },
      shared: {
        projectId: 'proj-789',
        category: 'meeting'
      }
    },
    ...overrides
  };
}

export function createEventWithAttachments(
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  return {
    id: 'event-with-attachments',
    summary: 'Meeting with Documents',
    attachments: [
      {
        fileUrl: 'https://docs.google.com/document/d/123',
        title: 'Meeting Agenda',
        mimeType: 'application/vnd.google-apps.document'
      },
      {
        fileUrl: 'https://drive.google.com/file/d/456',
        title: 'Presentation',
        mimeType: 'application/vnd.google-apps.presentation',
        fileId: '456'
      }
    ],
    ...overrides
  };
}

