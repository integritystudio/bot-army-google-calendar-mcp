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
- ⚠️ Integration tests removed (referenced non-existent AuthenticationService)

## Script Development

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

**Code Quality:**
- **Refactor targets:** Extract OAuth to `lib/gmail-client.mjs` (use `homedir()` from 'os', token guard, try/catch); label constants to `lib/constants.mjs`; batch ops to `lib/gmail-batch.mjs`
- **Performance:** Use `Promise.all` for concurrent fetches (see `summarize-remaining.mjs` pattern: parallel list + parallel get)
- **Date Parsing:** `lib/date-based-filter.mjs` is a pure utility (ISO, US, text, weekday patterns; no mutations)
