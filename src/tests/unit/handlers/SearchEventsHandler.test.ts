import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchEventsHandler } from '../../../handlers/core/SearchEventsHandler.js';
import { OAuth2Client } from 'google-auth-library';
import { calendar_v3 } from 'googleapis';
import { getTextContent, makeEvent, makeGaxiosError } from '../helpers/index.js';

vi.mock('googleapis', () => ({
  google: {
    calendar: vi.fn(() => ({
      events: {
        list: vi.fn()
      },
      calendarList: {
        get: vi.fn()
      }
    }))
  },
  calendar_v3: {}
}));

vi.mock('../../../utils/field-mask-builder.js', () => ({
  buildListFieldMask: vi.fn((fields) => {
    if (!fields || fields.length === 0) return undefined;
    return fields.join(',');
  })
}));

vi.mock('../../../utils/timezone-utils.js', () => ({
  convertToRFC3339: vi.fn((dateString, timezone) => {
    if (dateString.includes('Z') || dateString.includes('+') || dateString.includes('-')) {
      return dateString;
    }
    return `${dateString}Z`;
  })
}));

vi.mock('../../../handlers/utils.js', () => ({
  formatEventWithDetails: vi.fn((event) => {
    return `${event.summary || 'No Title'} (${event.start?.dateTime || event.start?.date || 'No Date'})`;
  })
}));

const BASE_ARGS = {
  calendarId: 'primary' as const,
  query: 'test',
  timeMin: '2025-01-01T00:00:00',
  timeMax: '2025-01-31T23:59:59'
} as const;

