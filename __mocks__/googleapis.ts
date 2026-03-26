import { vi } from 'vitest';

export const google = {
  calendar: vi.fn(() => ({
    events: { list: vi.fn() },
    calendarList: { get: vi.fn() }
  }))
};
export const calendar_v3 = {};
