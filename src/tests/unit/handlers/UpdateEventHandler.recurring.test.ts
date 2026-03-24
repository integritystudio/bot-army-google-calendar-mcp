import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { calendar_v3, google } from 'googleapis';
import { UpdateEventHandler } from '../../../handlers/core/UpdateEventHandler.js';

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
  let mockCalendar: Partial<calendar_v3.Calendar>;
  let mockOAuth2Client: OAuth2Client;

  beforeEach(() => {
    // Clear mocks first to prevent previous test state from bleeding in
    vi.clearAllMocks();

    // Realistic mock calendar API matching Google Calendar v3 structure
    mockCalendar = {
      events: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        list: vi.fn().mockResolvedValue({ data: { items: [] } })
      },
      calendarList: {
        get: vi.fn().mockResolvedValue({ data: { timeZone: 'UTC' } })
      }
    };

    // Mock google.calendar to return our mock calendar
    vi.mocked(google.calendar).mockReturnValue(mockCalendar as calendar_v3.Calendar);

    handler = new UpdateEventHandler();
    mockOAuth2Client = {} as OAuth2Client;
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
    it('should add UNTIL clause when updating future instances', async () => {
      const weeklyEvent = createMockRecurringEvent({
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO']
      });
      mockCalendar.events.get.mockResolvedValue({ data: weeklyEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: weeklyEvent });
      mockCalendar.events.insert.mockResolvedValue({ data: createMockRecurringEvent({ id: 'new-event' }) });

      const futureDate = '2026-04-01T10:00:00Z';
      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event123',
          modificationScope: 'thisAndFollowing',
          futureStartDate: futureDate,
          checkConflicts: false
        },
        mockOAuth2Client
      );

      // Verify patch was called with UNTIL clause
      const patchCall = mockCalendar.events.patch.mock.calls[0];
      const updatedRRule = patchCall[0].requestBody.recurrence[0];

      // Should have UNTIL pattern like RRULE:...; UNTIL=20260331T235959Z
      expect(updatedRRule).toMatch(/UNTIL=\d{8}T\d{6}Z/);
    });

    it('should remove COUNT pattern when adding UNTIL', async () => {
      const countEvent = createMockRecurringEvent({
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10']
      });
      mockCalendar.events.get.mockResolvedValue({ data: countEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: countEvent });
      mockCalendar.events.insert.mockResolvedValue({ data: createMockRecurringEvent({ id: 'new-event' }) });

      const futureDate = '2026-04-01T10:00:00Z';
      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event-with-count',
          modificationScope: 'thisAndFollowing',
          futureStartDate: futureDate,
          checkConflicts: false
        },
        mockOAuth2Client
      );

      // Verify patch was called and COUNT was removed
      const patchCall = mockCalendar.events.patch.mock.calls[0];
      const updatedRRule = patchCall[0].requestBody.recurrence[0];

      expect(updatedRRule).not.toContain('COUNT=10');
      expect(updatedRRule).toMatch(/UNTIL=/);
    });

    it('should create new recurring event from future date', async () => {
      const originalEvent = createMockRecurringEvent({
        id: 'original123',
        summary: 'Original Event',
        start: { dateTime: '2026-03-25T10:00:00Z', timeZone: 'UTC' },
        end: { dateTime: '2026-03-25T11:00:00Z', timeZone: 'UTC' },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=WE']
      });
      mockCalendar.events.get.mockResolvedValue({ data: originalEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: originalEvent });
      mockCalendar.events.insert.mockResolvedValue({ data: createMockRecurringEvent({ id: 'future123' }) });

      const futureDate = '2026-04-01T10:00:00Z';
      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'original123',
          modificationScope: 'thisAndFollowing',
          futureStartDate: futureDate,
          checkConflicts: false
        },
        mockOAuth2Client
      );

      // Verify insert was called to create new event
      expect(mockCalendar.events.insert).toHaveBeenCalled();
      const insertCall = mockCalendar.events.insert.mock.calls[0];
      const newEvent = insertCall[0].requestBody;

      // New event should start on futureDate
      expect(newEvent.start.dateTime).toBe(futureDate);
      // Should not have original ID (deleted fields)
      expect(newEvent.id).toBeUndefined();
    });

    it('should preserve original event duration in new series', async () => {
      const originalEvent = createMockRecurringEvent({
        summary: 'Meeting',
        start: { dateTime: '2026-03-25T10:00:00Z', timeZone: 'UTC' },
        end: { dateTime: '2026-03-25T11:30:00Z', timeZone: 'UTC' }, // 1.5 hour duration
        recurrence: ['RRULE:FREQ=DAILY']
      });
      mockCalendar.events.get.mockResolvedValue({ data: originalEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: originalEvent });
      mockCalendar.events.insert.mockResolvedValue({ data: createMockRecurringEvent({ id: 'new-future-event' }) });

      const futureDate = '2026-04-15T14:00:00Z';
      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'daily-event',
          modificationScope: 'thisAndFollowing',
          futureStartDate: futureDate,
          checkConflicts: false
        },
        mockOAuth2Client
      );

      // Verify new event preserves duration
      const insertCall = mockCalendar.events.insert.mock.calls[0];
      const newEvent = insertCall[0].requestBody;

      // Original duration: 11:30 - 10:00 = 1.5 hours = 5400 seconds
      // New event end should be: 14:00 + 1.5 hours = 15:30
      const newStart = new Date(newEvent.start.dateTime);
      const newEnd = new Date(newEvent.end.dateTime);
      const durationMs = newEnd.getTime() - newStart.getTime();
      const originalDurationMs = 1.5 * 60 * 60 * 1000; // 1.5 hours

      expect(durationMs).toBe(originalDurationMs);
    });

    it('should handle multiple RRULE patterns and clean all removable parts', async () => {
      const complexEvent = createMockRecurringEvent({
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=20;UNTIL=20270101T000000Z']
      });
      mockCalendar.events.get.mockResolvedValue({ data: complexEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: complexEvent });
      mockCalendar.events.insert.mockResolvedValue({ data: createMockRecurringEvent({ id: 'new' }) });

      const futureDate = '2026-06-01T10:00:00Z';
      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'complex123',
          modificationScope: 'thisAndFollowing',
          futureStartDate: futureDate,
          checkConflicts: false
        },
        mockOAuth2Client
      );

      // Verify both COUNT and old UNTIL were removed, new UNTIL added
      const patchCall = mockCalendar.events.patch.mock.calls[0];
      const updatedRRule = patchCall[0].requestBody.recurrence[0];

      expect(updatedRRule).not.toContain('COUNT=20');
      expect(updatedRRule).not.toContain('20270101T000000Z'); // Old UNTIL removed
      expect(updatedRRule).toMatch(/UNTIL=\d{8}T\d{6}Z$/); // New UNTIL added at end
    });
  });

  describe('Error Handling', () => {
    it('should throw MISSING_ORIGINAL_TIME for thisEventOnly without originalStartTime', async () => {
      const recurringEvent = createMockRecurringEvent();
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });

      await expect(() =>
        handler.runTool(
          {
            calendarId: 'primary',
            eventId: 'event123',
            modificationScope: 'thisEventOnly',
            // Missing originalStartTime
            summary: 'Updated',
            checkConflicts: false
          },
          mockOAuth2Client
        )
      ).rejects.toThrow('originalStartTime is required for single instance updates');
    });

    it('should throw MISSING_FUTURE_DATE for thisAndFollowing without futureStartDate', async () => {
      const recurringEvent = createMockRecurringEvent();
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });

      await expect(() =>
        handler.runTool(
          {
            calendarId: 'primary',
            eventId: 'event123',
            modificationScope: 'thisAndFollowing',
            // Missing futureStartDate
            summary: 'Updated',
            checkConflicts: false
          },
          mockOAuth2Client
        )
      ).rejects.toThrow('futureStartDate is required for future instance updates');
    });

    it('should throw error for non-recurring event with scope thisEventOnly', async () => {
      const singleEvent = createMockEvent({ recurrence: undefined });
      mockCalendar.events.get.mockResolvedValue({ data: singleEvent });

      await expect(() =>
        handler.runTool(
          {
            calendarId: 'primary',
            eventId: 'single123',
            modificationScope: 'thisEventOnly',
            originalStartTime: '2026-03-25T10:00:00Z',
            checkConflicts: false
          },
          mockOAuth2Client
        )
      ).rejects.toThrow('Scope other than "all" only applies to recurring events');
    });

    it('should throw error for non-recurring event with scope thisAndFollowing', async () => {
      const singleEvent = createMockEvent({ recurrence: undefined });
      mockCalendar.events.get.mockResolvedValue({ data: singleEvent });

      await expect(() =>
        handler.runTool(
          {
            calendarId: 'primary',
            eventId: 'single123',
            modificationScope: 'thisAndFollowing',
            futureStartDate: '2026-04-01T10:00:00Z',
            checkConflicts: false
          },
          mockOAuth2Client
        )
      ).rejects.toThrow('Scope other than "all" only applies to recurring events');
    });

    it('should handle missing event (404 from API)', async () => {
      mockCalendar.events.get.mockRejectedValue(
        new Error('Not found')
      );

      await expect(() =>
        handler.runTool(
          {
            calendarId: 'primary',
            eventId: 'nonexistent123',
            summary: 'Updated',
            checkConflicts: false
          },
          mockOAuth2Client
        )
      ).rejects.toThrow();
    });
  });

  describe('Integration with Tool Framework', () => {
    it('should return proper CallToolResult from runTool()', async () => {
      const recurringEvent = createMockRecurringEvent();
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: recurringEvent });

      const result = await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event123',
          summary: 'Updated Event',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      // Verify CallToolResult structure
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
      expect(typeof result.content[0].text).toBe('string');
    });

    it('should include event summary in response text', async () => {
      const eventSummary = 'Team Standup';
      const recurringEvent = createMockRecurringEvent({
        summary: eventSummary
      });
      mockCalendar.events.get.mockResolvedValue({ data: recurringEvent });
      mockCalendar.events.patch.mockResolvedValue({ data: recurringEvent });

      const result = await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event123',
          summary: 'Updated Standup',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      // Response text should mention the updated event
      expect(result.content[0].text).toContain('updated');
      expect(typeof result.content[0].text).toBe('string');
    });
  });
});
