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

## Recent Updates

**Email Organization Pipeline:**
- `switch-account.mjs` — File-based active account switching for multi-account workflows

**Schema.org Email Categorization:**
- `lib/schema-extractor.mjs` — Extract schema.org types from email HTML using htmlparser2
- Organization label hierarchy and category-based email classification
- Category map and serializer plan in `docs/SCHEMA_CATEGORY_MAP.md`

**Shared Library Expansion (`lib/`):**
- `gmail-batch-utils.mjs`, `gmail-message-utils.mjs`, `gmail-filter-utils.mjs` — Extracted helpers for batch ops, message parsing, filter creation
- `constants.mjs` — Shared constants (DEFAULT_MAX_RESULTS, category definitions)
- `email-utils.mjs`, `console-utils.mjs` — Email helpers and formatted output

**Auth & Account Management:**
- `isAuthenticated()` replaced `validateTokens()`; widened `accountMode` type for dynamic account support
- File-based active account resolution via `switch-account.mjs`

**Testing:**
- 601 unit tests passing, 23 skipped (3 integration test files require live API)
- Integration tests for conflict detection via MCP protocol (real server, real API)
- Consolidated test helpers reduce maintenance burden across 30+ test files

See [CHANGELOG](docs/CHANGELOG.md) for version history.

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
npm run auth:gmail
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
- Re-authenticate as needed with `npm run auth:gmail`

### Email Organization & Filtering Scripts

Automated scripts for organizing and filtering large volumes of Gmail with focus on correctness and efficiency.

**Management Scripts:** (use shared `createGmailClient()` for OAuth, error handling, and multi-account support)
- `list-unread-emails.mjs` - Categorize and summarize the 500 newest unread emails; `--total` for the exact mailbox-wide count (slow — pages every match), `--stats` for per-label counts. Its `--count` and `--verify` modes are gone: `report-messages.mjs --total --count "is:unread"` is exact where `--count` was not, and `audit-label-drift.mjs --query ... --expect ...` draws the expectation from the config rather than hardcoding it
- `audit-schema-markup.mjs` - How much unread mail carries schema.org JSON-LD, and which types (was `list-unread-emails.mjs --schema`)
- `report-messages.mjs` - The one read-only reporter: query -> page -> fetch headers -> project columns -> print. `list-unlabeled-unread.mjs`, `audit-unread.mjs` and `summarize-remaining.mjs` are presets over it
- `summarize-remaining.mjs` - Summary of uncategorized/remaining unread emails
- `apply-filters-to-unread.mjs` - Apply existing filters to current unread emails
- `switch-account.mjs` - Switch active Google account (file-based resolution)

**Specialized Filters:**
- `route-billing-mail.mjs` - Billing filters with conditional rate-limit detection; urgent alerts stay in the inbox, routine billing is archived (was `protect-important-inbox.mjs --billing`)
- `filter-events-by-date.mjs` - Classify event emails as future (label + keep) or past (label + archive)

**Archive & Processing Scripts:**
- `archive-old-emails.mjs` - Archive mail older than 7 days under a label or query; a `modify-messages.mjs` preset, previews without `--yes`
- `mark-read.mjs` - Mark unread mail under the routine categories as read; a `modify-messages.mjs` preset

**Utilities:**
- `lib/gmail-client.mjs` - Authenticated Gmail API client factory. Centralizes OAuth2 init, token validation, and multi-account support:
  ```js
  import { createGmailClient } from './lib/gmail-client.mjs';
  const gmail = createGmailClient(); // Uses ACCOUNT_MODE env var, throws on missing tokens
  ```
- `lib/gmail-label-utils.mjs` - Label ID resolution (NEW in v1.4.9). Resolves hardcoded label IDs dynamically for account portability:
  ```js
  import { buildLabelCache, resolveLabelId } from './lib/gmail-label-utils.mjs';
  const labelCache = await buildLabelCache(gmail);
  const labelId = labelCache.get('Events/Community'); // Dynamic instead of hardcoded Label_N
  ```
  See [`docs/LABEL-RESOLUTION-GUIDE.md`](docs/LABEL-RESOLUTION-GUIDE.md) for complete documentation.
