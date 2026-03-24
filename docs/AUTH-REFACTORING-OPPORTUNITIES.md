# Auth Refactoring Opportunities

**Analysis Date:** 2026-03-24
**Goal:** Apply new TokenManager auth methods (`isAuthenticated()`, `getCredentials()`, `refreshCredentials()`, `logout()`) to improve DRY and reduce code duplication.

---

## Executive Summary

3 refactoring opportunities identified:
- **Direct credential access** (1 location) → Use `getCredentials()` method
- **Token validation patterns** (3 locations) → Use `isAuthenticated()` method
- **Verbose token checking** (2 locations) → Simplify with new methods

**Estimated Effort:** 15-30 minutes | **Impact:** Cleaner API surface, better encapsulation

---

## Detailed Opportunities

### 1. Direct Credential Access (HIGH PRIORITY)

**Location:** `src/verify-tokens.ts:53`

**Current Pattern:**
```typescript
// Direct access to oauth2Client credentials
const credentials = oauth2Client.credentials;
if (credentials.expiry_date) {
  const expiresIn = Math.floor((credentials.expiry_date - Date.now()) / 1000);
  // ... calculate hours/minutes
}
```

**Issue:**
- Direct access to internal `oauth2Client.credentials` violates encapsulation
- Couples verify-tokens.ts to oauth2Client implementation
- No validation that credentials exist

**Refactored Pattern:**
```typescript
// Use TokenManager's new public method
const credentials = tokenManager.getCredentials();
if (credentials?.expiry_date) {
  const expiresIn = Math.floor((credentials.expiry_date - Date.now()) / 1000);
  // ... calculate hours/minutes
}
```

**Benefits:**
- ✅ Encapsulation: oauth2Client.credentials is internal detail
- ✅ Consistency: Use TokenManager for all credential access
- ✅ Safety: null-safe with optional chaining

---

### 2. Token Validation Pattern (MEDIUM PRIORITY)

**Locations (3 instances):**
1. `src/server.ts:61` - `await this.tokenManager.validateTokens(accountMode)`
2. `src/server.ts:75` - `await this.tokenManager.validateTokens(accountMode)`
3. `src/auth/server.ts:144` - `await this.tokenManager.validateTokens()`

**Current Pattern:**
```typescript
const hasValidTokens = await this.tokenManager.validateTokens();
if (!hasValidTokens) {
  // handle no auth
}
```

**Refactored Pattern:**
```typescript
if (!(await this.tokenManager.isAuthenticated())) {
  // handle no auth
}
```

**Benefits:**
- ✅ Intent clarity: `isAuthenticated()` reads better than `validateTokens()`
- ✅ DRY: Semantically correct method name
- ✅ Consistency: All auth checks use `isAuthenticated()`
- ✅ Future-proof: If validation logic changes, only one method to update

**Code Impact:**
- `src/server.ts:61` - Rename check and message
- `src/server.ts:75` - Rename check
- `src/auth/server.ts:144` - Rename check

---

### 3. Integration Test Auth Guards (MEDIUM PRIORITY)

**Locations (2 instances):**
1. `src/tests/integration/UpdateEventHandler.recurring.integration.test.ts:32`
2. `src/tests/integration/conflict-detection-integration.test.ts:31`

**Current Pattern:**
```typescript
const hasValidTokens = await tokenManager.validateTokens();
if (!hasValidTokens) {
  test.skip('No valid tokens from Doppler');
}
```

**Refactored Pattern:**
```typescript
const isAuth = await tokenManager.isAuthenticated();
if (!isAuth) {
  test.skip('No valid tokens from Doppler');
}
```

**Benefits:**
- ✅ Semantic clarity: `isAuthenticated()` is the right method
- ✅ Consistency: Test guards use same auth API as production code
- ✅ Maintainability: Single semantic meaning across codebase

---

## Unused New Methods

The following new TokenManager methods have **no current usage**:
- `refreshCredentials()` — Currently `validateTokens()` handles refresh implicitly
- `logout()` — No logout functionality exists in current codebase

### Recommendations

**For `refreshCredentials()`:**
- Current usage: `validateTokens()` calls `refresh()` internally
- Could replace `refreshCredentials()` with public method if explicit refresh needed
- **Status:** Keep for future use (e.g., manual token refresh in CLI tools)

**For `logout()`:**
- No current use case in MCP server
- Useful for: Multi-account CLI scripts, token cleanup
- **Status:** Keep for future implementation of logout functionality

---

## Refactoring Checklist

- [ ] **Refactor:** `src/verify-tokens.ts:53` - Replace `oauth2Client.credentials` with `tokenManager.getCredentials()`
- [ ] **Refactor:** `src/server.ts:61` - Replace `validateTokens()` with `isAuthenticated()`
- [ ] **Refactor:** `src/server.ts:75` - Replace `validateTokens()` with `isAuthenticated()`
- [ ] **Refactor:** `src/auth/server.ts:144` - Replace `validateTokens()` with `isAuthenticated()`
- [ ] **Refactor:** `src/tests/integration/UpdateEventHandler.recurring.integration.test.ts:32` - Use `isAuthenticated()`
- [ ] **Refactor:** `src/tests/integration/conflict-detection-integration.test.ts:31` - Use `isAuthenticated()`
- [ ] **Test:** All auth checks still work (`npm test`)
- [ ] **Verify:** No behavioral changes, only method naming

---

## Testing Strategy

**Before & After Parity:**
1. Run full test suite: `npm test`
2. Run integration tests: `npm test -- src/tests/integration/`
3. Manual verification: `npm run verify-tokens`

**Commit Scope:**
- Single focused commit: "refactor(auth): replace validateTokens with isAuthenticated"
- Alternative: Per-file commits if changes need isolation

---

## Summary of Changes

| File | Change | Method | Impact |
|------|--------|--------|--------|
| `src/verify-tokens.ts` | L53 | `getCredentials()` | Direct credential access |
| `src/server.ts` | L61 | `isAuthenticated()` | Token validation |
| `src/server.ts` | L75 | `isAuthenticated()` | Token validation |
| `src/auth/server.ts` | L144 | `isAuthenticated()` | Token validation |
| `src/tests/integration/*.ts` | L31-32 | `isAuthenticated()` | Test guards |

**Total Changes:** 6 locations | **Estimated Time:** 15-30 minutes | **Risk:** Low (semantic renames)
