import { z } from 'zod';
import type { Vitest } from 'vitest';

/**
 * Vitest test context type for async functions
 * Provides type-safe access to this.skip(), this.todo(), etc.
 */
export interface TestContext {
  skip(): void;
  todo(): void;
  skipIf(condition: boolean): void;
  todoIf(condition: boolean): void;
  onTestFinished(fn: () => void | Promise<void>): void;
}

/**
 * OAuth configuration for test setup
 */
export const TestOAuthConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUrl: z.string().url(),
  tokenPath: z.string().min(1).optional(),
  accountMode: z.enum(['test', 'normal']).default('test')
});

export type TestOAuthConfig = z.infer<typeof TestOAuthConfigSchema>;

/**
 * Test environment configuration
 */
export const TestEnvConfigSchema = z.object({
  testCalendarId: z.string().default('primary'),
  testTimeZone: z.string().default('UTC'),
  oauth: TestOAuthConfigSchema,
  skipCleanup: z.boolean().default(false),
  verbose: z.boolean().default(false)
});

export type TestEnvConfig = z.infer<typeof TestEnvConfigSchema>;

/**
 * Test event factory configuration
 */
export const TestEventConfigSchema = z.object({
  summary: z.string().default('Integration Test Event'),
  description: z.string().default('Created by test suite'),
  daysOffset: z.number().default(1),
  durationHours: z.number().default(1),
  timeZone: z.string().default('UTC'),
  recurrence: z.array(z.string()).optional()
});

export type TestEventConfig = z.infer<typeof TestEventConfigSchema>;

/**
 * Cleanup tracking for created test resources
 */
export const TestResourceTrackerSchema = z.object({
  calendarId: z.string(),
  eventIds: z.array(z.string()),
  createdAt: z.date(),
  shouldCleanup: z.boolean().default(true)
});

export type TestResourceTracker = z.infer<typeof TestResourceTrackerSchema>;

/**
 * Test assertion helpers with type safety
 */
export const TestAssertionSchema = z.object({
  type: z.enum(['text', 'image', 'resource']),
  text: z.string().optional(),
  mimeType: z.string().optional()
});

export type TestAssertion = z.infer<typeof TestAssertionSchema>;

/**
 * Tool call result for testing
 */
export const ToolResultSchema = z.object({
  content: z.array(TestAssertionSchema),
  isError: z.boolean().optional()
});

export type ToolResult = z.infer<typeof ToolResultSchema>;

/**
 * Test context wrapper for type-safe test execution
 */
export class TypedTestContext implements TestContext {
  private ctx: any;

  constructor(context: any) {
    this.ctx = context;
  }

  skip(): void {
    if (typeof this.ctx.skip === 'function') {
      this.ctx.skip();
    }
  }

  todo(): void {
    if (typeof this.ctx.todo === 'function') {
      this.ctx.todo();
    }
  }

  skipIf(condition: boolean): void {
    if (condition) {
      this.skip();
    }
  }

  todoIf(condition: boolean): void {
    if (condition) {
      this.todo();
    }
  }

  onTestFinished(fn: () => void | Promise<void>): void {
    if (typeof this.ctx.onTestFinished === 'function') {
      this.ctx.onTestFinished(fn);
    }
  }
}
