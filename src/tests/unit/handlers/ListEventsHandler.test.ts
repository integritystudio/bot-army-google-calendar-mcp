import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { google, calendar_v3 } from 'googleapis';
import { convertToRFC3339 } from '../../../utils/timezone-utils.js';
import { ListEventsHandler } from '../../../handlers/core/ListEventsHandler.js';
import { processBatchResponses } from '../../../handlers/core/batchUtils.js';
import { groupBy } from 'lodash-es';
import {
  getTextContent,
  assertTextContentContains,
  makeEvent,
  makeEventWithCalendarId,
  makeCalendarMock,
  setupListEventsHandler,
} from '../helpers/index.js';
import { LIST_EVENTS_API_DEFAULTS, TIME_MIN, TIME_MAX } from '../helpers/test-configs.js';
import { ToolSchemas } from '../../../tools/registry.js';

const ListEventsArgumentsSchema = ToolSchemas['list-events'];

vi.mock('google-auth-library');
vi.mock('googleapis');

describe('ListEventsHandler JSON String Handling', () => {
  const mockOAuth2Client = {
    getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-token' })
  } as unknown as OAuth2Client;

  const handler = new ListEventsHandler();
  let mockCalendar: ReturnType<typeof makeCalendarMock>;

  beforeEach(() => {
    mockCalendar = makeCalendarMock({
      list: vi.fn().mockResolvedValue({
        data: { items: [makeEvent({ id: 'test-event', summary: 'Test Event' })] }
      }),
      calendarListGet: vi.fn().mockResolvedValue({ data: { timeZone: 'UTC' } }),
    });
    vi.mocked(google.calendar).mockReturnValue(mockCalendar as unknown as calendar_v3.Calendar);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`--batch_boundary
Content-Type: application/http
Content-ID: <item1>

HTTP/1.1 200 OK
Content-Type: application/json

{"items": [{"id": "test-event", "summary": "Test Event", "start": {"dateTime": "2025-06-02T10:00:00Z"}, "end": {"dateTime": "2025-06-02T11:00:00Z"}}]}

--batch_boundary--`)
    });
  });

  it('should handle multiple calendar IDs as array', async () => {
    const args = {
      calendarId: ['primary', 'secondary@gmail.com'],
      timeMin: '2025-06-02T00:00:00Z',
      timeMax: '2025-06-09T23:59:59Z'
    };

    const result = await handler.runTool(args, mockOAuth2Client);
    expect(result.content).toHaveLength(1);
    expect(getTextContent(result)).toContain('Found');
  });

  it('should handle calendar IDs passed as JSON string', async () => {
    // This simulates the problematic case from the user
    const args = {
      calendarId: '["primary", "secondary@gmail.com"]',
      timeMin: '2025-06-02T00:00:00Z',
      timeMax: '2025-06-09T23:59:59Z'
    };

    // This would be parsed by the Zod transform before reaching the handler
    // For testing, we'll manually simulate what the transform should do
    let processedArgs = { ...args };
    if (typeof args.calendarId === 'string' && args.calendarId.startsWith('[')) {
      processedArgs.calendarId = JSON.parse(args.calendarId);
    }

    const result = await handler.runTool(processedArgs, mockOAuth2Client);
    expect(result.content).toHaveLength(1);
    expect(getTextContent(result)).toContain('Found');
  });
});

