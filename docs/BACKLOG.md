# Project Backlog

**Last Updated:** 2026-03-24

## Dependencies: Replace Custom Array Utilities with lodash-es

**Status:** ✅ Done
**Complexity:** Low
**Impact:** High (code reduction + maintainability)
**Discovery Date:** 2026-03-25

**Opportunity:**
The `src/utils/aggregationHelpers.ts` file exports 5 common array utility functions that are well-handled by the `lodash-es` library:

| Custom Function | lodash-es Equivalent | Usage |
|---|---|---|
| `sumBy(items, keyFn)` | `sumBy(items, keyFn)` | Reduce: 5 lines → 0 lines |
| `groupBy(items, keyFn)` | `groupBy(items, keyFn)` | Reduce: 6 lines → 0 lines |
| `countBy(items, keyFn)` | `countBy(items, keyFn)` | Reduce: 6 lines → 0 lines |
| `indexBy(items, keyFn)` | `keyBy(items, keyFn)` | Reduce: 6 lines → 0 lines |
| `uniqBy(items, keyFn)` | `uniqBy(items, keyFn)` | Reduce: 8 lines → 0 lines |

**Total:** 114 LOC → 0 LOC (delete entire file)

**Scope:**
1. Add `lodash-es` to dependencies: `npm install lodash-es @types/lodash-es`
2. Replace imports across codebase:
   - `src/handlers/core/batchUtils.ts` — imports `groupBy`
   - `src/handlers/core/eventFormatting.ts` — imports `groupBy`
   - `src/tests/integration/test-data-factory.ts` — imports `groupBy`
3. Delete `src/utils/aggregationHelpers.ts` entirely
4. Update imports to: `import { groupBy, sumBy, countBy, keyBy, uniqBy } from 'lodash-es';`

**Files Affected:**
- `src/utils/aggregationHelpers.ts` — DELETE
- `src/handlers/core/batchUtils.ts` — Update import
- `src/handlers/core/eventFormatting.ts` — Update import
- `src/tests/integration/test-data-factory.ts` — Update import
- `package.json` — Add lodash-es dependency

**Benefits:**
- **Maintenance:** Leverage battle-tested library instead of custom implementations
- **Discoverability:** Developers recognize lodash patterns; no learning curve
- **Consistency:** Aligns with industry standard (lodash is ubiquitous)
- **Performance:** lodash-es is optimized and tree-shakeable
- **Reduction:** Delete 114 lines of util code

**Notes:**
- `uniqBy` in lodash extracts keys; our custom version also extracted keys so behavior matches
- `indexBy` maps to lodash `keyBy` — identical semantics
- lodash-es supports ES6 imports (tree-shakeable) instead of CommonJS bloat

---


## Dependencies: Consolidate Date Utilities with date-fns

**Status:** ✅ Done
**Complexity:** Medium
**Impact:** Medium (reduces simple-rrule dependency creep)
**Discovery Date:** 2026-03-25

**Opportunity:**
`src/utils/date-utils.ts` wraps or reimplements date functions that are better handled by `date-fns` or `simple-rrule` alone. Current dependency on `simple-rrule` already provides much of this; consider whether to:
- Option A: Extend `simple-rrule` usage (lighter)
- Option B: Migrate to `date-fns` + keep `simple-rrule` for recurrence only (more flexible)

**Wrapper Functions to Eliminate:**

| Custom Function | Current Impl | Replacement | LOC |
|---|---|---|---|
| `addDays, addMonths, addYears` | Wraps `simple-rrule` | `date-fns: add()` or keep as-is | 3-6 |
| `durationMs/Hs/Days/Mins/Secs` | Wraps `simple-rrule` difference | `date-fns: difference*()` | 10-15 |
| `formatRFC3339, formatISODateTime` | Manual string split | `date-fns: formatISO()` | 4-6 |
| `getFutureDate, getPastDate` | Calls `addDays` | Direct: `addDays(new Date(), n)` | 4 |
| `isFutureDate, isPastDate` | Wraps `simple-rrule` | `date-fns: isFuture(), isPast()` | 4 |
| `compareDates` | Wraps `simple-rrule.compareAsc` | `date-fns: compareAsc()` | 1 |
| `getDaysInCurrentMonth, isMonthEnd` | Wraps `simple-rrule` | `date-fns: getDaysInMonth(), isLastDayOfMonth()` | 2 |

**Scope:**
1. **Decision:** Keep `simple-rrule` (recurrence-focused) or migrate fully to `date-fns`?
   - **Simple-rrule only:** No new deps; keep current wrapper layer
   - **date-fns route:** Add `date-fns` (28KB), simplify many wrappers, unify around one date library
2. If choosing **date-fns**:
   - `npm install date-fns`
   - Replace `simple-rrule` date imports with `date-fns`
   - Keep `simple-rrule` for RRULE parsing only (`toRRuleDateString, rrule parsing`)
   - Delete ~40 lines of thin wrappers
3. Audit all 40+ usages of `date-utils` functions to verify API compatibility

**Files Affected:**
- `src/utils/date-utils.ts` — Refactor or remove wrapper layer
- All files importing from `date-utils` — Verify no breaking changes
- `package.json` — Add `date-fns` (if chosen)

**Benefits (date-fns path):**
- **Simplification:** Delete thin wrapper functions; call date-fns directly
- **Flexibility:** date-fns has richer locale + formatting support
- **Bundle size:** Comparable to simple-rrule; tree-shakeable
- **Clarity:** Standard library patterns vs. bespoke wrappers

