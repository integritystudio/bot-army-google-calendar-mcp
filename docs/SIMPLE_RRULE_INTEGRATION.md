# Simple RRule Integration

## Overview
`simple-rrule` (v1.8.1) has been installed to provide TypeScript-first RRULE parsing, validation, and expansion capabilities.

## Installation Changes
- **Package**: `simple-rrule@^1.8.1` added to `dependencies`
- **Zod upgrade**: Upgraded from `^3.22.4` to `^4.x` (simple-rrule requires zod@>=4)
- **Installation**: Used `--legacy-peer-deps` due to openai's optional zod@^3.x peer dependency

## What simple-rrule Provides

### Core Functions
```typescript
// Parse RRULE strings
parseRecurrenceFromString(rruleString) -> IRrule | undefined

// Serialize to RRULE
getRRuleString(rule) -> string

// Expand rules to actual dates
expandRRuleFromString(rruleString, startDate, endDate) -> IExpandResult
expandRRule(rule, startDate, endDate) -> IExpandResult

// Date utilities
toRRuleDateString(date) -> string    // Format for RRULE UNTIL clauses
fromRruleDateStringToDate(str) -> Date
```

### IRrule Object Structure
```typescript
{
  dtStart: string;           // ISO 8601 datetime
  dtEnd: string;             // ISO 8601 datetime
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | ...;
  interval: number;          // e.g., every 2 weeks
  count?: number;            // Limit occurrences
  until?: string;            // UNTIL date (ISO format)
  byDay: string;             // 'MO,WE,FR', etc.
  byMonth: number;           // Month number
  byMonthDay: number;        // Day of month
  bySetPos: number;          // Position in set
  wkst: 'SU' | 'MO' | ...;   // Week start day
}
```

## Migration Path

### Current Setup (Keeps Existing Code)
Our custom `RRULE_PATTERNS` regex-based approach is kept for now:
- `stripUntilAndCount()` - removes UNTIL/COUNT clauses
- `buildUntilClause()` - constructs UNTIL clauses
- `isRRuleString()` - detects RRULE vs EXDATE/RDATE

**Why**: These are simple string operations that don't require full parsing. The regex approach is fast and doesn't need the overhead of parsing.

### New Adapter (simple-rrule-adapter.ts)
For future enhancements, use the adapter module:
```typescript
import {
  parseRRule,           // Parse RRULE string
  serializeRRule,       // Convert back to string
  expandRRuleToDateRange,  // Get all occurrences
  setRRuleUntil,        // Update UNTIL
  clearRRuleConstraints  // Remove COUNT/UNTIL
} from './simple-rrule-adapter.js';
```

### Use Cases for Replacement

**When to use simple-rrule**:
- Validating complex RRULE strings
- Expanding rules to find all occurrences
- Modifying rule objects and serializing
- Handling edge cases (leap years, DST, month boundaries)

**When to keep regex**:
- Simple string manipulations (strip/build clauses)
- Performance-critical paths (parsing on every update)
- Pattern matching against EXDATE/RDATE

## Example Usage

```typescript
import { expandRRuleToDateRange } from './utils/simple-rrule-adapter.js';

// Get all daily occurrences in a date range
const rrule = 'RRULE:FREQ=DAILY;COUNT=7;DTSTART=20260324T100000Z';
const dates = expandRRuleToDateRange(
  rrule,
  new Date('2026-03-24'),
  new Date('2026-04-01')
);

console.log(dates);
// [2026-03-24, 2026-03-25, 2026-03-26, ...]
```

## Testing
The installation was verified with:
```javascript
parseRecurrenceFromString('RRULE:FREQ=DAILY;COUNT=3')
// Successfully parses and returns IRrule object

expandRRuleFromString(rruleString, start, end)
// Successfully expands to 3 dates
```

## Known Limitations
- `simple-rrule` does not support TZ (timezone) in RRULE
- Our custom UNTIL date formatting (basic ISO: `YYYYMMDDTHHMMSSZ`) is preserved for Google Calendar compatibility
- The library works with ISO 8601 dates; careful conversion needed for all-day events

## Next Steps
1. **Gradual migration**: Use adapter for RecurringEventHelpers validation
2. **Validation layer**: Wrap parseRRule to validate calendar compatibility
3. **Testing**: Add unit tests for edge cases with simple-rrule
4. **Documentation**: Update RecurringEventHelpers docs with examples
