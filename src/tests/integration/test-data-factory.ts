// Test data factory utilities for integration tests
import { tryGetTextContent } from '../unit/helpers/index.js';
import { formatTZNaiveDateTime, formatRFC3339 } from '../../utils/date-utils.js';
import { extractEventIdFromResponse as extractEventIdFromResponseShared } from '../../testing/test-utils.js';
import {
  TIME_DURATIONS,
  TEST_TIMEZONE,
  TEST_EVENT_DEFAULTS
} from '../../testing/constants.js';

export interface TestEvent {
  id?: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  timeZone?: string; // Optional for all-day events
  location?: string;
  attendees?: Array<{ email: string }>;
  colorId?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: "email" | "popup"; minutes: number }>;
  };
  recurrence?: string[];
  modificationScope?: "thisAndFollowing" | "all" | "thisEventOnly";
  originalStartTime?: string;
  futureStartDate?: string;
  calendarId?: string;
  sendUpdates?: "all" | "externalOnly" | "none";
}

export interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
}

export class TestDataFactory {
  private static readonly TEST_CALENDAR_ID = process.env.TEST_CALENDAR_ID || 'primary';
  
  private createdEventIds: string[] = [];
  private performanceMetrics: PerformanceMetric[] = [];

  static getTestCalendarId(): string {
    return TestDataFactory.TEST_CALENDAR_ID;
  }

  // Date formatting wrappers (delegate to date-utils)
  static formatDateTimeRFC3339(date: Date): string {
    return formatTZNaiveDateTime(date);
  }

  static formatDateTimeRFC3339WithTimezone(date: Date): string {
    return formatRFC3339(date);
  }