describe('SearchEventsHandler', () => {
  let handler: SearchEventsHandler;
  let mockOAuth2Client: OAuth2Client;
  let mockCalendar: any;

  beforeEach(() => {
    handler = new SearchEventsHandler();
    mockOAuth2Client = new OAuth2Client();

    mockCalendar = {
      events: {
        list: vi.fn().mockResolvedValue({ data: { items: [] } })
      }
    };

    vi.spyOn(handler as any, 'getCalendar').mockReturnValue(mockCalendar);
    vi.spyOn(handler as any, 'getCalendarTimezone').mockResolvedValue('America/Los_Angeles');
  });

  describe('runTool', () => {
    it('should search and return events successfully', async () => {
      const mockEvents = [
        makeEvent({ summary: 'Team Meeting' }),
        makeEvent({
          id: 'event2',
          summary: 'Project Review',
          start: { dateTime: '2025-01-15T14:00:00Z' },
          end: { dateTime: '2025-01-15T15:00:00Z' }
        })
      ];

      mockCalendar.events.list.mockResolvedValue({ data: { items: mockEvents } });

      const result = await handler.runTool({ ...BASE_ARGS, query: 'meeting' }, mockOAuth2Client);

      expect(result.content).toHaveLength(1);
      const text = getTextContent(result);
      expect(text).toContain('Found 2 event(s)');
      expect(text).toContain('Team Meeting');
      expect(text).toContain('Project Review');
    });

    it('should return no events message when search yields no results', async () => {
      const result = await handler.runTool({ ...BASE_ARGS, query: 'nonexistent' }, mockOAuth2Client);

      expect(result.content).toHaveLength(1);
      expect(getTextContent(result)).toBe('No events found matching your search criteria.');
    });

    it('should return no events message when items is undefined', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: {} });

      const result = await handler.runTool(BASE_ARGS, mockOAuth2Client);

      expect(result.content).toHaveLength(1);
      expect(getTextContent(result)).toBe('No events found matching your search criteria.');
    });

    it('should include event index numbers in response', async () => {
      const mockEvents = [
        makeEvent({ summary: 'First Event' }),
        makeEvent({ id: 'event2', summary: 'Second Event', start: { dateTime: '2025-01-15T14:00:00Z' }, end: { dateTime: '2025-01-15T15:00:00Z' } })
      ];

      mockCalendar.events.list.mockResolvedValue({ data: { items: mockEvents } });

      const result = await handler.runTool({ ...BASE_ARGS, query: 'event' }, mockOAuth2Client);
      const text = getTextContent(result);

      expect(text).toContain('1. First Event');
      expect(text).toContain('2. Second Event');
    });
  });

  describe('searchEvents - API Parameters', () => {
    it('should pass correct parameters to calendar.events.list', async () => {
      await handler.runTool({ ...BASE_ARGS, query: 'meeting', timeZone: 'America/New_York' }, mockOAuth2Client);

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'primary',
          q: 'meeting',
          singleEvents: true,
          orderBy: 'startTime'
        })
      );

      const callArgs = mockCalendar.events.list.mock.calls[0][0];
      expect(callArgs.timeMin).toBeDefined();
      expect(callArgs.timeMax).toBeDefined();
    });

    it('should use provided timeZone for conversion', async () => {
      const { convertToRFC3339 } = await import('../../../utils/timezone-utils.js');

      await handler.runTool({ ...BASE_ARGS, timeZone: 'Asia/Tokyo' }, mockOAuth2Client);

      expect(vi.mocked(convertToRFC3339)).toHaveBeenCalledWith('2025-01-01T00:00:00', 'Asia/Tokyo');
      expect(vi.mocked(convertToRFC3339)).toHaveBeenCalledWith('2025-01-31T23:59:59', 'Asia/Tokyo');
    });

    it('should fallback to calendar timezone when timeZone not provided', async () => {
      await handler.runTool(BASE_ARGS, mockOAuth2Client);

      expect(handler['getCalendarTimezone']).toHaveBeenCalledWith(mockOAuth2Client, 'primary');
    });
  });

  describe('searchEvents - Field Handling', () => {
    it('should not include fields parameter when no fields requested', async () => {
      await handler.runTool(BASE_ARGS, mockOAuth2Client);

      const callArgs = mockCalendar.events.list.mock.calls[0][0];
      expect(callArgs.fields).toBeUndefined();
    });

    it('should include fields parameter when fields are requested', async () => {
      await handler.runTool({ ...BASE_ARGS, fields: ['description', 'attendees'] }, mockOAuth2Client);

      const callArgs = mockCalendar.events.list.mock.calls[0][0];
      expect(callArgs.fields).toBe('description,attendees');
    });
  });

  describe('searchEvents - Extended Properties', () => {
    it('should include privateExtendedProperty when provided', async () => {
      await handler.runTool({ ...BASE_ARGS, privateExtendedProperty: ['key1=value1', 'key2=value2'] }, mockOAuth2Client);

      const callArgs = mockCalendar.events.list.mock.calls[0][0];
      expect(callArgs.privateExtendedProperty).toEqual(['key1=value1', 'key2=value2']);
    });

    it('should include sharedExtendedProperty when provided', async () => {
      await handler.runTool({ ...BASE_ARGS, sharedExtendedProperty: ['prop1=val1'] }, mockOAuth2Client);

      const callArgs = mockCalendar.events.list.mock.calls[0][0];
      expect(callArgs.sharedExtendedProperty).toEqual(['prop1=val1']);
    });

    it('should not include extended properties when not provided', async () => {
      await handler.runTool(BASE_ARGS, mockOAuth2Client);

      const callArgs = mockCalendar.events.list.mock.calls[0][0];
      expect(callArgs.privateExtendedProperty).toBeUndefined();
      expect(callArgs.sharedExtendedProperty).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it.each([
      [500, 'Internal Server Error'],
      [404, 'Calendar not found'],
      [403, 'Insufficient permissions'],
      [429, 'Rate limit exceeded'],
      [400, 'Token expired']
    ])('should throw on HTTP %i error', async (status, message) => {
      const error = makeGaxiosError(status, 'Error', { error: { message } });
      mockCalendar.events.list.mockRejectedValue(error);

      await expect(handler.runTool(BASE_ARGS, mockOAuth2Client)).rejects.toThrow();
    });

    it('should handle non-GaxiosError errors gracefully', async () => {
      const genericError = new Error('Something went wrong');
      mockCalendar.events.list.mockRejectedValue(genericError);

      await expect(handler.runTool(BASE_ARGS, mockOAuth2Client)).rejects.toThrow();
    });
  });

  describe('Response Formatting', () => {
    it('should trim whitespace from final response', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [makeEvent()] } });

      const result = await handler.runTool(BASE_ARGS, mockOAuth2Client);
      const text = getTextContent(result);

      expect(text).not.toMatch(/^\s+/);
      expect(text).not.toMatch(/\s+$/);
    });

    it('should format single event correctly', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [makeEvent({ summary: 'Single Event' })] } });

      const result = await handler.runTool({ ...BASE_ARGS, query: 'single' }, mockOAuth2Client);
      const text = getTextContent(result);

      expect(text).toContain('Found 1 event(s)');
      expect(text).toContain('1. Single Event');
    });
  });


  describe('Query handling', () => {
    it('should pass query parameter to API', async () => {
      await handler.runTool({ ...BASE_ARGS, query: 'important project' }, mockOAuth2Client);

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'important project' })
      );
    });

    it('should handle special characters in query', async () => {
      await handler.runTool({ ...BASE_ARGS, query: '"exact phrase" OR tag:important' }, mockOAuth2Client);

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({ q: '"exact phrase" OR tag:important' })
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle events with minimal properties', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [{ id: 'minimal-event' }] } });

      const result = await handler.runTool(BASE_ARGS, mockOAuth2Client);

      expect(getTextContent(result)).toContain('Found 1 event(s)');
    });

    it('should handle many events', async () => {
      const mockEvents = Array.from({ length: 50 }, (_, i) => ({
        id: `event${i}`,
        summary: `Event ${i}`,
        start: { dateTime: `2025-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z` },
        end: { dateTime: `2025-01-${String((i % 28) + 1).padStart(2, '0')}T11:00:00Z` }
      }));

      mockCalendar.events.list.mockResolvedValue({ data: { items: mockEvents } });

      const result = await handler.runTool(BASE_ARGS, mockOAuth2Client);
      const text = getTextContent(result);

      expect(text).toContain('Found 50 event(s)');
      expect(text).toContain('50. Event 49');
    });

    it('should handle events with all-day dates', async () => {
      mockCalendar.events.list.mockResolvedValue({
        data: { items: [{ id: 'allday-event', summary: 'All Day Event', start: { date: '2025-01-15' }, end: { date: '2025-01-16' } }] }
      });

      const result = await handler.runTool({ ...BASE_ARGS, query: 'allday' }, mockOAuth2Client);

      expect(getTextContent(result)).toContain('All Day Event');
    });

    it('should handle events with RFC3339 timezone-aware times', async () => {
      mockCalendar.events.list.mockResolvedValue({
        data: {
          items: [makeEvent({ summary: 'TZ Event', start: { dateTime: '2025-01-15T10:00:00-08:00' }, end: { dateTime: '2025-01-15T11:00:00-08:00' } })]
        }
      });

      const result = await handler.runTool({ ...BASE_ARGS, query: 'tz' }, mockOAuth2Client);

      expect(getTextContent(result)).toContain('TZ Event');
    });
  });

});
