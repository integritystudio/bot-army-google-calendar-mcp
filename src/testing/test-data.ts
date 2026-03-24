import { z } from 'zod';
import type { calendar_v3 } from 'googleapis';
import {
  TestEventConfigSchema,
  TestOAuthConfigSchema,
  type TestEventConfig,
  type TestOAuthConfig
} from './types.js';

/**
 * Type-safe test event factory
 * Creates mock and real test events with consistent validation
 */
export class TestEventFactory {
  /**
   * Create a minimal mock event
   */
  static createMockEvent(
    overrides?: Partial<calendar_v3.Schema$Event>
  ): calendar_v3.Schema$Event {
    const now = new Date();
    const start = new Date(now.getTime() + 86400000); // tomorrow
    const end = new Date(start.getTime() + 3600000); // +1 hour

    return {
      id: 'mock-event-' + Math.random().toString(36).slice(2),
      summary: 'Test Event',
      description: 'Created by test suite',
      start: {
        dateTime: start.toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: 'UTC'
      },
      created: now.toISOString(),
      updated: now.toISOString(),
      etag: '"test-etag"',
      kind: 'calendar#event',
      status: 'confirmed',
      ...overrides
    };
  }

  /**
   * Create a mock recurring event
   */
  static createMockRecurringEvent(
    overrides?: Partial<calendar_v3.Schema$Event>
  ): calendar_v3.Schema$Event {
    return this.createMockEvent({
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
      ...overrides
    });
  }

  /**
   * Create a mock event with proper RRULE structure
   */
  static createMockEventWithRRULE(
    rrule: string,
    overrides?: Partial<calendar_v3.Schema$Event>
  ): calendar_v3.Schema$Event {
    return this.createMockEvent({
      recurrence: [rrule],
      ...overrides
    });
  }

  /**
   * Validate event config with Zod
   */
  static validateConfig(config: Partial<TestEventConfig>): TestEventConfig {
    return TestEventConfigSchema.parse(config);
  }

  /**
   * Create event with validated config
   */
  static fromConfig(config: Partial<TestEventConfig>): calendar_v3.Schema$Event {
    const validated = this.validateConfig(config);
    const now = new Date();
    const start = new Date(
      now.getTime() + validated.daysOffset * 86400000
    );
    const end = new Date(
      start.getTime() + validated.durationHours * 3600000
    );

    const event = this.createMockEvent({
      summary: validated.summary,
      description: validated.description,
      start: {
        dateTime: start.toISOString(),
        timeZone: validated.timeZone
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: validated.timeZone
      }
    });

    if (validated.recurrence) {
      event.recurrence = validated.recurrence;
    }

    return event;
  }
}

/**
 * OAuth configuration factory with validation
 */
export class TestOAuthFactory {
  /**
   * Create OAuth config from environment
   */
  static fromEnv(): TestOAuthConfig {
    return TestOAuthConfigSchema.parse({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || 'test-client-id',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'test-secret',
      redirectUrl:
        process.env.GOOGLE_OAUTH_REDIRECT_URL || 'http://localhost:3000/auth',
      tokenPath: process.env.CALENDARMCP_TOKEN_PATH,
      accountMode: process.env.GOOGLE_ACCOUNT_MODE as 'test' | 'normal' | undefined
    });
  }

  /**
   * Create test OAuth config
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

  /**
   * Validate OAuth config
   */
  static validate(config: unknown): TestOAuthConfig {
    return TestOAuthConfigSchema.parse(config);
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
 */
export const TestInputFactory = {
  /**
   * Create UpdateEventHandler input
   */
  createUpdateEventInput(
    overrides?: Partial<Record<string, any>>
  ): Record<string, any> {
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
   * Create CreateEventHandler input
   */
  createCreateEventInput(
    overrides?: Partial<Record<string, any>>
  ): Record<string, any> {
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
   * Create GetEventHandler input
   */
  createGetEventInput(
    overrides?: Partial<Record<string, any>>
  ): Record<string, any> {
    return {
      calendarId: 'primary',
      eventId: 'test-event-id',
      ...overrides
    };
  }
};
