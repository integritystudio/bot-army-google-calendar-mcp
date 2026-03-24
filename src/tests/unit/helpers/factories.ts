import { calendar_v3 } from 'googleapis';
import { GaxiosError } from 'gaxios';
import { vi } from 'vitest';
import {
  getFutureDate,
  getPastDate,
  formatTZNaiveDateTime,
  formatRFC3339,
  formatBasicDateTime,
  oneDayBefore,
} from '../../../utils/date-utils.js';

/**
 * Create a basic calendar event with optional overrides.
 * Useful for tests that need consistent event structures.
 */
export function makeEvent(overrides: Partial<calendar_v3.Schema$Event> = {}): calendar_v3.Schema$Event {
  return {
    id: 'event1',
    summary: 'Test Event',
    start: { dateTime: '2025-01-15T10:00:00Z' },
    end: { dateTime: '2025-01-15T11:00:00Z' },
    ...overrides
  };
}

/**
 * Create a calendar event with an extended calendarId property.
 * For batch operations and calendar-scoped event tests.
 */
export function makeEventWithCalendarId(
  calendarId: string,
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event & { calendarId?: string } {
  return {
    id: 'event1',
    summary: 'Test Event',
    start: { dateTime: '2025-01-15T10:00:00Z' },
    end: { dateTime: '2025-01-15T11:00:00Z' },
    calendarId,
    ...overrides
  };
}

/**
 * Create a GaxiosError for testing API error scenarios.
 * Supports status codes: 400, 403, 404, 429, 500, etc.
 */
export function makeGaxiosError(
  status: number,
  message: string,
  data?: object
): GaxiosError & { data?: object } {
  const error = new GaxiosError(message, {} as any, {
    status,
  } as any);

  // Attach data property for testing error responses
  if (data) {
    (error as any).data = data;
  }

  return error as any;
}

/**
 * Create multiple calendar events for list/batch tests.
 * @param count Number of events to create
 * @param baseOverrides Applied to all events
 * @param variantFn Optional function to vary properties per event (receives index)
 */
export function makeEvents(
  count: number,
  baseOverrides: Partial<calendar_v3.Schema$Event> = {},
  variantFn?: (index: number) => Partial<calendar_v3.Schema$Event>
): calendar_v3.Schema$Event[] {
  return Array.from({ length: count }, (_, i) => {
    const variantOverrides = variantFn?.(i) ?? {};
    return makeEvent({
      id: `event${i + 1}`,
      summary: `Event ${i + 1}`,
      start: { dateTime: `2025-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z` },
      end: { dateTime: `2025-01-${String((i % 28) + 1).padStart(2, '0')}T11:00:00Z` },
      ...baseOverrides,
      ...variantOverrides
    });
  });
}

/**
 * Generate a future date string in ISO format (timezone-naive).
 * Useful for tests that need consistent future dates.
 * @param daysFromNow Number of days in the future (default 365)
 * @returns ISO date string without timezone suffix (e.g., "2026-03-23T14:30:00")
 */
export function makeFutureDateString(daysFromNow: number = 365): string {
  return formatTZNaiveDateTime(getFutureDate(daysFromNow));
}

/**
 * Generate a past date string in ISO format (timezone-aware with Z suffix).
 * Useful for tests that need to validate past-date rejection.
 * @param yearsAgo Number of years in the past (default 1)
 * @returns ISO date string with Z suffix (e.g., "2025-03-23T14:30:00Z")
 */
export function makePastDateString(yearsAgo: number = 1): string {
  const pastDate = new Date();
  pastDate.setFullYear(pastDate.getFullYear() - yearsAgo);
  return formatRFC3339(pastDate);
}

// ============================================================================
// RECURRENCE FACTORIES - Create recurring event patterns for testing
// ============================================================================

/**
 * Create a recurring event with a weekly recurrence pattern.
 * @param daysFromNow Start date offset (default 7 days)
 * @param weeklyPattern Days of week (e.g., 'MO,WE,FR')
 * @param untilDaysFromNow Optional end date (days from now)
 * @returns Recurring event with RRULE
 */
export function makeWeeklyRecurringEvent(
  daysFromNow: number = 7,
  weeklyPattern: string = 'MO',
  untilDaysFromNow?: number,
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  const startDate = getFutureDate(daysFromNow);
  let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${weeklyPattern}`;

  if (untilDaysFromNow !== undefined) {
    const untilDate = oneDayBefore(getFutureDate(untilDaysFromNow));
    rrule += `;UNTIL=${formatBasicDateTime(untilDate)}`;
  }

  return makeEvent({
    id: 'recurring-weekly-1',
    summary: 'Weekly Meeting',
    recurrence: [rrule],
    start: { dateTime: formatRFC3339(startDate) },
    end: { dateTime: formatRFC3339(new Date(startDate.getTime() + 3600000)) },
    ...overrides,
  });
}

/**
 * Create a recurring event with a daily recurrence pattern.
 * @param daysFromNow Start date offset (default 1 day)
 * @param countOccurrences Number of occurrences (if specified instead of UNTIL)
 * @param untilDaysFromNow Optional end date (days from now)
 * @returns Recurring event with RRULE
 */
export function makeDailyRecurringEvent(
  daysFromNow: number = 1,
  countOccurrences?: number,
  untilDaysFromNow?: number,
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  const startDate = getFutureDate(daysFromNow);
  let rrule = 'RRULE:FREQ=DAILY';

  if (countOccurrences !== undefined) {
    rrule += `;COUNT=${countOccurrences}`;
  } else if (untilDaysFromNow !== undefined) {
    const untilDate = oneDayBefore(getFutureDate(untilDaysFromNow));
    rrule += `;UNTIL=${formatBasicDateTime(untilDate)}`;
  } else {
    // Default to 5 occurrences if neither specified
    rrule += ';COUNT=5';
  }

  return makeEvent({
    id: 'recurring-daily-1',
    summary: 'Daily Standup',
    recurrence: [rrule],
    start: { dateTime: formatRFC3339(startDate) },
    end: { dateTime: formatRFC3339(new Date(startDate.getTime() + 1800000)) },
    ...overrides,
  });
}

/**
 * Create a recurring event with a monthly recurrence pattern.
 * @param daysFromNow Start date offset (default 30 days)
 * @param monthlyDay Day of month (1-31, default 15)
 * @param untilDaysFromNow Optional end date (days from now)
 * @returns Recurring event with RRULE
 */
export function makeMonthlyRecurringEvent(
  daysFromNow: number = 30,
  monthlyDay: number = 15,
  untilDaysFromNow?: number,
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  const startDate = getFutureDate(daysFromNow);
  let rrule = `RRULE:FREQ=MONTHLY;BYMONTHDAY=${monthlyDay}`;

  if (untilDaysFromNow !== undefined) {
    const untilDate = oneDayBefore(getFutureDate(untilDaysFromNow));
    rrule += `;UNTIL=${formatBasicDateTime(untilDate)}`;
  }

  return makeEvent({
    id: 'recurring-monthly-1',
    summary: 'Monthly Review',
    recurrence: [rrule],
    start: { dateTime: formatRFC3339(startDate) },
    end: { dateTime: formatRFC3339(new Date(startDate.getTime() + 7200000)) },
    ...overrides,
  });
}

/**
 * Create a recurring event with exception dates (EXDATE).
 * Used to test skipped occurrences in a series.
 * @param daysFromNow Start date offset
 * @param exceptionDates Array of dates to exclude (as Date objects)
 * @returns Recurring event with EXDATE rules
 */
export function makeRecurringEventWithExceptions(
  daysFromNow: number = 7,
  exceptionDates: Date[] = [],
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  const startDate = getFutureDate(daysFromNow);
  const recurrence = ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'];

  if (exceptionDates.length > 0) {
    const exdateString = exceptionDates
      .map((d) => formatBasicDateTime(d))
      .join(',');
    recurrence.push(`EXDATE:${exdateString}`);
  }

  return makeEvent({
    id: 'recurring-with-exceptions-1',
    summary: 'Meeting with Exceptions',
    recurrence,
    start: { dateTime: formatRFC3339(startDate) },
    end: { dateTime: formatRFC3339(new Date(startDate.getTime() + 3600000)) },
    ...overrides,
  });
}

/**
 * Create a recurring event with additional dates (RDATE).
 * Used to test added occurrences in a series.
 * @param daysFromNow Start date offset
 * @param additionalDates Array of dates to add (as Date objects)
 * @returns Recurring event with RDATE rules
 */
export function makeRecurringEventWithAdditionalDates(
  daysFromNow: number = 7,
  additionalDates: Date[] = [],
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  const startDate = getFutureDate(daysFromNow);
  const recurrence = ['RRULE:FREQ=WEEKLY;BYDAY=MO'];

  if (additionalDates.length > 0) {
    const rdateString = additionalDates
      .map((d) => formatBasicDateTime(d))
      .join(',');
    recurrence.push(`RDATE:${rdateString}`);
  }

  return makeEvent({
    id: 'recurring-with-additions-1',
    summary: 'Meeting with Extra Dates',
    recurrence,
    start: { dateTime: formatRFC3339(startDate) },
    end: { dateTime: formatRFC3339(new Date(startDate.getTime() + 3600000)) },
    ...overrides,
  });
}

/**
 * Create a recurring event series instance (single occurrence).
 * Used for testing updates to specific event instances.
 * @param eventId Parent event ID
 * @param instanceDate Date of this specific occurrence
 * @param overrides Additional properties
 * @returns Single event occurrence from a recurring series
 */
export function makeRecurringEventInstance(
  eventId: string,
  instanceDate: Date,
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event & { originalStartTime?: string } {
  const instanceEndTime = new Date(instanceDate.getTime() + 3600000); // 1 hour duration

  const event = makeEvent({
    id: `${eventId}_${formatBasicDateTime(instanceDate)}`,
    summary: 'Series Instance',
    recurringEventId: eventId, // Mark as instance of recurring event
    start: { dateTime: formatRFC3339(instanceDate) },
    end: { dateTime: formatRFC3339(instanceEndTime) },
    ...overrides,
  });

  (event as any).originalStartTime = formatRFC3339(instanceDate);
  return event as calendar_v3.Schema$Event & { originalStartTime?: string };
}

/**
 * Create multiple instances of a recurring event.
 * Useful for simulating expanded series in API responses.
 * @param eventId Parent event ID
 * @param startDate First occurrence date
 * @param count Number of instances to create
 * @param intervalDays Spacing between instances
 * @returns Array of event instances
 */
export function makeRecurringEventInstances(
  eventId: string,
  startDate: Date,
  count: number = 5,
  intervalDays: number = 7
): calendar_v3.Schema$Event[] {
  return Array.from({ length: count }, (_, i) => {
    const instanceDate = new Date(startDate);
    instanceDate.setDate(instanceDate.getDate() + i * intervalDays);
    return makeRecurringEventInstance(eventId, instanceDate, {
      summary: `Occurrence ${i + 1}`,
    });
  });
}

// ============================================================================
// MOCK BUILDERS - Create mocks for Google Calendar API responses
// ============================================================================

/**
 * Create a typed mock calendar object for testing handlers.
 * Provides the minimal calendar_v3.Calendar interface needed by handlers.
 * @param overrides Custom mock implementations for specific methods
 * @returns Typed mock calendar with get/patch/insert/list methods
 */
export function makeCalendarMock(overrides: {
  get?: ReturnType<typeof vi.fn>;
  patch?: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
  list?: ReturnType<typeof vi.fn>;
} = {}): Pick<calendar_v3.Calendar, 'events'> & {
  events: {
    get: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
} {
  return {
    events: {
      get: overrides.get ?? vi.fn(),
      patch: overrides.patch ?? vi.fn(),
      insert: overrides.insert ?? vi.fn(),
      list: overrides.list ?? vi.fn(),
    },
  };
}
