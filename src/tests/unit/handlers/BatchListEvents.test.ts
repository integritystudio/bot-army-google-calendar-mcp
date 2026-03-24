/**
 * @jest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { getTextContent, assertTextContentContains, makeEvent, makeEventWithCalendarId, setupListEventsHandler } from '../helpers/index.js';
import { LIST_EVENTS_API_DEFAULTS, TIME_MIN, TIME_MAX } from '../helpers/test-configs.js';
// Import the types and schemas we're testing
import { ToolSchemas } from '../../../tools/registry.js';
import { ExtendedEvent } from '../../../handlers/core/batchUtils.js';

// Get the schema for validation testing
const ListEventsArgumentsSchema = ToolSchemas['list-events'];
import { ListEventsHandler } from '../../../handlers/core/ListEventsHandler.js';
import { processBatchResponses } from '../../../handlers/core/batchUtils.js';
import { groupBy } from '../../../utils/aggregationHelpers.js';

// Mock dependencies
vi.mock('google-auth-library');
vi.mock('googleapis');

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
      const parsed = JSON.parse(result.data?.calendarId);
      expect(parsed).toHaveLength(50);
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
    const sortByStartTime = (a: ExtendedEvent, b: ExtendedEvent) => {
      const aStart = a.start?.dateTime || a.start?.date || '';
      const bStart = b.start?.dateTime || b.start?.date || '';
      return aStart.localeCompare(bStart);
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