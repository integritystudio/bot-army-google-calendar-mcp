# Test Helpers

Shared utilities for handler tests to reduce duplication and improve maintainability.

## Available Exports

### `getTextContent(result)`
Extract text content from tool result with type safety.
```typescript
import { getTextContent } from './helpers/index.js';

const text = getTextContent(result);
expect(text).toContain('Success');
```

### `makeEvent(overrides?)`
Create a basic calendar event with optional overrides.
```typescript
import { makeEvent } from './helpers/index.js';

const event = makeEvent({ summary: 'Team Meeting' });
const twoHourEvent = makeEvent({
  summary: 'Workshop',
  start: { dateTime: '2025-02-01T09:00:00Z' },
  end: { dateTime: '2025-02-01T11:00:00Z' }
});
```

### `makeEventWithCalendarId(calendarId, overrides?)`
Create a calendar event with extended calendarId property (for batch tests).
```typescript
const event = makeEventWithCalendarId('primary@gmail.com', {
  summary: 'Shared Event'
});
```

### `makeEvents(count, baseOverrides?, variantFn?)`
Create multiple events with optional per-event variations.
```typescript
// Create 10 simple events
const events = makeEvents(10);

// Create 5 events with base location, varying summaries
const events = makeEvents(5, { location: 'Conference Room A' }, (i) => ({
  summary: `Meeting ${i + 1}`
}));
```

### `makeGaxiosError(status, message, data?)`
Create a GaxiosError for error scenario testing.
```typescript
import { makeGaxiosError } from './helpers/index.js';

mockCalendar.events.list.mockRejectedValue(
  makeGaxiosError(404, 'Not Found', { error: { message: 'Calendar not found' } })
);
```

## Migration Guide

### Before (inline event creation)
```typescript
const mockEvent = {
  id: 'event123',
  summary: 'Test Event',
  start: { dateTime: '2025-01-15T10:00:00Z' },
  end: { dateTime: '2025-01-15T11:00:00Z' }
};
```

### After (using factory)
```typescript
const mockEvent = makeEvent({ id: 'event123', summary: 'Test Event' });
```

## Files Using These Helpers

- ✅ SearchEventsHandler.test.ts (refactored)
- ✅ GetEventHandler.test.ts (getTextContent only)
- ✅ ListEventsHandler.test.ts (getTextContent only)
- ✅ GetCurrentTimeHandler.test.ts (getTextContent only)
- ✅ BatchListEvents.test.ts (getTextContent only)

## Recommended Next Steps

These files have HIGH refactoring opportunity:
1. **RecurringEventHelpers.test.ts** (20+ events) — Use `makeEvent()` + `makeEvents()`
2. **BatchListEvents.test.ts** (20+ with calendarId) — Use `makeEventWithCalendarId()`
3. **CreateEventHandler.test.ts** (13 events) — Use `makeEvent()` with targeted overrides

Expected savings: **~250+ lines of duplicate code**
