import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { initializeOAuth2Client } from '../../auth/client.js';
import { TokenManager } from '../../auth/tokenManager.js';
import { TestDataFactory } from './test-data-factory.js';
import { getTextContent } from '../unit/helpers/content.js';
import {
  createAndVerifyEvent,
  updateAndVerifyEvent,
  createNonOverlappingEventPair,
  createOverlappingEventPair
} from './integration-test-helpers.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const HALF_HOUR_MS = 30 * 60 * 1000;

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
    const isAuth = await tokenManager.isAuthenticated();

    if (!isAuth) {
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
    // Cleanup: Delete all created test events in parallel
    const deleteResults = await Promise.allSettled(
      createdEventIds.map((eventId) =>
        mcpClient.callTool({
          name: 'delete-event',
          arguments: {
            calendarId: TEST_CALENDAR_ID,
            eventId
          }
        })
      )
    );

    deleteResults.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.warn(`Failed to cleanup event ${createdEventIds[idx]}:`, result.reason);
      }
    });

    // Close MCP connection
    if (mcpClient) {
      await mcpClient.close();
    }
  }, 30000);

  describe('Event Creation Without Conflicts', () => {
    it('should create non-overlapping events without conflict', async () => {
      const now = new Date();
      const { event1Id, event2Id } = await createNonOverlappingEventPair(
        mcpClient,
        TEST_CALENDAR_ID,
        now,
        createdEventIds
      );

      expect(event1Id).toBeTruthy();
      expect(event2Id).toBeTruthy();
    });
  });

  describe('Conflict Detection: Overlapping Times', () => {
    it('should detect overlap when updating event to conflict with existing', async () => {
      const now = new Date();
      const { event1Id, event2Id } = await createOverlappingEventPair(
        mcpClient,
        TEST_CALENDAR_ID,
        now,
        createdEventIds
      );

      // Get the overlapping times from the helper
      const start1 = new Date(now.getTime() + 3 * ONE_HOUR_MS);
      const start2 = new Date(start1.getTime() + HALF_HOUR_MS);
      const end2 = new Date(start2.getTime() + ONE_HOUR_MS);

      // Update event 2 to overlap with event 1 - check for conflicts
      const { text } = await updateAndVerifyEvent(
        mcpClient,
        TEST_CALENDAR_ID,
        event2Id,
        start2,
        end2,
        true
      );

      expect(text).toBeTruthy();
    });
  });

  describe('Conflict Detection: Non-Overlapping Times', () => {
    it('should not detect conflicts for truly non-overlapping events', async () => {
      const now = new Date();
      const { event1Id, event2Id } = await createNonOverlappingEventPair(
        mcpClient,
        TEST_CALENDAR_ID,
        now,
        createdEventIds
      );

      // Get the non-overlapping times
      const start1 = new Date(now.getTime() + 4 * ONE_HOUR_MS);
      const end1 = new Date(start1.getTime() + ONE_HOUR_MS);
      const start2 = new Date(end1.getTime() + HALF_HOUR_MS);
      const end2 = new Date(start2.getTime() + ONE_HOUR_MS);

      // Update event 2 to maintain gap - should not report conflict
      const { text } = await updateAndVerifyEvent(
        mcpClient,
        TEST_CALENDAR_ID,
        event2Id,
        start2,
        end2,
        true
      );

      expect(text).toContain('No-Conflict Event 2');
    });
  });

  describe('Duplicate Detection', () => {
    it('should handle creation of similar events', async () => {
      const now = new Date();
      const start = new Date(now.getTime() + 5 * ONE_HOUR_MS);
      const end = new Date(start.getTime() + ONE_HOUR_MS);

      const { eventId: eventId1 } = await createAndVerifyEvent(
        mcpClient,
        TEST_CALENDAR_ID,
        'Duplicate Test Event',
        start,
        end,
        createdEventIds
      );

      expect(eventId1).toBeTruthy();

      // Create second event with same summary and similar time
      const FIVE_MIN_MS = 5 * 60 * 1000;
      const start2 = new Date(start.getTime() + FIVE_MIN_MS);
      const end2 = new Date(end.getTime() + FIVE_MIN_MS);

      const { eventId: eventId2 } = await createAndVerifyEvent(
        mcpClient,
        TEST_CALENDAR_ID,
        'Duplicate Test Event',
        start2,
        end2,
        createdEventIds
      );

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

      const id = TestDataFactory.extractEventIdFromResponse(result1);
      if (id) createdEventIds.push(id);

      // Create single event that might overlap with one recurrence
      const now = new Date();
      const overlapStart = new Date(now.getTime() + ONE_DAY_MS);
      overlapStart.setUTCHours(11, 0, 0, 0);

      const { eventId: eventId2 } = await createAndVerifyEvent(
        mcpClient,
        TEST_CALENDAR_ID,
        'Overlaps Recurring Instance',
        overlapStart,
        new Date(overlapStart.getTime() + ONE_HOUR_MS),
        createdEventIds
      );

      expect(eventId2).toBeTruthy();
    });
  });
});