- `lib/gmail-batch.mjs` / `lib/gmail-batch-utils.mjs` - Batch operations for bulk Gmail tasks (10-100x speedup)
- `lib/gmail-message-utils.mjs` - Message header/body extraction, `decodeBase64Payload()`
- `lib/gmail-filter-utils.mjs` - Filter creation helpers
- `lib/schema-extractor.mjs` - Schema.org type extraction from email HTML (htmlparser2)
- `lib/email-analyzer.mjs` / `lib/email-utils.mjs` - Email parsing and categorization helpers.
  `email-utils.mjs` is the only home for sender parsing: `extractDisplayName()`,
  `extractEmailAddress()`, `extractLocalPart()`, `extractDomain()`, `GENERIC_LOCAL_PARTS`,
  `shareLeadingToken()`
- `lib/constants.mjs` - Shared constants (DEFAULT_MAX_RESULTS, category definitions)
- `lib/console-utils.mjs` - Formatted console output helpers
- `lib/date-based-filter.mjs` - Pure utility for date-based email classification: extracts dates (ISO, US format, text dates, weekday patterns), compares to today, classifies as past/future/unknown. Does not mutate input.

## Known Issues

Sharp edges found the hard way. Each one fails **silently** — the script reports success
while doing nothing, or does the wrong thing without erroring.

### `ORG_TAGS` must contain no time-varying data

`ORG_TAGS` in [`create-org-tags.mjs`](create-org-tags.mjs) is long-lived routing config.
Anything in it that expires rots silently, because nothing re-reads the source to notice.

An org's `schema.event` therefore lists **recurring programmes, not dated instances** —
what kinds of event the org runs is stable; which edition runs when is not. No
`startDate`/`endDate`, and no edition year in a programme name (`ZoukMX Main Festival`,
not `ZoukMX Main Festival 2027`). `startDate` is optional on schema.org `Event`, so a
dateless programme is still valid.

Historical dates inside `DefinedTerm` descriptions are fine — "the Houston Fusion
Exchange (January 2008)" is a fact about a dance form's origin, not a forecast. The terms
themselves live in [`lib/vocabularies.mjs`](lib/vocabularies.mjs); see
[`docs/DEFINED-TERMS-GUIDE.md`](docs/DEFINED-TERMS-GUIDE.md).

To check: serialize `ORG_TAGS` and grep for ISO-date-shaped values.

```bash
node -e "import('./create-org-tags.mjs').then(m=>console.log(JSON.stringify(m.ORG_TAGS).match(/\"20[0-9]{2}-[0-9]{2}/g)||'none'))"
```

### Parentheses in a label name break Gmail's `label:` operator

Gmail's query parser cannot match `(` or `)` in a label name **even inside quotes**.
`label:"Organization/…/Council (BZDC)/ZoukMX"` returns **0** against a label that
demonstrably holds mail (confirmed via `labelIds`, which bypasses the parser).

This silently breaks:
- `applyTagSet()`'s `-label:"…"` backfill clause — re-tags everything on every run
- **any emptiness check guarding a label deletion** — a parenthesised label reads as
  empty and gets deleted with mail still on it

Keep label names free of parentheses. An acronym belongs in schema `alternateName`, not
in the path.

### A subject clause ORed onto a sender clause is unconstrained by that sender

`protect-important-inbox.mjs`'s "Calendly Refunds & Support" entry reads as
Calendly-scoped:

```
from:(support@calendly.zendesk.com OR invoice+statements@calendly.com)
  OR subject:(refund OR "Added to a team")
```

It is not. The `OR` means the subject clause matches on its own, with no sender
constraint at all — measured 410/410 of the query's matches come from the subject
half alone, and the sender half contributes 0. It labels Amazon returns, Airbnb
refunds, and Experian marketing "Keep Important", none of which mention Calendly.
134 already-labeled messages carry the label for exactly this reason (measured
2026-08-27).

