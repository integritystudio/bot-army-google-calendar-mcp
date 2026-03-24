import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { calendar_v3, google } from 'googleapis';
import { UpdateEventHandler } from '../../../handlers/core/UpdateEventHandler.js';
import { RecurringEventHelpers } from '../../../handlers/core/RecurringEventHelpers.js';
import { RecurringEventError, RECURRING_EVENT_ERRORS } from '../../../handlers/core/RecurringEventHelpers.js';

// Mock the google.calendar function
vi.mock('googleapis', async () => {
  const actual = await vi.importActual('googleapis');
  return {
    ...actual,
    google: {
      ...actual.google,
      calendar: vi.fn()
    }
  };
});

describe('UpdateEventHandler - Recurring Events', () => {
  let handler: UpdateEventHandler;
  let mockCalendar: any;
  let mockOAuth2Client: OAuth2Client;

  beforeEach(() => {
    // Realistic mock calendar API matching Google Calendar v3 structure
    mockCalendar = {
      events: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        list: vi.fn().mockResolvedValue({ data: { items: [] } }) // Required by ConflictDetectionService
      },
      calendarList: {
        get: vi.fn().mockResolvedValue({
          data: { timeZone: 'UTC' }
        })
      }
    };

    // Mock google.calendar to return our mock calendar
    vi.mocked(google.calendar).mockReturnValue(mockCalendar);

    handler = new UpdateEventHandler();
    mockOAuth2Client = {} as OAuth2Client;

    // Clear mocks between tests to prevent call count pollution
    vi.clearAllMocks();
  });

  /**
   * Helper to create realistic mock event responses.
   * Matches Google Calendar API response structure.
   */
  function createMockEvent(overrides: Partial<calendar_v3.Schema$Event> = {}): calendar_v3.Schema$Event {
    return {
      id: 'event123',
      summary: 'Test Event',
      start: { dateTime: '2026-03-25T10:00:00Z', timeZone: 'UTC' },
      end: { dateTime: '2026-03-25T11:00:00Z', timeZone: 'UTC' },
      created: '2026-03-20T12:00:00.000Z',
      updated: '2026-03-20T12:00:00.000Z',
      etag: '"etag123"',
      ...overrides
    };
  }

  /**
   * Helper for recurring event data with recurrence rules.
   */
  function createMockRecurringEvent(overrides: Partial<calendar_v3.Schema$Event> = {}): calendar_v3.Schema$Event {
    return createMockEvent({
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
      ...overrides
    });
  }

  // ============================================================================
  // PHASE 3: Test Cases will be written here
  // Testing via public runTool() method with correct scope names:
  // - 'thisEventOnly': Update single instance of recurring event
  // - 'thisAndFollowing': Update this and all future instances
  // - 'all' or undefined: Update all instances
  // ============================================================================

  describe('Scope Validation', () => {
    it('should accept valid scope: thisEventOnly', async () => {
      const recurringEvent = createMockRecurringEvent();
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: recurringEvent });

      const result = await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event123',
          modificationScope: 'thisEventOnly',
          originalStartTime: '2026-03-25T10:00:00Z',
          summary: 'Updated'
        },
        mockOAuth2Client
      );

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(mockCalendar.events.patch).toHaveBeenCalled();
    });

    it('should accept valid scope: thisAndFollowing', async () => {
      const recurringEvent = createMockRecurringEvent();
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: recurringEvent });
      mockCalendar.events.insert.mockResolvedValue({ data: createMockRecurringEvent({ id: 'new-event' }) });

      const futureDate = new Date('2026-04-01T10:00:00Z');
      const result = await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event123',
          modificationScope: 'thisAndFollowing',
          futureStartDate: futureDate.toISOString(),
          checkConflicts: false // Disable conflict checking for simpler test
        },
        mockOAuth2Client
      );

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(mockCalendar.events.patch).toHaveBeenCalled();
      expect(mockCalendar.events.insert).toHaveBeenCalled();
    });

    it('should accept valid scope: all', async () => {
      const recurringEvent = createMockRecurringEvent();
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: recurringEvent });

      const result = await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event123',
          modificationScope: 'all',
          summary: 'Updated All Instances',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      expect(result.content).toBeDefined();
      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'event123'
        })
      );
    });

    it('should accept undefined scope as "all"', async () => {
      const recurringEvent = createMockRecurringEvent();
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: recurringEvent });

      const result = await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event123',
          summary: 'Updated',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      expect(result.content).toBeDefined();
      expect(mockCalendar.events.patch).toHaveBeenCalled();
    });

    it('should reject invalid scope values', async () => {
      const recurringEvent = createMockRecurringEvent();
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });

      // Try with invalid scope (will fail schema validation)
      await expect(() =>
        handler.runTool(
          {
            calendarId: 'primary',
            eventId: 'event123',
            modificationScope: 'invalid-scope' as any,
            summary: 'Updated',
            checkConflicts: false
          },
          mockOAuth2Client
        )
      ).rejects.toThrow();
    });

    it('should reject scopes other than "all" for non-recurring events', async () => {
      // Single event - no recurrence
      const singleEvent = createMockEvent({ recurrence: undefined });
      mockCalendar.events.get.mockResolvedValue({ data: singleEvent });

      await expect(() =>
        handler.runTool(
          {
            calendarId: 'primary',
            eventId: 'event123',
            modificationScope: 'thisEventOnly',
            originalStartTime: '2026-03-25T10:00:00Z',
            checkConflicts: false
          },
          mockOAuth2Client
        )
      ).rejects.toThrow('Scope other than "all" only applies to recurring events');
    });
  });

  describe('Instance ID Formatting', () => {
    it('should format instance ID correctly for single instance updates', async () => {
      const recurringEvent = createMockRecurringEvent();
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: recurringEvent });

      const originalStartTime = '2026-03-25T10:00:00Z';
      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'recurring123',
          modificationScope: 'thisEventOnly',
          originalStartTime,
          summary: 'Updated Single Instance',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      // Expected instance ID format: eventId_YYYYMMDDTHHMMSSZ
      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'recurring123_20260325T100000Z'
        })
      );
    });

    it('should handle ISO timestamp with timezone offset (+HH:MM)', async () => {
      const recurringEvent = createMockRecurringEvent();
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: recurringEvent });

      // Timestamp with +05:30 offset should be converted to UTC
      const originalStartTime = '2026-03-25T15:30:00+05:30';
      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event-with-tz',
          modificationScope: 'thisEventOnly',
          originalStartTime,
          summary: 'Updated',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      // Verify patch was called with instance ID
      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: expect.stringMatching(/^event-with-tz_\d{8}T\d{6}Z$/)
        })
      );
    });

    it('should handle ISO timestamp with negative timezone offset (-HH:MM)', async () => {
      const recurringEvent = createMockRecurringEvent();
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: recurringEvent });

      const originalStartTime = '2026-03-25T05:00:00-08:00';
      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'pst-event',
          modificationScope: 'thisEventOnly',
          originalStartTime,
          summary: 'Updated',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      // Verify patch was called with instance ID format
      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: expect.stringMatching(/^pst-event_\d{8}T\d{6}Z$/)
        })
      );
    });

    it('should handle timestamp without timezone designation', async () => {
      const recurringEvent = createMockRecurringEvent();
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: recurringEvent });

      const originalStartTime = '2026-03-25T10:00:00';
      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'no-tz-event',
          modificationScope: 'thisEventOnly',
          originalStartTime,
          summary: 'Updated',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      // Should still format correctly with pattern eventId_YYYYMMDDTHHMMSSZ
      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: expect.stringMatching(/^no-tz-event_20260325T\d{6}Z$/)
        })
      );
    });

    it('should preserve event ID when formatting instance', async () => {
      const longEventId = 'abc123def456ghi789jkl000';
      const recurringEvent = createMockRecurringEvent({ id: longEventId });
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: recurringEvent });

      const originalStartTime = '2026-03-25T10:00:00Z';
      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: longEventId,
          modificationScope: 'thisEventOnly',
          originalStartTime,
          summary: 'Updated',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      // Instance ID should preserve the full event ID before underscore
      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: `${longEventId}_20260325T100000Z`
        })
      );
    });
  });

  describe('RRULE Manipulation', () => {
    // Tests for RRULE updates when using thisAndFollowing scope
    it.todo('should add UNTIL clause when updating future instances');
    it.todo('should remove COUNT pattern when adding UNTIL');
    it.todo('should create new recurring event from future date');
    it.todo('should preserve original event duration in new series');
  });

  describe('Error Handling', () => {
    // Tests for proper RecurringEventError types and error codes
    it.todo('should throw MISSING_ORIGINAL_TIME for thisEventOnly without originalStartTime');
    it.todo('should throw MISSING_FUTURE_DATE for thisAndFollowing without futureStartDate');
    it.todo('should throw INVALID_SCOPE for invalid scope value');
    it.todo('should throw NON_RECURRING_SCOPE for scope on non-recurring event');
  });

  describe('Integration with Tool Framework', () => {
    // Tests for runTool() public method and response format
    it.todo('should return proper CallToolResult from runTool()');
    it.todo('should include event in response for successful updates');
  });
});
