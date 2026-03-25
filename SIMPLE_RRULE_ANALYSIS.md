# Simple-RRule Time Helpers Analysis

## Overview
The `simple-rrule` library provides comprehensive date/time utilities that could reduce custom code in production. Currently, only `addDays` and `addMilliseconds` are imported.

## Available Simple-RRule Time Helpers

### Date Arithmetic (addDatesHelper.ts)
- `addMonths(date, months)` — Add/subtract months
- `addYears(date, years)` — Add/subtract years
- `addWeeks(date, weeks)` — Add/subtract weeks
- `addHours(date, hours)` — Add/subtract hours
- `addMinutes(date, minutes)` — Add/subtract minutes
- `addSeconds(date, seconds)` — Add/subtract seconds
- `getDaysInMonth(date)` — Get number of days in month

### Date Difference (differenceHelper.ts)
- `differenceInYears(dateLeft, dateRight)` — Get year difference
- `differenceInMonths(dateLeft, dateRight)` — Get month difference
- `differenceInWeeks(dateLeft, dateRight)` — Get week difference
- `differenceInDays(dateLeft, dateRight)` — Get day difference
- `differenceInHours(dateLeft, dateRight)` — Get hour difference
- `differenceInMinutes(dateLeft, dateRight)` — Get minute difference
- `differenceInSeconds(dateLeft, dateRight)` — Get second difference
- `differenceInMilliseconds(dateLeft, dateRight)` — Get millisecond difference
- `differenceInCalendarMonths(dateLeft, dateRight)` — Get calendar month difference

### Date Comparison (compare.ts & rRuleDateStringFormat.ts)
- `compareAsc(dateLeft, dateRight)` — Compare dates (-1, 0, 1)
- `isBefore(firstDate, lastDate)` — Date comparison
- `isLastDayOfMonth(date)` — Check if last day of month
- `toRRuleDateString(dateIso, utc?)` — Convert to YYYYMMDDTHHMMSSZ format
- `fromRruleDateStringToDate(dtString)` — Convert from RRule format

## Production Opportunities

### 1. Time Duration Constants
**Current:** Custom constants in two places
- `src/utils/date-utils.ts` — `TIME_DURATIONS` (HOUR, DAY, WEEK, MONTH)
- `src/testing/constants.ts` — `TIME_DURATIONS` (WEEK, MONTH, QUARTER) + duplicated WEEK, MONTH

**Issue:**
- Duplicated across utils and testing/constants
- Production code (`FreeBusyEventHandler`) imports from testing/constants
- Missing QUARTER definition in utils/date-utils

**Recommendation:**
- Consolidate to `utils/date-utils.ts` as single source
- Use `differenceInDays()` for duration calculations instead of manual millisecond math
- Remove custom constants once all callsites migrated

### 2. Date Difference Calculations
**Current Usage:** 18 instances of `.getTime()` arithmetic in production
```ts
// Current pattern
const diffInMilliseconds = maxDate.getTime() - minDate.getTime();

// Replaces with simple-rrule
const diffInDays = differenceInDays(maxDate, minDate);
const diffInMilliseconds = differenceInMilliseconds(maxDate, minDate);
```

**Locations to refactor:**
- `src/handlers/core/FreeBusyEventHandler.ts` — Line 58 (duration check)
- `src/handlers/core/RecurringEventHelpers.ts` — Line with `originalEnd.getTime() - originalStart.getTime()`
- Any other duration calculations

### 3. Date Format Conversions
**Current:** Manual string manipulation in `date-utils.ts`
```ts
// formatBasicDateTime: Replace with toRRuleDateString
export function formatBasicDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}
```

**RRule Format Conversion:**
- `toRRuleDateString()` — Already available in simple-rrule
- Can replace `formatBasicDateTime()` implementation
- Handles both UTC and non-UTC variants

### 4. Date Comparison Helpers
**Potential additions:**
```ts
// Use simple-rrule's compareAsc for sorting events
events.sort((a, b) => compareAsc(a.start, b.start));

// Use isBefore/isLastDayOfMonth for event logic
if (isBefore(eventStart, cutoffDate)) { ... }
if (isLastDayOfMonth(eventDate)) { ... }
```

## Code Quality Improvements

### Before Consolidation
```ts
// FreeBusyEventHandler.ts imports from testing file
import { TIME_DURATIONS } from "../../testing/constants.js";

// Manual duration calculation
const diffInMilliseconds = maxDate.getTime() - minDate.getTime();
const threeMonthsInMilliseconds = TIME_DURATIONS.QUARTER;
return diffInMilliseconds <= threeMonthsInMilliseconds;
```

### After Consolidation
```ts
// Use library function directly
import { differenceInDays } from 'simple-rrule';

const diffInDays = differenceInDays(maxDate, minDate);
return diffInDays <= 90; // 3 months in days
```

## Implementation Priority

### High Priority
1. **Move TIME_DURATIONS to utils/date-utils.ts** (single source)
2. **Replace manual `.getTime()` arithmetic with simple-rrule difference functions**
   - `src/handlers/core/FreeBusyEventHandler.ts:58`
   - `src/handlers/core/RecurringEventHelpers.ts`
3. **Fix production code importing from testing/constants**

### Medium Priority
1. **Replace formatBasicDateTime() with toRRuleDateString()**
2. **Use differenceInDays() instead of TIME_DURATIONS for clearer intent**

### Low Priority (Enhancement)
1. Add comparison helpers like `compareAsc`, `isBefore` for event sorting
2. Add `isLastDayOfMonth()` for recurring event edge cases
3. Add `getDaysInMonth()` where month calculations needed

## Testing Impact
- No API changes; library functions are well-tested in simple-rrule
- Test files already using duration constants will benefit from consolidation
- All date formatting tests should pass unchanged

## Summary
- **Currently using:** 2 functions from simple-rrule (`addDays`, `addMilliseconds`)
- **Available and unused:** 20+ time helper functions
- **Quick wins:** Replace custom duration math, consolidate constants, fix test import in production
- **Reduced code:** Estimated 50+ lines of custom date logic can be replaced
