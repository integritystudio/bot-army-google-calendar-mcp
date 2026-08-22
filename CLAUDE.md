# Google Calendar & Gmail MCP - Project Guidelines

## Auth & Development

**OAuth Setup** (test mode):
```bash
export GOOGLE_ACCOUNT_MODE=test CALENDARMCP_TOKEN_PATH=~/.config/google-calendar-mcp/tokens.json
npm run auth            # Creates tokens.json (default account: normal)
npm run auth:personal   # per-account; sets GOOGLE_ACCOUNT_MODE for you
npm run auth:alyshia
npm run verify-tokens   # Verify auth status (calendar; uses ./credentials.json)
```

**Dependency gotcha:** `package.json` overrides pin `googleapis-common@8.0.1` — 8.0.3 exact-pins a nested `google-auth-library@10.5.0` that duplicates the root copy and breaks `npm run lint` with `OAuth2Client` type mismatches. Verified still required at googleapis 173; recheck on future bumps.

**Env var split (gotcha):** TypeScript calendar code (`src/auth/paths.js`) reads `GOOGLE_ACCOUNT_MODE`; the root `.mjs` Gmail scripts (`lib/gmail-client.mjs`) read `ACCOUNT_MODE`. Setting only one leaves the other side on its default account — silently. **Prefer the per-account npm scripts**, which set the correct variable for their side: `auth:personal` / `auth:alyshia` (calendar, `GOOGLE_ACCOUNT_MODE`) and `auth:gmail:personal` / `auth:gmail:alyshia` (Gmail, `ACCOUNT_MODE`).

**Auth port (gotcha):** `auth:gmail` binds 3500; the calendar `auth` scans 3500-3505 for a free one. A running MCP server holds 3500, pushing calendar auth onto a port that may not be a **registered** redirect URI — Google then returns "Access blocked: This app's request is invalid" (`redirect_uri_mismatch`). Override with `GMAIL_AUTH_PORT=3505 npm run auth:gmail`; run `scripts/check-redirect-uris.sh` to see which ports Google actually accepts.

**Google Calendar API gotchas (recurring events):** inserts require an explicit `timeZone` on start/end even when dateTime carries a UTC offset (else 400 "Missing time zone definition"); durations must be whole seconds — a 1ms start/end skew gets a bare 400. Use `stripSubseconds()` (date-utils) on paired values.

