import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateEventHandler } from '../../../handlers/core/CreateEventHandler.js';
import { OAuth2Client } from 'google-auth-library';
import { makeEvent, getTextContent, createCreateEventArgs, makeCalendarMock, createConflictEventArgs, createFullEventArgs, STANDARD_ATTACHMENTS } from '../helpers/index.js';
import type { ConflictCheckResult } from '../../../services/conflict-detection/types.js';
import { performConflictCheck } from '../../../handlers/core/eventManipulationUtils.js';

// Mock the googleapis module
vi.mock('googleapis', () => ({
  google: {
    calendar: vi.fn(() => ({
      events: {
        insert: vi.fn()
      }
    }))
  },
  calendar_v3: {}
}));

// Mock conflict detection so tests don't exercise real API calls
vi.mock('../../../handlers/core/eventManipulationUtils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../handlers/core/eventManipulationUtils.js')>();
  return {
    ...actual,
    performConflictCheck: vi.fn().mockResolvedValue({
      hasConflicts: false,
      conflicts: [],
      duplicates: []
    } satisfies ConflictCheckResult)
  };
});

// Mock the event ID validator
vi.mock('../../../utils/event-id-validator.js', () => ({
  validateEventId: vi.fn((eventId: string) => {
    if (eventId && eventId.length < 5 || eventId.length > 1024) {
      throw new Error(`Invalid event ID: length must be between 5 and 1024 characters`);
    }
    if (eventId && !/^[a-zA-Z0-9-]+$/.test(eventId)) {
      throw new Error(`Invalid event ID: can only contain letters, numbers, and hyphens`);
    }
  })
}));


