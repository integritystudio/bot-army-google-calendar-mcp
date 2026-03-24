import { z } from 'zod';
import type { calendar_v3 } from 'googleapis';
import {
  TestEventConfigSchema,
  TestOAuthConfigSchema,
  type TestEventConfig,
  type TestOAuthConfig
} from './types.js';

/**
 * Configuration validation factories with Zod
 * Reuses existing test factories from src/tests/unit/helpers/
 * This module focuses on configuration validation, not event creation
 */
export class TestConfigFactory {
  /**
   * Validate event config with Zod
   */
  static validateEventConfig(
    config: Partial<TestEventConfig>
  ): TestEventConfig {
    return TestEventConfigSchema.parse(config);
  }

  /**
   * Validate OAuth config with Zod
   */
  static validateOAuthConfig(
    config: Partial<TestOAuthConfig>
  ): TestOAuthConfig {
    return TestOAuthConfigSchema.parse(config);
  }
}

/**
 * OAuth configuration factory with defaults support.
 * For loading from environment, use auth utilities directly:
 * @see src/auth/tokenManager.ts TokenManager class
 * @see src/auth/utils.ts getAccountMode(), getSecureTokenPath()
 */
export class TestOAuthFactory {
  /**
   * Create test OAuth config with defaults
   */
  static createTestConfig(
    overrides?: Partial<TestOAuthConfig>
  ): TestOAuthConfig {
    return TestOAuthConfigSchema.parse({
      clientId: 'test-client-id',
      clientSecret: 'test-secret',
      redirectUrl: 'http://localhost:3000/auth',
      accountMode: 'test',
      ...overrides
    });
  }
}

/**
 * Create mock OAuth2Client for testing
 */
export function createMockOAuth2Client() {
  return {
    getAccessToken: () =>
      Promise.resolve({ token: 'mock-token', expiry_date: null }),
    refreshAccessToken: () =>
      Promise.resolve({ credentials: { access_token: 'mock-token' } }),
    setCredentials: () => undefined,
    getCredentials: () => ({ access_token: 'mock-token' })
  } as any;
}

/**
 * Utilities for creating tool input payloads in tests
 * Re-export existing factories from src/tests/unit/helpers/
 * for consistent event creation across test suites
 */
export const TestInputFactory = {
  /**
   * Create UpdateEventHandler input with defaults
   */
  updateEvent(overrides?: Partial<Record<string, any>>): Record<string, any> {
    return {
      calendarId: 'primary',
      eventId: 'test-event-id',
      modificationScope: 'all',
      summary: 'Updated Event',
      checkConflicts: false,
      ...overrides
    };
  },

  /**
   * Create CreateEventHandler input with defaults
   */
  createEvent(overrides?: Partial<Record<string, any>>): Record<string, any> {
    const now = new Date();
    const start = new Date(now.getTime() + 86400000);
    const end = new Date(start.getTime() + 3600000);

    return {
      calendarId: 'primary',
      summary: 'New Test Event',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      ...overrides
    };
  },

  /**
   * Create GetEventHandler input with defaults
   */
  getEvent(overrides?: Partial<Record<string, any>>): Record<string, any> {
    return {
      calendarId: 'primary',
      eventId: 'test-event-id',
      ...overrides
    };
  }
};
