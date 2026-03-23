# Pre-existing Test Issues Analysis

## Overview
The codebase has 3 test files with compilation errors. These are pre-existing issues unrelated to Gmail OAuth integration.

## Critical Issues

### 1. **conflict-detection-integration.test.ts** - Test Architecture Issues (CRITICAL)

**Missing/Unimplemented APIs:**
- `initializeApp()` function - not exported from index.ts
- `AuthenticationService` class - does not exist in src/auth/
- `Server.callTool()` method - SDK doesn't provide this for direct testing
- `TestDataFactory.cleanupTestEvents()` - not implemented as static method
- `TestDataFactory.trackCreatedEvent()` - not implemented as static method

**Root Causes:**
- Test was written against an API design that was never fully implemented
- Test expects direct method calls on Server, but MCP SDK uses transport-based communication
- Missing setup/cleanup utilities in test infrastructure

**Impact:** Cannot run integration tests for conflict detection
**Fix Effort:** High - requires redesigning test architecture or implementing missing utilities

---

### 2. **claude-mcp-integration.test.ts** - MCP SDK Version Mismatch (HIGH)

**Error:** Line 126 - Invalid capabilities type
```typescript
// Current code (broken)
{ tools: {} }  // ❌ 'tools' not in v1.12.1 API

// Expected for SDK v1.12.1
{ sampling?: {...}, experimental?: {...} }
```

**Root Cause:** @modelcontextprotocol/sdk breaking changes in v1.12.1
- The `tools` property was removed from Client capabilities
- New structure uses nested experimental/sampling capabilities

**Impact:** Cannot initialize MCP client in tests
**Fix Effort:** Low - update one constructor call with correct capability shape

---

### 3. **SearchEventsHandler.test.ts** - Type Safety Issues (MEDIUM)

**Error:** Lines 102, 104, 121, 137, 166, 452, 478, 585, 607...
```typescript
// Problem: Union type doesn't guarantee 'text' property
const text = result.content[0].text  // ❌ text might not exist

// Solution: Type guard needed
if (result.content[0]?.type === 'text') {
  expect(result.content[0].text).toContain('...');
}
```

**Root Cause:** TypeScript 5.3.3 enforces strict union type narrowing
- `CallToolResult.content` is union of text/image/resource types
- Only text type has `text` property
- All accesses need type guards

**Impact:** ~20 test failures due to type narrowing
**Fix Effort:** Medium - add type guards to ~20+ assertions

---

## Recommendations

### Immediate Actions
1. ✅ Keep Gmail OAuth integration (no test dependencies)
2. ⏸️ Skip conflict-detection-integration.test.ts (not critical for calendar/Gmail)
3. 🔧 Fix claude-mcp-integration.test.ts (one-line fix)
4. 🔧 Fix SearchEventsHandler.test.ts (type guards for ~20 assertions)

### Long-term
- Redesign conflict detection tests with proper test utilities
- Implement `initializeApp()` for test harness
- Create TestDataFactory static methods for cleanup/tracking

---

## Non-Blocking Status

✅ **Gmail OAuth integration works correctly** - no test dependencies
✅ **Build succeeds** - esbuild is less strict than tsc
✅ **Dev server runs** - MCP tools load properly
✅ **Current tools functional** - calendar and Gmail tools available

The test errors are pre-existing and isolated. They don't affect:
- Build process
- Runtime functionality
- Gmail OAuth features
- Calendar operations
