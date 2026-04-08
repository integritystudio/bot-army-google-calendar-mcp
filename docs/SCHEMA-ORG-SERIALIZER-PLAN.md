# Schema.org Serializer Plan

**Purpose**: Add `@context`/`@type` JSON-LD output to calendar MCP tool responses.
**Status**: Not started (inbound extraction complete; outbound serialization pending)

---

## Implemented: Inbound Email Extraction

Complete in `lib/schema-extractor.mjs`:

- [x] `extractSchemaMarkupFromGmailPayload(html)` -- htmlparser2 streaming parser, captures `<script type="application/ld+json">` blocks, filters for `@context` containing "schema.org"
- [x] `extractHtmlFromPayload(payload)` -- recursive multipart traversal, base64url decode
- [x] `categorizeBySchema(schemaObjects)` -- routes `@type` through `SCHEMA_CATEGORY_MAP`, extracts metadata per type (event name/date/venue, order number/total, tracking number, reservation details)
- [x] `SCHEMA_CATEGORY_MAP` -- 15 schema.org types mapped to 6 categories (Events, Travel, Orders, Shipping, Billing, Actionable)

See [EMAIL-CATEGORIZATION.md](EMAIL-CATEGORIZATION.md) and [SCHEMA_CATEGORY_MAP.md](SCHEMA_CATEGORY_MAP.md).

---

## Not Started: Outbound Calendar Serialization

### Design Decisions

| Question | Decision | Rationale |
|---|---|---|
| Serialization layer | Separate `SchemaOrgSerializer` service | Matches `services/conflict-detection/` pattern; keeps handlers thin |
| Opt-in or default | Opt-in via `includeJsonLd` tool parameter | No breaking changes; keeps default responses lean |
| Timezone | ISO 8601 with offset | Combine `dateTime` + `timeZone` using existing `resolveTimeRange`/`createTimeObject` from `utils/timezone-utils.ts` |
| Attendee RSVP | `Person` with `additionalProperty` for `responseStatus` | Avoids Reservation complexity; schema.org Person covers email + name |

### Handler Integration Points

All 5 handlers use the same response pattern: `formatEventWithDetails()` (single) or `formatEventsList()` (list) -> `this.textResult(text)`. The serializer adds a second content block when `includeJsonLd` is true.

| Handler | Formatting function | Serializer output |
|---|---|---|
| `CreateEventHandler` | `createEventResponseWithConflicts()` | Single `Event` |
| `UpdateEventHandler` | `createEventResponseWithConflicts()` | Single `Event` |
| `GetEventHandler` | `formatEventWithDetails()` | Single `Event` |
| `ListEventsHandler` | `formatEventsList()` | `ItemList` of `Event` objects |
| `SearchEventsHandler` | `formatEventsList()` | `SearchAction` with `Event` results |

### Property Mapping: `calendar_v3.Schema$Event` -> JSON-LD Event

Source: `src/schemas/types.ts` `CalendarEvent` and `calendar_v3.Schema$Event` (superset used by handlers).

| Google Calendar field | schema.org property | Conversion |
|---|---|---|
| `id` | `identifier` | 1:1 |
| `summary` | `name` | 1:1 |
| `description` | `description` | 1:1 |
| `start.dateTime` + `start.timeZone` | `startDate` | ISO 8601 with offset |
| `start.date` | `startDate` | Date-only (all-day) |
| `end.dateTime` + `end.timeZone` | `endDate` | ISO 8601 with offset |
| `end.date` | `endDate` | Date-only (all-day) |
| `location` | `location` | String, or `Place` if structured |
| `attendees[].email` | `attendee[].email` | `Person` object |
| `attendees[].displayName` | `attendee[].name` | `Person` object |
| `attendees[].responseStatus` | `attendee[].additionalProperty` | `{name: "rsvpStatus", value: "accepted"}` |
| `htmlLink` | `url` | 1:1 |
| `recurrence` | `eventSchedule` | RRULE string array |
| `colorId` | `color` | Direct string |
| `organizer.email` | `organizer.email` | `Person` or `Organization` |
| `reminders` | -- | No schema.org equivalent |

### Example Output

Single event (GetEventHandler with `includeJsonLd: true`):

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "identifier": "abc123",
  "name": "Team Standup",
  "startDate": "2026-04-08T10:00:00-05:00",
  "endDate": "2026-04-08T10:30:00-05:00",
  "location": "Conference Room A",
  "attendee": [
    {
      "@type": "Person",
      "email": "alice@example.com",
      "name": "Alice",
      "additionalProperty": {
        "@type": "PropertyValue",
        "name": "rsvpStatus",
        "value": "accepted"
      }
    }
  ],
  "url": "https://calendar.google.com/calendar/event?eid=abc123"
}
```

List (ListEventsHandler with `includeJsonLd: true`):

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "numberOfItems": 3,
  "itemListElement": [
    { "@type": "Event", "name": "...", "startDate": "..." }
  ]
}
```

Search (SearchEventsHandler with `includeJsonLd: true`):

```json
{
  "@context": "https://schema.org",
  "@type": "SearchAction",
  "query": "standup",
  "result": {
    "@type": "ItemList",
    "itemListElement": [
      { "@type": "Event", "name": "...", "startDate": "..." }
    ]
  }
}
```

### Files to Create

- [ ] `src/services/schema-org/SchemaOrgSerializer.ts` -- `serializeEvent()`, `serializeEventList()`, `serializeSearchAction()`
- [ ] `src/services/schema-org/index.ts` -- barrel export
- [ ] `src/tests/unit/services/schema-org/SchemaOrgSerializer.test.ts`

### Files to Modify

- [ ] `src/handlers/core/GetEventHandler.ts` -- add `includeJsonLd` arg, append JSON-LD content block
- [ ] `src/handlers/core/CreateEventHandler.ts` -- same
- [ ] `src/handlers/core/UpdateEventHandler.ts` -- same
- [ ] `src/handlers/core/ListEventsHandler.ts` -- same, use `serializeEventList()`
- [ ] `src/handlers/core/SearchEventsHandler.ts` -- same, use `serializeSearchAction()`
- [ ] `src/tools/registry.ts` -- add `includeJsonLd` boolean to relevant tool schemas

### Validation

- schema-org-mcp tools: `get_schema_type("Event")`, `get_type_properties("Event")`, `generate_example("Event")` -- see [SCHEMA-ORG-MCP-TOOLS.md](SCHEMA-ORG-MCP-TOOLS.md)
- External: https://validator.schema.org/

### Related Docs

- [EMAIL-CATEGORIZATION.md](EMAIL-CATEGORIZATION.md) -- inbound extraction pipeline
- [SCHEMA_CATEGORY_MAP.md](SCHEMA_CATEGORY_MAP.md) -- type inventory and property mapping reference
- [SCHEMA-ORG-MCP-TOOLS.md](SCHEMA-ORG-MCP-TOOLS.md) -- MCP tool invocations for type validation
- [SCHEMA-ORG-INDEX.md](SCHEMA-ORG-INDEX.md) -- documentation index
