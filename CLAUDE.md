# Google Calendar & Gmail MCP - Project Guidelines

## Auth & Development

**OAuth Setup** (test mode):
```bash
export ACCOUNT_MODE=test CALENDARMCP_TOKEN_PATH=~/.config/google-calendar-mcp/tokens.json
npm run auth  # Creates tokens.json; repeat for multiple accounts
npm run verify-tokens  # Verify auth status
```

**Gmail Tokens:**
```bash
node auth-gmail.mjs  # Creates tokens-gmail.json (separate from calendar)
node check-gmail.mjs  # Quick unread count
```

**Development:**
```bash
npm install | npm run build | npm run dev | npm test
```

**Auth Details:**
- Tokens stored in `~/.config/google-calendar-mcp/tokens.json` (calendar) and `tokens-gmail.json` (Gmail)
- `ACCOUNT_MODE` selects which account; TokenManager auto-refreshes 5 min before expiry
- Test tokens expire after 7 days; set env vars before `npm run auth` or in `claude_desktop_config.json`
- Token files use 0600 permissions; TokenManager (src/auth/tokenManager.ts) handles multi-account lifecycle

**Test Status:**
- ✅ Core handler tests (CreateEventHandler, GetEventHandler, GetCurrentTimeHandler)
- ✅ Type-safe content assertions using `{ type: 'text'; text: string }` instead of `as any`
- ✅ Integration tests for conflict detection via MCP protocol (real server, real API)
- ✅ 486/486 tests passing

**Test Helpers & Fixtures:**
Consolidated utilities reduce boilerplate across 30+ test files:
- `factories.ts` - Event fixtures (makeEvent, makeTeamMeetingEvent, createFullEventArgs, STANDARD_ATTACHMENTS, ATTACHMENT_IDS)
- `content.ts` - Response helpers (getTextContent, expectValidToolResponse, expectJsonResponse, assertTextContentContains)
- `handler-setup.ts` - Mock setup (setupListEventsHandler, createGoogleCalendarMocks)
- `integration-test-helpers.ts` - Lifecycle helpers (createAndVerifyEvent, updateAndVerifyEvent, expectModificationScopeError, expectEventUpdateSuccess)

## Script Development

**Tools & Code Quality:**
- `npm run check-duplicates` — Detect repeated code blocks (scans src/ with 6-line window)
- Avoid bash heredocs with pipes — use Write tool or `.mjs` files in project root (not `/tmp`)

**Code Principles:**
- Avoid dead variables; extract repeated patterns into utilities
- Use named constants instead of magic strings; keep only non-obvious WHY in comments
- Don't mutate input params; prefer direct operations over TOCTOU existence checks
- Array.slice() naturally clamps; Math.min unnecessary

**Key Utilities:**
- `eventManipulationUtils.ts` — `conditionallyAddFields()`, `buildCoreEvent()`, `buildOptionalEventFields()`
- `date-utils.ts` — `formatRFC3339()`, `addMilliseconds()`, `oneDayBefore()`, etc.
- `timezone-utils.ts` — `createTimeObject()`, `resolveTimeZone()`, etc.

## Email Organization System

Core pattern: Label → conditional archive (keep future events, important items, archive notifications).

**Key Scripts:**
- `list-unread-emails.mjs`, `summarize-remaining.mjs` — Email analysis
- `apply-filters-to-unread.mjs`, `protect-important-inbox.mjs`, `filter-events-by-date.mjs` — Filtering & organization
- `create-remaining-filters.mjs` — Filter setup

**Categories:** Protected (never archive) | Events (future=keep, past=archive) | Monitoring (archive) | Product Updates (label+archive) | Communities (keep) | Services (archive) | Billing (conditional)

**Shared Utilities:**
- `gmail-client.mjs` — Authenticated client factory (✅ 65+ scripts)
- `gmail-label-utils.mjs` — Label caching: `buildLabelCache()`, `resolveLabelId()`, `resolveLabelIds()`
- `gmail-batch.mjs` — Batch operations (10-100x speedup)
- `date-based-filter.mjs` — Date parsing utility (ISO, US, text formats; no mutations)

**Patterns:**
- Use `Promise.all` for concurrent fetches (not serial loops)
- Dynamic label resolution (L6) — `labelCache.get('Label/Name')` instead of hardcoded IDs (see `docs/LABEL-RESOLUTION-GUIDE.md`)

