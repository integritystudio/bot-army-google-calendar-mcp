# Changelog — 1.5.0 (Unreleased)

## Testing

Milestones migrated from CLAUDE.md (recorded as of 2026-08-03):

- Core handler tests added: CreateEventHandler, GetEventHandler, GetCurrentTimeHandler
- Type-safe content assertions using `{ type: 'text'; text: string }` instead of `as any`
- Integration tests for conflict detection via MCP protocol (real server, real API)
- 601 unit tests passing across 33 files (`npm test`); integration tests require live API (`npm run test:integration`)
- Test helper consolidation reduced boilerplate across 30+ test files:
  - `factories.ts` — event fixtures (makeEvent, makeTeamMeetingEvent, createFullEventArgs, STANDARD_ATTACHMENTS, ATTACHMENT_IDS)
  - `content.ts` — response helpers (getTextContent, expectValidToolResponse, expectJsonResponse, assertTextContentContains)
  - `handler-setup.ts` — mock setup (setupListEventsHandler, createGoogleCalendarMocks)
  - `integration-test-helpers.ts` — lifecycle helpers (createAndVerifyEvent, updateAndVerifyEvent, expectModificationScopeError, expectEventUpdateSuccess)
