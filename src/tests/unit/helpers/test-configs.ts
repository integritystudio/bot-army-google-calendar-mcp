/**
 * Shared test configuration objects to eliminate duplication across test suites
 */

export const TIME_MIN = '2024-01-01T00:00:00Z';
export const TIME_MAX = '2024-01-31T23:59:59Z';

export const LIST_EVENTS_API_DEFAULTS = {
  singleEvents: true,
  orderBy: 'startTime'
} as const;
