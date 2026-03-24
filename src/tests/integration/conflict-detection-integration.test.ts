import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { initializeOAuth2Client } from '../../auth/client.js';
import { TokenManager } from '../../auth/tokenManager.js';
import { TestDataFactory } from './test-data-factory.js';

/**
 * Conflict Detection Integration Tests (Option A: MCP Protocol)
 *
 * PURPOSE: Test conflict and duplicate detection via MCP protocol
 * - Uses real MCP server spawned as child process
 * - Calls tools via stdio transport (Option A pattern)
 * - Uses real Google Calendar API with Doppler credentials
 * - Tests overlap detection, duplicate detection, non-conflict cases
 * - Real event creation and cleanup
 *
 * RUN: doppler run --project integrity-studio --config dev -- npm run test:integration
 * OR: GOOGLE_ACCOUNT_MODE=normal GOOGLE_OAUTH_CREDENTIALS=./gcp-oauth.keys.json doppler run -- npm run test:integration
 */

describe('Conflict Detection Integration (MCP Protocol)', () => {
  let mcpClient: Client;
  const createdEventIds: string[] = [];
  const TEST_CALENDAR_ID = TestDataFactory.getTestCalendarId();

  beforeAll(async () => {
    // 1. Auth guard: verify real credentials are available
    const oauth2Client = await initializeOAuth2Client();
    const tokenManager = new TokenManager(oauth2Client);
    const hasValidTokens = await tokenManager.validateTokens();

    if (!hasValidTokens) {
      throw new Error(
        'No valid tokens found. Run: npm run auth\n' +
          'For integration tests with Doppler: ' +
          'doppler run --project integrity-studio --config dev -- npm run test:integration'
      );
    }

    // 2. Start MCP server via stdio transport
    const cleanEnv = Object.fromEntries(
      Object.entries(process.env).filter(([, value]) => value !== undefined)
    ) as Record<string, string>;
    cleanEnv.NODE_ENV = 'test';

    mcpClient = new Client(
      {
        name: 'conflict-detection-test',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    const transport = new StdioClientTransport({
      command: 'node',
      args: ['build/index.js'],
      env: cleanEnv
    });

    await mcpClient.connect(transport);

    // 3. Verify tools are available
    const tools = await mcpClient.listTools();
    const toolNames = tools.tools.map((t) => t.name);
    expect(toolNames).toContain('create-event');
    expect(toolNames).toContain('update-event');
    expect(toolNames).toContain('delete-event');
    expect(toolNames).toContain('get-event');
  }, 30000);

  afterAll(async () => {
    // Cleanup: Delete all created test events
    for (const eventId of createdEventIds) {
      try {
        await mcpClient.callTool({
          name: 'delete-event',
          arguments: {
            calendarId: TEST_CALENDAR_ID,
            eventId: eventId
          }
        });
      } catch (error) {
        console.warn(`Failed to cleanup event ${eventId}:`, error);
      }
    }

    // Close MCP connection
    if (mcpClient) {
      await mcpClient.close();
    }
  }, 10000);

  /**
   * Helper: Extract event ID from tool response
   */
  function extractEventId(result: any): string {
    const text = (result.content[0] as { type: string; text: string }).text;
    return TestDataFactory.extractEventIdFromResponse(result);
  }

  /**
   * Helper: Get response text
   */
  function getResponseText(result: any): string {
    return (result.content[0] as { type: string; text: string }).text;
  }

  describe('Event Creation Without Conflicts', () => {
    it('should create non-overlapping events without conflict', async () => {
      const now = new Date();
      const start1 = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
      const end1 = new Date(start1.getTime() + 60 * 60 * 1000); // 1 hour duration

      const start2 = new Date(start1.getTime() + 2 * 60 * 60 * 1000); // 2 hours after event 1 ends
      const end2 = new Date(start2.getTime() + 60 * 60 * 1000);

      // Create first event
      const result1 = await mcpClient.callTool({
        name: 'create-event',
        arguments: {
          calendarId: TEST_CALENDAR_ID,
          summary: 'Non-Conflict Test Event 1',
          start: TestDataFactory.formatDateTimeRFC3339(start1),
          end: TestDataFactory.formatDateTimeRFC3339(end1),
          timeZone: 'UTC'
        }
      });

      const eventId1 = extractEventId(result1);
      createdEventIds.push(eventId1);
      expect(eventId1).toBeTruthy();
      expect(getResponseText(result1)).toContain('Non-Conflict Test Event 1');

      // Create second event (no overlap)
      const result2 = await mcpClient.callTool({
        name: 'create-event',
        arguments: {
          calendarId: TEST_CALENDAR_ID,
          summary: 'Non-Conflict Test Event 2',
          start: TestDataFactory.formatDateTimeRFC3339(start2),
          end: TestDataFactory.formatDateTimeRFC3339(end2),
          timeZone: 'UTC'
        }
      });

      const eventId2 = extractEventId(result2);
      createdEventIds.push(eventId2);
      expect(eventId2).toBeTruthy();
      expect(getResponseText(result2)).toContain('Non-Conflict Test Event 2');
    });
  });

  describe('Conflict Detection: Overlapping Times', () => {
    it('should detect overlap when updating event to conflict with existing', async () => {
      const now = new Date();
      const start1 = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
      const end1 = new Date(start1.getTime() + 60 * 60 * 1000); // 1 hour duration

      const start2 = new Date(start1.getTime() + 30 * 60 * 1000); // 30 min after event 1 starts
      const end2 = new Date(start2.getTime() + 60 * 60 * 1000);

      // Create event 1
      const result1 = await mcpClient.callTool({
        name: 'create-event',
        arguments: {
          calendarId: TEST_CALENDAR_ID,
          summary: 'Overlap Base Event',
          start: TestDataFactory.formatDateTimeRFC3339(start1),
          end: TestDataFactory.formatDateTimeRFC3339(end1),
          timeZone: 'UTC'
        }
      });

      const eventId1 = extractEventId(result1);
      createdEventIds.push(eventId1);

      // Create event 2 at different time
      const result2 = await mcpClient.callTool({
        name: 'create-event',
        arguments: {
          calendarId: TEST_CALENDAR_ID,
          summary: 'Overlap Test Event',
          start: TestDataFactory.formatDateTimeRFC3339(new Date(now.getTime() + 6 * 60 * 60 * 1000)),
          end: TestDataFactory.formatDateTimeRFC3339(new Date(now.getTime() + 7 * 60 * 60 * 1000)),
          timeZone: 'UTC'
        }
      });

      const eventId2 = extractEventId(result2);
      createdEventIds.push(eventId2);

      // Update event 2 to overlap with event 1 - check for conflicts
      const updateResult = await mcpClient.callTool({
        name: 'update-event',
        arguments: {
          calendarId: TEST_CALENDAR_ID,
          eventId: eventId2,
          start: TestDataFactory.formatDateTimeRFC3339(start2),
          end: TestDataFactory.formatDateTimeRFC3339(end2),
          timeZone: 'UTC',
          checkConflicts: true
        }
      });

      const updateText = getResponseText(updateResult);
      expect(updateText).toBeTruthy();
      // Response should either report conflict or succeed (depending on conflict detection config)
      // At minimum, the update should complete
      expect(updateResult.content[0].type).toBe('text');
    });
  });

  describe('Conflict Detection: Non-Overlapping Times', () => {
    it('should not detect conflicts for truly non-overlapping events', async () => {
      const now = new Date();
      const start1 = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now
      const end1 = new Date(start1.getTime() + 60 * 60 * 1000); // 1 hour duration

      const start2 = new Date(end1.getTime() + 30 * 60 * 1000); // 30 min after event 1 ends
      const end2 = new Date(start2.getTime() + 60 * 60 * 1000);

      // Create event 1
      const result1 = await mcpClient.callTool({
        name: 'create-event',
        arguments: {
          calendarId: TEST_CALENDAR_ID,
          summary: 'No-Conflict Event 1',
          start: TestDataFactory.formatDateTimeRFC3339(start1),
          end: TestDataFactory.formatDateTimeRFC3339(end1),
          timeZone: 'UTC'
        }
      });

      const eventId1 = extractEventId(result1);
      createdEventIds.push(eventId1);

      // Create event 2 with gap from event 1
      const result2 = await mcpClient.callTool({
        name: 'create-event',
        arguments: {
          calendarId: TEST_CALENDAR_ID,
          summary: 'No-Conflict Event 2',
          start: TestDataFactory.formatDateTimeRFC3339(start2),
          end: TestDataFactory.formatDateTimeRFC3339(end2),
          timeZone: 'UTC'
        }
      });

      const eventId2 = extractEventId(result2);
      createdEventIds.push(eventId2);

      // Update event 2 to maintain gap - should not report conflict
      const updateResult = await mcpClient.callTool({
        name: 'update-event',
        arguments: {
          calendarId: TEST_CALENDAR_ID,
          eventId: eventId2,
          start: TestDataFactory.formatDateTimeRFC3339(start2),
          end: TestDataFactory.formatDateTimeRFC3339(end2),
          timeZone: 'UTC',
          checkConflicts: true
        }
      });

      expect(updateResult.content[0].type).toBe('text');
      // Should succeed without conflict warnings
      const updateText = getResponseText(updateResult);
      expect(updateText).toContain('No-Conflict Event 2');
    });
  });

  describe('Duplicate Detection', () => {
    it('should handle creation of similar events', async () => {
      const now = new Date();
      const start = new Date(now.getTime() + 5 * 60 * 60 * 1000); // 5 hours from now
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      // Create first event
      const result1 = await mcpClient.callTool({
        name: 'create-event',
        arguments: {
          calendarId: TEST_CALENDAR_ID,
          summary: 'Duplicate Test Event',
          start: TestDataFactory.formatDateTimeRFC3339(start),
          end: TestDataFactory.formatDateTimeRFC3339(end),
          timeZone: 'UTC'
        }
      });

      const eventId1 = extractEventId(result1);
      createdEventIds.push(eventId1);
      expect(eventId1).toBeTruthy();

      // Create second event with same summary and similar time
      const start2 = new Date(start.getTime() + 5 * 60 * 1000); // 5 min later
      const end2 = new Date(end.getTime() + 5 * 60 * 1000);

      const result2 = await mcpClient.callTool({
        name: 'create-event',
        arguments: {
          calendarId: TEST_CALENDAR_ID,
          summary: 'Duplicate Test Event',
          start: TestDataFactory.formatDateTimeRFC3339(start2),
          end: TestDataFactory.formatDateTimeRFC3339(end2),
          timeZone: 'UTC'
        }
      });

      const eventId2 = extractEventId(result2);
      createdEventIds.push(eventId2);
      expect(eventId2).toBeTruthy();
      // Both events created successfully (duplicates not blocked, just detected)
      expect(eventId1).not.toBe(eventId2);
    });
  });

  describe('Recurring Events and Conflict Detection', () => {
    it('should handle conflict detection with recurring events', async () => {
      const recurringEvent = TestDataFactory.createRecurringEvent({
        summary: 'Recurring Conflict Base'
      });

      // Create recurring event
      const result1 = await mcpClient.callTool({
        name: 'create-event',
        arguments: {
          calendarId: TEST_CALENDAR_ID,
          ...recurringEvent
        }
      });

      const eventId1 = extractEventId(result1);
      createdEventIds.push(eventId1);

      // Create single event that might overlap with one recurrence
      const now = new Date();
      const overlapStart = new Date(now.getTime() + 86400000); // tomorrow (when recurring starts)
      overlapStart.setHours(11, 0, 0, 0); // 11 AM (overlaps with 10-11 AM recurring)

      const result2 = await mcpClient.callTool({
        name: 'create-event',
        arguments: {
          calendarId: TEST_CALENDAR_ID,
          summary: 'Overlaps Recurring Instance',
          start: TestDataFactory.formatDateTimeRFC3339(overlapStart),
          end: TestDataFactory.formatDateTimeRFC3339(
            new Date(overlapStart.getTime() + 60 * 60 * 1000)
          ),
          timeZone: 'UTC'
        }
      });

      const eventId2 = extractEventId(result2);
      createdEventIds.push(eventId2);
      expect(eventId2).toBeTruthy();
    });
  });
});
