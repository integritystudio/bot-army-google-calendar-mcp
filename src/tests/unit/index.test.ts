/**
 * Tests for the Google Calendar MCP Server implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OAuth2Client } from "google-auth-library";

// Import tool handlers to test them directly
import { ListCalendarsHandler } from "../../handlers/core/ListCalendarsHandler.js";
import { CreateEventHandler } from "../../handlers/core/CreateEventHandler.js";

// Import test helpers
import { TEST_EVENT_DEFAULTS, TEST_TIMEZONE, TEST_TIMEZONE_SECONDARY } from "../../testing/constants.js";

// Mock OAuth2Client
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    setCredentials: vi.fn(),
    refreshAccessToken: vi.fn().mockResolvedValue({ credentials: { access_token: 'mock_access_token' } }),
    on: vi.fn(),
  }))
}));

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    calendar: vi.fn().mockReturnValue({
      calendarList: {
        list: vi.fn(),
        get: vi.fn()
      },
      events: {
        list: vi.fn(),
        insert: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn()
      },
      colors: {
        get: vi.fn()
      },
      freebusy: {
        query: vi.fn()
      }
    })
  }
}));

// Mock TokenManager
vi.mock('./auth/tokenManager.js', () => ({
  TokenManager: vi.fn().mockImplementation(() => ({
    validateTokens: vi.fn().mockResolvedValue(true),
    loadSavedTokens: vi.fn().mockResolvedValue(true),
    clearTokens: vi.fn(),
  })),
}));

describe('Google Calendar MCP Server', () => {
  let mockOAuth2Client: OAuth2Client;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOAuth2Client = new OAuth2Client();
  });

  describe('McpServer Configuration', () => {
    it('should create McpServer with correct configuration', () => {
      const server = new McpServer({
        name: "google-calendar",
        version: "1.2.0"
      });

      expect(server).toBeDefined();
      // McpServer doesn't expose internal configuration for testing,
      // but we can verify it doesn't throw during creation
    });
  });

  describe('Tool Handlers', () => {
    function mockCalendarEuropeTimezone(mockCalendarApi: ReturnType<typeof import('googleapis')['google']['calendar']>, summary: string) {
      (mockCalendarApi.calendarList.get as any).mockResolvedValue({
        data: { id: 'primary', timeZone: TEST_TIMEZONE_SECONDARY }
      });
      (mockCalendarApi.events.insert as any).mockResolvedValue({
        data: { id: 'testEvent', summary }
      });
    }

    it('should handle list-calendars tool correctly', async () => {
      const handler = new ListCalendarsHandler();
      const { google } = await import('googleapis');
      const mockCalendarApi = google.calendar('v3');

      // Mock the API response
      (mockCalendarApi.calendarList.list as any).mockResolvedValue({
        data: {
          items: [
            { 
              id: 'cal1', 
              summary: 'Work Calendar',
              timeZone: 'America/New_York',
              kind: 'calendar#calendarListEntry',
              accessRole: 'owner',
              primary: true,
              selected: true,
              hidden: false,
              backgroundColor: '#0D7377',
              defaultReminders: [
                { method: 'popup', minutes: TEST_EVENT_DEFAULTS.REMINDER_MINUTES },
                { method: 'email', minutes: 60 }
              ],
              description: 'Work-related events and meetings'
            },
            {
              id: 'cal2',
              summary: 'Personal',
              timeZone: TEST_TIMEZONE,
              kind: 'calendar#calendarListEntry',
              accessRole: 'reader',
              primary: false,
              selected: true,
              hidden: false,
              backgroundColor: '#D50000'
            },
          ]
        }
      });

      const result = await handler.runTool({}, mockOAuth2Client);

      expect(mockCalendarApi.calendarList.list).toHaveBeenCalled();
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: `Work Calendar (PRIMARY) (cal1)
  Timezone: America/New_York
  Kind: calendar#calendarListEntry
  Access Role: owner
  Selected: Yes
  Hidden: No
  Background Color: #0D7377
  Default Reminders: popup (${TEST_EVENT_DEFAULTS.REMINDER_MINUTES}min before), email (60min before)
  Description: Work-related events and meetings

Personal (cal2)
  Timezone: ${TEST_TIMEZONE}
  Kind: calendar#calendarListEntry
  Access Role: reader
  Selected: Yes
  Hidden: No
  Background Color: #D50000
  Default Reminders: None`,
          },
        ],
      });
    });

    it('should use calendar default timezone when timeZone is not provided', async () => {
      const handler = new CreateEventHandler();
      const { google } = await import('googleapis');
      const mockCalendarApi = google.calendar('v3');

      const mockEventArgs = {
        calendarId: 'primary',
        summary: 'Meeting without timezone',
        start: '2024-08-15T10:00:00', // Timezone-naive datetime
        end: '2024-08-15T11:00:00', // Timezone-naive datetime
      };

      mockCalendarEuropeTimezone(mockCalendarApi, mockEventArgs.summary);

      await handler.runTool(mockEventArgs, mockOAuth2Client);

      // Verify that the calendar's timezone was used
      expect(mockCalendarApi.events.insert).toHaveBeenCalledWith({
        calendarId: mockEventArgs.calendarId,
        requestBody: expect.objectContaining({
          start: { dateTime: mockEventArgs.start, timeZone: TEST_TIMEZONE_SECONDARY },
          end: { dateTime: mockEventArgs.end, timeZone: TEST_TIMEZONE_SECONDARY },
        }),
      });
    });

    it('should handle timezone-aware datetime strings correctly', async () => {
      const handler = new CreateEventHandler();
      const { google } = await import('googleapis');
      const mockCalendarApi = google.calendar('v3');

      const mockEventArgs = {
        calendarId: 'primary',
        summary: 'Meeting with timezone in datetime',
        start: '2024-08-15T10:00:00-07:00', // Timezone-aware datetime
        end: '2024-08-15T11:00:00-07:00', // Timezone-aware datetime
      };

      mockCalendarEuropeTimezone(mockCalendarApi, mockEventArgs.summary);

      await handler.runTool(mockEventArgs, mockOAuth2Client);

      // Verify that timezone from datetime was used (no timeZone property)
      expect(mockCalendarApi.events.insert).toHaveBeenCalledWith({
        calendarId: mockEventArgs.calendarId,
        requestBody: expect.objectContaining({
          start: { dateTime: mockEventArgs.start }, // No timeZone property
          end: { dateTime: mockEventArgs.end }, // No timeZone property
        }),
      });
    });

  });

  describe('Configuration and Environment Variables', () => {
    it('should parse environment variables correctly', async () => {
      const originalEnv = process.env;
      
      try {
        // Set test environment variables
        process.env.TRANSPORT = 'http';
        process.env.PORT = '4000';
        process.env.HOST = '0.0.0.0';
        process.env.DEBUG = 'true';

        // Import config parser after setting env vars
        const { parseArgs } = await import('../../config/TransportConfig.js');
        
        const config = parseArgs([]);

        expect(config.transport.type).toBe('http');
        expect(config.transport.port).toBe(4000);
        expect(config.transport.host).toBe('0.0.0.0');
        expect(config.debug).toBe(true);
      } finally {
        // Restore original environment
        process.env = originalEnv;
      }
    });

    it('should allow CLI arguments to override environment variables', async () => {
      const originalEnv = process.env;
      
      try {
        // Set environment variables
        process.env.TRANSPORT = 'http';
        process.env.PORT = '4000';

        const { parseArgs } = await import('../../config/TransportConfig.js');
        
        // CLI arguments should override env vars
        const config = parseArgs(['--transport', 'stdio', '--port', '5000']);

        expect(config.transport.type).toBe('stdio');
        expect(config.transport.port).toBe(5000);
      } finally {
        process.env = originalEnv;
      }
    });
  });
});