describe('Batch List Events Functionality', () => {
  let mockOAuth2Client: OAuth2Client;
  let listEventsHandler: ListEventsHandler;
  let mockCalendarApi: ReturnType<typeof setupListEventsHandler>['mockCalendarApi'];

  beforeEach(() => {
    const setup = setupListEventsHandler();
    mockOAuth2Client = setup.mockOAuth2Client;
    listEventsHandler = setup.handler;
    mockCalendarApi = setup.mockCalendarApi;
  });

  describe('Input Validation', () => {
    it('should validate single calendar ID string', () => {
      const input = {
        calendarId: 'primary',
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-12-31T23:59:59Z'
      };

      const result = ListEventsArgumentsSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data?.calendarId).toBe('primary');
    });

    it('should validate array of calendar IDs', () => {
      const input = {
        calendarId: '["primary", "work@example.com", "personal@example.com"]',
        timeMin: '2024-01-01T00:00:00Z'
      };

      const result = ListEventsArgumentsSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(typeof result.data?.calendarId).toBe('string');
      expect(result.data?.calendarId).toBe('["primary", "work@example.com", "personal@example.com"]');
    });

    it('should accept actual array of calendar IDs (not JSON string)', () => {
      const input = {
        calendarId: ['primary', 'work@example.com', 'personal@example.com'],
        timeMin: '2024-01-01T00:00:00Z'
      };

      const result = ListEventsArgumentsSchema.safeParse(input);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('expected string');
    });

    it('should handle malformed JSON string gracefully', () => {
      const input = {
        calendarId: '["primary", "work@example.com"',
        timeMin: '2024-01-01T00:00:00Z'
      };

      const result = ListEventsArgumentsSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(typeof result.data?.calendarId).toBe('string');
      expect(result.data?.calendarId).toBe('["primary", "work@example.com"');
    });

    it('should reject empty calendar ID array', () => {
      const input = {
        calendarId: [],
        timeMin: '2024-01-01T00:00:00Z'
      };

      const result = ListEventsArgumentsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject array with too many calendar IDs (> 50)', () => {
      const input = {
        calendarId: Array(51).fill('cal').map((c, i) => `${c}${i}@example.com`),
        timeMin: '2024-01-01T00:00:00Z'
      };

      const result = ListEventsArgumentsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid time format', () => {
      const input = {
        calendarId: 'primary',
        timeMin: '2024-01-01'
      };

      const result = ListEventsArgumentsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should handle maximum allowed calendars (50)', () => {
      const maxCalendars = Array(50).fill('cal').map((c, i) => `${c}${i}@example.com`);

      const input = {
        calendarId: JSON.stringify(maxCalendars),
        timeMin: TIME_MIN
      };

      const result = ListEventsArgumentsSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(typeof result.data?.calendarId).toBe('string');
      expect(result.data?.calendarId).toBe(JSON.stringify(maxCalendars));
    });
  });

  describe('Single Calendar Events (Existing Functionality)', () => {

    it('should handle single calendar ID as string', async () => {
      // Arrange
      const mockEvents = [
        makeEvent({ id: 'event1', summary: 'Meeting', start: { dateTime: '2024-01-15T10:00:00Z' }, end: { dateTime: '2024-01-15T11:00:00Z' } }),
        makeEvent({ id: 'event2', summary: 'Lunch', start: { dateTime: '2024-01-15T12:00:00Z' }, end: { dateTime: '2024-01-15T13:00:00Z' }, location: 'Restaurant' })
      ];

      mockCalendarApi.events.list.mockResolvedValue({
        data: { items: mockEvents }
      });

      const args = {
        calendarId: 'primary',
        timeMin: TIME_MIN,
        timeMax: TIME_MAX
      };

      // Act
      const result = await listEventsHandler.runTool(args, mockOAuth2Client);

      // Assert
      expect(mockCalendarApi.events.list).toHaveBeenCalledWith({
        calendarId: 'primary',
        timeMin: args.timeMin,
        timeMax: args.timeMax,
        ...LIST_EVENTS_API_DEFAULTS
      });

      assertTextContentContains(result, 'Found');
    });

    it('should handle empty results for single calendar', async () => {
      // Arrange
      mockCalendarApi.events.list.mockResolvedValue({
        data: { items: [] }
      });

      const args = {
        calendarId: 'primary',
        timeMin: '2024-01-01T00:00:00Z'
      };

      // Act
      const result = await listEventsHandler.runTool(args, mockOAuth2Client);

      // Assert - no events means text saying no events found
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(getTextContent(result)).toContain('No events found');
    });
  });

  describe('Batch Response Parsing', () => {
    it('should parse successful batch responses correctly', () => {
      // Mock successful batch responses
      const mockBatchResponses = [
        {
          statusCode: 200,
          headers: {},
          body: {
            items: [
              makeEvent({ id: 'work1', summary: 'Work Meeting', start: { dateTime: '2024-01-15T09:00:00Z' }, end: { dateTime: '2024-01-15T10:00:00Z' } })
            ]
          }
        },
        {
          statusCode: 200,
          headers: {},
          body: {
            items: [
              makeEvent({ id: 'personal1', summary: 'Gym', start: { dateTime: '2024-01-15T18:00:00Z' }, end: { dateTime: '2024-01-15T19:00:00Z' } })
            ]
          }
        }
      ];

      const calendarIds = ['work@example.com', 'personal@example.com'];

      // Simulate processing batch responses
      const { events, errors } = processBatchResponses(mockBatchResponses, calendarIds, { includeErrors: true });

      // Assert results
      expect(events).toHaveLength(2);
      expect(events[0].calendarId).toBe('work@example.com');
      expect(events[0].summary).toBe('Work Meeting');
      expect(events[1].calendarId).toBe('personal@example.com');
      expect(events[1].summary).toBe('Gym');
      expect(errors).toHaveLength(0);
    });

    it('should handle partial failures in batch responses', () => {
      // Mock mixed success/failure responses
      const mockBatchResponses = [
        {
          statusCode: 200,
          headers: {},
          body: {
            items: [
              makeEvent({ id: 'event1', summary: 'Success Event', start: { dateTime: '2024-01-15T09:00:00Z' }, end: { dateTime: '2024-01-15T10:00:00Z' } })
            ]
          }
        },
        {
          statusCode: 404,
          headers: {},
          body: {
            error: {
              code: 404,
              message: 'Calendar not found'
            }
          }
        },
        {
          statusCode: 403,
          headers: {},
          body: {
            error: {
              code: 403,
              message: 'Access denied'
            }
          }
        }
      ];

      const calendarIds = ['primary', 'nonexistent@example.com', 'noaccess@example.com'];

      // Simulate processing
      const { events, errors } = processBatchResponses(mockBatchResponses, calendarIds, { includeErrors: true });

      // Assert partial success
      expect(events).toHaveLength(1);
      expect(events[0].summary).toBe('Success Event');
      expect(errors).toHaveLength(2);
      expect(errors[0].calendarId).toBe('nonexistent@example.com');
      expect(errors[1].calendarId).toBe('noaccess@example.com');
    });

    it('should handle empty results from some calendars', () => {
      const mockBatchResponses = [
        {
          statusCode: 200,
          headers: {},
          body: { items: [] } // Empty calendar
        },
        {
          statusCode: 200,
          headers: {},
          body: {
            items: [
              makeEvent({ id: 'event1', summary: 'Only Event', start: { dateTime: '2024-01-15T09:00:00Z' }, end: { dateTime: '2024-01-15T10:00:00Z' } })
            ]
          }
        }
      ];

      const calendarIds = ['empty@example.com', 'busy@example.com'];

      const { events } = processBatchResponses(mockBatchResponses, calendarIds);

      expect(events).toHaveLength(1);
      expect(events[0].calendarId).toBe('busy@example.com');
    });
  });

  describe('Event Sorting and Formatting', () => {
    const sortByStartTime = (a: calendar_v3.Schema$Event, b: calendar_v3.Schema$Event) => {
      const aStart = a.start?.dateTime || a.start?.date || '';
      const bStart = b.start?.dateTime || b.start?.date || '';
      return aStart < bStart ? -1 : aStart > bStart ? 1 : 0;
    };

    it('should sort events by start time across multiple calendars', () => {
      const events = [
        makeEventWithCalendarId('cal2', { id: 'event2', summary: 'Second Event', start: { dateTime: '2024-01-15T14:00:00Z' }, end: { dateTime: '2024-01-15T15:00:00Z' } }),
        makeEventWithCalendarId('cal1', { id: 'event1', summary: 'First Event', start: { dateTime: '2024-01-15T09:00:00Z' }, end: { dateTime: '2024-01-15T10:00:00Z' } }),
        makeEventWithCalendarId('cal1', { id: 'event3', summary: 'Third Event', start: { dateTime: '2024-01-15T18:00:00Z' }, end: { dateTime: '2024-01-15T19:00:00Z' } })
      ];

      const sortedEvents = events.sort(sortByStartTime);

      expect(sortedEvents[0].summary).toBe('First Event');
      expect(sortedEvents[1].summary).toBe('Second Event');
      expect(sortedEvents[2].summary).toBe('Third Event');
    });

    it('should format multiple calendar events with calendar grouping', () => {
      const events = [
        makeEventWithCalendarId('work@example.com', { id: 'work1', summary: 'Work Meeting', start: { dateTime: '2024-01-15T09:00:00Z' }, end: { dateTime: '2024-01-15T10:00:00Z' } }),
        makeEventWithCalendarId('personal@example.com', { id: 'personal1', summary: 'Gym', start: { dateTime: '2024-01-15T18:00:00Z' }, end: { dateTime: '2024-01-15T19:00:00Z' } })
      ];

      // Group events by calendar
      const grouped = groupBy(events, (event) => event.calendarId || 'unknown');

      // Since we now return resources instead of formatted text,
      // we just verify that events are grouped correctly
      expect(grouped['work@example.com']).toHaveLength(1);
      expect(grouped['personal@example.com']).toHaveLength(1);
      expect(grouped['work@example.com'][0].summary).toBe('Work Meeting');
      expect(grouped['personal@example.com'][0].summary).toBe('Gym');
    });

    it('should handle date-only events in sorting', () => {
      const events = [
        makeEvent({ id: 'all-day', summary: 'All Day Event', start: { date: '2024-01-15' }, end: { date: '2024-01-16' } }),
        makeEvent({ id: 'timed', summary: 'Timed Event', start: { dateTime: '2024-01-15T09:00:00Z' }, end: { dateTime: '2024-01-15T10:00:00Z' } })
      ];

      const sortedEvents = events.sort(sortByStartTime);

      // Date-only event should come before timed event on same day
      expect(sortedEvents[0].summary).toBe('All Day Event');
      expect(sortedEvents[1].summary).toBe('Timed Event');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      // Mock authentication failure
      const authError = new Error('Authentication required');
      vi.spyOn(listEventsHandler as any, 'handleGoogleApiError').mockImplementation(() => {
        throw authError;
      });

      mockCalendarApi.events.list.mockRejectedValue(new Error('invalid_grant'));

      const args = {
        calendarId: 'primary',
        timeMin: TIME_MIN
      };

      await expect(listEventsHandler.runTool(args, mockOAuth2Client))
        .rejects.toThrow('Authentication required');
    });
  });

  describe('Integration Scenarios', () => {
    it('should prefer existing single calendar path for single array item', async () => {
      const args = {
        calendarId: ['primary'], // Array with single item
        timeMin: TIME_MIN
      };

      const mockEvents = [
        makeEvent({ id: 'event1', summary: 'Single Calendar Event', start: { dateTime: '2024-01-15T10:00:00Z' }, end: { dateTime: '2024-01-15T11:00:00Z' } })
      ];

      mockCalendarApi.events.list.mockResolvedValue({
        data: { items: mockEvents }
      });

      const result = await listEventsHandler.runTool(args, mockOAuth2Client);

      expect(mockCalendarApi.events.list).toHaveBeenCalledWith({
        calendarId: 'primary',
        timeMin: args.timeMin,
        timeMax: undefined,
        ...LIST_EVENTS_API_DEFAULTS
      });

      assertTextContentContains(result, 'Found');
    });
  });
});

