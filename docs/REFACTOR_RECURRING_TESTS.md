# Refactoring UpdateEventHandler.recurring.test.ts with Doppler

## Overview

Instead of testing a shadow implementation, we'll refactor `UpdateEventHandler.recurring.test.ts` to:
1. Use real `UpdateEventHandler` and `RecurringEventHelpers` from source
2. Load real Google OAuth credentials from Doppler
3. Test actual Google Calendar API interactions
4. Run with `npm run test:integration:doppler`

## Current State

**File:** `src/tests/unit/handlers/UpdateEventHandler.recurring.test.ts`

**Problems:**
- Tests a fake `EnhancedUpdateEventHandler` class (lines 6–199)
- Wrong scope values: `'single'` vs `'thisEventOnly'`, `'future'` vs `'thisAndFollowing'`
- Cannot catch regressions in real handler
- No error code validation

## Proposed Refactor

### Step 1: Move to Integration Tests

```bash
mv src/tests/unit/handlers/UpdateEventHandler.recurring.test.ts \
   src/tests/integration/UpdateEventHandler.recurring.test.ts
```

Rationale: Integration tests expect real credentials and run against real APIs.

### Step 2: Import Real Handler

```typescript
// BEFORE (shadow class)
class EnhancedUpdateEventHandler { /* ... */ }

// AFTER (real handler)
import { UpdateEventHandler } from '../../../handlers/core/UpdateEventHandler.js';
import { RecurringEventHelpers } from '../../../handlers/core/RecurringEventHelpers.js';
import { OAuth2Client } from 'google-auth-library';
import { initializeOAuth2Client } from '../../../auth/client.js';
import { TokenManager } from '../../../auth/tokenManager.js';
```

### Step 3: Setup Real OAuth Client

```typescript
describe('UpdateEventHandler - Recurring Events', () => {
  let handler: UpdateEventHandler;
  let oauth2Client: OAuth2Client;

  beforeAll(async () => {
    // Load real credentials from Doppler
    oauth2Client = await initializeOAuth2Client();
    const tokenManager = new TokenManager(oauth2Client);
    const hasValidTokens = await tokenManager.validateTokens();

    if (!hasValidTokens) {
      throw new Error('No valid tokens found. Run: npm run auth');
    }
  });

  beforeEach(() => {
    handler = new UpdateEventHandler();
  });

  afterAll(async () => {
    // Optional: cleanup
  });
});
```

### Step 4: Replace Mock-Based Tests with Real API Tests

**BEFORE (mock-based, wrong scope values):**
```typescript
it('should detect event type and route to appropriate method', async () => {
  const recurringEvent = {
    data: {
      id: 'recurring123',
      summary: 'Weekly Meeting',
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO']
    }
  };
  mockCalendar.events.get.mockResolvedValue(recurringEvent);
  mockCalendar.events.patch.mockResolvedValue({ data: recurringEvent.data });

  const args = {
    calendarId: 'primary',
    eventId: 'recurring123',
    timeZone: 'America/Los_Angeles',
    modificationScope: 'all', // ← shadow uses this, not needed for 'all'
    summary: 'Updated Meeting'
  };

  await handler.updateEventWithScope(args);
  expect(mockCalendar.events.patch).toHaveBeenCalled();
});
```

**AFTER (real API test, correct scope values):**
```typescript
it('should update all instances of a recurring event', async () => {
  // 1. Create a test recurring event
  const testEvent = {
    summary: 'Test Recurring - Update All',
    description: 'Integration test event',
    start: { dateTime: new Date(Date.now() + 86400000).toISOString(), timeZone: 'UTC' },
    end: { dateTime: new Date(Date.now() + 90000000).toISOString(), timeZone: 'UTC' },
    recurrence: ['RRULE:FREQ=DAILY;COUNT=5']
  };

  const calendar = new google.calendar_v3.Calendar({ auth: oauth2Client });
  const createResp = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: testEvent
  });
  const eventId = createResp.data.id!;

  // 2. Update all instances with correct scope
  const result = await handler.runTool({
    calendarId: 'primary',
    eventId: eventId,
    modificationScope: 'all', // ← correct value
    summary: 'Updated Recurring Event',
    timeZone: 'UTC'
  }, oauth2Client);

  // 3. Assert on real response format
  expect(result.content[0].type).toBe('text');
  expect(result.content[0].text).toContain('Updated Recurring Event');

  // 4. Cleanup
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId
  });
});
```

