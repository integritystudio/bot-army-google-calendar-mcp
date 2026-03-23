# Google Calendar & Gmail MCP Server

A Model Context Protocol (MCP) server that provides Google Calendar and Gmail integration for AI assistants like Claude.

## Features

### Calendar
- **Multi-Calendar Support**: List events from multiple calendars simultaneously
- **Event Management**: Create, update, delete, and search calendar events
- **Recurring Events**: Advanced modification capabilities for recurring events
- **Free/Busy Queries**: Check availability across calendars
- **Smart Scheduling**: Natural language understanding for dates and times
- **Inteligent Import**: Add calendar events from images, PDFs or web links

### Gmail
- **Message Search**: Query Gmail with flexible search filters (is:unread, from:, subject:, etc.)
- **Profile Management**: Get account information (message count, thread count, email address)
- **Multi-Account Support**: Use multiple Gmail accounts with separate OAuth tokens

## Quick Start

### Prerequisites

1. A Google Cloud project with the Calendar API enabled
2. OAuth 2.0 credentials (Desktop app type)

### Google Cloud Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one.
3. Enable the [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com) for your project. Ensure that the right project is selected from the top bar before enabling the API.
4. Create OAuth 2.0 credentials:
   - Go to Credentials
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "User data" for the type of data that the app will be accessing
   - Add your app name and contact information
   - Add the following scopes (optional):
     - `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/calendar`
   - Select "Desktop app" as the application type (Important!)
   - Save the auth key, you'll need to add its path to the JSON in the next step
   - Add your email address as a test user under the [Audience screen](https://console.cloud.google.com/auth/audience)
      - Note: it might take a few minutes for the test user to be added. The OAuth consent will not allow you to proceed until the test user has propagated.
      - Note about test mode: While an app is in test mode the auth tokens will expire after 1 week and need to be refreshed (see Re-authentication section below).

### Installation

**Option 1: Use with npx (Recommended)**

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "npx",
      "args": ["@cocal/google-calendar-mcp"],
      "env": {
        "GOOGLE_OAUTH_CREDENTIALS": "/path/to/your/gcp-oauth.keys.json"
      }
    }
  }
}
```

**⚠️ Important Note for npx Users**: When using npx, you **must** specify the credentials file path using the `GOOGLE_OAUTH_CREDENTIALS` environment variable.

**Option 2: Local Installation**

```bash
git clone https://github.com/nspady/google-calendar-mcp.git
cd google-calendar-mcp
npm install
npm run build
```

Then add to Claude Desktop config using the local path or by specifying the path with the `GOOGLE_OAUTH_CREDENTIALS` environment variable.

### First Run

1. Start Claude Desktop
2. The server will prompt for authentication on first use
3. Complete the OAuth flow in your browser
4. You're ready to use calendar features!

### Multi-Account Support (Test Mode)

This server supports multiple Google accounts in test mode with automatic token management.

**Setup both accounts:**

Account 1 (Initial):
```bash
export ACCOUNT_MODE=test
export CALENDARMCP_TOKEN_PATH=~/.config/google-calendar-mcp/tokens.json
npm run auth
```

Account 2 (Same file, different account key):
```bash
export ACCOUNT_MODE=test
export CALENDARMCP_TOKEN_PATH=~/.config/google-calendar-mcp/tokens.json
npm run auth  # Authenticates second account in same tokens.json
```

**Verify both accounts:**
```bash
export GOOGLE_OAUTH_CREDENTIALS="./credentials.json"
npm run verify-tokens
```

Outputs token status, expiry times, and account validity for all authenticated accounts.

**Important Notes:**
- Both accounts stored in single `tokens.json` file with separate keys
- Tokens expire after 7 days in test mode (Google requirement)
- TokenManager auto-refreshes tokens 5 minutes before expiry
- Set `ACCOUNT_MODE` environment variable before running the server to select which account is active

### Re-authentication

If you're in test mode (default), tokens expire after 7 days. If you are using a client like Claude Desktop it should open up a browser window to automatically re-auth. However, if you see authentication errors you can also resolve by following these steps:

**For npx users:**
```bash
export GOOGLE_OAUTH_CREDENTIALS="/path/to/your/gcp-oauth.keys.json"
export ACCOUNT_MODE=test
npx @cocal/google-calendar-mcp auth
```

**For local installation:**
```bash
export ACCOUNT_MODE=test
npm run auth
```

**To avoid weekly re-authentication**, publish your app to production mode (without verification):
1. Go to Google Cloud Console → "APIs & Services" → "OAuth consent screen"
2. Click "PUBLISH APP" and confirm
3. Your tokens will no longer expire after 7 days but Google will show a more threatning warning when connecting to the app about it being unverified.

See [Authentication Guide](docs/authentication.md#moving-to-production-mode-recommended) for details.

### Gmail OAuth Setup

To enable Gmail features, authenticate with Gmail scopes:

```bash
# Using the provided auth script
node auth-gmail.mjs
```

This will:
1. Open your browser for OAuth authentication
2. Request Gmail access (read and modify permissions)
3. Save tokens to `~/.config/google-calendar-mcp/tokens-gmail.json`

**Quick Check:**
```bash
# Check unread message count
node check-gmail.mjs
```

**Important Notes:**
- Gmail and Calendar tokens are stored separately
- Gmail scopes: `gmail.readonly`, `gmail.modify`
- Tokens expire after 7 days in test mode
- Re-authenticate as needed with `node auth-gmail.mjs`

### Email Organization & Filtering Scripts

Automated scripts for organizing and filtering large volumes of Gmail with focus on correctness and efficiency.

**Management Scripts:**
- `list-unread-emails.mjs` - Categorize and summarize unread emails by label/sender patterns; clean fallback categorization
- `summarize-remaining.mjs` - Summary of uncategorized/remaining unread emails (internal work, forums, misc); parallel fetching
- `describe-internal.mjs` - Detailed breakdown of internal team emails with subjects and dates
- `apply-filters-to-unread.mjs` - Apply existing filters to current unread emails
- `create-remaining-filters.mjs` - Batch create filters for multiple categories (Product Updates, Communities, Services)

**Specialized Filters:**
- `create-billing-filter.mjs` - Smart billing filter with conditional rate-limit detection
- `create-signoz-filter.mjs` - Archive SigNoz monitoring alerts automatically
- `create-dmarc-filter.mjs` - Organize DMARC authentication reports
- `create-eventbrite-filter.mjs` - Label and archive Eventbrite event emails
- `create-meet-notes-filter.mjs` - Label Google Meet notes
- `delete-sentry-filter.mjs` - Remove outdated filters

**Archive & Processing Scripts:**
- `archive-signoz-dmarc.mjs` - Batch archive monitoring and DMARC report emails using Gmail batch API
- `mark-signoz-read.mjs` - Mark SigNoz alerts as read in bulk
- `mark-past-events-read.mjs` - Classify event emails by date and mark past events as read
- `protect-important-inbox.mjs` - Label critical items to prevent archiving (payments, rate limits, services)

**Event Management:**
- `filter-events-by-date.mjs` - Classify event emails as future (label + keep) or past (label + archive)
- `organize-international-house.mjs` - Label and organize International House event emails

**Utilities:**
- `lib/date-based-filter.mjs` - Pure utility for date-based email classification: extracts dates (ISO, US format, text dates, weekday patterns), compares to today, classifies as past/future/unknown. Does not mutate input. Handles dates without year by inferring current or next year.

## Example Usage

Along with the normal capabilities you would expect for a calendar integration you can also do really dynamic, multi-step processes like:

1. **Cross-calendar availability**:
   ```
   Please provide availability looking at both my personal and work calendar for this upcoming week.
   I am looking for a good time to meet with someone in London for 1 hr.
   ```

2. Add events from screenshots, images and other data sources:
   ```
   Add this event to my calendar based on the attached screenshot.
   ```
   Supported image formats: PNG, JPEG, GIF
   Images can contain event details like date, time, location, and description

3. Calendar analysis:
   ```
   What events do I have coming up this week that aren't part of my usual routine?
   ```
4. Check attendance:
   ```
   Which events tomorrow have attendees who have not accepted the invitation?
   ```
5. Auto coordinate events:
   ```
   Here's some available that was provided to me by someone. {available times}
   Take a look at the times provided and let me know which ones are open on my calendar.
   ```

6. **Gmail workflows**:
   ```
   How many unread emails do I have from my work account?
   ```
   ```
   Search for all emails from john@company.com that I haven't replied to yet.
   ```
   ```
   Show me all unread messages from the past week.
   ```
   ```
   Mark all unread emails from my boss as read.
   ```
   ```
   Archive all promotional emails from marketing.
   ```
   ```
   Delete these 5 spam messages (provide IDs).
   ```

## Date Parsing

The email organization system uses intelligent date parsing (`lib/date-based-filter.mjs`) to classify event emails:

**Supported Formats:**
- ISO 8601: `2026-03-25`, `2026/03/25`
- US format: `03/25/2026`, `3/25/2026`
- Text format: `March 25, 2026`, `March 25` (infers year)
- Weekday patterns: `@ Mon, Mar 23`, `@ Friday Mar 22`
- Returns `null` for unparseable dates

**Classification:**
- Past events (date < today): archive from inbox, keep label
- Future events (date ≥ today): label and keep in inbox
- Unknown: marked for manual review

**Implementation Notes:**
- Pure function: does not mutate input dates
- Handles missing years by inferring current or next year
- Used by `mark-past-events-read.mjs` to auto-archive old events

## Available Tools

### Calendar Tools
| Tool | Description |
|------|-------------|
| `list-calendars` | List all available calendars |
| `list-events` | List events with date filtering |
| `search-events` | Search events by text query |
| `create-event` | Create new calendar events |
| `update-event` | Update existing events |
| `delete-event` | Delete events |
| `get-freebusy` | Check availability across calendars, including external calendars |
| `list-colors` | List available event colors |

### Gmail Tools
| Tool | Description |
|------|-------------|
| `gmail-search-messages` | Search Gmail messages (e.g., `is:unread`, `from:user@example.com`) |
| `gmail-get-profile` | Get Gmail profile info (email, message count, thread count) |
| `gmail-modify-messages` | Modify messages: mark read/unread, archive, delete, add/remove labels |
| `gmail-create-label` | Create new labels for organizing emails |
| `gmail-create-filter` | Create filters to auto-organize emails (auto-label, archive, delete, etc.) |

## Documentation

- [Authentication Setup](docs/authentication.md) - Detailed Google Cloud setup
- [Advanced Usage](docs/advanced-usage.md) - Multi-account, batch operations
- [Deployment Guide](docs/deployment.md) - Remote access and integration
- [OAuth Verification](docs/oauth-verification.md) - Moving from test to production mode
- [Architecture](docs/architecture.md) - Technical architecture overview
- [Development](docs/development.md) - Contributing and testing

## Testing Status

Run tests with `npm test`. Current test suite includes:
- **Handler Tests**: Core functionality for create, get, list, search, update, and delete operations; content assertions use narrower `{ type: 'text'; text: string }` type instead of `as any`
- **Service Tests**: Conflict detection and event similarity analysis
- **Schema Tests**: Tool schema validation and compatibility

**Note**: Integration tests referencing non-existent `AuthenticationService` and `initializeApp` exports were removed. Re-implement when the authentication service architecture is finalized.

## Configuration

**Environment Variables:**
- `GOOGLE_OAUTH_CREDENTIALS` - Path to OAuth credentials file
- `CALENDARMCP_TOKEN_PATH` - Custom token storage location for Calendar tokens (optional)
- `ACCOUNT_MODE` - Account mode selection (normal or test; default: test)

**Token Storage:**
- Calendar tokens: `~/.config/google-calendar-mcp/tokens.json`
- Gmail tokens: `~/.config/google-calendar-mcp/tokens-gmail.json`
- Both stored with secure permissions (0600)

**Claude Desktop Config Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`


