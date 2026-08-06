# Google Calendar & Gmail MCP - Project Guidelines

## Auth & Development

**OAuth Setup** (test mode):
```bash
export GOOGLE_ACCOUNT_MODE=test CALENDARMCP_TOKEN_PATH=~/.config/google-calendar-mcp/tokens.json
npm run auth  # Creates tokens.json; repeat for multiple accounts
npm run verify-tokens  # Verify auth status (calendar; uses ./credentials.json)
```

**Dependency gotcha:** `package.json` overrides pin `googleapis-common@8.0.1` — 8.0.3 exact-pins a nested `google-auth-library@10.5.0` that duplicates the root copy and breaks `npm run lint` with `OAuth2Client` type mismatches. Verified still required at googleapis 173; recheck on future bumps.

**Env var split (gotcha):** TypeScript calendar code (`src/auth/paths.js`) reads `GOOGLE_ACCOUNT_MODE`; the root `.mjs` Gmail scripts (`lib/gmail-client.mjs`) read `ACCOUNT_MODE`. Setting only one leaves the other side on its default account.

**Google Calendar API gotchas (recurring events):** inserts require an explicit `timeZone` on start/end even when dateTime carries a UTC offset (else 400 "Missing time zone definition"); durations must be whole seconds — a 1ms start/end skew gets a bare 400. Use `stripSubseconds()` (date-utils) on paired values.

**Gmail Tokens:**
```bash
node auth-gmail.mjs      # Creates tokens-gmail.json (separate from calendar; ACCOUNT_MODE selects account)
node verify-tokens.mjs   # Verify Gmail token status
```

**Development:**
```bash
npm install | npm run build | npm run dev | npm test
npm run lint              # tsc --noEmit (tsconfig.lint.json)
npm run test:all          # Unit + integration with doppler-injected creds (integrity-studio/dev)
npm run test:integration  # Integration tests with doppler creds (test:doppler for unit)
npm run repomix           # Regenerate docs/repomix/ artifacts (token tree, compressed/full/docs/git-ranked XML)
```

**Auth Details:**
- Tokens stored in `~/.config/google-calendar-mcp/tokens.json` (calendar) and `tokens-gmail.json` (Gmail)
- `GOOGLE_ACCOUNT_MODE` (calendar) / `ACCOUNT_MODE` (Gmail .mjs) selects account; TokenManager auto-refreshes 5 min before expiry
- Test tokens expire after 7 days; set env vars before `npm run auth` or in `claude_desktop_config.json`
- Token files use 0600 permissions; TokenManager (src/auth/tokenManager.ts) handles multi-account lifecycle

**Testing:**
- `npm test` runs unit tests (all passing); `npm run test:integration` requires live API
- Use `{ type: 'text'; text: string }` content assertions, never `as any`
- Test history and milestones: `docs/changelog/` ([CHANGELOG.md](docs/CHANGELOG.md))
- Known gap: `claude-mcp-integration.test.ts` fails at beforeAll under `test:all` — CLAUDE_API_KEY is not in doppler integrity-studio/dev; its 6 tests skip. Not a code failure.

**Test Helpers & Fixtures** (`src/tests/unit/helpers/`, `src/tests/integration/`):
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
- `list-unread-emails.mjs`, `list-inbox.mjs`, `summarize-remaining.mjs` — Email analysis
- `list-unlabeled-unread.mjs [--preview N] [--all]` — Count/preview unread emails with no user label (inbox by default; `--all` adds an exact mailbox-wide count, slow on large archives)
- `dump-messages.mjs [--max N] "<gmail-query>"` — TSV dump (date, from, subject) of messages matching any Gmail query; count goes to stderr so stdout pipes cleanly
- `organize-emails.mjs` — Full pipeline: label, filter, and conditionally archive emails
- `create-gmail-filters.mjs` — Batch create Gmail filters from category definitions
- `create-other-filters.mjs` — Filters for uncategorized "Other" emails (GitHub, finance, travel, newsletters, etc.)
- `sublabel-services.mjs` — Sub-categorize Services & Alerts into Real Estate/Health/Utilities sublabels + auto-label filters (`--all` includes read mail)
- `protect-important-inbox.mjs`, `filter-events-by-date.mjs` — Filtering & organization
- `mark-read.mjs` (label/past-event based, `--archived-only`/`--past-events` flags), `mark-forums-read.mjs`, `archive-old-emails.mjs --label "X"` — Read/archive maintenance
- `mark-old-label-read.mjs --label "X" [--before YYYY/MM/DD]` — Mark a label's unread emails older than a cutoff (default 30 days) as read
- `mark-past-events-read.mjs [--label "Events"] [--dry-run]` — Date-classify a label's unread mail (subject/body via `classifyEmail`, HTML fallback); mark past events read, keep future/undatable unread
- `extract-event-details.mjs [--max N] [--full] "<gmail-query>" [query...]` — Print subject + body fragments around date/time/location keywords for each query's matches (calendar-entry prep without opening emails)
- `bulk-archive-unread.mjs` — Archive all unread inbox mail except "Keep Important" (stays unread; resumable; retry + batch-split on FAILED_PRECONDITION)
- `switch-account.mjs` — Switch active Google account (file-based resolution)

**Categories:** Protected (never archive) | Events (future=keep, past=archive) | Monitoring (archive) | Product Updates (label+archive) | Communities (keep) | Services (archive) | Billing (conditional)

**Shared Utilities (`lib/`):**
- `gmail-client.mjs` — Authenticated client factory (used by all root .mjs scripts)
- `gmail-label-utils.mjs` — Label caching: `buildLabelCache()`, `resolveLabelId()`, `resolveLabelIds()`
- `gmail-batch.mjs` / `gmail-batch-utils.mjs` — Batch operations (10-100x speedup)
- `gmail-message-utils.mjs` — Message header/body extraction, `decodeBase64Payload()`, `countMessagesMatching()` (exact paginated query counts), `fetchMessageHeaders()`
- `gmail-filter-utils.mjs` — Filter creation helpers
- `date-based-filter.mjs` — Date parsing utility (ISO, US, text formats; no mutations)
- `schema-extractor.mjs` — Schema.org type extraction from email HTML (htmlparser2)
- `email-analyzer.mjs` / `email-utils.mjs` — Email parsing, categorization helpers
- `constants.mjs` — Shared constants (DEFAULT_MAX_RESULTS, category definitions)
- `console-utils.mjs` — Formatted console output helpers

**Patterns:**
- Use `Promise.all` for concurrent fetches (not serial loops)
- Dynamic label resolution (L6) — `labelCache.get('Label/Name')` instead of hardcoded IDs (see `docs/LABEL-RESOLUTION-GUIDE.md`)

