# Project Backlog

## High Priority Items

### Test Architecture Refactor: conflict-detection-integration.test.ts
**Status:** 🔴 BLOCKED - Requires Design Discussion
**Priority:** High
**Estimated Effort:** 40-60 hours
**Date Added:** 2026-03-23

#### Overview
The `src/tests/integration/conflict-detection-integration.test.ts` file has fundamental architectural issues that prevent compilation. The test expects APIs that don't exist and uses patterns incompatible with the MCP SDK's transport-based design.

#### Root Cause Analysis

##### Issue 1: Missing `initializeApp()` Function
**Location:** Line 4
**Error:** Module '"../../index.js"' has no exported member 'initializeApp'

**Current State:**
- `src/index.ts` does NOT export `initializeApp()`
- Only exports: internal functions `main()` and `runAuthServer()`
- These are not suitable for test harness initialization

**What Test Expects:**
```typescript
// Current code (broken)
import { initializeApp } from '../../index.js';
const server = initializeApp(testConfig);
```

**Why It's Needed:**
- Tests need deterministic server setup with custom configuration
- Current architecture boots full server; tests can't control environment
- No way to inject mock/test dependencies

**Solution Approaches:**
1. **Export initializeApp() from index.ts**
   - Create test-friendly initialization function
   - Accept ServerConfig or similar object
   - Support custom transport for testing
   - Return initialized Server instance

2. **Create dedicated test utilities**
   - `src/testing/test-server.ts` - Server setup for tests
   - `src/testing/fixtures.ts` - Common test data
   - `src/testing/mocks.ts` - Mock OAuth, Calendar clients

**Implementation Considerations:**
- Must NOT interfere with production code paths
- Should use dependency injection for flexibility
- Need proper TypeScript types for test utilities
- Consider circular dependency issues with OAuth clients

---

##### Issue 2: Missing `AuthenticationService` Class
**Location:** Line 6
**Error:** Cannot find module '../../auth/AuthenticationService.js'

**Current State:**
- File does NOT exist in `src/auth/`
- Available: `client.ts`, `server.ts`, `tokenManager.ts`, `utils.ts`, `paths.js`
- TokenManager handles multi-account support but is not exposed as service

**What Test Expects:**
```typescript
// Current code (broken)
const authService = new AuthenticationService(oauth2Client);
const isAuth = await authService.isAuthenticated();
```

**Why It's Needed:**
- Tests need to verify authentication state before running
- Tests need to authenticate multiple accounts for conflict detection
- Need programmatic control over auth lifecycle

**Solution Approaches:**
1. **Create AuthenticationService class**
   - Wrapper around OAuth2Client and TokenManager
   - Methods: `isAuthenticated()`, `getTokens()`, `refreshTokens()`, `logout()`
   - Support multi-account: `setAccount(mode)`, `getAccount()`

2. **Export from TokenManager**
   - TokenManager already has token logic
   - Could add authentication state methods
   - Keep it simple: just add auth checking

**Implementation Considerations:**
- Must handle test vs production token paths
- Need secure token refresh logic
- Should validate tokens against Google API (not just local cache)
- Must support both normal and test accounts

**Code Location:**
```
src/auth/AuthenticationService.ts (new file)
- Or extend TokenManager with auth methods
```

---

##### Issue 3: `Server.callTool()` Method Doesn't Exist
**Locations:** Lines 55, 68, 102, 120, 157, 168, etc.
**Error:** Property 'callTool()' does not exist on type Server

**Current State:**
- MCP SDK's `Server` class is for receiving tool calls FROM clients
- Does NOT have a method to call tools directly
- Tool calls must come through MCP protocol (JSON-RPC over stdio/HTTP)

**What Test Expects:**
```typescript
// Current code (broken)
const result = await server.callTool('create-event', args);
expect(result.content[0].text).toContain('event created');
```

