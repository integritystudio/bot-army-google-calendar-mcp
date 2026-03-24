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

## Script Development

**Code Quality:**
- `npm run check-duplicates` — Detect repeated code blocks (scans src/ with 6-line window)

**Avoid bash heredocs with pipes** (causes "parse error near |'"):
- Use Write tool or create `.mjs` files in project root instead of `/tmp`
- `/tmp` scripts can't access `node_modules`; use project root for npm imports
- If using heredoc, keep it simple (no pipes, special chars, or complex syntax)

**Code Quality:**
- Avoid dead variables; use derived values instead
- Remove comments that duplicate code (keep only non-obvious WHY)
- Extract repeated patterns into shared utilities
- Use named constants instead of magic strings
- Don't mutate input params; create local copies
- Prefer direct operations over redundant existence checks (TOCTOU)
- Array.slice() naturally clamps; Math.min unnecessary

## Email Organization System

Core pattern: Label → conditional archive (keep future events, important items, archive routine notifications).

**Key Scripts:**
```bash
node list-unread-emails.mjs           # Summary by category/sender
node summarize-remaining.mjs          # Remaining uncategorized (internal work, forums)
node describe-internal.mjs            # Detailed breakdown of internal team emails (Chandra, Jordan, John, Alex)
node create-remaining-filters.mjs     # Create filters (Product Updates, Communities, Services)
node apply-filters-to-unread.mjs      # Apply filters to current unread
node protect-important-inbox.mjs      # Protect: Cloudflare alerts, Calendly, Capital City Village, Investment Banking
node filter-events-by-date.mjs        # Events: future=keep, past=archive
node archive-signoz-dmarc.mjs         # Monitoring/DMARC auto-archive
```

**Categories:**
| Type | Treatment | Senders/Items |
|------|-----------|---|
| Protected | Never archive | Cloudflare rate limits, Calendly support, CCV services, IB meetings |
| Events | Future keep, past archive | International House, Meetup, Eventbrite, Calendly reminders |
| Monitoring | Archive | SigNoz alerts, DMARC reports |
| Product Updates | Label + archive | Google Cloud/Workspace, HubSpot, OpenAI, Postman, Resend, Yodlee, Adapty, DataHub |
| Communities | Keep | Women Techmakers |
| Services | Archive | FoundersCard, Link, Heroku, Zapier, Zillow |
| Billing | Conditional | GW invoices, GC charges (rate-limit aware) |

**Shared Utilities:**
- `lib/gmail-client.mjs` - Authenticated Gmail client factory; use `createGmailClient()` in all scripts (✅ Applied to 65+ scripts)
- `lib/gmail-label-utils.mjs` - Label resolution utilities (NEW - see L6 below)
  - `buildLabelCache(gmail)` - Fetch all labels once at startup
  - `resolveLabelId(gmail, labelName, labelCache)` - Cached single label lookup
  - `resolveLabelIds(gmail, labelNames)` - Batch label resolution
- `lib/gmail-batch.mjs` - Batch filter operations for 10-100x speedup
- `lib/date-based-filter.mjs` - Pure utility for date parsing (ISO, US, text, weekday patterns; no mutations)

**Code Quality:**
- **Established patterns:** Refactored scripts use best practices (error handling, named constants, getHeader() helpers, parallel `Promise.all` for list + detail fetches)
- **Performance:** Use `Promise.all` for concurrent list + detail fetches (not serial loops)
- **L6 Pattern (NEW):** Dynamic label ID resolution for portability across accounts
  - See `docs/LABEL-RESOLUTION-GUIDE.md` for complete pattern documentation
  - Replace hardcoded `Label_N` IDs with `labelCache.get('Label/Name')`
  - Enables scripts to work across different Gmail accounts with different label IDs

## Backlog & Roadmap

**Current Status:** 24/24 items complete (100%) ✅ - See [`docs/changelog/1.4.9/CHANGELOG.md`](docs/changelog/1.4.9/CHANGELOG.md)

### Recently Completed (v1.4.9)
✅ **L1:** createGmailClient() refactoring (applied to 65+ scripts)
✅ **L2:** Batch filter operations (`lib/gmail-batch.mjs`)
✅ **L3:** TOCTOU risk mitigation in token handling
✅ **L4:** process.exit pattern documentation
✅ **L5:** Extract shared helpers (createLabels, applyPatterns)
✅ **L6:** Dynamic label ID resolution (new feature)
✅ **L7:** Email analyzer module extraction & code quality audit
✅ **Auth Refactor:** Replace validateTokens with isAuthenticated; implement getCredentials
✅ **Timezone Utils:** Consolidate datetime utilities, eliminate duplication (19 lines reduced)
✅ **Test Architecture:** Integration tests for conflict detection via MCP protocol
✅ **Medium Priority:** Sequential API optimization (~500ms latency reduction), loop isolation anti-patterns

### Design Decision Log
All originally blocked items now complete. See [`docs/BACKLOG.md`](docs/BACKLOG.md) for detailed implementation notes and [`docs/CHANGELOG.md`](docs/CHANGELOG.md) for version history.