  // Event data generators
  static createSingleEvent(overrides: Partial<TestEvent> = {}): TestEvent {
    const now = new Date();
    const start = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration

    return {
      summary: TEST_EVENT_DEFAULTS.SUMMARY,
      description: TEST_EVENT_DEFAULTS.DESCRIPTION,
      start: formatTZNaiveDateTime(start),
      end: formatTZNaiveDateTime(end),
      timeZone: TEST_TIMEZONE,
      location: TEST_EVENT_DEFAULTS.LOCATION,
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: TEST_EVENT_DEFAULTS.REMINDER_MINUTES }]
      },
      ...overrides
    };
  }

  static createAllDayEvent(overrides: Partial<TestEvent> = {}): TestEvent {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    // For all-day events, use date-only format (YYYY-MM-DD)
    const startDate = tomorrow.toISOString().split('T')[0];
    const endDate = dayAfter.toISOString().split('T')[0];

    return {
      summary: TEST_EVENT_DEFAULTS.ALL_DAY_SUMMARY,
      description: TEST_EVENT_DEFAULTS.ALL_DAY_DESCRIPTION,
      start: startDate,
      end: endDate,
      // Note: timeZone is not used for all-day events (they're date-only)
      ...overrides
    };
  }

  static createRecurringEvent(overrides: Partial<TestEvent> = {}): TestEvent {
    const start = new Date();
    start.setDate(start.getDate() + 1); // Tomorrow
    start.setHours(10, 0, 0, 0); // 10 AM

    const end = new Date(start);
    end.setHours(11, 0, 0, 0); // 11 AM

    return {
      summary: TEST_EVENT_DEFAULTS.RECURRING_SUMMARY,
      description: TEST_EVENT_DEFAULTS.RECURRING_DESCRIPTION,
      start: formatTZNaiveDateTime(start),
      end: formatTZNaiveDateTime(end),
      timeZone: TEST_TIMEZONE,
      location: TEST_EVENT_DEFAULTS.RECURRING_LOCATION,
      recurrence: ['RRULE:FREQ=WEEKLY;COUNT=5'], // 5 weeks
      reminders: {
        useDefault: false,
        overrides: [{ method: 'email', minutes: TEST_EVENT_DEFAULTS.RECURRING_EMAIL_REMINDER_MINUTES }]
      },
      ...overrides
    };
  }

  static createEventWithAttendees(overrides: Partial<TestEvent> = {}): TestEvent {
    const invitee1 = process.env.INVITEE_1;
    const invitee2 = process.env.INVITEE_2;
    
    if (!invitee1 || !invitee2) {
      throw new Error('INVITEE_1 and INVITEE_2 environment variables are required for creating events with attendees');
    }
    
    return this.createSingleEvent({
      summary: 'Test Meeting with Attendees',
      attendees: [
        { email: invitee1 },
        { email: invitee2 }
      ],
      ...overrides
    });
  }

  static createColoredEvent(colorId: string, overrides: Partial<TestEvent> = {}): TestEvent {
    return this.createSingleEvent({
      summary: `Test Event - Color ${colorId}`,
      colorId,
      ...overrides
    });
  }

  // Time range generators
  static getTimeRanges() {
    const now = new Date();
    
    return {
      // Past week
      pastWeek: {
        timeMin: formatRFC3339(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
        timeMax: formatRFC3339(now)
      },
      // Next week
      nextWeek: {
        timeMin: formatRFC3339(now),
        timeMax: formatRFC3339(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000))
      },
      // Next month
      nextMonth: {
        timeMin: formatRFC3339(now),
        timeMax: formatRFC3339(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000))
      },
      // Large range (3 months)
      threeMonths: {
        timeMin: formatRFC3339(now),
        timeMax: formatRFC3339(new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000))
      }
    };
  }

  // Performance tracking
  startTimer(_operation: string): number {
    return Date.now();
  }

  endTimer(operation: string, startTime: number, success: boolean, error?: string): void {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    this.performanceMetrics.push({
      operation,
      startTime,
      endTime,
      duration,
      success,
      error
    });
  }

  getPerformanceMetrics(): PerformanceMetric[] {
    return [...this.performanceMetrics];
  }

  clearPerformanceMetrics(): void {
    this.performanceMetrics = [];
  }

  // Event tracking for cleanup
  addCreatedEventId(eventId: string): void {
    this.createdEventIds.push(eventId);
  }

  getCreatedEventIds(): string[] {
    return [...this.createdEventIds];
  }

  clearCreatedEventIds(): void {
    this.createdEventIds = [];
  }

  // Search queries
  static getSearchQueries() {
    return [
      'Test Integration',
      'meeting',
      'recurring',
      'attendees',
      'Conference Room',
      'nonexistent_query_should_return_empty'
    ];
  }

  // Validation helpers
  static validateEventResponse(response: any): boolean {
    if (!response || !response.content || !Array.isArray(response.content)) {
      return false;
    }

    const text = tryGetTextContent(response);
    // Accept empty strings for search operations - they indicate "no results found"
    return typeof text === 'string';
  }

  /**
   * Extract event ID from response.
   * Delegates to shared utility in src/testing/test-utils.ts
   */
  static extractEventIdFromResponse(response: any): string | null {
    return extractEventIdFromResponseShared(response);
  }

  static extractAllEventIds(response: any): string[] {
    const text = tryGetTextContent(response);
    if (!text) return [];
    
    const eventIds: string[] = [];
    
    // Look for event IDs in list format - they appear in parentheses after event titles
    // Pattern: anything that looks like an event ID in parentheses
    const pattern = /\(([a-zA-Z0-9_@.-]{10,})\)/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const eventId = match[1].trim();
      // Basic validation - should be at least 10 characters and not contain spaces
      if (eventId.length >= 10 && !eventId.includes(' ')) {
        eventIds.push(eventId);
      }
    }
    
    // Also look for Event ID: patterns
    const idPattern = /Event ID:\s*([a-zA-Z0-9_@.-]+)/g;
    while ((match = idPattern.exec(text)) !== null) {
      const eventId = match[1].trim();
      if (eventId.length >= 10 && !eventIds.includes(eventId)) {
        eventIds.push(eventId);
      }
    }
    
    return eventIds;
  }

  // Error simulation helpers
  static getInvalidTestData() {
    return {
      invalidCalendarId: 'invalid_calendar_id',
      invalidEventId: 'invalid_event_id',
      invalidTimeFormat: '2024-13-45T25:99:99Z',
      invalidTimezone: 'Invalid/Timezone',
      invalidEmail: 'not-an-email',
      invalidColorId: '999',
      malformedRecurrence: ['INVALID:RRULE'],
      futureDateInPast: '2020-01-01T10:00:00Z'
    };
  }
}