Not yet fixed — the query is live, so narrowing it is a mailbox-mutating decision
(drop the subject clause? scope it with an explicit sender `AND`?), not a
refactor. `cappedSweep`'s truncation cap is protecting against exactly this shape
of query, which is why this file cannot be safely folded into `applyTagSet()`'s
unbounded backfill — see the comment above `IMPORTANT_FILTERS` in the script.

### An unquoted multi-word term breaks its whole `OR` group

`subject:(late fee OR overdue OR "missed payment")` does not mean what it reads as.
Gmail collapses it to `late AND fee`: it matched **8** messages where the quoted
spelling `subject:("late fee" OR overdue OR "missed payment")` matches **100**. The
`overdue` and `"missed payment"` arms contributed nothing, silently — the query is
valid, returns results, and looks like it works.

Quote every multi-word term inside an `OR` group. A bare two-word term is two ANDed
tokens, and the `OR` binds to the second one.

This is how `route-billing-mail.mjs` ran its entire urgent-billing protection on one
of its three terms.

### A negation must be scoped like the test it complements

`subject:X` and `-"X"` are not complements. The first tests the subject; the second
negates the term **anywhere in the message**, body included. A partition built from the
two leaks: a message can fall through both halves.

`route-billing-mail.mjs` paired `subject:(...urgent...)` with a hand-expanded
`-"late fee" -overdue -"missed payment"`, and **149** billing messages matched neither
side — held out of the archive sweep because their bodies happened to mention an urgent
word. Write the complement as `-subject:(...)`, from the same constant as the test, and
assert the two halves sum to the unpartitioned total.

### `searchAndModify()` truncates to its caller's `maxResults`

`searchAndModify()` in [`lib/gmail-batch-utils.mjs`](lib/gmail-batch-utils.mjs) **does**
page — it follows `nextPageToken` in a `do/while` loop at 500 per request. The cap is
entirely the caller's optional fourth argument, `maxResults`, which breaks that loop
early. **Fix the call site, not the library.**

Callers that truncate today:

| Call site | Cap | Deliberate? |
|---|---|---|
| `protect-important-inbox.mjs`, `route-billing-mail.mjs` (6 sites) | `SUBJECT_SWEEP_CAP` | **Yes** — subject-only queries; `cappedSweep()` (in `lib/gmail-batch-utils.mjs`) says when it truncates |
| `create-filters.mjs:281` | `category.maxResults` | **Yes** — opt-in per category, unset means page to exhaustion |

No accidental truncation remains. `relabel-messages.mjs` used to head this table: it
passed `DEFAULT_MAX_RESULTS`, so on a 7,000-message label it moved **100** and printed
`Total relabeled: 100` — which reads as success. The inner `Processed 50/61` lines came
from batch chunking of one page, not from list paging, so they gave false reassurance of
full coverage. It is now a [`modify-messages.mjs`](modify-messages.mjs) preset, which
selects with `listAllMessageIds` (unbounded) instead of `searchAndModify`. Because
lifting the cap makes an unbounded relabel a far bigger action than the capped one it
replaces, it now previews unless `--yes`.

`archive-old-emails.mjs` had the same cap by a different route — `searchAndModifyOlderThan`
*defaulted* `maxResults`, so dropping the argument would not have lifted it. That helper
had no other caller once the script migrated, and has been deleted.

Use [`strip-label.mjs`](strip-label.mjs) for bulk removal; it is a
[`modify-messages.mjs`](modify-messages.mjs) preset, so it selects by `labelIds` and
collects every id before modifying anything — no page token is held across a mutation,
which is what its old re-query-the-first-page loop existed to avoid.

Never confirm a bulk relabel from a script's own count — re-query afterwards.

### A Gmail filter can add only one user label

`users.settings.filters.create` rejects an action whose `addLabelIds` holds more than one
**user** label (`Too many user labels in filter`); system labels in `removeLabelIds` do
not count. To apply two labels on arrival, create one filter per label on the same query,
with only the first carrying the archive/mark-read action.

`users.messages.modify` has no such limit, which is why a backfill can succeed on a label
set that filter creation rejects.

### `resultSizeEstimate` is not a count

