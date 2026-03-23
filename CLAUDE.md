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