### Step 5: Add Tests for Real Error Codes

```typescript
it('should throw RecurringEventError when using thisEventOnly on non-recurring event', async () => {
  // 1. Create a single (non-recurring) event
  const testEvent = {
    summary: 'Single Event',
    start: { dateTime: new Date(Date.now() + 86400000).toISOString(), timeZone: 'UTC' },
    end: { dateTime: new Date(Date.now() + 90000000).toISOString(), timeZone: 'UTC' }
  };

  const calendar = new google.calendar_v3.Calendar({ auth: oauth2Client });
  const createResp = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: testEvent
  });
  const eventId = createResp.data.id!;

  // 2. Try to use thisEventOnly on single event
  await expect(handler.runTool({
    calendarId: 'primary',
    eventId: eventId,
    modificationScope: 'thisEventOnly', // ← correct value, should error
    originalStartTime: new Date().toISOString(),
    summary: 'Updated'
  }, oauth2Client)).rejects.toThrow('Scope other than "all" only applies to recurring events');

  // 3. Cleanup
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId
  });
});
```

### Step 6: Test All Modification Scopes

```typescript
describe('modificationScope behavior', () => {
  let testEventId: string;

  beforeAll(async () => {
    // Create recurring test event
    const calendar = new google.calendar_v3.Calendar({ auth: oauth2Client });
    const resp = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: 'Scope Test Event',
        recurrence: ['RRULE:FREQ=DAILY;COUNT=10'],
        start: { dateTime: new Date(Date.now() + 86400000).toISOString(), timeZone: 'UTC' },
        end: { dateTime: new Date(Date.now() + 90000000).toISOString(), timeZone: 'UTC' }
      }
    });
    testEventId = resp.data.id!;
  });

  it('should update all instances with scope "all"', async () => {
    const result = await handler.runTool({
      calendarId: 'primary',
      eventId: testEventId,
      modificationScope: 'all',
      summary: 'All Updated'
    }, oauth2Client);

    expect(result.content[0].text).toContain('All Updated');
  });

  it('should update single instance with scope "thisEventOnly"', async () => {
    const now = new Date();
    const result = await handler.runTool({
      calendarId: 'primary',
      eventId: testEventId,
      modificationScope: 'thisEventOnly',
      originalStartTime: now.toISOString(),
      summary: 'Single Instance Updated'
    }, oauth2Client);

    expect(result.content[0].text).toContain('Single Instance Updated');
  });

  it('should update future instances with scope "thisAndFollowing"', async () => {
    const futureDate = new Date(Date.now() + 5 * 86400000);
    const result = await handler.runTool({
      calendarId: 'primary',
      eventId: testEventId,
      modificationScope: 'thisAndFollowing',
      futureStartDate: futureDate.toISOString(),
      summary: 'Future Updated'
    }, oauth2Client);

    expect(result.content[0].text).toContain('Future Updated');
  });

  afterAll(async () => {
    const calendar = new google.calendar_v3.Calendar({ auth: oauth2Client });
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: testEventId
    });
  });
});
```

## Running the Refactored Tests

```bash
# Run with Doppler credentials loaded
npm run test:integration:doppler

# Or manually
doppler run -- npm run test:integration
```

## Benefits

✅ **Real implementation tested** - No shadow class duplication
✅ **Correct scope values** - `'thisEventOnly'` and `'thisAndFollowing'`
✅ **Error code validation** - Tests verify `RecurringEventError` codes
✅ **Conflict detection tested** - Full request pipeline validated
✅ **Regression detection** - Any API changes caught immediately
✅ **No mocking complexity** - Real Google APIs, real tokens from Doppler

## Timeline

- **Phase 1 (4–6h):** Extract and analyze existing test cases
- **Phase 2 (6–8h):** Implement new real-API test structure
- **Phase 3 (4–6h):** Add additional edge cases (DST, RRULE formats, timezone handling)
- **Phase 4 (2–4h):** Verify all tests pass with real Google Calendar API

**Total: 16–24 hours** (consistent with original estimate, but now with real integration testing)

## See Also

- [Doppler Setup Guide](./DOPPLER_SETUP.md)
- [Code Review Results](../CLAUDE.md#code-review-updateeventhandler-recurring-tests)
- `src/handlers/core/RecurringEventHelpers.ts` - Implementation to test
- `src/handlers/core/UpdateEventHandler.ts` - Handler to test