`messages.list` returns `resultSizeEstimate`, and Gmail **caps it at ~201** — so it is not
merely imprecise, it is a ceiling that any larger result set hits exactly. It reported `201`
for both `from:info@email.meetup.com` (true count **10,475**, off by 52×) and
`from:news@alphasignal.ai` (true count 433). Two unrelated senders reporting an identical
total is the tell.

The failure is silent and always *under*-reports, so anything sized from it — a coverage
percentage, a "how much mail would this touch" check, a decision that a set is small enough
to skip paging — is wrong in the direction that looks safe.

Use `countMessagesMatching()` in [`lib/gmail-message-utils.mjs`](lib/gmail-message-utils.mjs),
which pages to a true total and can return sample IDs in the same walk. `labels.get` is the
cheap way to count a whole label, but its counters are not exact either — see below.

### `labels.get` counters are eventually consistent

`labels.get` returns `messagesTotal`/`messagesUnread` in one cheap call, which is why
`list-unread-emails.mjs --stats` reports every label that way. They are **not exact**: Gmail
recomputes them asynchronously, and they can be wrong by orders of magnitude before settling.

`--stats` reported `Travel: 5179 total, 1313 unread`. Three paging methods all said **13** —
`labelIds: [Travel, UNREAD]`, `label:Travel is:unread`, and the same query with `in:anywhere`
(so Spam and Trash were not the gap). Minutes later `labels.get` self-corrected to
`5197 total, 13 unread` with nothing having touched the mailbox.