**Risks:**
- **API mismatch:** Our wrappers normalize order of args (e.g., `durationMs(from, to)` vs date-fns `differenceInMilliseconds(to, from)`)
  - Mitigation: Keep thin wrapper layer for order normalization; only delegate to date-fns
- **RRULE handling:** `simple-rrule` is optimized for recurrence; date-fns requires separate rrule library
  - Recommendation: Keep `simple-rrule` for recurrence, use `date-fns` for general date math

**Notes:**
- Current usage of `simple-rrule`: `toRRuleDateString`, `compareAsc`, `getDaysInMonth`, `isBefore`, `isLastDayOfMonth`, `differenceIn*` functions
- Consider hybrid approach: `date-fns` for general math, `simple-rrule` for recurrence

---


## Dependencies: Replace Custom Batch Chunking with p-limit

**Status:** ✅ Done
**Complexity:** Low
**Impact:** Low–Medium (cleaner concurrency control)
**Discovery Date:** 2026-03-25

**Opportunity:**
`src/utils/batchProcessor.ts` implements parallel batch processing with manual chunking:
- `processBatchItems()` — Already uses `Promise.all()` (no concurrency limit)
- `processBatchItemsChunked()` — Manual loop chunking to control parallelism

The `p-limit` library (3KB) or `p-queue` (8KB) can replace the chunking logic cleanly.

**Current Implementation:**
```typescript
// Lines 106–136: Manual slice/chunk loop
for (let chunkIndex = 0; chunkIndex < items.length; chunkIndex += batchSize) {
  const chunk = items.slice(chunkIndex, chunkIndex + batchSize);
  const promises = chunk.map(item => operation(item));
  const outcomes = await Promise.all(promises);
  // ... error handling
}
```

**Replacement with p-limit:**
```typescript
import pLimit from 'p-limit';

const limit = pLimit(batchSize);
const promises = items.map(item => limit(() => operation(item)));
const outcomes = await Promise.all(promises);
```

**Scope:**
1. Add `p-limit` to dependencies: `npm install p-limit`
2. Refactor `processBatchItemsChunked()`:
   - Remove manual `for` loop (10+ lines)
   - Use `pLimit` to control concurrency
   - Keep error aggregation logic
3. Consider simplifying `processBatchItems()` to always use p-limit with max concurrency
4. Update callers: None expected (internal utility); test thoroughly

**Files Affected:**
- `src/utils/batchProcessor.ts` — Simplify chunking logic (~15 LOC saved)
- `package.json` — Add p-limit dependency

**Benefits:**
- **Clarity:** Concurrency semantics explicit (`const limit = pLimit(5)`) vs. manual chunking
- **Correctness:** p-limit is battle-tested; manual chunking can have edge cases
- **Maintenance:** Single responsibility — library handles concurrency, we handle errors
- **Flexibility:** Easy to tune batch size; no loop refactoring needed

**Alternative:** Use `Promise.allSettled()` to handle all errors cleanly instead of manual outcome tracking.

---


## Dependencies: Email Parsing with parseaddr or email-addresses

**Status:** 🔲 DEFER
**Complexity:** Low
**Impact:** Low (1–2 uses; niche functionality)
**Discovery Date:** 2026-03-25

**Opportunity:**
Gmail utility functions in `lib/email-analyzer.mjs` implement custom email header parsing:

| Custom Function | Behavior | Replacement Lib |
|---|---|---|
| `extractDisplayName(from)` | Parses "Name <email@addr>" → "Name" | `parseaddr` or `email-addresses` |
| `extractEmailAddress(from)` | Parses "Name <email@addr>" → "email@addr" | `parseaddr` or `email-addresses` |

**Current Implementation:**
```javascript
export function extractDisplayName(from) {
  const match = from.match(/^([^<]*)<[^>]+>$/);
  return match ? match[1].trim() : from;
}

export function extractEmailAddress(from) {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}
```

**Scope:**
1. Evaluate libraries:
   - **parseaddr** (2KB) — Lightweight; standard `mailbox` parsing
   - **email-addresses** (20KB) — Comprehensive RFC 5322 parsing
2. Choose based on usage frequency and complexity
3. Replace 2 functions in `lib/email-analyzer.mjs`
4. No type changes needed (input/output same)

**Files Affected:**
- `lib/email-analyzer.mjs` — Replace `extractDisplayName` and `extractEmailAddress`
- `package.json` — Add `parseaddr` or `email-addresses`

**Benefits:**
- **Correctness:** Handles edge cases (quoted names, angle brackets in display names, etc.)
- **Standards:** RFC 5322 compliant parsing vs. regex heuristics
- **Simplicity:** Delete 2 regex-based functions

**Caveats:**
- **Usage:** These functions used in ~1–2 email scripts; low impact if not done
- **Bundle size:** If only 2 uses, custom regex might still be lighter
- **Recommendation:** Defer unless email parsing becomes more complex

---


## Dependencies: Gmail Search Query Building with query-string

**Status:** 🔲 DEFER
**Complexity:** Low
**Impact:** Low (single utility function)
**Discovery Date:** 2026-03-25

**Recommendation:** **Skip this item** — custom implementation is lightweight and domain-specific. Premature abstraction; defer unless search criteria become more complex.

---
