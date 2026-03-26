# Project Backlog

**Last Updated:** 2026-03-26 (session 2)

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
