# Quick Start: Integrated Inbox Management

Example commands for the Gmail organization pipeline. All scripts run from the project root with `node`.

## 1. Authenticate

```bash
npm run auth:gmail         # Create Gmail tokens (tokens-gmail.json)
node verify-tokens.mjs     # Verify Gmail token status
```

Multi-account:

```bash
node switch-account.mjs                # Show active account and available accounts
node switch-account.mjs work           # Switch active account to "work"
node switch-account.mjs --add work     # Auth a new account named "work"
node switch-account.mjs --remove work  # Remove an account's tokens
```

`ACCOUNT_MODE` selects the account for these `.mjs` scripts (the TypeScript calendar side reads `GOOGLE_ACCOUNT_MODE` instead — set both if working across both).

## 2. Inspect the inbox

```bash
node report-messages.mjs --format list --group-by category \
  --columns unread,sender,subject --max 200 "in:inbox"   # Current inbox contents
node list-unread-emails.mjs            # Full category breakdown with previews
node list-unread-emails.mjs --count    # Just the total unread count
node list-unread-emails.mjs --stats    # Per-label total/unread counts + mailbox profile
node list-unread-emails.mjs --verify   # Spot-check label application on sample emails
node list-unread-emails.mjs --schema   # Detect schema.org JSON-LD in unread emails
node summarize-remaining.mjs           # Summarize what's left uncategorized
```

## 3. Label and organize

```bash
node create-filters.mjs --only Events            # Label event emails
node create-filters.mjs --only Newsletters       # Label newsletters
node create-org-tags.mjs                         # Organization/* label hierarchy
```

## 4. Create auto-label filters

```bash
node create-filters.mjs                     # Create all category filters + backfill
node create-filters.mjs --only "Promotions" # Only categories whose label starts with the prefix
node sublabel-services.mjs                 # Sub-categorize Services & Alerts (Real Estate/Health/Utilities) + auto-label filters
node sublabel-services.mjs --all           # Also retro-label already-read Services & Alerts mail
```

## 5. Protect important mail

```bash
node protect-important-inbox.mjs                        # Keep important items in inbox
node protect-important-inbox.mjs --billing              # Smart billing filters with rate-limit detection
node protect-important-inbox.mjs --billing --update     # Add urgent billing alert filter
node protect-important-inbox.mjs --billing --apply-only # Apply billing filters to unread emails only
```

## 6. Archive and mark read

```bash
node filter-events-by-date.mjs                    # Keep future events, archive past ones
node archive-old-emails.mjs --label "Meeting Responses"        # Preview
node archive-old-emails.mjs --label "Meeting Responses" --yes  # Apply
node mark-read.mjs                                # Mark all labeled emails as read
node mark-read.mjs --archived-only                # Restrict to emails no longer in inbox
node mark-forums-read.mjs                         # Mark Forums emails older than 5 days as read
node mark-old-label-read.mjs --label "Newsletters"                     # Mark label's emails older than 30 days as read
node mark-old-label-read.mjs --label "Job Search" --before 2026/06/01  # Explicit cutoff date
node mark-past-events-read.mjs                    # Mark past-dated Events emails read; keep future/undatable unread
node mark-past-events-read.mjs --label "Travel" --dry-run  # Preview date split for another label
node extract-event-details.mjs 'subject:"Registration confirmed for Hack AI"'      # Print when/where fragments for matches
node extract-event-details.mjs --max 5 --full 'label:Events is:unread from:luma-mail.com'  # Full body text, 5 msgs per query
node modify-messages.mjs --query "is:unread in:inbox" --exclude-label "Keep Important" --remove INBOX --yes   # Archive ALL unread inbox mail except "Keep Important" (stays unread; resumable)
```

## Typical maintenance run

```bash
node create-filters.mjs && \
node filter-events-by-date.mjs && \
node mark-read.mjs --archived-only && \
node list-unread-emails.mjs --count
```

## Category policy

| Category | Behavior |
|----------|----------|
| Protected | Never archive |
| Events | Future = keep, past = archive |
| Monitoring, Services | Archive |
| Product Updates | Label + archive |
| Communities | Keep |
| Billing | Conditional |
