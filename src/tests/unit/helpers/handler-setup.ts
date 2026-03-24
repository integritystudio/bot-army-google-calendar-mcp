/**
 * Consolidates repeated test setup patterns for handler tests.
 * Eliminates duplication of beforeEach initialization across test files.
 */

import { vi } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { makeCalendarMock } from './factories.js';
import { ListEventsHandler } from '../../../handlers/core/ListEventsHandler.js';

export interface HandlerSetup {
  mockOAuth2Client: OAuth2Client;
  handler: ListEventsHandler;
  mockCalendarApi: any;
}

/**
 * Set up mocked handler with calendar API for testing.
 * Replaces repeated beforeEach initialization blocks.
 */
export function setupListEventsHandler(): HandlerSetup {
  vi.clearAllMocks();
  const mockOAuth2Client = new OAuth2Client();
  const mockCalendarApi = makeCalendarMock();
  const handler = new ListEventsHandler();
  vi.spyOn(handler as any, 'getCalendar').mockReturnValue(mockCalendarApi);

  return {
    mockOAuth2Client,
    handler,
    mockCalendarApi
  };
}
