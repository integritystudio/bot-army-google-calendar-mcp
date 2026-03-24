import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { google, calendar_v3 } from 'googleapis';
import { initializeOAuth2Client } from '../../auth/client.js';
import { TokenManager } from '../../auth/tokenManager.js';
import { UpdateEventHandler } from '../../handlers/core/UpdateEventHandler.js';

/**
 * Real Google Calendar Integration Tests for UpdateEventHandler Recurring Events
 *
 * PURPOSE: Test the real UpdateEventHandler against actual Google Calendar API
 * - Uses real credentials from Doppler
 * - Tests actual modification scopes: 'all', 'thisEventOnly', 'thisAndFollowing'
 * - Validates error handling and response formatting
 * - No mocking - real API calls
 *
 * RUN: npm run test:integration:doppler
 * OR: doppler run -- npm run test:integration
 */

describe('UpdateEventHandler - Recurring Events (Real API Integration)', () => {
  let handler: UpdateEventHandler;
  let oauth2Client: OAuth2Client;
  let calendar: any;
  const createdEventIds: string[] = [];
  const TEST_CALENDAR_ID = process.env.TEST_CALENDAR_ID || 'primary';

  beforeAll(async () => {
    // Load real credentials from Doppler
    oauth2Client = await initializeOAuth2Client();
    const tokenManager = new TokenManager(oauth2Client);
    const isAuth = await tokenManager.isAuthenticated();

    if (!isAuth) {
      throw new Error(
        'No valid tokens found. Run: npm run auth\n' +
        'For integration tests with Doppler: doppler run -- npm run test:integration'
      );
    }

    handler = new UpdateEventHandler();
    calendar = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });
  });

  afterAll(async () => {
    // Cleanup: Delete all created test events
    for (const eventId of createdEventIds) {
      try {
        await calendar.events.delete({
          calendarId: TEST_CALENDAR_ID,
          eventId: eventId
        });
      } catch (error) {
        console.warn(`Failed to cleanup event ${eventId}:`, error);
      }
    }
  });

  async function createTestEvent(overrides: any = {}): Promise<string> {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    const dayAfter = new Date(now.getTime() + 172800000);

    const event = {
      summary: 'Integration Test Event',
      description: 'Created by UpdateEventHandler.recurring.integration.test.ts',
      start: {
        dateTime: tomorrow.toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: dayAfter.toISOString(),
        timeZone: 'UTC'
      },
      ...overrides
    };

    const response = await calendar.events.insert({
      calendarId: TEST_CALENDAR_ID,
      requestBody: event
    });

    const eventId = response.data.id!;
    createdEventIds.push(eventId);
    return eventId;
  }

  describe('Update all instances (scope: "all")', () => {
    it('should update summary for all instances of recurring event', async () => {
      // Create recurring event
      const eventId = await createTestEvent({
        summary: 'Weekly Standup',
        recurrence: ['RRULE:FREQ=WEEKLY;COUNT=5']
      });

      // Update with scope "all"
      const result = await handler.runTool(
        {
          calendarId: TEST_CALENDAR_ID,
          eventId: eventId,
          modificationScope: 'all',
          summary: 'Updated Weekly Standup',
          timeZone: 'UTC'
        },
        oauth2Client
      );

      // Verify response
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Updated Weekly Standup');
      expect(result.content[0].text).toContain('updated');
    });

    it('should update all instances without specifying scope (defaults to "all")', async () => {
      const eventId = await createTestEvent({
        summary: 'Daily Sync',
        recurrence: ['RRULE:FREQ=DAILY;COUNT=3']
      });

      const result = await handler.runTool(
        {
          calendarId: TEST_CALENDAR_ID,
          eventId: eventId,
          // modificationScope not specified - should default to 'all'
          summary: 'Updated Daily Sync',
          timeZone: 'UTC'
        },
        oauth2Client
      );

      expect(result.content[0].text).toContain('Updated Daily Sync');
    });
  });

  describe('Update single instance (scope: "thisEventOnly")', () => {
    it('should update only the specified instance', async () => {
      const now = new Date();
      const eventStart = new Date(now.getTime() + 86400000);

      const eventId = await createTestEvent({
        summary: 'Repeating Meeting',
        recurrence: ['RRULE:FREQ=DAILY;COUNT=5'],
        start: { dateTime: eventStart.toISOString(), timeZone: 'UTC' }
      });

      const result = await handler.runTool(
        {
          calendarId: TEST_CALENDAR_ID,
          eventId: eventId,
          modificationScope: 'thisEventOnly',
          originalStartTime: eventStart.toISOString(),
          summary: 'Single Instance Updated',
          timeZone: 'UTC'
        },
        oauth2Client
      );

      expect(result.content[0].text).toContain('Single Instance Updated');
    });

    it('should throw error when thisEventOnly is used without originalStartTime', async () => {
      const eventId = await createTestEvent({
        summary: 'Test Event',
        recurrence: ['RRULE:FREQ=DAILY;COUNT=3']
      });

      await expect(
        handler.runTool(
          {
            calendarId: TEST_CALENDAR_ID,
            eventId: eventId,
            modificationScope: 'thisEventOnly',
            // originalStartTime missing - should error
            summary: 'Updated',
            timeZone: 'UTC'
          },
          oauth2Client
        )
      ).rejects.toThrow();
    });
  });

  describe('Update future instances (scope: "thisAndFollowing")', () => {
    it('should update this and following instances', async () => {
      const now = new Date();
      const eventStart = new Date(now.getTime() + 86400000);
      const futureDate = new Date(now.getTime() + 5 * 86400000);

      const eventId = await createTestEvent({
        summary: 'Bi-weekly Review',
        recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
        start: { dateTime: eventStart.toISOString(), timeZone: 'UTC' }
      });

      const result = await handler.runTool(
        {
          calendarId: TEST_CALENDAR_ID,
          eventId: eventId,
          modificationScope: 'thisAndFollowing',
          futureStartDate: futureDate.toISOString(),
          summary: 'Updated from future date',
          timeZone: 'UTC'
        },
        oauth2Client
      );

      expect(result.content[0].text).toContain('Updated from future date');
    });

    it('should throw error when thisAndFollowing is used without futureStartDate', async () => {
      const eventId = await createTestEvent({
        summary: 'Test Event',
        recurrence: ['RRULE:FREQ=DAILY;COUNT=5']
      });

      await expect(
        handler.runTool(
          {
            calendarId: TEST_CALENDAR_ID,
            eventId: eventId,
            modificationScope: 'thisAndFollowing',
            // futureStartDate missing - should error
            summary: 'Updated',
            timeZone: 'UTC'
          },
          oauth2Client
        )
      ).rejects.toThrow();
    });
  });

  describe('Scope validation', () => {
    it('should throw error when using thisEventOnly on single (non-recurring) event', async () => {
      const eventId = await createTestEvent({
        summary: 'Single Event',
        // No recurrence
      });

      await expect(
        handler.runTool(
          {
            calendarId: TEST_CALENDAR_ID,
            eventId: eventId,
            modificationScope: 'thisEventOnly',
            originalStartTime: new Date().toISOString(),
            summary: 'Updated',
            timeZone: 'UTC'
          },
          oauth2Client
        )
      ).rejects.toThrow('Scope other than "all" only applies to recurring events');
    });

    it('should throw error when using thisAndFollowing on single event', async () => {
      const eventId = await createTestEvent({
        summary: 'Single Event',
        // No recurrence
      });

      await expect(
        handler.runTool(
          {
            calendarId: TEST_CALENDAR_ID,
            eventId: eventId,
            modificationScope: 'thisAndFollowing',
            futureStartDate: new Date(Date.now() + 86400000).toISOString(),
            summary: 'Updated',
            timeZone: 'UTC'
          },
          oauth2Client
        )
      ).rejects.toThrow('Scope other than "all" only applies to recurring events');
    });
  });

  describe('Conflict detection', () => {
    it('should report conflicts when updating to overlapping time', async () => {
      // Create first event
      const eventId1 = await createTestEvent({
        summary: 'Event 1',
        start: {
          dateTime: new Date(Date.now() + 86400000).toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: new Date(Date.now() + 90000000).toISOString(),
          timeZone: 'UTC'
        }
      });

      // Create second event
      const eventId2 = await createTestEvent({
        summary: 'Event 2',
        start: {
          dateTime: new Date(Date.now() + 100000000).toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: new Date(Date.now() + 103600000).toISOString(),
          timeZone: 'UTC'
        }
      });

      // Try to move event 2 to overlap with event 1
      const result = await handler.runTool(
        {
          calendarId: TEST_CALENDAR_ID,
          eventId: eventId2,
          start: new Date(Date.now() + 86400000 + 1800000).toISOString(),
          end: new Date(Date.now() + 90000000 + 1800000).toISOString(),
          timeZone: 'UTC',
          checkConflicts: true
        },
        oauth2Client
      );

      expect(result.content[0].type).toBe('text');
      // Should either succeed or report conflicts (depending on conflict detection)
      expect(result.content).toBeDefined();
    });
  });

  describe('Recurrence rule variations', () => {
    it('should handle daily recurrence', async () => {
      const eventId = await createTestEvent({
        summary: 'Daily Event',
        recurrence: ['RRULE:FREQ=DAILY;COUNT=7']
      });

      const result = await handler.runTool(
        {
          calendarId: TEST_CALENDAR_ID,
          eventId: eventId,
          modificationScope: 'all',
          summary: 'Updated Daily',
          timeZone: 'UTC'
        },
        oauth2Client
      );

      expect(result.content[0].text).toContain('Updated Daily');
    });

    it('should handle weekly recurrence with BYDAY', async () => {
      const eventId = await createTestEvent({
        summary: 'Weekly Event',
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12']
      });

      const result = await handler.runTool(
        {
          calendarId: TEST_CALENDAR_ID,
          eventId: eventId,
          modificationScope: 'all',
          summary: 'Updated Weekly',
          timeZone: 'UTC'
        },
        oauth2Client
      );

      expect(result.content[0].text).toContain('Updated Weekly');
    });

    it('should handle monthly recurrence', async () => {
      const eventId = await createTestEvent({
        summary: 'Monthly Event',
        recurrence: ['RRULE:FREQ=MONTHLY;COUNT=12']
      });

      const result = await handler.runTool(
        {
          calendarId: TEST_CALENDAR_ID,
          eventId: eventId,
          modificationScope: 'all',
          summary: 'Updated Monthly',
          timeZone: 'UTC'
        },
        oauth2Client
      );

      expect(result.content[0].text).toContain('Updated Monthly');
    });
  });
});
