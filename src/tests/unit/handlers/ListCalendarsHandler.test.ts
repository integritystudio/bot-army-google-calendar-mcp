import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListCalendarsHandler } from '../../../handlers/core/ListCalendarsHandler.js';
import { OAuth2Client } from 'google-auth-library';
import { getTextContent } from '../helpers/index.js';

vi.mock('googleapis', () => ({
  google: {
    calendar: vi.fn(() => ({
      calendarList: { list: vi.fn() }
    }))
  },
  calendar_v3: {}
}));

describe('ListCalendarsHandler', () => {
  let handler: ListCalendarsHandler;
  let mockOAuth2Client: OAuth2Client;
  let mockList: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handler = new ListCalendarsHandler();
    mockOAuth2Client = new OAuth2Client();
    mockList = vi.fn();
    vi.spyOn(handler as any, 'getCalendar').mockReturnValue({
      calendarList: { list: mockList }
    });
  });

  describe('Description truncation', () => {
    it('should truncate description longer than 100 characters', async () => {
      mockList.mockResolvedValue({
        data: { items: [{ id: 'cal1', summary: 'Work', description: 'A'.repeat(101) }] }
      });

      const text = getTextContent(await handler.runTool({}, mockOAuth2Client));

      expect(text).toContain(`${'A'.repeat(100)}...`);
    });

    it('should not truncate description of exactly 100 characters', async () => {
      const description = 'B'.repeat(100);
      mockList.mockResolvedValue({
        data: { items: [{ id: 'cal1', summary: 'Work', description }] }
      });

      const text = getTextContent(await handler.runTool({}, mockOAuth2Client));

      expect(text).toContain(`Description: ${'B'.repeat(100)}`);
      expect(text).not.toContain('...');
    });
  });

  describe('sanitizeString', () => {
    it('should remove null bytes from calendar fields', async () => {
      mockList.mockResolvedValue({
        data: { items: [{ id: 'cal1', summary: 'Work\x00Calendar' }] }
      });

      const text = getTextContent(await handler.runTool({}, mockOAuth2Client));

      expect(text).toContain('WorkCalendar');
      expect(text).not.toContain('\x00');
    });

    it('should remove control characters from calendar fields', async () => {
      mockList.mockResolvedValue({
        data: { items: [{ id: 'cal1', summary: 'Work\x01\x1FCalendar' }] }
      });

      const text = getTextContent(await handler.runTool({}, mockOAuth2Client));

      expect(text).toContain('WorkCalendar');
    });

    it('should remove problematic Unicode characters', async () => {
      mockList.mockResolvedValue({
        data: { items: [{ id: 'cal1', summary: 'Work\uFFFECalendar\uFFFF' }] }
      });

      const text = getTextContent(await handler.runTool({}, mockOAuth2Client));

      expect(text).toContain('WorkCalendar');
      expect(text).not.toContain('\uFFFE');
      expect(text).not.toContain('\uFFFF');
    });

    it('should truncate field values longer than 500 characters', async () => {
      mockList.mockResolvedValue({
        data: { items: [{ id: 'cal1', summary: 'C'.repeat(501) }] }
      });

      const text = getTextContent(await handler.runTool({}, mockOAuth2Client));

      expect(text).toContain('C'.repeat(500));
      expect(text).not.toContain('C'.repeat(501));
    });

    it('should trim whitespace from field values', async () => {
      mockList.mockResolvedValue({
        data: { items: [{ id: 'cal1', summary: '  Work Calendar  ' }] }
      });

      const text = getTextContent(await handler.runTool({}, mockOAuth2Client));

      expect(text).toContain('Work Calendar');
    });
  });
});
