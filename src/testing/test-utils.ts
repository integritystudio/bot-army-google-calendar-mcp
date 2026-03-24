import type { TestContext } from './types.js';
import { TypedTestContext } from './types.js';

/**
 * Wrap test function with proper async context type
 * Solves: "'this' implicitly has type 'any'" errors
 *
 * Usage:
 *   it('test name', withTestContext(async function(ctx) {
 *     ctx.skipIf(someCondition);
 *     // test code
 *   }));
 */
export function withTestContext(
  testFn: (this: TestContext, ctx: TestContext) => Promise<void> | void
): (this: any) => Promise<void> {
  return async function(this: any) {
    const ctx = new TypedTestContext(this);
    return testFn.call(ctx, ctx);
  };
}

/**
 * Wrap test function that uses `this` directly with type safety
 * Solves: "'this' implicitly has type 'any'" errors
 *
 * Usage:
 *   it('test name', typedTest(async function(this: TestContext) {
 *     this.skip();
 *   }));
 */
export function typedTest(
  testFn: (this: TestContext) => Promise<void> | void
): (this: any) => Promise<void> {
  return async function(this: any) {
    const ctx = new TypedTestContext(this);
    return testFn.call(ctx);
  };
}

/**
 * Create a typed test context from raw vitest context
 * Use when you need to wrap an existing test function signature
 */
export function createTypedContext(rawContext: any): TestContext {
  return new TypedTestContext(rawContext);
}

/**
 * Conditional test skip with description
 * Usage: skipTestIf(process.env.CI === 'true', 'Skip in CI');
 */
export function skipTestIf(
  condition: boolean,
  reason: string,
  ctx: TestContext
): void {
  if (condition) {
    ctx.skip();
  }
}

/**
 * Conditional test todo with description
 * Usage: todoTestIf(shouldImplement, 'Waiting for API endpoint');
 */
export function todoTestIf(
  condition: boolean,
  reason: string,
  ctx: TestContext
): void {
  if (condition) {
    ctx.todo();
  }
}

/**
 * Ensure test cleanup runs even if test fails
 * Solves: test failures preventing cleanup execution
 *
 * Usage:
 *   withCleanup(
 *     () => createTestEvent(),
 *     (eventId) => deleteTestEvent(eventId)
 *   )
 */
export async function withCleanup<T, C>(
  setup: () => Promise<T>,
  cleanup: (resource: T) => Promise<void>
): Promise<T> {
  const resource = await setup();
  try {
    return resource;
  } finally {
    await cleanup(resource).catch((err) => {
      console.error('Cleanup failed:', err);
    });
  }
}

/**
 * Track multiple resources for cleanup
 * Usage:
 *   const tracker = new ResourceTracker('primary');
 *   tracker.track(eventId);
 *   await tracker.cleanup(oauth2Client);
 */
export class ResourceTracker {
  private eventIds: Set<string> = new Set();
  private readonly calendarId: string;

  constructor(calendarId: string) {
    this.calendarId = calendarId;
  }

  track(eventId: string): void {
    this.eventIds.add(eventId);
  }

  getTracked(): string[] {
    return Array.from(this.eventIds);
  }

  async cleanup(
    calendarDeleteFn: (calendarId: string, eventId: string) => Promise<void>
  ): Promise<void> {
    const errors: Error[] = [];

    for (const eventId of this.eventIds) {
      try {
        await calendarDeleteFn(this.calendarId, eventId);
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error
            : new Error(`Failed to delete ${eventId}`)
        );
      }
    }

    this.eventIds.clear();

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Cleanup failed for some events');
    }
  }
}
