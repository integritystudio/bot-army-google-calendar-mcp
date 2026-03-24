/**
 * Integration test helpers for event creation and verification.
 * Consolidates repeated patterns for conflict detection and event lifecycle tests.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { TestDataFactory } from './test-data-factory.js';
import { getTextContent } from '../unit/helpers/content.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const HALF_HOUR_MS = 30 * 60 * 1000;

export interface EventCreateResult {
  eventId: string;
  result: unknown;
}

export interface EventUpdateResult {
  result: unknown;
  text: string;
}

/**
 * Create an event via MCP client and extract the ID.
 * Consolidates the repeated create-event pattern across integration tests.
 */
export async function createAndVerifyEvent(
  mcpClient: Client,
  calendarId: string,
  summary: string,
  start: Date,
  end: Date,
  createdEventIds: string[]
): Promise<EventCreateResult> {
  const result = await mcpClient.callTool({
    name: 'create-event',
    arguments: {
      calendarId,
      summary,
      start: TestDataFactory.formatDateTimeRFC3339(start),
      end: TestDataFactory.formatDateTimeRFC3339(end),
      timeZone: 'UTC'
    }
  });

  const eventId = extractEventId(result);
  createdEventIds.push(eventId);

  return { eventId, result };
}

/**
 * Update an event via MCP client and return formatted response.
 * Consolidates the repeated update-event pattern across integration tests.
 */
export async function updateAndVerifyEvent(
  mcpClient: Client,
  calendarId: string,
  eventId: string,
  start: Date,
  end: Date,
  checkConflicts: boolean = false
): Promise<EventUpdateResult> {
  const result = await mcpClient.callTool({
    name: 'update-event',
    arguments: {
      calendarId,
      eventId,
      start: TestDataFactory.formatDateTimeRFC3339(start),
      end: TestDataFactory.formatDateTimeRFC3339(end),
      timeZone: 'UTC',
      ...(checkConflicts && { checkConflicts: true })
    }
  });

  const text = getTextContent(result);
  return { result, text };
}

/**
 * Helper: Extract event ID from tool response.
 */
function extractEventId(result: unknown): string {
  const id = TestDataFactory.extractEventIdFromResponse(result);
  if (!id) throw new Error('No event ID found in response');
  return id;
}

/**
 * Create two sequential, non-overlapping events.
 * Useful for testing non-conflict scenarios.
 */
export async function createNonOverlappingEventPair(
  mcpClient: Client,
  calendarId: string,
  baseTime: Date,
  createdEventIds: string[]
): Promise<{ event1Id: string; event2Id: string }> {
  const start1 = new Date(baseTime.getTime() + 2 * ONE_HOUR_MS);
  const end1 = new Date(start1.getTime() + ONE_HOUR_MS);
  const start2 = new Date(start1.getTime() + 2 * ONE_HOUR_MS);
  const end2 = new Date(start2.getTime() + ONE_HOUR_MS);

  const { eventId: event1Id } = await createAndVerifyEvent(
    mcpClient,
    calendarId,
    'Non-Overlapping Event 1',
    start1,
    end1,
    createdEventIds
  );

  const { eventId: event2Id } = await createAndVerifyEvent(
    mcpClient,
    calendarId,
    'Non-Overlapping Event 2',
    start2,
    end2,
    createdEventIds
  );

  return { event1Id, event2Id };
}

/**
 * Create two overlapping events.
 * Useful for testing conflict detection scenarios.
 */
export async function createOverlappingEventPair(
  mcpClient: Client,
  calendarId: string,
  baseTime: Date,
  createdEventIds: string[]
): Promise<{ event1Id: string; event2Id: string }> {
  const start1 = new Date(baseTime.getTime() + 3 * ONE_HOUR_MS);
  const end1 = new Date(start1.getTime() + ONE_HOUR_MS);
  const start2 = new Date(start1.getTime() + HALF_HOUR_MS);
  const end2 = new Date(start2.getTime() + ONE_HOUR_MS);

  const { eventId: event1Id } = await createAndVerifyEvent(
    mcpClient,
    calendarId,
    'Base Event',
    start1,
    end1,
    createdEventIds
  );

  const { eventId: event2Id } = await createAndVerifyEvent(
    mcpClient,
    calendarId,
    'Overlapping Event',
    start2,
    end2,
    createdEventIds
  );

  return { event1Id, event2Id };
}
