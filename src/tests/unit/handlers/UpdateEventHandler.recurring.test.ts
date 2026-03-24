import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { calendar_v3, google } from 'googleapis';
import { UpdateEventHandler } from '../../../handlers/core/UpdateEventHandler.js';
import { UpdateEventInput, ToolSchemas } from '../../../tools/registry.js';
import { makeEvent, makeFutureDateString, makeCalendarMock } from '../helpers/factories.js';

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
  let mockCalendar: ReturnType<typeof makeCalendarMock>;
  let mockOAuth2Client: OAuth2Client;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCalendar = makeCalendarMock({
      list: vi.fn().mockResolvedValue({ data: { items: [] } }),
      calendarListGet: vi.fn().mockResolvedValue({ data: { timeZone: 'UTC' } })
    });

    vi.mocked(google.calendar).mockReturnValue(mockCalendar as calendar_v3.Calendar);

    handler = new UpdateEventHandler();
    mockOAuth2Client = {} as OAuth2Client;
  });

  /**
   * Create mock calendar event from production factory with metadata.
   * Uses makeEvent() from factories.ts but adds metadata fields.
   */
  function createMockEvent(overrides: Partial<calendar_v3.Schema$Event> = {}): calendar_v3.Schema$Event {
    return makeEvent({
      id: 'event123',
      created: '2026-03-20T12:00:00.000Z',
      updated: '2026-03-20T12:00:00.000Z',
      etag: '"etag123"',
      ...overrides
    });
  }

  /**
   * Create recurring event with RRULE using production factory.
   */
  function createMockRecurringEvent(overrides: Partial<calendar_v3.Schema$Event> = {}): calendar_v3.Schema$Event {
    return createMockEvent({
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
      ...overrides
    });
  }

  /**
   * Build UpdateEventInput using production Zod schema with validation.
   * Ensures test data conforms to production schema expectations by parsing through Zod.
   * Throws validation errors if inputs violate schema refinements (e.g., thisEventOnly without originalStartTime).
   */
  function buildUpdateEventInput(overrides: Partial<UpdateEventInput> = {}): UpdateEventInput {
    return ToolSchemas['update-event'].parse({
      calendarId: 'primary',
      eventId: 'event123',
      checkConflicts: false,
      ...overrides
    });
  }

  /**
   * Setup mocks for calendar API responses.
   * Configures events.get, events.patch, and optionally events.insert with mock data.
   */
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

      const args: UpdateEventInput = buildUpdateEventInput({
        modificationScope: 'thisEventOnly',
        originalStartTime: '2026-03-25T10:00:00Z',
        summary: 'Updated'
      });

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(result.content[0].type).toBe('text');
      expect(mockCalendar.events.patch).toHaveBeenCalled();
    });

    it('should accept valid scope: thisAndFollowing', async () => {
      setupMocks(createMockRecurringEvent(), createMockRecurringEvent({ id: 'new-event' }));

      const args: UpdateEventInput = buildUpdateEventInput({
        modificationScope: 'thisAndFollowing',
        futureStartDate: makeFutureDateString(8)
      });

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(result.content[0].type).toBe('text');
      expect(mockCalendar.events.patch).toHaveBeenCalled();
      expect(mockCalendar.events.insert).toHaveBeenCalled();
    });

    it('should accept valid scope: all', async () => {
      setupMocks(createMockRecurringEvent());

      const args: UpdateEventInput = buildUpdateEventInput({
        modificationScope: 'all',
        summary: 'Updated All Instances'
      });

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(result.content).toBeDefined();
      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'event123' })
      );
    });

    it('should accept undefined scope as "all"', async () => {
      setupMocks(createMockRecurringEvent());

      const args: UpdateEventInput = buildUpdateEventInput({
        summary: 'Updated'
      });

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(result.content).toBeDefined();
      expect(mockCalendar.events.patch).toHaveBeenCalled();
    });

    it('should reject invalid scope values', () => {
      // Test Zod schema validation directly - invalid scope is caught during parse
      expect(() =>
        ToolSchemas['update-event'].parse({
          calendarId: 'primary',
          eventId: 'event123',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          modificationScope: 'invalid-scope' as any, // intentionally invalid to test schema validation
          summary: 'Updated',
          checkConflicts: false
        })
      ).toThrow();
    });
  });

  describe('Instance ID Formatting', () => {
    it('should format instance ID correctly for single instance updates', async () => {
      setupMocks(createMockRecurringEvent());

      const args: UpdateEventInput = buildUpdateEventInput({
        eventId: 'recurring123',
        modificationScope: 'thisEventOnly',
        originalStartTime: '2026-03-25T10:00:00Z',
        summary: 'Updated Single Instance'
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'recurring123_20260325T100000Z' })
      );
    });

    it('should handle ISO timestamp with positive timezone offset (+HH:MM)', async () => {
      setupMocks(createMockRecurringEvent());

      const args: UpdateEventInput = buildUpdateEventInput({
        eventId: 'event-with-tz',
        modificationScope: 'thisEventOnly',
        originalStartTime: '2026-03-25T15:30:00+05:30',
        summary: 'Updated'
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: expect.stringMatching(/^event-with-tz_\d{8}T\d{6}Z$/)
        })
      );
    });

    it('should handle ISO timestamp with negative timezone offset (-HH:MM)', async () => {
      setupMocks(createMockRecurringEvent());

      const args: UpdateEventInput = buildUpdateEventInput({
        eventId: 'pst-event',
        modificationScope: 'thisEventOnly',
        originalStartTime: '2026-03-25T05:00:00-08:00',
        summary: 'Updated'
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: expect.stringMatching(/^pst-event_\d{8}T\d{6}Z$/)
        })
      );
    });

    it('should handle timestamp without timezone designation', async () => {
      setupMocks(createMockRecurringEvent());

      const args: UpdateEventInput = buildUpdateEventInput({
        eventId: 'no-tz-event',
        modificationScope: 'thisEventOnly',
        originalStartTime: '2026-03-25T10:00:00',
        summary: 'Updated'
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: expect.stringMatching(/^no-tz-event_20260325T\d{6}Z$/)
        })
      );
    });

    it('should preserve event ID when formatting instance', async () => {
      const longEventId = 'abc123def456ghi789jkl000';
      setupMocks(createMockRecurringEvent({ id: longEventId }));

      const args: UpdateEventInput = buildUpdateEventInput({
        eventId: longEventId,
        modificationScope: 'thisEventOnly',
        originalStartTime: '2026-03-25T10:00:00Z',
        summary: 'Updated'
      });

      await handler.runTool(args, mockOAuth2Client);

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

      const args: UpdateEventInput = buildUpdateEventInput({
        modificationScope: 'thisAndFollowing',
        futureStartDate: makeFutureDateString(8)
      });

      await handler.runTool(args, mockOAuth2Client);

      const updatedRRule = mockCalendar.events.patch.mock.calls[0][0].requestBody.recurrence[0];
      expect(updatedRRule).toMatch(/UNTIL=\d{8}T\d{6}Z/);
    });

    it('should remove COUNT pattern when adding UNTIL', async () => {
      setupMocks(
        createMockRecurringEvent({ recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10'] }),
        createMockRecurringEvent({ id: 'new-event' })
      );

      const args: UpdateEventInput = buildUpdateEventInput({
        eventId: 'event-with-count',
        modificationScope: 'thisAndFollowing',
        futureStartDate: makeFutureDateString(8)
      });

      await handler.runTool(args, mockOAuth2Client);

      const updatedRRule = mockCalendar.events.patch.mock.calls[0][0].requestBody.recurrence[0];
      expect(updatedRRule).not.toContain('COUNT=10');
      expect(updatedRRule).toMatch(/UNTIL=/);
    });

    it('should create new recurring event starting from futureStartDate', async () => {
      const futureDate = makeFutureDateString(8);
      setupMocks(
        createMockRecurringEvent({
          id: 'original123',
          summary: 'Original Event',
          recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=WE']
        }),
        createMockRecurringEvent({ id: 'future123' })
      );

      const args: UpdateEventInput = buildUpdateEventInput({
        eventId: 'original123',
        modificationScope: 'thisAndFollowing',
        futureStartDate: futureDate
      });

      await handler.runTool(args, mockOAuth2Client);

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

      const args: UpdateEventInput = buildUpdateEventInput({
        eventId: 'daily-event',
        modificationScope: 'thisAndFollowing',
        futureStartDate: makeFutureDateString(22)
      });

      await handler.runTool(args, mockOAuth2Client);

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

      const args: UpdateEventInput = buildUpdateEventInput({
        eventId: 'complex123',
        modificationScope: 'thisAndFollowing',
        futureStartDate: makeFutureDateString(69)
      });

      await handler.runTool(args, mockOAuth2Client);

      const updatedRRule = mockCalendar.events.patch.mock.calls[0][0].requestBody.recurrence[0];
      expect(updatedRRule).not.toContain('COUNT=20');
      expect(updatedRRule).not.toContain('20270101T000000Z');
      expect(updatedRRule).toMatch(/UNTIL=\d{8}T\d{6}Z$/);
    });
  });

  describe('Error Handling', () => {
    it('should throw for thisEventOnly without originalStartTime', () => {
      // Test Zod schema refinement directly - buildUpdateEventInput now validates schema
      expect(() =>
        ToolSchemas['update-event'].parse({
          calendarId: 'primary',
          eventId: 'event123',
          modificationScope: 'thisEventOnly',
          summary: 'Updated',
          checkConflicts: false
        })
      ).toThrow();
    });

    it('should throw for thisAndFollowing without futureStartDate', () => {
      // Test Zod schema refinement directly - buildUpdateEventInput now validates schema
      expect(() =>
        ToolSchemas['update-event'].parse({
          calendarId: 'primary',
          eventId: 'event123',
          modificationScope: 'thisAndFollowing',
          summary: 'Updated',
          checkConflicts: false
        })
      ).toThrow();
    });

    it('should throw for non-recurring event with scope thisEventOnly', async () => {
      setupMocks(createMockEvent({ recurrence: undefined }));

      const args: UpdateEventInput = buildUpdateEventInput({
        eventId: 'single123',
        modificationScope: 'thisEventOnly',
        originalStartTime: '2026-03-25T10:00:00Z'
      });

      await expect(() =>
        handler.runTool(args, mockOAuth2Client)
      ).rejects.toThrow('Scope other than "all" only applies to recurring events');
    });

    it('should throw for non-recurring event with scope thisAndFollowing', async () => {
      setupMocks(createMockEvent({ recurrence: undefined }));

      const args: UpdateEventInput = buildUpdateEventInput({
        eventId: 'single123',
        modificationScope: 'thisAndFollowing',
        futureStartDate: makeFutureDateString(8)
      });

      await expect(() =>
        handler.runTool(args, mockOAuth2Client)
      ).rejects.toThrow('Scope other than "all" only applies to recurring events');
    });

    it('should throw when event is not found (404)', async () => {
      // Cannot use setupMocks since we need to reject, not resolve
      mockCalendar.events.get.mockRejectedValue(new Error('Not found'));

      const args: UpdateEventInput = buildUpdateEventInput({
        eventId: 'nonexistent123',
        summary: 'Updated'
      });

      await expect(() =>
        handler.runTool(args, mockOAuth2Client)
      ).rejects.toThrow();
    });
  });

  describe('Integration with Tool Framework', () => {
    it('should return a valid CallToolResult from runTool()', async () => {
      setupMocks(createMockRecurringEvent());

      const args: UpdateEventInput = buildUpdateEventInput({
        summary: 'Updated Event'
      });

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(typeof result.content[0].text).toBe('string');
    });

    it('should include "updated" in response text', async () => {
      setupMocks(createMockRecurringEvent({ summary: 'Team Standup' }));

      const args: UpdateEventInput = buildUpdateEventInput({
        summary: 'Updated Standup'
      });

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(result.content[0].text).toContain('updated');
    });
  });
});
