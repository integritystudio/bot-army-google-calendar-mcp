import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchEventsHandler } from '../../../handlers/core/SearchEventsHandler.js';
import { OAuth2Client } from 'google-auth-library';
import { calendar_v3 } from 'googleapis';
import { GaxiosError } from 'gaxios';

// Mock the googleapis module
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

// Mock the field mask builder
vi.mock('../../../utils/field-mask-builder.js', () => ({
  buildListFieldMask: vi.fn((fields) => {
    if (!fields || fields.length === 0) return undefined;
    return fields.join(',');
  })
}));

// Mock the datetime utils
vi.mock('../../../handlers/utils/datetime.js', () => ({
  convertToRFC3339: vi.fn((dateString, timezone) => {
    // Simple mock: just append Z if not present
    if (dateString.includes('Z') || dateString.includes('+') || dateString.includes('-')) {
      return dateString;
    }
    return `${dateString}Z`;
  })
}));

// Mock the formatting utils
vi.mock('../../../handlers/utils.js', () => ({
  formatEventWithDetails: vi.fn((event) => {
    return `${event.summary || 'No Title'} (${event.start?.dateTime || event.start?.date || 'No Date'})`;
  })
}));

describe('SearchEventsHandler', () => {
  let handler: SearchEventsHandler;
  let mockOAuth2Client: OAuth2Client;
  let mockCalendar: any;

  beforeEach(() => {
    handler = new SearchEventsHandler();
    mockOAuth2Client = new OAuth2Client();

    mockCalendar = {
      events: {
        list: vi.fn()
      },
      calendarList: {
        get: vi.fn().mockResolvedValue({
          data: { timeZone: 'America/Los_Angeles' }
        })
      }
    };

    vi.spyOn(handler as any, 'getCalendar').mockReturnValue(mockCalendar);
    vi.spyOn(handler as any, 'getCalendarTimezone').mockResolvedValue('America/Los_Angeles');
  });

  describe('runTool', () => {
    it('should search and return events successfully', async () => {
      const mockEvents: calendar_v3.Schema$Event[] = [
        {
          id: 'event1',
          summary: 'Team Meeting',
          start: { dateTime: '2025-01-15T10:00:00Z' },
          end: { dateTime: '2025-01-15T11:00:00Z' }
        },
        {
          id: 'event2',
          summary: 'Project Review',
          start: { dateTime: '2025-01-15T14:00:00Z' },
          end: { dateTime: '2025-01-15T15:00:00Z' }
        }
      ];

      mockCalendar.events.list.mockResolvedValue({ data: { items: mockEvents } });

      const args = {
        calendarId: 'primary',
        query: 'meeting',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      const text = (result.content[0] as any).text;
      expect(text).toContain('Found 2 event(s)');
      expect(text).toContain('Team Meeting');
      expect(text).toContain('Project Review');
    });

    it('should return no events message when search yields no results', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'nonexistent',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect((result.content[0] as any).text).toBe('No events found matching your search criteria.');
    });

    it('should return no events message when items is undefined', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: {} });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(result.content).toHaveLength(1);
      expect((result.content[0] as any).text).toBe('No events found matching your search criteria.');
    });

    it('should include event index numbers in response', async () => {
      const mockEvents: calendar_v3.Schema$Event[] = [
        {
          id: 'event1',
          summary: 'First Event',
          start: { dateTime: '2025-01-15T10:00:00Z' },
          end: { dateTime: '2025-01-15T11:00:00Z' }
        },
        {
          id: 'event2',
          summary: 'Second Event',
          start: { dateTime: '2025-01-15T14:00:00Z' },
          end: { dateTime: '2025-01-15T15:00:00Z' }
        }
      ];

      mockCalendar.events.list.mockResolvedValue({ data: { items: mockEvents } });

      const args = {
        calendarId: 'primary',
        query: 'event',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      const result = await handler.runTool(args, mockOAuth2Client);
      const text = (result.content[0] as any).text;

      expect(text).toContain('1. First Event');
      expect(text).toContain('2. Second Event');
    });
  });

  describe('searchEvents - API Parameters', () => {
    it('should pass correct parameters to calendar.events.list', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'meeting',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59',
        timeZone: 'America/New_York'
      };

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'primary',
          q: 'meeting',
          singleEvents: true,
          orderBy: 'startTime'
        })
      );

      // Verify timeMin and timeMax are converted
      const callArgs = mockCalendar.events.list.mock.calls[0][0];
      expect(callArgs.timeMin).toBeDefined();
      expect(callArgs.timeMax).toBeDefined();
    });

    it('should use provided timeZone for conversion', async () => {
      const { convertToRFC3339 } = await import('../../../handlers/utils/datetime.js');
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59',
        timeZone: 'Asia/Tokyo'
      };

      await handler.runTool(args, mockOAuth2Client);

      expect(vi.mocked(convertToRFC3339)).toHaveBeenCalledWith('2025-01-01T00:00:00', 'Asia/Tokyo');
      expect(vi.mocked(convertToRFC3339)).toHaveBeenCalledWith('2025-01-31T23:59:59', 'Asia/Tokyo');
    });

    it('should fallback to calendar timezone when timeZone not provided', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await handler.runTool(args, mockOAuth2Client);

      expect(handler['getCalendarTimezone']).toHaveBeenCalledWith(mockOAuth2Client, 'primary');
    });
  });

  describe('searchEvents - Field Handling', () => {
    it('should not include fields parameter when no fields requested', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await handler.runTool(args, mockOAuth2Client);

      const callArgs = mockCalendar.events.list.mock.calls[0][0];
      expect(callArgs.fields).toBeUndefined();
    });

    it('should include fields parameter when fields are requested', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59',
        fields: ['description', 'attendees']
      };

      await handler.runTool(args, mockOAuth2Client);

      const callArgs = mockCalendar.events.list.mock.calls[0][0];
      expect(callArgs.fields).toBe('description,attendees');
    });
  });

  describe('searchEvents - Extended Properties', () => {
    it('should include privateExtendedProperty when provided', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59',
        privateExtendedProperty: ['key1=value1', 'key2=value2']
      };

      await handler.runTool(args, mockOAuth2Client);

      const callArgs = mockCalendar.events.list.mock.calls[0][0];
      expect(callArgs.privateExtendedProperty).toEqual(['key1=value1', 'key2=value2']);
    });

    it('should include sharedExtendedProperty when provided', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59',
        sharedExtendedProperty: ['prop1=val1']
      };

      await handler.runTool(args, mockOAuth2Client);

      const callArgs = mockCalendar.events.list.mock.calls[0][0];
      expect(callArgs.sharedExtendedProperty).toEqual(['prop1=val1']);
    });

    it('should not include extended properties when not provided', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await handler.runTool(args, mockOAuth2Client);

      const callArgs = mockCalendar.events.list.mock.calls[0][0];
      expect(callArgs.privateExtendedProperty).toBeUndefined();
      expect(callArgs.sharedExtendedProperty).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors and throw appropriate error', async () => {
      const apiError = new GaxiosError('API Error', {} as any, {
        status: 500,
        data: { error: { message: 'Internal Server Error' } }
      } as any);

      mockCalendar.events.list.mockRejectedValue(apiError);

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await expect(handler.runTool(args, mockOAuth2Client)).rejects.toThrow();
    });

    it('should handle 404 not found errors', async () => {
      const notFoundError = new GaxiosError('Not Found', {} as any, {
        status: 404,
        data: { error: { message: 'Calendar not found' } }
      } as any);

      mockCalendar.events.list.mockRejectedValue(notFoundError);

      const args = {
        calendarId: 'nonexistent',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await expect(handler.runTool(args, mockOAuth2Client)).rejects.toThrow();
    });

    it('should handle 403 forbidden errors', async () => {
      const forbiddenError = new GaxiosError('Forbidden', {} as any, {
        status: 403,
        data: { error: { message: 'Insufficient permissions' } }
      } as any);

      mockCalendar.events.list.mockRejectedValue(forbiddenError);

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await expect(handler.runTool(args, mockOAuth2Client)).rejects.toThrow();
    });

    it('should handle 429 rate limit errors', async () => {
      const rateLimitError = new GaxiosError('Too Many Requests', {} as any, {
        status: 429,
        data: { error: { message: 'Rate limit exceeded' } }
      } as any);

      mockCalendar.events.list.mockRejectedValue(rateLimitError);

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await expect(handler.runTool(args, mockOAuth2Client)).rejects.toThrow();
    });

    it('should handle invalid_grant authentication errors', async () => {
      const authError = new GaxiosError('Invalid Grant', {} as any, {
        status: 400,
        data: { error: 'invalid_grant', error_description: 'Token expired' }
      } as any);

      mockCalendar.events.list.mockRejectedValue(authError);

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await expect(handler.runTool(args, mockOAuth2Client)).rejects.toThrow();
    });

    it('should handle non-GaxiosError errors gracefully', async () => {
      const genericError = new Error('Something went wrong');

      mockCalendar.events.list.mockRejectedValue(genericError);

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await expect(handler.runTool(args, mockOAuth2Client)).rejects.toThrow();
    });
  });

  describe('Response Formatting', () => {
    it('should trim whitespace from final response', async () => {
      const mockEvents: calendar_v3.Schema$Event[] = [
        {
          id: 'event1',
          summary: 'Test Event',
          start: { dateTime: '2025-01-15T10:00:00Z' },
          end: { dateTime: '2025-01-15T11:00:00Z' }
        }
      ];

      mockCalendar.events.list.mockResolvedValue({ data: { items: mockEvents } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      const result = await handler.runTool(args, mockOAuth2Client);
      const text = (result.content[0] as any).text;

      expect(text).not.toMatch(/^\s+/);
      expect(text).not.toMatch(/\s+$/);
    });

    it('should format single event correctly', async () => {
      const mockEvents: calendar_v3.Schema$Event[] = [
        {
          id: 'event1',
          summary: 'Single Event',
          start: { dateTime: '2025-01-15T10:00:00Z' },
          end: { dateTime: '2025-01-15T11:00:00Z' }
        }
      ];

      mockCalendar.events.list.mockResolvedValue({ data: { items: mockEvents } });

      const args = {
        calendarId: 'primary',
        query: 'single',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      const result = await handler.runTool(args, mockOAuth2Client);
      const text = (result.content[0] as any).text;

      expect(text).toContain('Found 1 event(s)');
      expect(text).toContain('1. Single Event');
    });
  });

  describe('Calendar ID handling', () => {
    it('should accept calendar ID in any format', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'user@example.com',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'user@example.com'
        })
      );
    });

    it('should handle primary calendar ID', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'primary'
        })
      );
    });
  });

  describe('Query handling', () => {
    it('should pass query parameter to API', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'important project',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'important project'
        })
      );
    });

    it('should handle special characters in query', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: '"exact phrase" OR tag:important',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: '"exact phrase" OR tag:important'
        })
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle events with minimal properties', async () => {
      const mockEvents: calendar_v3.Schema$Event[] = [
        {
          id: 'minimal-event'
        }
      ];

      mockCalendar.events.list.mockResolvedValue({ data: { items: mockEvents } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(result.content[0].type).toBe('text');
      expect((result.content[0] as any).text).toContain('Found 1 event(s)');
    });

    it('should handle many events', async () => {
      const mockEvents: calendar_v3.Schema$Event[] = Array.from({ length: 50 }, (_, i) => ({
        id: `event${i}`,
        summary: `Event ${i}`,
        start: { dateTime: `2025-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z` },
        end: { dateTime: `2025-01-${String((i % 28) + 1).padStart(2, '0')}T11:00:00Z` }
      }));

      mockCalendar.events.list.mockResolvedValue({ data: { items: mockEvents } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      const result = await handler.runTool(args, mockOAuth2Client);
      const text = (result.content[0] as any).text;

      expect(text).toContain('Found 50 event(s)');
      expect(text).toContain('50. Event 49');
    });

    it('should handle events with all-day dates', async () => {
      const mockEvents: calendar_v3.Schema$Event[] = [
        {
          id: 'allday-event',
          summary: 'All Day Event',
          start: { date: '2025-01-15' },
          end: { date: '2025-01-16' }
        }
      ];

      mockCalendar.events.list.mockResolvedValue({ data: { items: mockEvents } });

      const args = {
        calendarId: 'primary',
        query: 'allday',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      const result = await handler.runTool(args, mockOAuth2Client);

      expect((result.content[0] as any).text).toContain('All Day Event');
    });

    it('should handle events with RFC3339 timezone-aware times', async () => {
      const mockEvents: calendar_v3.Schema$Event[] = [
        {
          id: 'event1',
          summary: 'TZ Event',
          start: { dateTime: '2025-01-15T10:00:00-08:00' },
          end: { dateTime: '2025-01-15T11:00:00-08:00' }
        }
      ];

      mockCalendar.events.list.mockResolvedValue({ data: { items: mockEvents } });

      const args = {
        calendarId: 'primary',
        query: 'tz',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      const result = await handler.runTool(args, mockOAuth2Client);

      expect((result.content[0] as any).text).toContain('TZ Event');
    });
  });

  describe('API call verification', () => {
    it('should set singleEvents to true', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          singleEvents: true
        })
      );
    });

    it('should set orderBy to startTime', async () => {
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const args = {
        calendarId: 'primary',
        query: 'test',
        timeMin: '2025-01-01T00:00:00',
        timeMax: '2025-01-31T23:59:59'
      };

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: 'startTime'
        })
      );
    });
  });
});
