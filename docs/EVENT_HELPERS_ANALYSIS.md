# Analysis: Applying event-test-data.ts Helpers Across Test Suite

## Overview
The functions in `src/tests/unit/helpers/event-test-data.ts` (created from the RecurringEventHelpers.test.ts ↔ validators.test.ts deduplication) can be applied across multiple test files to reduce copy-pasta and improve consistency.

## Current Helper Functions Available

### Event Creation
- `createTestEventWithDateTime(startTime, endTime, overrides)` - Basic dateTime event
- `createTestEventWithTZOffset(startTime, endTime, overrides)` - TZ-aware event (with offset)
- `createCompleteTestEvent(overrides)` - Full event with system fields
- `SYSTEM_FIELDS` - Constant list of fields to strip during duplication

### UpdateEvent Arguments
- `createUpdateEventArgs(calendarId, eventId, timeZone, overrides)` - Basic args
- `createUpdateEventArgsWithTimes(start, end, timeZone, overrides)` - With time changes
- `createUpdateEventArgsWithAttendees(overrides)` - With attendees & reminders
- `createComplexUpdateEventArgs(overrides)` - Complex nested objects

## Opportunities by File

### 🔴 High Priority (Inline Event Definitions with Repeated Patterns)

#### 1. **ConflictAnalyzer.test.ts** (17 inline events)
**Issue:** Extensive inline `calendar_v3.Schema$Event` definitions with repeated `start: { dateTime }, end: { dateTime }` pattern.

**Lines:** 10-55, 62-71, 78-87, 97-148
**Pattern:**
```typescript
const event1: calendar_v3.Schema$Event = {
  summary: 'Meeting 1',
  start: { dateTime: '2024-01-01T10:00:00Z' },
  end: { dateTime: '2024-01-01T11:00:00Z' }
};
```

**Recommendation:**
- Import `makeEvent()` from factories (already supports overrides)
- OR create a new simple helper `createConflictTestEvent(summary, startTime, endTime, overrides)` in event-test-data.ts

**Estimated Impact:** 15+ lines saved, 5+ events using helper pattern

---

#### 2. **GetEventHandler.test.ts** (2 inline events)
**Lines:** 48-54, 76-84
**Pattern:**
```typescript
const mockEvent = {
  id: 'event123',
  summary: 'Test Event',
  start: { dateTime: '2025-01-15T10:00:00Z' },
  end: { dateTime: '2025-01-15T11:00:00Z' },
  ...other fields
};
```

**Recommendation:**
- Use `makeEvent({ summary: '...', ...})` from factories.ts
- Already supports arbitrary overrides

**Estimated Impact:** 10 lines saved, consolidates with SearchEventsHandler pattern

---

#### 3. **ListEventsHandler.test.ts** (1 inline event in mock)
**Lines:** 35-42
**Pattern:**
```typescript
{
  id: 'test-event',
  summary: 'Test Event',
  start: { dateTime: '2025-06-02T10:00:00Z' },
  end: { dateTime: '2025-06-02T11:00:00Z' }
}
```

**Recommendation:**
- Use `makeEvent()` from factories.ts
- Apply same pattern as SearchEventsHandler.test.ts (which already does this)

**Estimated Impact:** 5 lines saved, aligns with SearchEventsHandler pattern

---

### 🟡 Medium Priority (Local Helper Functions That Could Be Centralized)

#### 4. **UpdateEventHandler.recurring.test.ts** (3 local helpers)
**Lines:** 49-81
**Functions:**
- `createMockEvent()` - Wraps `makeEvent()` with metadata
- `createMockRecurringEvent()` - Adds recurrence to `createMockEvent()`
- `buildUpdateEventInput()` - Builds & validates input via Zod schema

**Current Implementation:**
```typescript
function createMockEvent(overrides = {}) {
  return makeEvent({
    id: 'event123',
    created: '2026-03-20T12:00:00.000Z',
    updated: '2026-03-20T12:00:00.000Z',
    etag: '"etag123"',
    ...overrides
  });
}

function createMockRecurringEvent(overrides = {}) {
  return createMockEvent({
    recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
    ...overrides
  });
}

function buildUpdateEventInput(overrides = {}) {
  return ToolSchemas['update-event'].parse({
    calendarId: 'primary',
    eventId: 'event123',
    checkConflicts: false,
    ...overrides
  });
}
```

**Recommendation:**
- `createMockEvent()` - Could be a variant in event-test-data.ts or factories.ts (adds metadata fields)
- `createMockRecurringEvent()` - Natural follow-up: could be `createEventWithRecurrence(overrides)`
- `buildUpdateEventInput()` - Specific to UpdateEventHandler tests; handler-specific validation is fine to keep local

**Estimated Impact:** 20 lines saved if centralized, improves consistency across recurring event tests

---

#### 5. **CreateEventHandler.test.ts** (2 inline arg objects)
**Lines:** 70-75, 110-124
**Pattern:**
```typescript
const args = {
  calendarId: 'primary',
  summary: 'Test Event',
  start: '2025-01-15T10:00:00',
  end: '2025-01-15T11:00:00',
  // ...optional fields
};
```