## Security

- OAuth tokens are stored securely in your system's config directory
- Credentials never leave your local machine
- All calendar operations require explicit user consent

### Troubleshooting

1. **OAuth Credentials File Not Found:**
   - For npx users: You **must** specify the credentials file path using `GOOGLE_OAUTH_CREDENTIALS`
   - Verify file paths are absolute and accessible

2. **Authentication Errors:**
   - Ensure your credentials file contains credentials for a **Desktop App** type
   - Verify your user email is added as a **Test User** in the Google Cloud OAuth Consent screen
   - Try deleting saved tokens and re-authenticating
   - Check that no other process is blocking ports 3000-3004

3. **Build Errors:**
   - Run `npm install && npm run build` again
   - Check Node.js version (use LTS)
   - Delete the `build/` directory and run `npm run build`
4. **"Something went wrong" screen during browser authentication**
   - Perform manual authentication per the below steps
   - Use a Chromium-based browser to open the authentication URL. Test app authentication may not be supported on some non-Chromium browsers.

### Manual Authentication
For re-authentication or troubleshooting:
```bash
# For npx installations
export GOOGLE_OAUTH_CREDENTIALS="/path/to/your/credentials.json"
npx @cocal/google-calendar-mcp auth

# For local installations
npm run auth
```

## License

MIT

## Support

- [GitHub Issues](https://github.com/nspady/google-calendar-mcp/issues)
- [Documentation](docs/)
