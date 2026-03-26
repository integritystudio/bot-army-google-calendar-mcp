import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FreeBusyEventHandler } from '../../../handlers/core/FreeBusyEventHandler.js';
import { OAuth2Client } from 'google-auth-library';
import { getTextContent, makeGaxiosError } from '../helpers/index.js';
import { FreeBusyResponse } from '../../../schemas/types.js';

vi.mock('googleapis');

// 2025-01-01 is the base; QUARTER = 90 days exactly
const TIME_MIN = '2025-01-01T00:00:00Z';
const TIME_MAX_89_DAYS = '2025-03-31T00:00:00Z';   // 89 days — under limit
const TIME_MAX_90_DAYS = '2025-04-01T00:00:00Z';   // 90 days — at limit (allowed)
const TIME_MAX_91_DAYS = '2025-04-02T00:00:00Z';   // 91 days — over limit (rejected)

function makeFreeBusyResponse(
  calendars: FreeBusyResponse['calendars'],
  overrides: Partial<FreeBusyResponse> = {}
): FreeBusyResponse {
  return {
    kind: 'calendar#freeBusy',
    timeMin: TIME_MIN,
    timeMax: TIME_MAX_89_DAYS,
    calendars,
    ...overrides,
  };
}

describe('FreeBusyEventHandler', () => {
  let handler: FreeBusyEventHandler;
  let mockOAuth2Client: OAuth2Client;
  let mockFreebusyQuery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handler = new FreeBusyEventHandler();
    mockOAuth2Client = new OAuth2Client();
    mockFreebusyQuery = vi.fn();
    vi.spyOn(handler as any, 'getCalendar').mockReturnValue({
      freebusy: { query: mockFreebusyQuery },
    });
  });

  describe('time range validation (isLessThanThreeMonths)', () => {
    it('rejects a range over 90 days without calling the API', async () => {
      const result = await handler.runTool(
        { timeMin: TIME_MIN, timeMax: TIME_MAX_91_DAYS, calendars: [{ id: 'primary' }] },
        mockOAuth2Client
      );

      expect(getTextContent(result)).toContain('less than 3 months');
      expect(mockFreebusyQuery).not.toHaveBeenCalled();
    });

    it('allows a range exactly at the 90-day boundary', async () => {
      mockFreebusyQuery.mockResolvedValue({
        data: makeFreeBusyResponse(
          { 'user@example.com': { busy: [] } },
          { timeMax: TIME_MAX_90_DAYS }
        ),
      });

      const result = await handler.runTool(
        { timeMin: TIME_MIN, timeMax: TIME_MAX_90_DAYS, calendars: [{ id: 'user@example.com' }] },
        mockOAuth2Client
      );

      expect(mockFreebusyQuery).toHaveBeenCalled();
      expect(getTextContent(result)).not.toContain('less than 3 months');
    });

    it('allows a range under 90 days', async () => {
      mockFreebusyQuery.mockResolvedValue({
        data: makeFreeBusyResponse({ 'user@example.com': { busy: [] } }),
      });

      await handler.runTool(
        { timeMin: TIME_MIN, timeMax: TIME_MAX_89_DAYS, calendars: [{ id: 'user@example.com' }] },
        mockOAuth2Client
      );

      expect(mockFreebusyQuery).toHaveBeenCalled();
    });
  });

  describe('generateAvailabilitySummary', () => {
    const BASE_ARGS = {
      timeMin: TIME_MIN,
      timeMax: TIME_MAX_89_DAYS,
      calendars: [{ id: 'user@example.com' }],
    };

    it('reports available when no busy slots exist', async () => {
      mockFreebusyQuery.mockResolvedValue({
        data: makeFreeBusyResponse({ 'user@example.com': { busy: [] } }),
      });

      const result = await handler.runTool(BASE_ARGS, mockOAuth2Client);
      const text = getTextContent(result);

      expect(text).toContain('user@example.com is available');
      expect(text).toContain(TIME_MIN);
      expect(text).toContain(TIME_MAX_89_DAYS);
    });

    it('lists each busy time slot', async () => {
      mockFreebusyQuery.mockResolvedValue({
        data: makeFreeBusyResponse({
          'user@example.com': {
            busy: [
              { start: '2025-01-10T09:00:00Z', end: '2025-01-10T10:00:00Z' },
              { start: '2025-01-10T14:00:00Z', end: '2025-01-10T15:00:00Z' },
            ],
          },
        }),
      });

      const result = await handler.runTool(BASE_ARGS, mockOAuth2Client);
      const text = getTextContent(result);

      expect(text).toContain('user@example.com is busy');
      expect(text).toContain('2025-01-10T09:00:00Z');
      expect(text).toContain('2025-01-10T14:00:00Z');
    });

    it('reports account not found for notFound errors', async () => {
      mockFreebusyQuery.mockResolvedValue({
        data: makeFreeBusyResponse({
          'missing@example.com': {
            errors: [{ domain: 'calendar', reason: 'notFound' }],
            busy: [],
          },
        }),
      });

      const result = await handler.runTool(
        { ...BASE_ARGS, calendars: [{ id: 'missing@example.com' }] },
        mockOAuth2Client
      );

      expect(getTextContent(result)).toContain('account not found');
    });

    it('handles multiple calendars with mixed availability', async () => {
      mockFreebusyQuery.mockResolvedValue({
        data: makeFreeBusyResponse({
          'alice@example.com': { busy: [] },
          'bob@example.com': {
            busy: [{ start: '2025-02-01T10:00:00Z', end: '2025-02-01T11:00:00Z' }],
          },
        }),
      });

      const result = await handler.runTool(
        { ...BASE_ARGS, calendars: [{ id: 'alice@example.com' }, { id: 'bob@example.com' }] },
        mockOAuth2Client
      );

      const text = getTextContent(result);
      expect(text).toContain('alice@example.com is available');
      expect(text).toContain('bob@example.com is busy');
    });
  });

  describe('queryFreeBusy', () => {
    it('passes all args to the freebusy API', async () => {
      mockFreebusyQuery.mockResolvedValue({
        data: makeFreeBusyResponse({ primary: { busy: [] } }),
      });

      await handler.runTool(
        {
          timeMin: TIME_MIN,
          timeMax: TIME_MAX_89_DAYS,
          timeZone: 'America/New_York',
          groupExpansionMax: 5,
          calendarExpansionMax: 10,
          calendars: [{ id: 'primary' }],
        },
        mockOAuth2Client
      );

      expect(mockFreebusyQuery).toHaveBeenCalledWith({
        requestBody: {
          timeMin: TIME_MIN,
          timeMax: TIME_MAX_89_DAYS,
          timeZone: 'America/New_York',
          groupExpansionMax: 5,
          calendarExpansionMax: 10,
          items: [{ id: 'primary' }],
        },
      });
    });

    it('propagates API errors', async () => {
      mockFreebusyQuery.mockRejectedValue(makeGaxiosError(403, 'Forbidden'));

      await expect(
        handler.runTool(
          { timeMin: TIME_MIN, timeMax: TIME_MAX_89_DAYS, calendars: [{ id: 'primary' }] },
          mockOAuth2Client
        )
      ).rejects.toThrow();
    });
  });
});