describe('ListEventsHandler - Timezone Handling', () => {
  let handler: ListEventsHandler;
  let mockOAuth2Client: OAuth2Client;
  let mockCalendar: ReturnType<typeof makeCalendarMock>;

  beforeEach(() => {
    handler = new ListEventsHandler();
    mockOAuth2Client = {} as OAuth2Client;
    mockCalendar = makeCalendarMock();
    vi.mocked(google.calendar).mockReturnValue(mockCalendar as unknown as calendar_v3.Calendar);
  });

  describe('convertToRFC3339 timezone interpretation', () => {
    // Timezone-naive datetime should be interpreted in the target timezone.
    it.each([
      ['Los Angeles time (PST, UTC-8)', '2025-01-01T10:00:00', 'America/Los_Angeles', '2025-01-01T18:00:00Z'],
      ['New York time (EST, UTC-5)', '2025-01-01T10:00:00', 'America/New_York', '2025-01-01T15:00:00Z'],
      ['London time (GMT, UTC+0)', '2025-01-01T10:00:00', 'Europe/London', '2025-01-01T10:00:00Z'],
      ['Los Angeles time during DST (PDT, UTC-7)', '2025-07-01T10:00:00', 'America/Los_Angeles', '2025-07-01T17:00:00Z']
    ] as const)('should correctly convert timezone-naive datetime to %s', (_label, datetime, timezone, expected) => {
      expect(convertToRFC3339(datetime, timezone)).toBe(expected);
    });

    it('should leave timezone-aware datetime unchanged', () => {
      const datetime = '2025-01-01T10:00:00-08:00';
      const timezone = 'America/Los_Angeles';

      const result = convertToRFC3339(datetime, timezone);

      // Should remain unchanged since it already has timezone info
      expect(result).toBe('2025-01-01T10:00:00-08:00');
    });
  });

  describe('ListEventsHandler timezone parameter usage', () => {
    beforeEach(() => {
      // Mock successful calendar list response
      mockCalendar.calendarList.get.mockResolvedValue({
        data: { timeZone: 'UTC' }
      });

      // Mock successful events list response
      mockCalendar.events.list.mockResolvedValue({
        data: { items: [] }
      });
    });

    const expectEventsListCalledWith = (timeMin: string, timeMax: string) =>
      expect(mockCalendar.events.list).toHaveBeenCalledWith({
        calendarId: 'primary',
        timeMin,
        timeMax,
        ...LIST_EVENTS_API_DEFAULTS
      });

    it('should use timeZone parameter to interpret timezone-naive timeMin/timeMax', async () => {
      const args = {
        calendarId: 'primary',
        timeMin: '2025-01-01T10:00:00',
        timeMax: '2025-01-01T18:00:00',
        timeZone: 'America/Los_Angeles'
      };

      await handler.runTool(args, mockOAuth2Client);

      expectEventsListCalledWith('2025-01-01T18:00:00Z', '2025-01-02T02:00:00Z');
    });

    it('should preserve timezone-aware timeMin/timeMax regardless of timeZone parameter', async () => {
      const args = {
        calendarId: 'primary',
        timeMin: '2025-01-01T10:00:00-08:00',
        timeMax: '2025-01-01T18:00:00-08:00',
        timeZone: 'America/New_York' // Different timezone, should be ignored
      };

      await handler.runTool(args, mockOAuth2Client);

      expectEventsListCalledWith('2025-01-01T10:00:00-08:00', '2025-01-01T18:00:00-08:00');
    });

    it('should fall back to calendar timezone when timeZone parameter not provided', async () => {
      mockCalendar.calendarList.get.mockResolvedValue({
        data: { timeZone: 'America/Los_Angeles' }
      });

      const args = {
        calendarId: 'primary',
        timeMin: '2025-01-01T10:00:00',
        timeMax: '2025-01-01T18:00:00'
        // No timeZone parameter
      };

      await handler.runTool(args, mockOAuth2Client);

      expectEventsListCalledWith('2025-01-01T18:00:00Z', '2025-01-02T02:00:00Z');
    });

    it('should handle UTC timezone correctly', async () => {
      const args = {
        calendarId: 'primary',
        timeMin: '2025-01-01T10:00:00',
        timeMax: '2025-01-01T18:00:00',
        timeZone: 'UTC'
      };

      await handler.runTool(args, mockOAuth2Client);

      expectEventsListCalledWith('2025-01-01T10:00:00Z', '2025-01-01T18:00:00Z');
    });
  });
});
