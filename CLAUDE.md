# Google Calendar & Gmail MCP - Project Guidelines

## Authentication Setup (Test Mode with Multiple Accounts)

### Current Configuration
- OAuth app: `email-grep-service` (Google Cloud project)
- Credentials file: `credentials.json` (has client_id, client_secret, redirect_uris)
- Token storage: Uses `CALENDARMCP_TOKEN_PATH` environment variable for multi-account support
- Account mode: Use `ACCOUNT_MODE=test` for test user accounts

### Authenticating Both Accounts

The TokenManager stores multiple accounts in a single tokens.json file using account keys ("normal" and "test" by default).

**Account 1: Integrity Studio (test account)**
```bash
export ACCOUNT_MODE=test
export CALENDARMCP_TOKEN_PATH=~/.config/google-calendar-mcp/tokens.json
npm run auth
# Follow OAuth flow in browser for Integrity Studio account
```

**Account 2: alyshialedlie@gmail.com (test account)**
```bash
export ACCOUNT_MODE=test
export CALENDARMCP_TOKEN_PATH=~/.config/google-calendar-mcp/tokens.json
npm run auth
# Follow OAuth flow in browser for Gmail account
# Both tokens stored in same file with different account keys
```

### Verify Both Accounts
```bash
export GOOGLE_OAUTH_CREDENTIALS=./credentials.json
npm run verify-tokens
# Shows both accounts, their expiry times, and validity status
```

### Token Storage
- All tokens stored in: `~/.config/google-calendar-mcp/tokens.json`
- Default permission: 0600 (read/write owner only)
- TokenManager automatically refreshes access tokens 5 minutes before expiry
- Refresh tokens are rotated on each refresh cycle

### Important Notes
- Test mode tokens expire after 7 days (requires re-authentication)
- ACCOUNT_MODE environment variable selects which account's tokens to use at runtime
- Environment variables must be set before running `npm run auth` or starting the MCP server
- For Claude Desktop integration, set env vars in `claude_desktop_config.json`

## Development

```bash
npm install          # Install dependencies
npm run build        # Build TypeScript to JavaScript
npm run dev          # Dev mode with file watching
npm run lint         # Type-check with TypeScript
npm test             # Run unit tests
npm run test:integration  # Run integration tests
```

## Token Management
- TokenManager (src/auth/tokenManager.ts): Multi-account token lifecycle
- AuthServer (src/auth/server.ts): OAuth 2.0 authorization code flow
- getSecureTokenPath (src/auth/paths.js): Respects CALENDARMCP_TOKEN_PATH env var

## Gmail OAuth Setup

### Authenticating Gmail

Gmail tokens are stored separately in `tokens-gmail.json` with full read/modify access:

```bash
node auth-gmail.mjs
# Opens browser for OAuth flow
# Tokens saved to: ~/.config/google-calendar-mcp/tokens-gmail.json
```

### Using Gmail Tools

After authentication, five MCP tools available:

**1. `gmail-search-messages`**
- Search Gmail with queries: `is:unread`, `from:user@example.com`, `subject:hello`
- Returns message count and details (subject, from, date, snippet)
- Supports pagination with pageToken

**2. `gmail-get-profile`**
- Get profile info: email address, total messages, total threads
- Quick account summary

**3. `gmail-modify-messages`**
- Actions: `markRead`, `markUnread`, `archive`, `delete`, `addLabel`, `removeLabel`
- Batch operations: modify multiple messages at once
- Requires `labelId` for label operations
- Returns status of each operation

**4. `gmail-create-label`**
- Create new Gmail labels for organizing emails
- Set visibility: `labelShow` (visible in label list) or `labelHide` (hidden)
- Set message visibility: `show` (appears in message list) or `hide` (hidden)
- Returns label ID for use with other tools

**5. `gmail-create-filter`**
- Create filters to auto-organize emails based on criteria
- Criteria: from, to, subject, query, hasAttachment, excludeChats
- Actions: auto-label, auto-archive, mark read/spam/trash, forward, etc.
- Applies to all future matching emails

### Quick Check Script

```bash
node check-gmail.mjs
# Returns unread message count
```

### Token Storage
- Gmail tokens: `~/.config/google-calendar-mcp/tokens-gmail.json`
- Separate from calendar tokens (tokens.json)
- Default permission: 0600 (secure)
- Scopes: `gmail.readonly`, `gmail.modify`