describe('CreateEventHandler', () => {
  let handler: CreateEventHandler;
  let mockOAuth2Client: OAuth2Client;
  let mockCalendar: ReturnType<typeof makeCalendarMock>;
  let getCalendarTimezoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    handler = new CreateEventHandler();
    mockOAuth2Client = new OAuth2Client();

    mockCalendar = makeCalendarMock();

    // Mock the getCalendar method
    vi.spyOn(handler as any, 'getCalendar').mockReturnValue(mockCalendar);

    // Mock getCalendarTimezone
    getCalendarTimezoneSpy = vi.spyOn(handler as any, 'getCalendarTimezone').mockResolvedValue('America/Los_Angeles');
  });

  describe('Basic Event Creation', () => {
    const FULL_EVENT = createFullEventArgs();

    it('should create an event without custom ID', async () => {
      const mockCreatedEvent = makeEvent({
        id: 'generated-id-123',
        htmlLink: 'https://calendar.google.com/event?eid=abc123'
      });

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs();

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalledWith({
        calendarId: 'primary',
        requestBody: expect.objectContaining({
          summary: 'Test Event',
          start: { dateTime: '2025-01-15T10:00:00', timeZone: 'America/Los_Angeles' },
          end: { dateTime: '2025-01-15T11:00:00', timeZone: 'America/Los_Angeles' }
        })
      });

      // Should not include id field when no custom ID provided
      expect(mockCalendar.events.insert.mock.calls[0][0].requestBody.id).toBeUndefined();

      expect(result.content[0].type).toBe('text');
      const textContent = getTextContent(result);
      expect(textContent).toContain('Event created successfully!');
      expect(textContent).toContain('Test Event');
    });

    it('should create event with all basic optional fields', async () => {
      const mockCreatedEvent = makeEvent(FULL_EVENT);

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs('primary', FULL_EVENT);

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalledWith({
        calendarId: 'primary',
        requestBody: expect.objectContaining({
          id: 'full-event',
          summary: 'Full Event',
          description: 'Event description',
          location: 'Conference Room A',
          attendees: [{ email: 'test@example.com' }],
          colorId: '5',
          reminders: {
            useDefault: false,
            overrides: [{ method: 'email', minutes: 30 }]
          }
        })
      });

      const textContent = getTextContent(result);
      expect(textContent).toContain('Event created successfully!');
    });
  });

  describe('Custom Event IDs', () => {
    it('should create an event with custom ID', async () => {
      const mockCreatedEvent = makeEvent({
        id: 'customevent2025',
        htmlLink: 'https://calendar.google.com/event?eid=abc123'
      });

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs('primary', {
        eventId: 'customevent2025'
      });

      const result = await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalledWith({
        calendarId: 'primary',
        requestBody: expect.objectContaining({
          id: 'customevent2025',
          summary: 'Test Event',
          start: { dateTime: '2025-01-15T10:00:00', timeZone: 'America/Los_Angeles' },
          end: { dateTime: '2025-01-15T11:00:00', timeZone: 'America/Los_Angeles' }
        })
      });

      const textContent = getTextContent(result);
      expect(textContent).toContain('Event created successfully!');
    });

    it('should validate event ID before making API call', async () => {
      const args = {
        calendarId: 'primary',
        eventId: 'abc', // Too short (< 5 chars)
        summary: 'Test Event',
        start: '2025-01-15T10:00:00',
        end: '2025-01-15T11:00:00'
      };

      await expect(handler.runTool(args, mockOAuth2Client)).rejects.toThrow(
        'Invalid event ID: length must be between 5 and 1024 characters'
      );

      // Should not call the API if validation fails
      expect(mockCalendar.events.insert).not.toHaveBeenCalled();
    });

    it('should handle invalid custom event ID', async () => {
      const args = {
        calendarId: 'primary',
        eventId: 'bad id', // Contains space
        summary: 'Test Event',
        start: '2025-01-15T10:00:00',
        end: '2025-01-15T11:00:00'
      };

      await expect(handler.runTool(args, mockOAuth2Client)).rejects.toThrow(
        'Invalid event ID: can only contain letters, numbers, and hyphens'
      );

      expect(mockCalendar.events.insert).not.toHaveBeenCalled();
    });

    it('should handle event ID conflict (409 error)', async () => {
      const conflictError = new Error('Conflict');
      (conflictError as any).code = 409;
      mockCalendar.events.insert.mockRejectedValue(conflictError);

      const args = createConflictEventArgs('existing-event');

      await expect(handler.runTool(args, mockOAuth2Client)).rejects.toThrow(
        "Event ID 'existing-event' already exists. Please use a different ID."
      );
    });

    it('should handle event ID conflict with response status', async () => {
      const conflictError = new Error('Conflict');
      (conflictError as any).response = { status: 409 };
      mockCalendar.events.insert.mockRejectedValue(conflictError);

      const args = createConflictEventArgs('existing-event');

      await expect(handler.runTool(args, mockOAuth2Client)).rejects.toThrow(
        "Event ID 'existing-event' already exists. Please use a different ID."
      );
    });
  });

  describe('Guest Management Properties', () => {
    it('should create event with transparency setting', async () => {
      const mockCreatedEvent = makeEvent({
        summary: 'Focus Time',
        transparency: 'transparent'
      });

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs('primary', {
        summary: 'Focus Time',
        transparency: 'transparent' as const
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            transparency: 'transparent'
          })
        })
      );
    });

    it('should create event with visibility settings', async () => {
      const mockCreatedEvent = makeEvent({
        summary: 'Private Meeting',
        visibility: 'private'
      });

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs('primary', {
        summary: 'Private Meeting',
        visibility: 'private' as const
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            visibility: 'private'
          })
        })
      );
    });

    it('should create event with guest permissions', async () => {
      const mockCreatedEvent = makeEvent({
        summary: 'Team Meeting'
      });

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs('primary', {
        summary: 'Team Meeting',
        guestsCanInviteOthers: false,
        guestsCanModify: true,
        guestsCanSeeOtherGuests: false,
        anyoneCanAddSelf: true
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            guestsCanInviteOthers: false,
            guestsCanModify: true,
            guestsCanSeeOtherGuests: false,
            anyoneCanAddSelf: true
          })
        })
      );
    });

    it('should send update notifications when specified', async () => {
      const mockCreatedEvent = makeEvent({
        summary: 'Meeting'
      });

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs('primary', {
        summary: 'Meeting',
        sendUpdates: 'externalOnly' as const
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          sendUpdates: 'externalOnly'
        })
      );
    });
  });

  describe('Conference Data', () => {
    it('should create event with conference data', async () => {
      const mockCreatedEvent = makeEvent({
        summary: 'Video Call',
        conferenceData: {
          entryPoints: [{ uri: 'https://meet.google.com/abc-defg-hij' }]
        }
      });

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs('primary', {
        summary: 'Video Call',
        conferenceData: {
          createRequest: {
            requestId: 'unique-request-123',
            conferenceSolutionKey: {
              type: 'hangoutsMeet' as const
            }
          }
        }
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            conferenceData: {
              createRequest: {
                requestId: 'unique-request-123',
                conferenceSolutionKey: {
                  type: 'hangoutsMeet'
                }
              }
            }
          }),
          conferenceDataVersion: 1
        })
      );
    });
  });

  describe('Extended Properties', () => {
    const EXTENDED_PROPS = {
      private: {
        'appId': '12345',
        'customField': 'value1'
      },
      shared: {
        'projectId': 'proj-789',
        'category': 'meeting'
      }
    };

    it('should create event with extended properties', async () => {
      const mockCreatedEvent = makeEvent({
        summary: 'Custom Event'
      });

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs('primary', {
        summary: 'Custom Event',
        extendedProperties: EXTENDED_PROPS
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            extendedProperties: EXTENDED_PROPS
          })
        })
      );
    });
  });

  describe('Attachments', () => {
    const ATTACHMENTS = STANDARD_ATTACHMENTS;

    it('should create event with attachments', async () => {
      const mockCreatedEvent = makeEvent({
        summary: 'Meeting with Docs'
      });

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs('primary', {
        summary: 'Meeting with Docs',
        attachments: ATTACHMENTS
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            attachments: ATTACHMENTS
          }),
          supportsAttachments: true
        })
      );
    });
  });

  describe('Enhanced Attendees', () => {
    it('should create event with detailed attendee information', async () => {
      const mockCreatedEvent = makeEvent({
        summary: 'Team Sync'
      });

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs('primary', {
        summary: 'Team Sync',
        attendees: [
          {
            email: 'alice@example.com',
            displayName: 'Alice Smith',
            optional: false,
            responseStatus: 'accepted' as const
          },
          {
            email: 'bob@example.com',
            displayName: 'Bob Jones',
            optional: true,
            responseStatus: 'needsAction' as const,
            comment: 'May join late',
            additionalGuests: 2
          }
        ]
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            attendees: [
              {
                email: 'alice@example.com',
                displayName: 'Alice Smith',
                optional: false,
                responseStatus: 'accepted'
              },
              {
                email: 'bob@example.com',
                displayName: 'Bob Jones',
                optional: true,
                responseStatus: 'needsAction',
                comment: 'May join late',
                additionalGuests: 2
              }
            ]
          })
        })
      );
    });
  });

  describe('Source Property', () => {
    it('should create event with source information', async () => {
      const mockCreatedEvent = makeEvent({
        summary: 'Follow-up Meeting'
      });

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs('primary', {
        summary: 'Follow-up Meeting',
        source: {
          url: 'https://example.com/meetings/123',
          title: 'Original Meeting Request'
        }
      });

      await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            source: {
              url: 'https://example.com/meetings/123',
              title: 'Original Meeting Request'
            }
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors other than 409', async () => {
      const apiError = new Error('API Error');
      (apiError as any).code = 500;
      mockCalendar.events.insert.mockRejectedValue(apiError);

      const args = createCreateEventArgs();

      // Mock handleGoogleApiError
      vi.spyOn(handler as any, 'handleGoogleApiError').mockImplementation(() => {
        throw new Error('Handled API Error');
      });

      await expect(handler.runTool(args, mockOAuth2Client)).rejects.toThrow('Handled API Error');
    });

    it('should handle missing response data', async () => {
      mockCalendar.events.insert.mockResolvedValue({ data: null });

      const args = createCreateEventArgs();

      await expect(handler.runTool(args, mockOAuth2Client)).rejects.toThrow(
        'Failed to create event, no data returned'
      );
    });
  });

  describe('Combined Properties', () => {
    it('should create event with multiple enhanced properties', async () => {
      const mockCreatedEvent = makeEvent({
        summary: 'Complex Event'
      });

      mockCalendar.events.insert.mockResolvedValue({ data: mockCreatedEvent });

      const args = createCreateEventArgs('primary', {
        eventId: 'customcomplexevent',
        summary: 'Complex Event',
        description: 'An event with all features',
        location: 'Conference Room A',
        transparency: 'opaque' as const,
        visibility: 'public' as const,
        guestsCanInviteOthers: true,
        guestsCanModify: false,
        conferenceData: {
          createRequest: {
            requestId: 'conf-123',
            conferenceSolutionKey: {
              type: 'hangoutsMeet' as const
            }
          }
        },
        attendees: [
          {
            email: 'team@example.com',
            displayName: 'Team',
            optional: false
          }
        ],
        extendedProperties: {
          private: {
            'trackingId': '789'
          }
        },
        source: {
          url: 'https://example.com/source',
          title: 'Source System'
        },
        sendUpdates: 'all' as const
      });

      await handler.runTool(args, mockOAuth2Client);

      const callArgs = mockCalendar.events.insert.mock.calls[0][0];
      
      expect(callArgs.requestBody).toMatchObject({
        id: 'customcomplexevent',
        summary: 'Complex Event',
        description: 'An event with all features',
        location: 'Conference Room A',
        transparency: 'opaque',
        visibility: 'public',
        guestsCanInviteOthers: true,
        guestsCanModify: false
      });
      
      expect(callArgs.conferenceDataVersion).toBe(1);
      expect(callArgs.sendUpdates).toBe('all');
    });
  });

  describe('Timezone Resolution', () => {
    it('should not call getCalendarTimezone when args.timeZone is provided', async () => {
      mockCalendar.events.insert.mockResolvedValue({ data: makeEvent({ id: 'tz-event' }) });

      const args = createCreateEventArgs('primary', { timeZone: 'Europe/London' } as any);
      await handler.runTool(args, mockOAuth2Client);

      expect(getCalendarTimezoneSpy).not.toHaveBeenCalled();
    });

    it('should call getCalendarTimezone when args.timeZone is absent', async () => {
      mockCalendar.events.insert.mockResolvedValue({ data: makeEvent({ id: 'tz-event' }) });

      const args = createCreateEventArgs();
      await handler.runTool(args, mockOAuth2Client);

      expect(getCalendarTimezoneSpy).toHaveBeenCalled();
    });
  });

  describe('Conflict Detection', () => {
    const mockPerformConflictCheck = vi.mocked(performConflictCheck);

    const EMPTY_CONFLICTS: ConflictCheckResult = { hasConflicts: false, conflicts: [], duplicates: [] };

    const BLOCKING_DUPLICATE: ConflictCheckResult = {
      hasConflicts: true,
      conflicts: [],
      duplicates: [
        {
          event: { id: 'dup-event-001', title: 'Test Event', similarity: 0.97 },
          suggestion: 'This appears to be a duplicate. Consider updating the existing event instead.'
        }
      ]
    };

    const NON_BLOCKING_CONFLICT: ConflictCheckResult = {
      hasConflicts: true,
      conflicts: [
        {
          type: 'overlap',
          calendar: 'primary',
          event: { id: 'other-event', title: 'Other Meeting' }
        }
      ],
      duplicates: []
    };

    beforeEach(() => {
      mockPerformConflictCheck.mockResolvedValue(EMPTY_CONFLICTS);
    });

    it('should block creation when a blocking duplicate is detected', async () => {
      mockPerformConflictCheck.mockResolvedValue(BLOCKING_DUPLICATE);

      const args = createCreateEventArgs();
      const result = await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).not.toHaveBeenCalled();
      const text = getTextContent(result);
      expect(text).toContain('DUPLICATE EVENT DETECTED');
      expect(text).toContain('97%');
      expect(text).toContain('allowDuplicates');
    });

    it('should create event when allowDuplicates bypasses the blocking duplicate', async () => {
      mockPerformConflictCheck.mockResolvedValue(BLOCKING_DUPLICATE);
      mockCalendar.events.insert.mockResolvedValue({ data: makeEvent({ id: 'new-event' }) });

      const args = createCreateEventArgs('primary', { allowDuplicates: true } as any);
      const result = await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalled();
      expect(getTextContent(result)).toContain('Event created');
    });

    it('should include conflict warning in response when non-blocking conflicts exist', async () => {
      mockPerformConflictCheck.mockResolvedValue(NON_BLOCKING_CONFLICT);
      mockCalendar.events.insert.mockResolvedValue({ data: makeEvent({ id: 'new-event' }) });

      const args = createCreateEventArgs();
      const result = await handler.runTool(args, mockOAuth2Client);

      expect(mockCalendar.events.insert).toHaveBeenCalled();
      expect(getTextContent(result)).toContain('Event created with warnings!');
    });

    it('should pass calendarsToCheck and duplicateSimilarityThreshold to conflict check', async () => {
      mockCalendar.events.insert.mockResolvedValue({ data: makeEvent({ id: 'new-event' }) });

      const args = createCreateEventArgs('primary', {
        calendarsToCheck: ['primary', 'work@example.com'],
        duplicateSimilarityThreshold: 0.8
      } as any);

      await handler.runTool(args, mockOAuth2Client);

      expect(mockPerformConflictCheck).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'primary',
        expect.objectContaining({
          calendarsToCheck: ['primary', 'work@example.com'],
          duplicateSimilarityThreshold: 0.8
        })
      );
    });
  });
});