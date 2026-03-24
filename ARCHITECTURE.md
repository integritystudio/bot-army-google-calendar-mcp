# Architecture Overview

## High-Level Flow

```
CLI Entry (index.ts)
  ↓
GoogleCalendarMcpServer (server.ts)
  ├─ Authentication (auth/)
  │  ├─ OAuth2Client init
  │  ├─ TokenManager (multi-account, auto-refresh)
  │  └─ AuthServer (browser flow)
  ├─ ToolRegistry (tools/registry.ts)
  │  └─ Handler dispatch
  └─ Transport (transports/)
     ├─ Stdio (Claude Desktop)
     └─ HTTP (remote access)
```

## Directory Structure

### `src/auth/`
- **client.ts** - OAuth2Client initialization with credentials validation
- **tokenManager.ts** - Multi-account token lifecycle with TokenManager API:
  - `isAuthenticated()` - Check valid, non-expired token status
  - `getCredentials()` - Access current account credentials
  - `refreshCredentials()` - Explicit token refresh
  - `logout()` - Clear tokens for account
  - Auto-refresh 5 min before expiry, account-aware storage
- **server.ts** - OAuth browser flow for authentication
- **utils.ts** - Token parsing, credential loading helpers

### `src/handlers/core/`
Implements MCP tool handlers via `BaseToolHandler` pattern:
- **ListEventsHandler** - Multi-calendar event listing with date filtering
- **CreateEventHandler** - Event creation with recurring event support
- **UpdateEventHandler** - Event updates with field mask optimization
- **DeleteEventHandler** - Event deletion with conflict detection
- **SearchEventsHandler** - Text-based event search
- **FreeBusyHandler** - Cross-calendar availability checks
- **ListColorsHandler** - Event color palette
- **GetCurrentTimeHandler** - Server time (timezone-aware)
- **RecurringEventHelpers** - Shared logic for recurring event modifications
- **BatchRequestHandler** - Batch Gmail operations

### `src/handlers/gmail/`
Gmail-specific handlers:
- **GmailSearchHandler** - Message search with filter syntax
- **GmailModifyHandler** - Batch operations (mark read/archive/delete/label)
- **GmailCreateHandler** - Label and filter creation

### `src/services/`
Business logic (conflicts, event similarity):
- **ConflictDetectionService** - Time-based overlap detection
- **EventSimilarityService** - Fuzzy event matching

### `src/utils/`
Shared utilities:
- **timezone-utils.ts** - RFC3339 conversion, timezone offset calculation, datetime object construction
- **date-utils.ts** - Date parsing and validation
- **field-mask-builder.ts** - Optimized Google API update masking
- **event-id-validator.ts** - Event ID format validation

### `src/schemas/`
Zod validation schemas:
- **core.ts** - Calendar event schemas (create, update, recurring)
- **gmail.ts** - Gmail message and filter schemas
- **gmail-label-utils-types.ts** - Label resolution type definitions
- **gmail-batch-types.ts** - Batch operation type definitions
- **email-analyzer-types.ts** - Email categorization type definitions

### `src/testing/`
Test infrastructure:
- **types.ts** - Zod schemas and TypeScript interfaces
- **test-utils.ts** - `withTestContext()`, `typedTest()`, ResourceTracker, cleanup utilities

### `src/tests/`
Test suites:
- **unit/** - Handler, service, and utility tests (486 tests)
- **integration/** - MCP protocol tests with real server and API

### `src/transports/`
MCP transport implementations:
- **stdio.ts** - Standard input/output (Claude Desktop)
- **http.ts** - HTTP server (remote/browser access)

### `src/config/`
- **TransportConfig.ts** - CLI argument parsing (transport type, port, host)

## Key Patterns

### Handler Pattern
```typescript
class XyzHandler extends BaseToolHandler {
  async execute(input: ParsedInput): Promise<ToolResponse> {
    // Validation via Zod
    // API call via google-auth-library
    // Content assertion via { type: 'text'; text: string }
  }
}
```

### Token Management
- Multi-account support via `ACCOUNT_MODE` env var
- Auto-refresh 5 min before expiry
- Separate storage: Calendar (`tokens.json`) vs Gmail (`tokens-gmail.json`)
- Test mode: 7-day expiry (Google requirement)

### Timezone Handling
All datetime operations consolidated in `src/utils/timezone-utils.ts` (refactored ae1c01b, 499e7dd):
- `convertToRFC3339()` - Datetime string → RFC3339 with timezone
- `convertLocalTimeToUTC()` - Local time + timezone → UTC offset
- `hasTimezoneInDatetime()` - Detect timezone in datetime string
- `createTimeObject()` - Build datetime object with timezone
- Consolidated from multiple datetime utility files for DRY, single source of truth

### Email Organization Scripts
Located in project root (non-MCP):
- Uses `lib/gmail-client.mjs` for OAuth
- `lib/gmail-label-utils.mjs` for dynamic label ID resolution
- `lib/gmail-batch.mjs` for batch operations
- `lib/email-analyzer.mjs` for categorization helpers

## Data Flow

### Create Event
1. Handler receives input → Zod validation
2. Construct RFC3339 datetime via `timezone-utils`
3. Call `calendar.events.insert()`
4. Check conflicts via `ConflictDetectionService`
5. Return event with MCP tool response format

### Update Recurring Event
1. Fetch base event → validate recurrence rule
2. Build field mask (only changed fields)
3. For instance modifications: separate start/end times via `RecurringEventHelpers`
4. Apply timezone via `createTimeObject()`
5. Return updated event

### Search & Filter Gmail
1. Resolve label IDs via `buildLabelCache()` (cached at startup)
2. Construct Gmail search query
3. Fetch message list → fetch details in parallel
4. Apply filters (archive, label, mark read)
5. Use batch API for 10-100x speedup

## Dependencies
- **@modelcontextprotocol/sdk** - MCP protocol
- **google-auth-library** - OAuth2, Google API client
- **zod** - Schema validation
- **vitest** - Testing framework

## Testing Strategy
- **Unit tests (486)** - Handler, service, utility logic isolated
- **Integration tests** - Real MCP server spawned, real Google Calendar API
- **Schema tests** - Zod validation coverage
- **Type-safe assertions** - `{ type: 'text'; text: string }` instead of `as any`

## Multi-Account Support
```
TokenManager
├─ ACCOUNT_MODE=test → test account (7-day expiry)
└─ ACCOUNT_MODE=production → prod account (no expiry)
```
Token file structure (both accounts in one file):
```json
{
  "test": { "access_token": "...", "expiry_date": ... },
  "production": { "access_token": "...", "expiry_date": ... }
}
```

## Recent Architectural Improvements (v1.4.9+)

### Auth API Refactoring (c9a57a9)
- Replaced direct `validateTokens()` calls with semantic API methods
- `isAuthenticated()` - Clearer intent for auth status checks
- `getCredentials()` - Improved encapsulation over direct credential access
- Applied across 5 locations (server.ts ×2, auth/server.ts ×1, integration tests ×2)
- All 486 tests passing after refactor

### Timezone Utilities Consolidation (ae1c01b, 499e7dd)
- Unified all datetime operations into single `src/utils/timezone-utils.ts`
- Eliminates code duplication across event creation, update, recurring event handlers
- Single source of truth for RFC3339, UTC, and timezone-aware operations
- Improved maintainability and consistency

### Test Infrastructure
- 486/486 unit tests covering handlers, services, utilities
- Integration tests using real MCP protocol with Google Calendar API
- Type-safe content assertions (`{ type: 'text'; text: string }`)
- Dynamic future dates prevent test expiration