The tell is **the same figure repeating across unrelated labels** — that run showed exactly
`501 unread` on `Events`, `Events/Entertainment` and `Meetup Events` at once — and parent
totals that bear no relation to the sum of their children. Note this is the *opposite*
signature to [`resultSizeEstimate`](#resultsizeestimate-is-not-a-count), which pins to a
ceiling and always under-reports; a stale label counter can err in either direction.

It is not label-resolution drift: `resolveLabelId()` is an exact-name `Map` lookup over one
`labels.list`, so a name always resolves to the same id. The bad numbers come from Google.

Treat `--stats` as indicative. Confirm any count you are about to act on — especially one
sizing a bulk operation — with `countMessagesMatching()`, which pages and is exact.

### Sender-matching helpers miss grouped `from:(a OR b)` queries

A `/from:([^\s()]+)/` sweep requires a non-paren character right after `from:`, so on
`from:(news.bizjournals.com OR engaged.bizjournals.com)` it matches **nothing** — not the
first domain, not a partial. The config uses both spellings interchangeably
([`create-filters.mjs`](create-filters.mjs) has ~a dozen grouped ones), so a helper built
on that regex silently treats those domains as unclaimed.

`coveredDomains()` in [`audit-org-tag-coverage.mjs`](audit-org-tag-coverage.mjs) had this
bug and under-reported coverage until it switched to `fromTokens()` from
[`audit-label-drift.mjs`](audit-label-drift.mjs), which handles both forms — import from
there rather than writing a third copy. The hazard is now larger, not smaller: consolidated
categories (`consolidate: true` in `create-filters.mjs`) merge whole sender lists into
OR-grouped chunk filters, so a plain-regex helper reads an entire category as unclaimed.

The same helper class must also handle `from:"Display Name"` — a bare word with no dot
never suffix-matches a domain, so filters written that way stay invisible to any
domain-only comparison.

### A verification check can assert a label the config never produces

`list-unread-emails.mjs --verify` reported `AlphaSignal email has 'Product Updates' label:
false` for months. (That mode is now deleted for this reason; use
`audit-label-drift.mjs --query "from:news@alphasignal.ai" --expect "Newsletters"`.) The mail was labeled correctly — the *check* was stale: both
[`create-filters.mjs`](create-filters.mjs)
route AlphaSignal to `Newsletters`, and no live filter applies `Product Updates` to it. The
label it looked for was residue from an older config, still sitting on 321 messages.

A spot-check that hardcodes its expectation drifts from the config it is meant to verify,
and reads as a labeling failure when it is really a check failure. Derive the expected
label from the config, or audit with [`audit-label-drift.mjs`](audit-label-drift.mjs),
which compares config, live filters and actual mail rather than trusting any one of them.

### Sender domains do not reveal an organization's type

**This is the canonical tally — other docs point here rather than repeating it, because a
count duplicated across files goes stale in every copy at once.**

Six of six type guesses made from domain names alone were wrong: `fuegodance.com` is a
shoe brand, `tinyminotaur.com` a tavern, `experiencehouse.co` a design cohort,
`thesisdriven.com` a real-estate data business, `houstonssc.com` a recreational sports
league, and `premierhw.com` is **Premier Health and Wellness** — a medical spa — not the
"Premier Home Warranty" its entry was named for. Audit content before assigning a type —
see [`audit-sender-signals.mjs`](audit-sender-signals.mjs), whose display-name output is
more reliable than its keyword scores (calibrated 2/5 on known answers; it did score
`premierhw.com` correctly at `HealthAndBeautyBusiness:19`).

`premierhw.com` adds a second trap: an **abbreviation** expanded from the domain. `HW` was
read as Home Warranty; the mail footer says Health and Wellness. An acronym in a domain is
a guess, not evidence — the body text is evidence.

Related: many domains are **sending platforms**, not organizations —
`express.medallia.com` carries 20 orgs including Airbnb, CVS and Marriott. Use
[`extract-platform-orgs.mjs`](extract-platform-orgs.mjs), which enumerates the whole
domain; a 25-message sample of that domain found 3 of the 20.

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
- [Backlog & Roadmap](docs/BACKLOG.md) - Future work, refactoring targets, design decisions

### Schema & Vocabulary Alignment

Type definitions are aligned with [schema.org](https://schema.org/) for calendar events, email categorization, and reservation types. The [GS1 Web Vocabulary](https://ref.gs1.org/voc/) complements schema.org with supply chain, product identification (`gs1:Product`, GTIN), and commercial transaction types (`gs1:Offer`, `gs1:PriceSpecification`, `gs1:Transaction`). The two vocabularies work together in JSON-LD.

- [Schema Category Map](docs/SCHEMA_CATEGORY_MAP.md) -- type inventory, property mappings, GS1 overlap analysis
- [Email Categorization](docs/EMAIL-CATEGORIZATION.md) -- inbound email schema extraction and GS1 enrichment
- [Serializer Plan](docs/SCHEMA-ORG-SERIALIZER-PLAN.md) -- outbound JSON-LD serialization for calendar MCP responses

## Development

**Project Guidelines:**
- See [`CLAUDE.md`](CLAUDE.md) for code quality standards, script patterns, and refactoring guidelines
- OAuth extraction pattern: use `createGmailClient()` from `lib/gmail-client.mjs`
- Established patterns: error handling with try/catch, named constants, parallel API fetches with `Promise.all`
- TypeScript, ES modules, 2-space indent, no magic strings

**Code Quality Tools:**
- Detect duplicated code blocks: `npm run check-duplicates` (jscpd, token-based clone detection over src/)
- Consolidated: `GmailCreateHandler.ts` unifies filter and label creation logic (single source of truth)

**Completed Roadmap:**
- ✅ All 24 backlog items complete (v1.4.9)
- ✅ Schema.org email categorization with `schema-extractor.mjs` (htmlparser2)
- ✅ Shared lib expansion: 12 utility modules in `lib/`
- ✅ Auth refactor: `isAuthenticated()`, dynamic account switching
- See [`docs/BACKLOG.md`](docs/BACKLOG.md) for detailed implementation notes and [`docs/CHANGELOG.md`](docs/CHANGELOG.md) for version history

## Testing Status

Run tests with `npm test`. 601 unit tests passing, 23 skipped, across 36 test files.
- **Handler Tests**: Core functionality for create, get, list, search, update, and delete operations; type-safe content assertions
- **Service Tests**: Conflict detection and event similarity analysis
- **Schema Tests**: Tool schema validation and compatibility
- **Integration Tests**: 3 files require live Google API credentials (conflict detection, recurring events, MCP protocol)

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
