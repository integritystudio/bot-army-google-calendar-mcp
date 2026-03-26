/**
 * Consolidates repeated test setup patterns for handler tests.
 * Eliminates duplication of beforeEach initialization across test files.
 */

import { vi } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { makeCalendarMock } from './factories.js';
import { ListEventsHandler } from '../../../handlers/core/ListEventsHandler.js';

/**
 * Mock the googleapis module with standard calendar and calendarList methods.
 * Returns mocked googleapis for use in vi.mock() calls.
 */
interface GoogleCalendarMocks {
  google: { calendar: ReturnType<typeof vi.fn> };
  calendar_v3: Record<string, never>;
}

export function createGoogleCalendarMocks(): GoogleCalendarMocks {
  return {
    google: {
      calendar: vi.fn(() => ({
        events: {
          list: vi.fn()
        },
        calendarList: {
          get: vi.fn()
        }
      }))
    },
    calendar_v3: {}
  };
}

export interface HandlerSetup {
  mockOAuth2Client: OAuth2Client;
  handler: ListEventsHandler;
  mockCalendarApi: ReturnType<typeof makeCalendarMock>;
}

/**
 * Set up mocked handler with calendar API for testing.
 * Replaces repeated beforeEach initialization blocks.
 */
export function setupListEventsHandler(): HandlerSetup {
  vi.clearAllMocks();
  const mockOAuth2Client = new OAuth2Client();
  const mockCalendarApi = makeCalendarMock({
    calendarListGet: vi.fn().mockResolvedValue({ data: { timeZone: 'UTC' } })
  });
  const handler = new ListEventsHandler();
  vi.spyOn(handler as any, 'getCalendar').mockReturnValue(mockCalendarApi);

  return {
    mockOAuth2Client,
    handler,
    mockCalendarApi
  };
}