**Note:** These are **CreateEvent** input args, different from **UpdateEvent** args. UpdateEvent args include timezone, modificationScope, etc.

**Recommendation:**
- Create `createEventHandlerArgs(overrides)` in event-test-data.ts (or new file if keeping separate)
- Parallel to `createUpdateEventArgs()` but for CreateEvent

**Estimated Impact:** 12 lines saved, enables consistent handler input testing across all handlers

---

### 🟢 Lower Priority (Already Following Good Patterns)

#### SearchEventsHandler.test.ts
✅ Already uses `makeEvent()` correctly (lines 70, 108)

#### BatchListEvents.test.ts, index.test.ts
⚠️ Has 5 shared blocks but they're assertion patterns (`expect().toBe()`, `getTextContent()`), not event creation

#### RecurringEventHelpers.test.ts
✅ Updated in Phase 1 to use event-test-data.ts helpers

#### validators.test.ts
✅ Updated in Phase 1 to use event-test-data.ts helpers

---

## Recommended Implementation Plan

### Phase A: Immediate Wins (Low risk, high impact)

1. **ConflictAnalyzer.test.ts** - Switch inline events to `makeEvent()`
   - Impact: 15 lines, 5+ events
   - Risk: Very low (makeEvent() is flexible)
   - Effort: 10 minutes

2. **GetEventHandler.test.ts** - Use `makeEvent()` for mock responses
   - Impact: 10 lines
   - Risk: Very low
   - Effort: 5 minutes

3. **ListEventsHandler.test.ts** - Use `makeEvent()` in mock array
   - Impact: 5 lines
   - Risk: Very low
   - Effort: 3 minutes

### Phase B: New Helper Functions (Medium effort)

4. **Create `createEventHandlerArgs()` helper** in event-test-data.ts
   - For CreateEvent, ListEvents, GetEvent, SearchEvents handler args
   - Mirrors pattern of `createUpdateEventArgs()`
   - Impact: Enables consistent handler input testing
   - Effort: 15 minutes

5. **Consider `createEventWithMetadata()` and `createRecurringEventInstance()`** helpers
   - Support for UpdateEventHandler.recurring.test.ts patterns
   - Lower priority (tests are already working, but would improve consistency)
   - Effort: 20 minutes

### Phase C: Refactoring (Optional)

6. **Consolidate local helper functions** from UpdateEventHandler.recurring.test.ts
   - `createMockEvent()` → `createEventWithMetadata()` in event-test-data.ts
   - `createMockRecurringEvent()` → natural variant
   - Effort: 20 minutes (refactor + import updates)

---

## Summary by Impact

| File | Lines Saved | Complexity | Risk | Priority |
|------|------------|-----------|------|----------|
| ConflictAnalyzer.test.ts | ~15 | Low | Low | 🔴 High |
| GetEventHandler.test.ts | ~10 | Low | Low | 🔴 High |
| ListEventsHandler.test.ts | ~5 | Low | Low | 🔴 High |
| New: createEventHandlerArgs() | +10 | Medium | Low | 🟡 Medium |
| UpdateEventHandler.recurring.test.ts | ~20 | Medium | Medium | 🟢 Low |
| **Total** | **~60** lines | - | - | - |

---

## Next Steps

1. **Start with Phase A** (ConflictAnalyzer, GetEventHandler, ListEventsHandler) - minimal risk, immediate wins
2. **Run tests** after each file to verify no regressions
3. **Evaluate Phase B** - decide if new helpers improve enough to justify the code
4. **Re-run check-duplicates** after changes to measure duplication reduction

---

## Code Snippet: Proposed Phase B Implementation

```typescript
// In event-test-data.ts - add these helpers

/**
 * Create handler args for CreateEvent command.
 * Base pattern for all event creation handler tests.
 */
export function createEventHandlerArgs(
  calendarId: string = 'primary',
  overrides: Record<string, any> = {}
): Record<string, any> {
  return {
    calendarId,
    summary: 'Test Event',
    start: '2025-01-15T10:00:00',
    end: '2025-01-15T11:00:00',
    ...overrides
  };
}

/**
 * Create event with system metadata fields for mock responses.
 * Useful for tests that need complete event objects from API.
 */
export function createEventWithMetadata(
  overrides: Partial<calendar_v3.Schema$Event> = {}
): calendar_v3.Schema$Event {
  return createCompleteTestEvent({
    id: 'event123',
    created: '2026-03-20T12:00:00.000Z',
    updated: '2026-03-20T12:00:00.000Z',
    etag: '"etag123"',
    ...overrides
  });
}
```

Then in UpdateEventHandler.recurring.test.ts:
```typescript
import { createEventWithMetadata, createComplexUpdateEventArgs } from '../helpers/index.js';

// Replace local createMockEvent with:
const mockEvent = createEventWithMetadata({ recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'] });
```
