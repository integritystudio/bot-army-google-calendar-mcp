import { calendar_v3 } from 'googleapis';
import { GaxiosError } from 'gaxios';

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
): GaxiosError {
  return new GaxiosError(message, {} as any, {
    status,
    data
  } as any);
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
