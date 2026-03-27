import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { OAuth2Client } from 'google-auth-library';
import { DeleteEventHandler } from '../../../handlers/core/DeleteEventHandler.js';
import { makeCalendarMock, makeGaxiosError } from '../helpers/index.js';

describe('DeleteEventHandler', () => {
  let handler: DeleteEventHandler;
  let mockOAuth2Client: OAuth2Client;
  let mockCalendar: ReturnType<typeof makeCalendarMock>;

  beforeEach(() => {
    handler = new DeleteEventHandler();
    mockOAuth2Client = new OAuth2Client();
    mockCalendar = makeCalendarMock();
    vi.spyOn(handler as any, 'getCalendar').mockReturnValue(mockCalendar);
  });

  describe('successful deletion', () => {
    it('should return success message', async () => {
      mockCalendar.events.delete.mockResolvedValue({});

      const result = await handler.runTool(
        { calendarId: 'primary', eventId: 'event123', sendUpdates: 'all' },
        mockOAuth2Client
      );

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Event deleted successfully');
    });

    it('should pass calendarId, eventId, and sendUpdates to the API', async () => {
      mockCalendar.events.delete.mockResolvedValue({});

      await handler.runTool(
        { calendarId: 'work@example.com', eventId: 'event456', sendUpdates: 'none' },
        mockOAuth2Client
      );

      expect(mockCalendar.events.delete).toHaveBeenCalledWith({
        calendarId: 'work@example.com',
        eventId: 'event456',
        sendUpdates: 'none',
      });
    });

    it.each(['all', 'externalOnly', 'none'] as const)(
      'should pass sendUpdates "%s" through to the API',
      async (sendUpdates) => {
        mockCalendar.events.delete.mockResolvedValue({});

        await handler.runTool(
          { calendarId: 'primary', eventId: 'event123', sendUpdates },
          mockOAuth2Client
        );

        expect(mockCalendar.events.delete).toHaveBeenCalledWith(
          expect.objectContaining({ sendUpdates })
        );
      }
    );
  });

  describe('error handling', () => {
    it('should throw McpError on 404 not found', async () => {
      mockCalendar.events.delete.mockRejectedValue(makeGaxiosError(404, 'Not Found'));

      await expect(
        handler.runTool({ calendarId: 'primary', eventId: 'missing', sendUpdates: 'all' }, mockOAuth2Client)
      ).rejects.toThrow(McpError);
    });

    it('should throw McpError on 403 forbidden', async () => {
      mockCalendar.events.delete.mockRejectedValue(makeGaxiosError(403, 'Forbidden'));

      await expect(
        handler.runTool({ calendarId: 'primary', eventId: 'event123', sendUpdates: 'all' }, mockOAuth2Client)
      ).rejects.toThrow(McpError);
    });

    it('should throw McpError on 410 gone (already deleted)', async () => {
      mockCalendar.events.delete.mockRejectedValue(makeGaxiosError(410, 'Gone'));

      await expect(
        handler.runTool({ calendarId: 'primary', eventId: 'event123', sendUpdates: 'all' }, mockOAuth2Client)
      ).rejects.toThrow(McpError);
    });

    it('should throw McpError on 500 server error', async () => {
      mockCalendar.events.delete.mockRejectedValue(makeGaxiosError(500, 'Internal Server Error'));

      await expect(
        handler.runTool({ calendarId: 'primary', eventId: 'event123', sendUpdates: 'all' }, mockOAuth2Client)
      ).rejects.toThrow(McpError);
    });

    it('should throw McpError on 429 rate limit', async () => {
      mockCalendar.events.delete.mockRejectedValue(makeGaxiosError(429, 'Too Many Requests'));

      await expect(
        handler.runTool({ calendarId: 'primary', eventId: 'event123', sendUpdates: 'all' }, mockOAuth2Client)
      ).rejects.toThrow(McpError);
    });
  });
});
