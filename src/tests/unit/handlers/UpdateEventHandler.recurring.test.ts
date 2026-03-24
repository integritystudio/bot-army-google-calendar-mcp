import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { calendar_v3, google } from 'googleapis';
import { UpdateEventHandler } from '../../../handlers/core/UpdateEventHandler.js';

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
    vi.clearAllMocks();

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

    vi.mocked(google.calendar).mockReturnValue(mockCalendar as calendar_v3.Calendar);

    handler = new UpdateEventHandler();
    mockOAuth2Client = {} as OAuth2Client;
  });

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

  function createMockRecurringEvent(overrides: Partial<calendar_v3.Schema$Event> = {}): calendar_v3.Schema$Event {
    return createMockEvent({
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
      ...overrides
    });
  }

  function setupMocks(
    eventData: calendar_v3.Schema$Event,
    insertData?: calendar_v3.Schema$Event
  ): void {
    mockCalendar.events.get.mockResolvedValue({ data: eventData });
    mockCalendar.events.patch.mockResolvedValue({ data: eventData });
    if (insertData != null) {
      mockCalendar.events.insert.mockResolvedValue({ data: insertData });
    }
  }

  describe('Scope Validation', () => {
    it('should accept valid scope: thisEventOnly', async () => {
      setupMocks(createMockRecurringEvent());

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

      expect(result.content[0].type).toBe('text');
      expect(mockCalendar.events.patch).toHaveBeenCalled();
    });

    it('should accept valid scope: thisAndFollowing', async () => {
      setupMocks(createMockRecurringEvent(), createMockRecurringEvent({ id: 'new-event' }));

      const result = await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event123',
          modificationScope: 'thisAndFollowing',
          futureStartDate: '2026-04-01T10:00:00Z',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      expect(result.content[0].type).toBe('text');
      expect(mockCalendar.events.patch).toHaveBeenCalled();
      expect(mockCalendar.events.insert).toHaveBeenCalled();
    });

    it('should accept valid scope: all', async () => {
      setupMocks(createMockRecurringEvent());

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
        expect.objectContaining({ eventId: 'event123' })
      );
    });

    it('should accept undefined scope as "all"', async () => {
      setupMocks(createMockRecurringEvent());

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
      mockCalendar.events.get.mockResolvedValue({ data: createMockRecurringEvent() });

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
      setupMocks(createMockRecurringEvent());

      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'recurring123',
          modificationScope: 'thisEventOnly',
          originalStartTime: '2026-03-25T10:00:00Z',
          summary: 'Updated Single Instance',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'recurring123_20260325T100000Z' })
      );
    });

    it('should handle ISO timestamp with positive timezone offset (+HH:MM)', async () => {
      setupMocks(createMockRecurringEvent());

      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event-with-tz',
          modificationScope: 'thisEventOnly',
          originalStartTime: '2026-03-25T15:30:00+05:30',
          summary: 'Updated',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: expect.stringMatching(/^event-with-tz_\d{8}T\d{6}Z$/)
        })
      );
    });

    it('should handle ISO timestamp with negative timezone offset (-HH:MM)', async () => {
      setupMocks(createMockRecurringEvent());

      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'pst-event',
          modificationScope: 'thisEventOnly',
          originalStartTime: '2026-03-25T05:00:00-08:00',
          summary: 'Updated',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: expect.stringMatching(/^pst-event_\d{8}T\d{6}Z$/)
        })
      );
    });

    it('should handle timestamp without timezone designation', async () => {
      setupMocks(createMockRecurringEvent());

      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'no-tz-event',
          modificationScope: 'thisEventOnly',
          originalStartTime: '2026-03-25T10:00:00',
          summary: 'Updated',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: expect.stringMatching(/^no-tz-event_20260325T\d{6}Z$/)
        })
      );
    });

    it('should preserve event ID when formatting instance', async () => {
      const longEventId = 'abc123def456ghi789jkl000';
      setupMocks(createMockRecurringEvent({ id: longEventId }));

      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: longEventId,
          modificationScope: 'thisEventOnly',
          originalStartTime: '2026-03-25T10:00:00Z',
          summary: 'Updated',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: `${longEventId}_20260325T100000Z` })
      );
    });
  });

  describe('RRULE Manipulation', () => {
    it('should add UNTIL clause when updating future instances', async () => {
      setupMocks(
        createMockRecurringEvent({ recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'] }),
        createMockRecurringEvent({ id: 'new-event' })
      );

      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event123',
          modificationScope: 'thisAndFollowing',
          futureStartDate: '2026-04-01T10:00:00Z',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      const updatedRRule = mockCalendar.events.patch.mock.calls[0][0].requestBody.recurrence[0];
      expect(updatedRRule).toMatch(/UNTIL=\d{8}T\d{6}Z/);
    });

    it('should remove COUNT pattern when adding UNTIL', async () => {
      setupMocks(
        createMockRecurringEvent({ recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10'] }),
        createMockRecurringEvent({ id: 'new-event' })
      );

      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event-with-count',
          modificationScope: 'thisAndFollowing',
          futureStartDate: '2026-04-01T10:00:00Z',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      const updatedRRule = mockCalendar.events.patch.mock.calls[0][0].requestBody.recurrence[0];
      expect(updatedRRule).not.toContain('COUNT=10');
      expect(updatedRRule).toMatch(/UNTIL=/);
    });

    it('should create new recurring event starting from futureStartDate', async () => {
      const futureDate = '2026-04-01T10:00:00Z';
      setupMocks(
        createMockRecurringEvent({
          id: 'original123',
          summary: 'Original Event',
          recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=WE']
        }),
        createMockRecurringEvent({ id: 'future123' })
      );

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

      const newEvent = mockCalendar.events.insert.mock.calls[0][0].requestBody;
      expect(newEvent.start.dateTime).toBe(futureDate);
      expect(newEvent.id).toBeUndefined();
    });

    it('should preserve original event duration in new series', async () => {
      const originalStart = '2026-03-25T10:00:00Z';
      const originalEnd = '2026-03-25T11:30:00Z';
      setupMocks(
        createMockRecurringEvent({
          summary: 'Meeting',
          start: { dateTime: originalStart, timeZone: 'UTC' },
          end: { dateTime: originalEnd, timeZone: 'UTC' },
          recurrence: ['RRULE:FREQ=DAILY']
        }),
        createMockRecurringEvent({ id: 'new-future-event' })
      );

      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'daily-event',
          modificationScope: 'thisAndFollowing',
          futureStartDate: '2026-04-15T14:00:00Z',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      const newEvent = mockCalendar.events.insert.mock.calls[0][0].requestBody;
      const newDurationMs = new Date(newEvent.end.dateTime).getTime() - new Date(newEvent.start.dateTime).getTime();
      const originalDurationMs = new Date(originalEnd).getTime() - new Date(originalStart).getTime();
      expect(newDurationMs).toBe(originalDurationMs);
    });

    it('should remove COUNT and old UNTIL, then add new UNTIL for complex RRULE', async () => {
      setupMocks(
        createMockRecurringEvent({
          recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=20;UNTIL=20270101T000000Z']
        }),
        createMockRecurringEvent({ id: 'new' })
      );

      await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'complex123',
          modificationScope: 'thisAndFollowing',
          futureStartDate: '2026-06-01T10:00:00Z',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      const updatedRRule = mockCalendar.events.patch.mock.calls[0][0].requestBody.recurrence[0];
      expect(updatedRRule).not.toContain('COUNT=20');
      expect(updatedRRule).not.toContain('20270101T000000Z');
      expect(updatedRRule).toMatch(/UNTIL=\d{8}T\d{6}Z$/);
    });
  });

  describe('Error Handling', () => {
    it('should throw for thisEventOnly without originalStartTime', async () => {
      mockCalendar.events.get.mockResolvedValue({ data: createMockRecurringEvent() });

      await expect(() =>
        handler.runTool(
          {
            calendarId: 'primary',
            eventId: 'event123',
            modificationScope: 'thisEventOnly',
            summary: 'Updated',
            checkConflicts: false
          },
          mockOAuth2Client
        )
      ).rejects.toThrow('originalStartTime is required for single instance updates');
    });

    it('should throw for thisAndFollowing without futureStartDate', async () => {
      mockCalendar.events.get.mockResolvedValue({ data: createMockRecurringEvent() });

      await expect(() =>
        handler.runTool(
          {
            calendarId: 'primary',
            eventId: 'event123',
            modificationScope: 'thisAndFollowing',
            summary: 'Updated',
            checkConflicts: false
          },
          mockOAuth2Client
        )
      ).rejects.toThrow('futureStartDate is required for future instance updates');
    });

    it('should throw for non-recurring event with scope thisEventOnly', async () => {
      mockCalendar.events.get.mockResolvedValue({ data: createMockEvent({ recurrence: undefined }) });

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

    it('should throw for non-recurring event with scope thisAndFollowing', async () => {
      mockCalendar.events.get.mockResolvedValue({ data: createMockEvent({ recurrence: undefined }) });

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

    it('should throw when event is not found (404)', async () => {
      mockCalendar.events.get.mockRejectedValue(new Error('Not found'));

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
    it('should return a valid CallToolResult from runTool()', async () => {
      setupMocks(createMockRecurringEvent());

      const result = await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event123',
          summary: 'Updated Event',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(typeof result.content[0].text).toBe('string');
    });

    it('should include "updated" in response text', async () => {
      setupMocks(createMockRecurringEvent({ summary: 'Team Standup' }));

      const result = await handler.runTool(
        {
          calendarId: 'primary',
          eventId: 'event123',
          summary: 'Updated Standup',
          checkConflicts: false
        },
        mockOAuth2Client
      );

      expect(result.content[0].text).toContain('updated');
    });
  });
});
