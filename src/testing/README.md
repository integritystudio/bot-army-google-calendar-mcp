# Testing Utilities

This module provides type-safe testing infrastructure with proper async context handling and Zod validation.

## Exports

### Types
- `TestContext` - Type-safe Vitest context interface
- `TypedTestContext` - Wrapper for runtime context access
- `TestOAuthConfig`, `TestEventConfig`, `TestEnvConfig` - Zod-validated configuration types

### Utilities
- `withTestContext()` - Wrap test functions with proper async context
- `typedTest()` - Create type-safe test with explicit `this` annotation
- `withCleanup()` - Ensure cleanup runs even if test fails
- `ResourceTracker` - Track and clean up multiple test resources

### Factories
- `TestOAuthFactory` - Create and validate OAuth configs
- `TestConfigFactory` - Validate test configurations
- `TestInputFactory` - Create handler input payloads

## Usage

### Fix Async Context Type Errors

**Problem:** `'this' implicitly has type 'any'` when using `this.skip()` in tests

**Solution 1: Use `withTestContext()`**
```typescript
import { withTestContext } from '../testing/index.js';

it('my test', withTestContext(async function(ctx) {
  ctx.skipIf(someCondition);
  // test code
}));
```

**Solution 2: Use `typedTest()` with explicit `this`**
```typescript
import { typedTest } from '../testing/index.js';
import type { TestContext } from '../testing/index.js';

it('my test', typedTest(async function(this: TestContext) {
  this.skip();
  // test code
}));
```

### Type-Safe Configuration

```typescript
import { TestOAuthFactory } from '../testing/index.js';

// Load from environment (with validation)
const oauth = TestOAuthFactory.fromEnv();

// Create test defaults
const testOAuth = TestOAuthFactory.createTestConfig({
  clientId: 'custom-id'
});
```

### Cleanup Guarantees

```typescript
import { withCleanup, ResourceTracker } from '../testing/index.js';

// Simple cleanup
const eventId = await withCleanup(
  () => createTestEvent(),
  (id) => deleteTestEvent(id)
);

// Multiple resources
const tracker = new ResourceTracker('primary');
tracker.track(eventId1);
tracker.track(eventId2);
await tracker.cleanup((calId, eventId) =>
  calendar.events.delete({ calendarId: calId, eventId })
);
```

## Reused Production Code

Event factories are intentionally **not duplicated** here. Use existing factories from `src/tests/unit/helpers/`:

```typescript
import { makeEvent, makeWeeklyRecurringEvent } from '../tests/unit/helpers/index.js';

const event = makeEvent({ summary: 'My Event' });
const recurring = makeWeeklyRecurringEvent(7, 'MO,WE,FR');
```

This module focuses on **async context types** and **configuration validation**.
