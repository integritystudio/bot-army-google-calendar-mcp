/**
 * Shared constants for test utilities and data factories
 */

// Event ID extraction constraints
export const EVENT_ID_MIN_LENGTH = 10;

// Response format patterns for event ID extraction
export const RESPONSE_PATTERNS = {
  LEGACY_CREATED: 'Event created: ',
  LEGACY_UPDATED: 'Event updated: ',
  NEW_CREATED: '✅ Event created successfully',
  NEW_UPDATED: '✅ Event updated successfully',
  EVENT_ID_PREFIX: 'Event ID: ',
  CREATED_EVENT: 'Created event: ',
  ID_SUFFIX: 'ID: ',
  EVENT_ID_CHAR_CLASS: '[a-zA-Z0-9_@.-]'
} as const;

// Time range durations (in milliseconds)
export const TIME_DURATIONS = {
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  QUARTER: 90 * 24 * 60 * 60 * 1000
} as const;

// Timezone for integration test events
export const TEST_TIMEZONE = 'America/Los_Angeles';

// Secondary timezone used in unit tests for timezone-fallback scenarios
export const TEST_TIMEZONE_SECONDARY = 'Europe/London';

// Test event constants
export const TEST_EVENT_DEFAULTS = {
  SUMMARY: 'Test Integration Event',
  DESCRIPTION: 'Created by integration test suite',
  LOCATION: 'Test Conference Room',
  REMINDER_MINUTES: 15,
  RECURRING_SUMMARY: 'Test Recurring Meeting',
  RECURRING_DESCRIPTION: 'Weekly recurring test meeting',
  RECURRING_LOCATION: 'Recurring Meeting Room',
  RECURRING_EMAIL_REMINDER_MINUTES: 1440,
  ALL_DAY_SUMMARY: 'Test All-Day Event',
  ALL_DAY_DESCRIPTION: 'All-day test event',
  COLORED_EVENT_SUMMARY_PREFIX: 'Test Event - Color '
} as const;

// MCP response status indicators
export const RESPONSE_INDICATORS = {
  SUCCESS_CHECK: '✅'
} as const;
