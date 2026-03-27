import { calendar_v3 } from 'googleapis';
import { GaxiosError } from 'gaxios';
import { vi } from 'vitest';
import { addHours, addMinutes } from 'date-fns';
import {
  addDays,
  getFutureDate,
  formatTZNaiveDateTime,
  formatRFC3339,
  formatBasicDateTime,
  oneDayBefore,
} from '../../../utils/date-utils.js';
import { createBuilder } from './testBuilder.js';

const EVENT_BUILDER = createBuilder<calendar_v3.Schema$Event>({
  id: 'event1',
  summary: 'Test Event',
  start: { dateTime: '2025-01-15T10:00:00Z' },
  end: { dateTime: '2025-01-15T11:00:00Z' }
});

export function makeEvent(overrides: Partial<calendar_v3.Schema$Event> = {}): calendar_v3.Schema$Event {
  return EVENT_BUILDER.build(overrides);
}

export function makeEventWithCalendarId(
  calendarId: string,
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event & { calendarId?: string } {
  return {
    ...makeEvent(overrides),
    calendarId
  };
}

export function makeGaxiosError(
  status: number,
  message: string,
  data?: object
): GaxiosError & { data?: object } {
  const error = new GaxiosError(message, {} as any, {
    status,
  } as any);

  if (data) {
    (error as any).data = data;
  }

  return error as GaxiosError & { data?: object };
}

export function makeEvents(
  count: number,
  baseOverrides: Partial<calendar_v3.Schema$Event> = {},
  variantFn?: (index: number) => Partial<calendar_v3.Schema$Event>
): calendar_v3.Schema$Event[] {
  return EVENT_BUILDER.buildMany(count, (i) => {
    const variantOverrides = variantFn?.(i) ?? {};
    const day = String((i % 28) + 1).padStart(2, '0');
    return {
      ...baseOverrides,
      id: `event${i + 1}`,
      summary: `Event ${i + 1}`,
      start: { dateTime: `2025-01-${day}T10:00:00Z` },
      end: { dateTime: `2025-01-${day}T11:00:00Z` },
      ...variantOverrides
    };
  });
}

// Returns timezone-naive string (no Z suffix) — use when the handler under test must supply the timezone.
export function makeFutureDateString(daysFromNow: number = 365): string {
  return formatTZNaiveDateTime(getFutureDate(daysFromNow));
}

export function makePastDateString(yearsAgo: number = 1): string {
  const pastDate = new Date();
  pastDate.setFullYear(pastDate.getFullYear() - yearsAgo);
  return formatRFC3339(pastDate);
}

// ============================================================================
// RECURRENCE FACTORIES - Create recurring event patterns for testing
//
// Intended for tests that need full recurring event objects with realistic
// future dates: conflict detection for recurring events, list/search results
// that return expanded series, and freebusy scenarios spanning recurrences.
//
// Not a fit for RRULE string-manipulation tests (pass raw arrays directly)
// or handler tests that need fixed dates for timezone assertions.
// ============================================================================

function appendUntil(rrule: string, untilDaysFromNow: number): string {
  const untilDate = oneDayBefore(getFutureDate(untilDaysFromNow));
  return rrule + `;UNTIL=${formatBasicDateTime(untilDate)}`;
}

function formatDateList(dates: Date[]): string {
  return dates.map((d) => formatBasicDateTime(d)).join(',');
}

// @param weeklyPattern Days of week (e.g., 'MO', 'MO,WE,FR')
export function makeWeeklyRecurringEvent(
  daysFromNow: number = 7,
  weeklyPattern: string = 'MO',
  untilDaysFromNow?: number,
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  const startDate = getFutureDate(daysFromNow);
  let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${weeklyPattern}`;
  if (untilDaysFromNow !== undefined) rrule = appendUntil(rrule, untilDaysFromNow);

  return makeEvent({
    id: 'recurring-weekly-1',
    summary: 'Weekly Meeting',
    recurrence: [rrule],
    start: { dateTime: formatRFC3339(startDate) },
    end: { dateTime: formatRFC3339(addHours(startDate, 1)) },
    ...overrides,
  });
}

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
    rrule = appendUntil(rrule, untilDaysFromNow);
  } else {
    rrule += ';COUNT=5';
  }

  return makeEvent({
    id: 'recurring-daily-1',
    summary: 'Daily Standup',
    recurrence: [rrule],
    start: { dateTime: formatRFC3339(startDate) },
    end: { dateTime: formatRFC3339(addMinutes(startDate, 30)) },
    ...overrides,
  });
}

export function makeMonthlyRecurringEvent(
  daysFromNow: number = 30,
  monthlyDay: number = 15,
  untilDaysFromNow?: number,
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  const startDate = getFutureDate(daysFromNow);
  let rrule = `RRULE:FREQ=MONTHLY;BYMONTHDAY=${monthlyDay}`;
  if (untilDaysFromNow !== undefined) rrule = appendUntil(rrule, untilDaysFromNow);

  return makeEvent({
    id: 'recurring-monthly-1',
    summary: 'Monthly Review',
    recurrence: [rrule],
    start: { dateTime: formatRFC3339(startDate) },
    end: { dateTime: formatRFC3339(addHours(startDate, 2)) },
    ...overrides,
  });
}

export function makeRecurringEventWithExceptions(
  daysFromNow: number = 7,
  exceptionDates: Date[] = [],
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  const startDate = getFutureDate(daysFromNow);
  const recurrence = ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'];

  if (exceptionDates.length > 0) {
    recurrence.push(`EXDATE:${formatDateList(exceptionDates)}`);
  }

  return makeEvent({
    id: 'recurring-with-exceptions-1',
    summary: 'Meeting with Exceptions',
    recurrence,
    start: { dateTime: formatRFC3339(startDate) },
    end: { dateTime: formatRFC3339(addHours(startDate, 1)) },
    ...overrides,
  });
}

export function makeRecurringEventWithAdditionalDates(
  daysFromNow: number = 7,
  additionalDates: Date[] = [],
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  const startDate = getFutureDate(daysFromNow);
  const recurrence = ['RRULE:FREQ=WEEKLY;BYDAY=MO'];

  if (additionalDates.length > 0) {
    recurrence.push(`RDATE:${formatDateList(additionalDates)}`);
  }

  return makeEvent({
    id: 'recurring-with-additions-1',
    summary: 'Meeting with Extra Dates',
    recurrence,
    start: { dateTime: formatRFC3339(startDate) },
    end: { dateTime: formatRFC3339(addHours(startDate, 1)) },
    ...overrides,
  });
}

export function makeRecurringEventInstance(
  eventId: string,
  instanceDate: Date,
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  return makeEvent({
    id: `${eventId}_${formatBasicDateTime(instanceDate)}`,
    summary: 'Series Instance',
    recurringEventId: eventId,
    originalStartTime: { dateTime: formatRFC3339(instanceDate) },
    start: { dateTime: formatRFC3339(instanceDate) },
    end: { dateTime: formatRFC3339(addHours(instanceDate, 1)) },
    ...overrides,
  });
}

export function makeRecurringEventInstances(
  eventId: string,
  startDate: Date,
  count: number = 5,
  intervalDays: number = 7
): calendar_v3.Schema$Event[] {
  return Array.from({ length: count }, (_, i) => {
    const instanceDate = addDays(startDate, i * intervalDays);
    return makeRecurringEventInstance(eventId, instanceDate, {
      summary: `Occurrence ${i + 1}`,
    });
  });
}

// ============================================================================
// MOCK BUILDERS - Create mocks for Google Calendar API responses
// ============================================================================

export function makeCalendarMock(overrides: {
  get?: ReturnType<typeof vi.fn>;
  patch?: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
  list?: ReturnType<typeof vi.fn>;
  delete?: ReturnType<typeof vi.fn>;
  calendarListGet?: ReturnType<typeof vi.fn>;
} = {}): Pick<calendar_v3.Calendar, 'events'> & {
  events: {
    get: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  calendarList: {
    get: ReturnType<typeof vi.fn>;
  };
} {
  return {
    events: {
      get: overrides.get ?? vi.fn(),
      patch: overrides.patch ?? vi.fn(),
      insert: overrides.insert ?? vi.fn(),
      list: overrides.list ?? vi.fn(),
      delete: overrides.delete ?? vi.fn(),
    } as any,
    calendarList: {
      get: overrides.calendarListGet ?? vi.fn(),
    },
  };
}

// ============================================================================
// CONFLICT DETECTION BUILDERS - Pre-configured events for conflict tests
// ============================================================================

export function makeConflictingEvents(
  overrides1: Partial<calendar_v3.Schema$Event> = {},
  overrides2: Partial<calendar_v3.Schema$Event> = {}
): [calendar_v3.Schema$Event, calendar_v3.Schema$Event] {
  const event1 = makeEvent({
    summary: 'Meeting 1',
    start: { dateTime: '2024-01-01T10:00:00Z' },
    end: { dateTime: '2024-01-01T11:00:00Z' },
    ...overrides1,
  });

  const event2 = makeEvent({
    summary: 'Meeting 2',
    start: overrides2.start ?? event1.start,
    end: overrides2.end ?? event1.end,
    ...overrides2,
  });

  return [event1, event2];
}

export function makeTeamMeetingEvent(
  location: string = 'Conference Room A',
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  return makeEvent({
    summary: 'Team Meeting',
    location,
    start: { dateTime: '2024-01-01T10:00:00' },
    end: { dateTime: '2024-01-01T11:00:00' },
    ...overrides,
  });
}

export const ATTACHMENT_IDS = {
  DOCUMENT: '123',
  PRESENTATION: '456'
} as const;

export function createFullEventArgs(
  overrides: Record<string, any> = {}
): Record<string, any> {
  return {
    eventId: 'full-event',
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

export const STANDARD_ATTACHMENTS = [
  {
    fileUrl: `https://docs.google.com/document/d/${ATTACHMENT_IDS.DOCUMENT}`,
    title: 'Meeting Agenda',
    mimeType: 'application/vnd.google-apps.document'
  },
  {
    fileUrl: `https://drive.google.com/file/d/${ATTACHMENT_IDS.PRESENTATION}`,
    title: 'Presentation',
    mimeType: 'application/vnd.google-apps.presentation',
    fileId: ATTACHMENT_IDS.PRESENTATION
  }
] as const satisfies readonly calendar_v3.Schema$EventAttachment[];
