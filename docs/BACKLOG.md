# Project Backlog

**Last Updated:** 2026-08-12 (session 3)

## Constants: Fold lib/constants.mjs Gmail Literals into src/shared/gmail-core.ts

**Status:** 🔲 DEFER
**Complexity:** Low (mechanical, but wide)
**Impact:** Medium (a divergence here is silent)
**Discovery Date:** 2026-08-12

**Opportunity:**
`src/shared/gmail-core.ts` was introduced to give the MCP handlers and the CLI scripts
one copy of Gmail's paging, batching and retry primitives. Four constants were left
behind and now exist on both sides:

| Constant | `lib/constants.mjs` | `src/shared/gmail-core.ts` | CLI callers |
|---|---|---|---|
| `USER_ID` / `GMAIL_USER_ID` | `'me'` (L2) | `'me'` (L13) | 18 files |
| `GMAIL_BATCH_MODIFY_LIMIT` | `1000` (L251) | `1000` (L15) | **0 — now dead** |
| `GMAIL_INBOX` | `'INBOX'` (L5) | — (`GMAIL_LABEL_INBOX` in `gmailUtils.ts`) | 7 files |
| `GMAIL_UNREAD` | `'UNREAD'` (L256) | — (`GMAIL_LABEL_UNREAD` in `gmailUtils.ts`) | 9 files |

The system-label names live in a third place too: `GMAIL_LABEL_INBOX`/`SPAM`/`TRASH`/`UNREAD`
in `src/handlers/gmail/gmailUtils.ts`, which `LABEL_FLAGS` uses to map `archive`/`markAsRead`
onto label changes.

**Scope:**
1. Delete `GMAIL_BATCH_MODIFY_LIMIT` from `lib/constants.mjs` — no remaining reference
   outside its own definition since batching moved to the shared core. Zero-risk first step.
2. Decide where the system-label names belong (shared core is the natural home, since both
   `LABEL_FLAGS` and the CLI's filter actions consume them) and re-export from the other two.
3. Repoint `USER_ID` last — 18 files, and the rename to `GMAIL_USER_ID` is the noisy part.

**Files Affected:**
- `lib/constants.mjs` — remove the duplicated definitions, or re-export from the core
- `src/shared/gmail-core.ts` — becomes the single definition site
- `src/handlers/gmail/gmailUtils.ts` — `GMAIL_LABEL_*` re-export rather than redefine

**Benefits:**
- **Correctness:** a value that must match on both sides cannot drift
- **Cleanup:** one already-dead constant removed immediately

**Caveats:**
- **Low urgency:** these are stable string literals, not logic — `'me'` will not change
- **Churn vs. payoff:** step 3 touches 18 files to dedupe a three-character string; do it
  only alongside other work in those files
- **Constraint:** anything the CLI imports from `src/shared/gmail-core.ts` must keep that
  module free of relative `.js` import specifiers, or `.mjs` callers break at runtime with
  `ERR_MODULE_NOT_FOUND` (Node does not rewrite `.js` → `.ts` the way TypeScript does)

---

## Label Resolution: Reconcile lib/gmail-label-utils.mjs with the Shared Core

**Status:** 🔲 DEFER — revisit when a handler needs bulk resolution
**Complexity:** Medium
**Impact:** Low (the two are not currently the same operation)
**Discovery Date:** 2026-08-12

**Opportunity:**
Label lookup did not move into `src/shared/gmail-core.ts` with the other primitives,
because the two sides solve genuinely different problems:

| Side | Function | Shape | Callers |
|---|---|---|---|
| CLI | `buildLabelCache` / `buildLabelIndex` (`lib/gmail-label-utils.mjs`) | one `labels.list`, whole-mailbox `Map` both directions + user/system split | 14 / 5 files |
| CLI | `ensureLabelExists` (`lib/gmail-filter-utils.mjs`) | get-or-create, cache-first | 5 files |
| MCP | `getLabelByName` (`src/shared/gmail-core.ts`) | one name → one `Schema$Label`, via `labels.list` + `labels.get` | 1 handler |

A script resolving dozens of labels wants the cache; a handler resolving one wants the
single lookup with counts attached. Forcing them together today would make one caller pay
for the other's shape — the handler would fetch the whole mailbox's labels, or the scripts
would issue one round trip per label.

**Scope:**
1. Trigger to revisit: a second MCP handler needing label resolution, or any handler
   resolving more than one name per call.
2. If triggered, move `buildLabelIndex` into the shared core (it is the general primitive —
   `buildLabelCache` is already just its `byName` half) and rebuild `getLabelByName` on top,
   keeping the `labels.get` step so message/thread counts survive.
3. `ensureLabelExists` and `GmailCreateLabelHandler`'s 409 path already agree behaviourally
   as of this session; keep them that way if either changes.

**Files Affected:**
- `lib/gmail-label-utils.mjs` — `buildLabelIndex` would move; `buildLabelCache` becomes a wrapper
- `lib/gmail-filter-utils.mjs` — `ensureLabelExists` rebuilds on the shared lookup
- `src/shared/gmail-core.ts` — gains the index; `getLabelByName` layers over it

**Benefits:**
- **Consistency:** one definition of "resolve a label name", including the system/user split
- **Reuse:** handlers get whole-mailbox resolution without reimplementing the cache

**Caveats:**
- **Not a duplication today:** merging now would be speculative — the two shapes have
  different cost profiles, and neither currently has a bug the other would fix
- **Cache staleness:** `buildLabelCache` is built once per run; a handler is long-lived, so a
  shared cache would need invalidation the CLI has never needed
- **`resolveLabelId`/`resolveLabelIds` have 1 caller each** — check whether they are worth
  keeping at all before porting them

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