**Gmail Tokens:**
```bash
npm run auth:gmail            # Creates tokens-gmail.json (default account: normal)
npm run auth:gmail:personal   # per-account; sets ACCOUNT_MODE for you
npm run auth:gmail:alyshia
node verify-tokens.mjs        # Verify Gmail token status
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
- `npm run check-duplicates` — Detect repeated code blocks via jscpd (scans src/ with 6-line window)
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

## Known Issues

**Read [README.md#known-issues](README.md#known-issues) before bulk label work.** Every
entry there fails *silently* — the script prints success while doing nothing. Summary:
`ORG_TAGS` must hold no time-varying data (`schema.event` = recurring programmes, never
dated instances); parentheses in a label name break Gmail's `label:` operator, which
misreads strips, backfills **and delete guards**; `searchAndModify()` pages but truncates
to a caller-supplied `maxResults`, so `relabel-messages.mjs` caps at 100 and still
reports success; a filter can add only one
user label; `resultSizeEstimate` is an estimate, not a count (201 reported against a true
433); `labels.get`'s `messagesTotal`/`messagesUnread` are eventually consistent and can be
off by orders of magnitude (1,313 unread reported against a true 13), so `--stats` is
indicative only; sender-matching regexes miss grouped `from:(a OR b)` queries and `from:"Display Name"`
ones, so coverage audits under-claim; a spot-check that hardcodes its expected label drifts
from the config it verifies and reads as a labeling failure; and a sender's domain does not
reveal its org type — every name-based guess so far has been wrong, with the running tally
and examples kept only in the README.

## Email Organization System

Core pattern: Label → conditional archive (keep future events, important items, archive notifications).

**Key Scripts:**
- `list-unread-emails.mjs`, `list-inbox.mjs`, `summarize-remaining.mjs` — Email analysis
- `list-unlabeled-unread.mjs [--preview N|all] [--all]` — Count/preview unread emails with no user label (inbox by default; `--preview all` lists every inbox match; `--all` adds an exact mailbox-wide count, slow on large archives)
- `dump-messages.mjs [--max N] "<gmail-query>"` — TSV dump (date, from, subject) of messages matching any Gmail query; count goes to stderr so stdout pipes cleanly
- `audit-unread.mjs` — TSV audit of unread mail (date, from, subject, inbox-vs-archived, Gmail category, user labels, whether a `List-Unsubscribe` header is present); `total`/`unlabeled`/`inbox` summary to stderr. Takes no flags and **does not page** — it reads one `messages.list` page of the 500 newest unread, so it is a sample, not a mailbox-wide count; use `list-unlabeled-unread.mjs --all` for the exact figure
- `create-filters.mjs [--only <label-prefix>] [--dry-run] [--prune]` — Single source of truth for category routing: **syncs** live Gmail filters against the config (diffs by criteria+action, creates what's missing, reports stale filters on a category's label; `--prune` deletes them, `--dry-run` prints the whole plan without mutating) and backfills existing mail. Per-category `archive`/`markRead`/`maxResults`/`consolidate` flags; a filter entry can set its own `markRead`. `consolidate: true` merges a category's senders into OR-chunked filters (Gmail hard-caps accounts at **1,000 filters** — near it, creates and deletes fail with intermittent `FAILED_PRECONDITION`); **append** new senders to consolidated categories, mid-list inserts churn chunk boundaries. Deletes run before creates (cap headroom), so a sync briefly unroutes a consolidated category's senders; the backfill sweeps whatever arrives in the gap
- `create-org-tags.mjs [--filters-only] [--only <label-prefix>] [--orgs a,b]` — Organization/* sender tags; label-only (never archives/marks read). `ORG_TAGS` lives in [`config/org-tags.mjs`](config/org-tags.mjs) and uses field `entries`, matching `applyTagSet()` directly. Backfill covers read **and** unread mailbox-wide. **See [docs/ORG-TAGS-GUIDE.md](docs/ORG-TAGS-GUIDE.md) before adding tags**
- `audit-org-tag-coverage.mjs [--max N] [--query "<gmail-query>"]` — Sender domains with no `Organization/*` label that no `ORG_TAGS` entry claims; also flags `ORG_TAGS` labels missing from Gmail. **Its `coveredDomains()` cannot see grouped `from:(a OR b)` queries**, so domains written that way read as unclaimed — see [README.md#known-issues](README.md#known-issues)
- `audit-label-drift.mjs [--source filters|org-tags|country-tags|all] [--only <label-prefix>] [--query "<gmail-query>" [--expect "<label>"]] [--sample N] [--exact]` — Cross-checks the three places a label assignment lives: what the config claims, what live Gmail filters do, and what the mail actually carries. Reports `NO_FILTER` (config claims a label nothing applies), `MISSING_LABEL` (backfill gap — filters run only on arrival), `STRAY_LABEL` (residue from a config the repo no longer describes) and `NO_MAIL` (dead rule or typo'd query). Rules are matched to each other **by sender**, so expectations are always drawn from the *whole* config, never the `--source`/`--only` subset — scoping the expectation set reports every legitimately-overlapping label as a stray (a Newsletters-only run went 36 strays → 20 once fixed). Sender-unconstrained `subject:` rules used to over-report here; `organize-emails.mjs` was the last source of them and is gone, so every rule the audit compares against is now sender-scoped. **`MISSING_LABEL` needs `--exact` to be trusted** — without it the check samples, and `messages.list` returns newest-first while a backfill gap sits in the oldest mail, so it samples exactly the messages a filter already handled: a 10-message sample of `info@email.meetup.com` reported 0 missing against a real gap of **6,381 of 10,475**. `--exact` counts by `labelIds`
- `audit-sender-signals.mjs (--domains-file <path> | --domains a.com,b.com) [--sample N]` — Scores each sender's subject+body text against schema.org-type keyword sets. **Never infer an org's type from its domain name, and never expand an abbreviation in one** — see [README.md#known-issues](README.md#known-issues) for the examples and running tally, kept there so the count lives in exactly one place. The scanner is a signal, not an oracle: tantrany.com's "happy hour / tickets" language mis-scores as EntertainmentBusiness when it is an EducationalOrganization. Also prints true mailbox-wide totals, which the unread sample badly understates
- `extract-platform-orgs.mjs --domain <d> [--max N] [--emit]` — Enumerate every org behind a platform domain (ESPs, survey/booking tools). **Pages the whole domain rather than sampling** — a 25-message sample of `express.medallia.com` found 3 of 20 orgs and would have missed 46% of the mail. Refuses above `--max` (default 400) as too fragmented; flags `FANS-OUT` local parts that carry many orgs (`marriott@` → 16 hotel properties) and `NAME-ONLY` ones whose address is no guide to the org (`posadas@`→Fiesta Inn, `noreply@`→**Avianca**)
- `create-country-tags.mjs [--filters-only] [--only <label>] [--countries a,b]` — Country/* sender-origin tags; label-only like `create-org-tags.mjs` (never archives). Seeded from ccTLD domains only — brands sending localized mail from a global domain can't be attributed and are left untagged. `COUNTRY_TAGS` lives in [`config/country-tags.mjs`](config/country-tags.mjs) and is read by `audit-label-drift.mjs`. All three config sources (`CATEGORIES`, `ORG_TAGS`, `COUNTRY_TAGS`) now name their rule array `entries`, so anything iterating them uses one field
- `sublabel-services.mjs` — Sub-categorize Services & Alerts into Real Estate/Health/Utilities sublabels + auto-label filters (`--all` includes read mail)
- `modify-messages.mjs (--label "<name>" | --query "<gmail-query>") [--unread] [--before YYYY/MM/DD] [--add "<label>"] [--remove "<label>"] [--yes]` — General select-and-relabel: resolves labels, pages the selection, batch-modifies it. **Previews and changes nothing without `--yes`.** Selects by `labelIds` rather than `label:"…"` (a label name is unsafe search input — see [README.md#known-issues](README.md#known-issues)), and every named label must already exist, so a typo fails before the paging spend. System names (`UNREAD`/`INBOX`/`SPAM`) resolve through the same lookup as user labels. `mark-spam.mjs` and `mark-old-label-read.mjs` are presets of this. Unlike `relabel-messages.mjs` it pages, so it does not cap at 100
- `relabel-messages.mjs --query "<gmail-query>" [--add "<label>"] [--remove "<label>"]` — Move a query's matches between user labels; both labels must already exist (fails fast rather than creating one from a typo). **Caps at 100 messages** — it calls `searchAndModify` with `DEFAULT_MAX_RESULTS`, which truncates that function's paging loop; on a larger set it moves 100 and prints a success line. Dropping the argument is the whole fix. Use `strip-label.mjs` for bulk removal
- `strip-label.mjs --label "X" [--query "<gmail-query>"] [--dry-run]` — Remove a label from every message carrying it, paging until none remain; `--query` narrows that to one sender's copies. Re-queries the first page each round rather than using `pageToken`, because removing the label shrinks the result set and invalidates tokens. **Check what remains labeled before stripping** — stripping `Product Updates` off AlphaSignal mail would have orphaned 215 of 321 messages, because only the rest also carried `Newsletters`; backfill the correct label first (`labelAllMatching()` in `lib/gmail-tag-utils.mjs` pages properly, unlike `relabel-messages.mjs --add`)
- `merge-label.mjs --from "A" --into "B" [--delete-source] [--dry-run]` — Add B to every message carrying A, then optionally delete A. Selects by `labelIds`, **never a `label:"…"` query**: a label name is unsafe search input — parens return 0 matches, and `&`/spaces can tokenize into a *sibling* label. Both fail silently, so a query-based merge can operate on the wrong set and still print success; `Food` → `Food & Delivery` was exactly that prefix collision. Pages with `pageToken` (safe here, unlike `strip-label.mjs` — adding a label leaves the source set unchanged), deletes via one `labels.delete` rather than a bulk strip so there is no partial-detach window, and refuses to delete unless the target ends up holding at least as many messages as the source did
- `protect-important-inbox.mjs`, `filter-events-by-date.mjs` — Filtering & organization
- `mark-read.mjs` (label/past-event based, `--archived-only`/`--past-events` flags), `mark-forums-read.mjs`, `archive-old-emails.mjs (--label "X" | --query "<gmail-query>")` — Read/archive maintenance (7-day cutoff; `--query` covers senders that should sit in the inbox briefly, since Gmail filters run only on arrival and can't express age)
- `mark-old-label-read.mjs --label "X" [--before YYYY/MM/DD]` — Mark a label's unread emails older than a cutoff (default 30 days) as read. A `modify-messages.mjs` preset that applies immediately — it has no preview gate, unlike the general tool
- `mark-past-events-read.mjs [--label "Events"] [--dry-run]` — Date-classify a label's unread mail (subject/body via `classifyEmail`, HTML fallback); mark past events read, keep future/undatable unread
- `extract-event-details.mjs [--max N] [--full] "<gmail-query>" [query...]` — Print subject + body fragments around date/time/location keywords for each query's matches (calendar-entry prep without opening emails)
- `bulk-archive-unread.mjs` — Archive all unread inbox mail except "Keep Important" (stays unread; resumable; retry + batch-split on FAILED_PRECONDITION)
- `mark-spam.mjs "<gmail-query>" [--yes]` — Add SPAM / remove INBOX+UNREAD for a query's matches; previews and changes nothing without `--yes` (an over-broad query trains Gmail's classifier on wanted mail). A `modify-messages.mjs` preset; the preview lists 25 matches then summarizes the rest
- `switch-account.mjs` — Switch active Google account (file-based resolution)

**Categories:** Protected (never archive) | Events (future=keep, past=archive) | Monitoring (archive) | Product Updates (label+archive) | Communities (keep) | Services (archive) | Billing (conditional)

**Routing Config (`config/`):** Data only — no Gmail client, no CLI, so an auditor
reading a config does not load googleapis (~1ms vs ~550ms via the CLI entrypoint).
All three export their rule array as `entries`.
- `categories.mjs` — `CATEGORIES`, category routing; applied by `create-filters.mjs`
- `org-tags.mjs` — `ORG_TAGS`, Organization/* sender tags; applied by `create-org-tags.mjs`
- `country-tags.mjs` — `COUNTRY_TAGS`, Country/* tags; applied by `create-country-tags.mjs`

Consumers (`audit-label-drift.mjs`, `audit-org-tag-coverage.mjs`, `build-jsonld.mjs`)
import from `config/`, never from the `create-*.mjs` entrypoint.

**Shared Utilities (`lib/`):**
- `gmail-client.mjs` — Authenticated client factory (used by all root .mjs scripts)
- `gmail-label-utils.mjs` — Label caching: `buildLabelCache()`, `resolveLabelId()`, `resolveLabelIds()`
- `gmail-batch.mjs` / `gmail-batch-utils.mjs` — Batch operations (10-100x speedup)
- `gmail-message-utils.mjs` — Message header/body extraction, `decodeBase64Payload()`, `countMessagesMatching()` (exact paginated query counts), `fetchMessageHeaders()`
- `gmail-filter-utils.mjs` — Filter creation helpers
- `gmail-tag-utils.mjs` — Label-only tag sets shared by `create-org-tags.mjs` / `create-country-tags.mjs`: `withRetry()`, `labelAllMatching()`, `applyTagSet()`
- `defined-terms.mjs` / `vocabularies.mjs` — schema.org `DefinedTerm`/`DefinedTermSet` builders + `validateVocabulary()`, and the vocabularies `ORG_TAGS` points at (`VOCABULARIES` lists all five). A tag group's `schema` field is **documentation only** — `applyTagSet()` never reads it, so adding a term changes no mail. **See [docs/DEFINED-TERMS-GUIDE.md](docs/DEFINED-TERMS-GUIDE.md) before adding a term or set**
- `date-based-filter.mjs` — Date parsing utility (ISO, US, text formats; no mutations)
- `schema-extractor.mjs` — Schema.org type extraction from email HTML (htmlparser2)
- `email-analyzer.mjs` / `email-utils.mjs` — Email parsing, categorization helpers. **All sender
  parsing lives in `email-utils.mjs`** — `extractDisplayName()` (strict: `''`, not the address,
  when the header has no display name, so grouping by name can tell those apart; write
  `extractDisplayName(f) || extractEmailAddress(f)` to print), `extractEmailAddress()`,
  `extractLocalPart()`, `extractDomain()` (lowercased — the domain→label configs are lower
  case, so an unnormalized compare silently misses), plus `GENERIC_LOCAL_PARTS` and
  `shareLeadingToken()`. These were duplicated across `audit-sender-signals.mjs`,
  `audit-org-tag-coverage.mjs` and `sublabel-services.mjs`, with two scripts importing them
  *from a CLI entrypoint*; don't re-add a local regex variant
- `constants.mjs` — Shared constants (DEFAULT_MAX_RESULTS, category definitions)
- `console-utils.mjs` — Formatted console output helpers

**Patterns:**
- Use `Promise.all` for concurrent fetches (not serial loops)
- `npm run build:jsonld` / `check:jsonld` (`build-jsonld.mjs`) — emits `docs/mailbox.jsonld`, one flattened JSON-LD `@graph` of `VOCABULARIES` + every `ORG_TAGS` `schema` block; `--check` fails when stale. **Nothing else stores these entities** — they are built in memory per run and discarded, since a Gmail label holds only a name
- Dynamic label resolution (L6) — `labelCache.get('Label/Name')` instead of hardcoded IDs (see `docs/LABEL-RESOLUTION-GUIDE.md`)

