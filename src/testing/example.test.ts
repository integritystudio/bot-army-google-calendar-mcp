/**
 * EXAMPLE: Demonstrates fix for Issue 5 - Async Context Type Errors
 *
 * This file shows the solution patterns for:
 * "'this' implicitly has type 'any'" errors when using this.skip(), this.todo(), etc.
 *
 * Use these patterns in your actual integration tests.
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { withTestContext, typedTest, ResourceTracker } from './index.js';
import type { TestContext } from './index.js';

describe('Example: Async Context Type Fix (Issue 5)', () => {
  describe('Solution 1: withTestContext wrapper', () => {
    it(
      'should skip test when condition is true',
      withTestContext(async function(ctx) {
        // ✓ ctx has type TestContext - no 'any' type errors
        ctx.skipIf(true);
        expect(true).toBe(true);
      })
    );

    it(
      'should mark test as todo',
      withTestContext(async function(ctx) {
        // ✓ ctx has proper type annotations
        ctx.todoIf(true);
        expect(true).toBe(true);
      })
    );

    it(
      'should have cleanup callback',
      withTestContext(async function(ctx) {
        let cleanupCalled = false;
        ctx.onTestFinished(() => {
          cleanupCalled = true;
        });
        expect(cleanupCalled).toBe(false);
        // cleanup runs after test
      })
    );
  });

  describe('Solution 2: typedTest with explicit this', () => {
    it(
      'should use typed this context',
      typedTest(async function(this: TestContext) {
        // ✓ 'this' has explicit TestContext type - no type errors
        this.skipIf(false);
        expect(true).toBe(true);
      })
    );

    it(
      'should handle todo with reason',
      typedTest(async function(this: TestContext) {
        // ✓ Can call context methods directly
        if (process.env.SKIP_INTEGRATION_TESTS) {
          this.skip();
        }
        expect(true).toBe(true);
      })
    );
  });

  describe('Resource Tracking Pattern', () => {
    let tracker: ResourceTracker;

    beforeEach(() => {
      tracker = new ResourceTracker('primary');
    });

    afterEach(async () => {
      // Mock cleanup function
      await tracker.cleanup(async () => {
        // In real tests: await calendar.events.delete(...)
      });
    });

    it(
      'should track multiple resources',
      withTestContext(async function(ctx) {
        tracker.track('event-1');
        tracker.track('event-2');
        tracker.track('event-3');

        const tracked = tracker.getTracked();
        expect(tracked).toHaveLength(3);
        // Cleanup runs in afterEach, guarantees deletion
      })
    );
  });
});

/**
 * KEY PATTERNS FIXED:
 *
 * ❌ BEFORE (Error: 'this' implicitly has type 'any'):
 * ```
 * it('test', async function() {
 *   this.skip();  // ERROR: no type info
 * });
 * ```
 *
 * ✓ AFTER (No errors):
 * ```
 * it('test', withTestContext(async function(ctx) {
 *   ctx.skip();   // ✓ ctx: TestContext
 * }));
 *
 * // OR
 *
 * it('test', typedTest(async function(this: TestContext) {
 *   this.skip();  // ✓ this: TestContext
 * }));
 * ```
 *
 * WHY IT WORKS:
 * - Explicit TestContext type annotation
 * - Wrapper functions preserve context binding
 * - Full TypeScript support for skip(), todo(), onTestFinished()
 * - Works with async/await syntax
 */