## Script Development Best Practices

### Avoid Heredocs with Pipes
⚠️ **Never use bash heredocs with pipe characters (`|`) — causes "parse error near |'" errors**

❌ **Bad:**
```bash
cat > /tmp/script.mjs << 'EOF'
# script content with pipes or complex syntax
EOF
```

✅ **Good Options:**
1. **Use Write tool for file creation:**
   ```typescript
   Write({file_path: "/tmp/script.mjs", content: "..."})
   ```

2. **Write project files instead of /tmp:**
   - Create files in project root (e.g., `analyze-emails.mjs`)
   - Commit to git if reusable
   - Avoid /tmp for package dependencies

3. **If using bash heredoc, keep it simple:**
   - No pipes, special chars, or complex syntax
   - Only plain text content
   - Use node scripts in project root instead

### Dependencies in Scripts
- Scripts in `/tmp` cannot access `node_modules` from project
- Use project root for scripts that import npm packages
- Or: Install packages globally (`npm install -g package-name`)
- Or: Reference absolute paths to node_modules

## Email Organization System

### Overview
A comprehensive email filtering and archiving system to manage high-volume inboxes by categorizing and protecting important items.

### Core Pattern: Label + Conditional Archive
- **Future Events**: Label "Events", keep in inbox
- **Past Events**: Label "Events", archive from inbox
- **Important Items**: Label "Keep Important", never archive (payments, rate limits, services)
- **Routine Notifications**: Label category, archive to keep inbox clean

### Key Scripts

**Status & Management:**
```bash
node list-unread-emails.mjs
# Shows all unread emails categorized by label/sender, summary counts
# Categories: Sentry Alerts, Keep Important, Events, Monitoring, Product Updates, etc.
```

**Apply Filters:**
```bash
node apply-filters-to-unread.mjs
# Applies created filters to current unread emails
```

**Batch Filter Creation:**
```bash
node create-remaining-filters.mjs
# Creates filters for: Product Updates, Communities, Services & Alerts
# Auto-applies to matching existing emails
```

**Conditional Filters:**
```bash
# Billing: regular emails archived, urgent (rate limit) emails protected
node create-billing-filter.mjs
node apply-billing-filter-to-unread.mjs

# Events: future events stay, past events archive
node filter-events-by-date.mjs

# Monitoring: SigNoz alerts archived automatically
node archive-signoz-dmarc.mjs
```

**Protection:**
```bash
# Prevent important items from being archived
node protect-important-inbox.mjs
# Labels: Cloudflare rate limits, Calendly refunds/support, Capital City Village, Investment Banking
```

### Categories & Organization

**Protected (Keep Important):**
- Cloudflare rate limits and DDoS alerts
- Calendly refunds and support
- Capital City Village services
- Investment Banking meetings

**Events (Future = Keep, Past = Archive):**
- International House events
- Meetup group meetups
- Eventbrite event announcements
- Calendly meeting reminders

**Monitoring (Archive):**
- SigNoz alerts (alertmanager@signoz.cloud)
- DMARC authentication reports

**Product Updates (Label + Archive):**
- Google Workspace, Google Cloud, Google Analytics
- HubSpot, Postman, Resend, Mixpanel, OpenAI, Yodlee
- Adapty, DataHub, Storylane

**Communities:**
- Women Techmakers events

**Services & Alerts:**
- FoundersCard, Link, Heroku, Zillow, American Best, Zapier

**Billing:**
- Google Workspace invoices
- Google Cloud charges (rate-limit aware)

### Date Parsing (lib/date-based-filter.mjs)
Recognizes multiple date formats in email content:
- ISO: `2026-03-25`
- US: `03/25/2026`
- Text: `March 25, 2026`
- Weekday patterns: `@ Mon, Mar 23`
- Compares to current date for past/future classification

### Workflow Example
1. Run `list-unread-emails.mjs` to see current state
2. Create filters: `node create-remaining-filters.mjs`
3. Apply to existing emails: `node apply-filters-to-unread.mjs`
4. Protect important items: `node protect-important-inbox.mjs`
5. Archive routine notifications: `node archive-signoz-dmarc.mjs`
6. Process events: `node filter-events-by-date.mjs`
7. Verify results: `node list-unread-emails.mjs`