**Why It's Wrong:**
- Violates MCP architecture (server receives calls, doesn't make them)
- Tests would need to run HTTP/stdio transport to communicate
- This is integration test, not unit test of server internals

**Solution Approaches:**

**Option A: Test via MCP Protocol (Recommended)**
```typescript
// Correct way: use MCP client
const client = new StdioClientTransport({ command: 'node', args: [...] });
const result = await client.callTool('create-event', args);
```
- Pros: Tests real MCP behavior, catches protocol issues
- Cons: Slower, more setup overhead, integration test not unit test

**Option B: Test Tool Handlers Directly**
```typescript
// Test the handler directly (unit test)
const handler = new CreateEventHandler();
const result = await handler.runTool(args, mockOAuth2Client);
```
- Pros: Fast, isolated, testable
- Cons: Doesn't test tool registry, MCP server behavior

**Option C: Inject Mock Transport (Advanced)**
```typescript
// Mock the server's request handling
const mockTransport = new MockTransport();
const server = new Server({}, {}, mockTransport);
const result = await server.callTool(...); // Mock handles it
```
- Pros: Tests server without real transport overhead
- Cons: Complex to implement, easy to break isolation

**Recommended Pattern:**
- Use **Option A** for integration tests (test real MCP flow)
- Use **Option B** for unit tests (test handlers in isolation)
- Clearly separate: `*.test.ts` (unit) vs `*.integration.test.ts` (integration)

---

##### Issue 4: Missing TestDataFactory Static Methods
**Locations:** Lines 35, 39, 65, 112, 143, 165, 180
**Errors:**
- `cleanupTestEvents()` not defined
- `trackCreatedEvent()` not defined

**Current State:**
```typescript
// TestDataFactory exists (src/tests/integration/test-data-factory.ts)
// But only has instance methods:
addCreatedEventId()
clearCreatedEventIds()
extractEventIdFromResponse()
// Missing static cleanup/tracking methods
```

**What Test Expects:**
```typescript
// Current code (broken)
TestDataFactory.cleanupTestEvents(calendarId);
TestDataFactory.trackCreatedEvent(eventId);
```

**Why It's Needed:**
- Tests need to clean up after themselves (no test pollution)
- Tests need to track which events were created (for verification)
- Static methods allow cleanup in `afterEach()` hooks

**Solution Approaches:**

**Option A: Add Static Methods to TestDataFactory**
```typescript
export class TestDataFactory {
  private static createdEvents: Map<string, string[]> = new Map();

  static trackCreatedEvent(calendarId: string, eventId: string) {
    if (!this.createdEvents.has(calendarId)) {
      this.createdEvents.set(calendarId, []);
    }
    this.createdEvents.get(calendarId)!.push(eventId);
  }

  static async cleanupTestEvents(
    calendarId: string,
    oauth2Client: OAuth2Client
  ) {
    const events = this.createdEvents.get(calendarId) || [];
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    for (const eventId of events) {
      await calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: 'none'
      });
    }
    this.createdEvents.delete(calendarId);
  }
}
```

**Option B: Create Separate Test Utilities Module**
```typescript
// src/tests/integration/test-utils.ts
export class TestCleanup {
  private events: Map<string, string[]> = new Map();

  track(calendarId: string, eventId: string) { ... }
  async cleanup(calendarId: string, oauth2Client: OAuth2Client) { ... }
}

// Usage in tests
const cleanup = new TestCleanup();
afterEach(() => cleanup.cleanup(calendarId, oauth2Client));
```

**Recommended:** Option A (simpler, follows existing pattern)

---

##### Issue 5: Async Context Type Issues
**Locations:** Lines 45, 85, 148, 187
**Error:** 'this' implicitly has type 'any' because it does not have a type annotation

**Current State:**
```typescript
// Test uses this.skip() but TypeScript can't infer context type
it('test name', async function() {
  this.skip(); // ERROR: 'this' has type 'any'
});
```

**Why It Happens:**
- Vitest test context needs explicit type annotation
- Arrow functions `() =>` lose test context (`this`)
- Named function `function() {}` preserves context but TypeScript complains

**Solution:**
```typescript
it('test name', async function(this: Mocha.Context) {
  this.skip();
  // OR use vitest API directly:
  // this.skip() in named function
  // OR use skip() from vitest import
});
```

**Implementation:**
```typescript
import { describe, it, skip, expect } from 'vitest';
import type { TestContext } from 'vitest';

describe('Conflict Detection', () => {
  it('test name', async function(this: TestContext) {
    if (someCondition) this.skip();
    // ... test code
  });
});
```

---

#### Implementation Plan

**Phase 1: Design & Setup (8-12 hours)**
- [ ] Decide on test architecture (Option A/B/C for callTool)
- [ ] Design AuthenticationService API
- [ ] Design initializeApp() signature
- [ ] Create TypeScript interfaces for test utilities
- [ ] Get team alignment on patterns

**Phase 2: Implement Core Utilities (16-24 hours)**
- [ ] Create `src/auth/AuthenticationService.ts`
- [ ] Export `initializeApp()` from `src/index.ts`
- [ ] Create test utilities in `src/testing/`
- [ ] Add TestDataFactory static methods
- [ ] Fix async context type annotations

**Phase 3: Refactor Tests (12-20 hours)**
- [ ] Update test setup/teardown
- [ ] Rewrite tool call tests with proper MCP flow
- [ ] Add proper cleanup hooks
- [ ] Verify conflict detection logic works
- [ ] Add new tests for edge cases

**Phase 4: Integration & Validation (4-8 hours)**
- [ ] Run full test suite
- [ ] Check test isolation (no pollution)
- [ ] Verify token cleanup
- [ ] Performance profile
- [ ] Document patterns for future tests

**Total Estimated Effort:** 40-64 hours

---

#### Dependencies & Blockers

**Required First:**
- Consensus on test architecture approach
- Team review of proposed APIs
- Decision on test vs unit test scope

**Related Tickets/Issues:**
- None currently identified
- May surface during refactor

**Risk Areas:**
- Token cleanup (security concern if events leak to production)
- OAuth client initialization in tests
- Parallel test execution (token conflicts?)

---

#### Success Criteria

- [ ] All tests compile without TypeScript errors
- [ ] Tests run and pass consistently
- [ ] No test data pollutes production calendars
- [ ] Test execution time < 30 seconds
- [ ] Can run tests in parallel (no conflicts)
- [ ] Documentation of test patterns exists
- [ ] Future developers can add tests easily

---

#### Notes & Observations

**Current Status (as of 2026-03-23):**
- Tests do not block production deployment
- Gmail OAuth integration complete and tested
- Calendar functionality fully operational
- This test file addresses optional conflict detection feature

**Why It Was Deferred:**
1. Does not affect calendar/Gmail core functionality
2. Requires significant architectural decisions
3. Would benefit from team discussion first
4. Production code is functional despite test issues

**Future Consideration:**
- Conflict detection is valuable feature for power users
- Should be prioritized after core Gmail/Calendar stabilizes
- May want to evaluate open source test frameworks first

---

## Completed Items

### Gmail OAuth Integration
**Status:** ✅ COMPLETED (2026-03-23)
- Implemented GmailSearchHandler
- Implemented GmailGetProfileHandler
- Updated tool registry with Gmail tools
- Created auth-gmail.mjs script
- Created check-gmail.mjs utility
- Authenticated with proper scopes
- Verified 201 unread messages accessible

### Test Fixes - SDK Compatibility
**Status:** ✅ COMPLETED (2026-03-23)
- Fixed claude-mcp-integration.test.ts (SDK v1.12.1 capability type)
- Fixed SearchEventsHandler.test.ts (union type narrowing)
- Updated documentation for both

### Documentation Updates
**Status:** ✅ COMPLETED (2026-03-23)
- Updated CLAUDE.md with Gmail section
- Updated README.md with Gmail features
- Created TEST_ISSUES_ANALYSIS.md
- Created TEST_FIXES_SUMMARY.md
