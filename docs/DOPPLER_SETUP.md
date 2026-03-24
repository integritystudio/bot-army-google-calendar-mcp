# Doppler Setup for Integration Tests

This guide explains how to use Doppler to provide real Google OAuth credentials to integration tests, avoiding the need for mocking.

## Why Doppler?

- **Real credentials**: Tests run against actual Google APIs without mocks
- **No secrets in repo**: Credentials stored securely in Doppler, not checked into git
- **Environment isolation**: Separate dev, staging, and production credentials
- **Secure by default**: Doppler encrypts secrets and audits access

## Prerequisites

- Doppler CLI installed: `doppler --version` (should show v3.x+)
- Authenticated to IntegrityStudio workspace: `doppler me`
- Already configured: `doppler.yaml` points to `integrity-studio/dev`

## Setup Status: ✅ READY

The `integrity-studio` project is already configured with Google OAuth secrets in the `dev` config:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URIS`
- `GOOGLE_CALENDAR_ACCESS_TOKEN`
- `GOOGLE_CALENDAR_REFRESH_TOKEN`
- Plus additional configuration keys

Verify setup:
```bash
bash scripts/setup-doppler-tests.sh
```

## Running Tests with Doppler

### Unit Tests (mocked)
```bash
npm test
```

### Integration Tests (real Google APIs)
```bash
npm run test:integration:doppler
```

### All Tests
```bash
npm run test:all:doppler
```

## How It Works

The `doppler run` command:
1. Loads all secrets from the `test` config
2. Injects them into the environment
3. Runs vitest
4. Vitest loads environment variables via `loadEnv()` in `vitest.config.ts`
5. Tests can access credentials via `process.env.GOOGLE_OAUTH_CREDENTIALS`, etc.

## Refactoring UpdateEventHandler Tests

With Doppler in place, the `UpdateEventHandler.recurring.test.ts` can be refactored to use real credentials:

```typescript
// Before: Mock setup
const mockCalendar = { events: { get: vi.fn(), patch: vi.fn() } };
const handler = new EnhancedUpdateEventHandler(mockCalendar);

// After: Real handler with real Google API
const oauth2Client = await initializeOAuth2Client();
const handler = new UpdateEventHandler();
const result = await handler.runTool(args, oauth2Client);
```

Since tests run with `doppler run`, real credentials are available from `GOOGLE_OAUTH_CREDENTIALS`.

## Troubleshooting

### "Project not found" error
```bash
doppler projects create --name bot-army-google-calendar-mcp
doppler configs create --project bot-army-google-calendar-mcp --config test
```

### "Unauthorized" error
Ensure you're authenticated:
```bash
doppler login
doppler me
```

### Environment variables not loaded
Verify secrets are set:
```bash
doppler secrets --project bot-army-google-calendar-mcp --config test
```

### Tests still failing
Check vitest.config.ts is loading env vars:
```bash
doppler run -- node -e "console.log(process.env.GOOGLE_OAUTH_CREDENTIALS)" | head -c 50
```

## Security

- ✅ Credentials never committed to git
- ✅ Doppler audit logs track all access
- ✅ Secrets encrypted at rest
- ✅ Multiple configs per project (test, staging, prod)
- ⚠️ Never share your doppler CLI token (in `.doppler/` directory)

## See Also

- [Doppler Docs](https://docs.doppler.com)
- [UpdateEventHandler.recurring.test.ts Refactor Plan](../CLAUDE.md#blocked-items)
