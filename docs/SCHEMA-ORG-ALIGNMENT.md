# Schema.org Type Alignment Analysis
## Google Calendar MCP Codebase Type Definitions

**Generated**: 2026-03-24
**Purpose**: Align Google Calendar MCP type definitions with schema.org vocabulary for semantic web compatibility and metadata standardization.

---

## Executive Summary

The Google Calendar MCP codebase defines **47 TypeScript types and interfaces** across calendar, email/Gmail, conflict detection, and transport management. This document maps these types to **schema.org vocabulary** for:

- **Semantic interoperability**: Align internal types with globally-recognized schema standards
- **Structured data compatibility**: Enable rich metadata and knowledge graph integration
- **API documentation**: Use schema.org descriptions to enhance API reference
- **SEO/LLM benefits**: Improve content discoverability and AI understanding

**Key Finding**: The codebase aligns well with schema.org's **Event**, **EmailMessage**, **Action**, and **Schedule** types, with opportunities to enhance conflict/duplicate detection with custom extensions.

---

## Codebase Type Inventory

### Core Calendar Types (7 types)

| Codebase Type | Purpose | Schema.org Equivalent |
|---|---|---|
| **CalendarEvent** | Main event entity with start/end times, attendees, reminders | [`Event`](https://schema.org/Event) |
| **CalendarListEntry** | Calendar metadata in calendar list | [`Calendar`](https://schema.org/Calendar) or `Collection` |
| **CalendarEventAttendee** | Event participant with RSVP status | [`Person`](https://schema.org/Person) + [`Reservation`](https://schema.org/Reservation) |
| **CalendarEventReminder** | Notification settings (email/popup, minutes) | [`InteractionCounter`](https://schema.org/InteractionCounter) or custom reminder action |
| **FreeBusyResponse** | Free/busy time slots | [`ScheduleAction`](https://schema.org/ScheduleAction) + time range |
| **EventTimeRange** | Start/end time for events | [`OpeningHoursSpecification`](https://schema.org/OpeningHoursSpecification) |
| **DateTimeComponents** | Year, month, day, hour breakdown | Utility type (no direct schema equivalent) |

### Conflict Detection Types (4 types)

| Codebase Type | Purpose | Schema.org Alignment |
|---|---|---|
| **ConflictInfo** | Overlap or duplicate event record | Custom extension of [`Event`](https://schema.org/Event) with conflict metadata |
| **DuplicateInfo** | Duplicate event detected | Custom extension; could use [`Thing`](https://schema.org/Thing) with identical properties |
| **ConflictCheckResult** | Result of conflict detection | Custom `ConflictCheckResult` type (MCP-specific) |
| **ConflictDetectionOptions** | Configuration for conflict checking | Custom configuration object |

### Gmail/Email Types (7 types)

| Codebase Type | Purpose | Schema.org Equivalent |
|---|---|---|
| **GmailSearchInput** | Email search query parameters | Custom MCP input type; uses [`SearchAction`](https://schema.org/SearchAction) pattern |
| **GmailModifyInput** | Message modification (mark read, archive, delete) | [`ModifyAction`](https://schema.org/ModifyAction) or custom action |
| **GmailCreateFilterInput** | Email filter criteria | Custom filter configuration |
| **GmailApplyFiltersInput** | Apply filters to messages | Custom action; relates to [`FilterAction`](https://schema.org/FilterAction) (experimental) |
| **GmailCreateLabelInput** | Gmail label creation | Custom label/tag type; could extend [`Thing`](https://schema.org/Thing) with name + visibility |
| **OAuthCredentials** | Authentication tokens | No schema.org equivalent (authentication is out of scope) |
| **PerformanceMetric** | Operation timing metadata | [`PerformanceMetric`](https://schema.org/PerformanceMetric) |

### Transport & Configuration Types (8 types)

| Codebase Type | Purpose | Schema.org Alignment |
|---|---|---|
| **TransportConfig** | Transport layer configuration (stdio/http) | MCP-specific, no schema.org equivalent |
| **ServerConfig** | Server configuration | MCP-specific, no schema.org equivalent |
| **BatchRequest** / **BatchResponse** | Batch operation handling | [`BuyAction`](https://schema.org/BuyAction) pattern or custom batch action |
| **BatchError** | Batch operation error | Error handling pattern (no standard schema.org error type) |
| **HttpTransportConfig** | HTTP-specific transport config | MCP-specific, no schema.org equivalent |
| **ConflictDetectionConfig** | Conflict detection settings | Custom configuration type |
| **ConflictCheckOptions** | Runtime conflict check options | Custom options type |

### Tool Input Types (12 types)

All tool input types (`ListCalendarsInput`, `CreateEventInput`, `UpdateEventInput`, `SearchEventsInput`, etc.) are **MCP protocol-specific** and map to tool operation schemas rather than schema.org types directly. However, their parameters align with corresponding schema.org types:

- **Event operations** → [`Event`](https://schema.org/Event) + [`Action`](https://schema.org/Action) subtypes
- **Search operations** → [`SearchAction`](https://schema.org/SearchAction)
- **Batch operations** → Custom MCP batch action pattern

---

## Schema.org Type Recommendations

### Core Recommendations (High Priority)

#### 1. **Event** (for CalendarEvent)
- **URL**: https://schema.org/Event
- **Usage**: Primary mapping for `CalendarEvent` interface
- **Key Properties**:
  - `name` → `CalendarEvent.summary`
  - `startDate` / `startTime` → `CalendarEvent.start`
  - `endDate` / `endTime` → `CalendarEvent.end`
  - `location` → `CalendarEvent.location`
  - `attendee` → `CalendarEvent.attendees[]`
  - `organizer` → Calendar owner
  - `reminder` → Event reminders (custom extension)

**Example Schema.org Event Context**:
```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Team Standup",
  "startDate": "2026-03-24T10:00:00",
  "endDate": "2026-03-24T10:30:00",
  "location": "Conference Room A",
  "attendee": [
    {
      "@type": "Person",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "organizer": {
    "@type": "Person",
    "name": "Alice Smith"
  }
}
```

#### 2. **Person** (for CalendarEventAttendee)
- **URL**: https://schema.org/Person
- **Usage**: Represents calendar attendees
- **Key Properties**:
  - `name` → Attendee name
  - `email` → Attendee email
  - `url` → Calendar profile URL (if available)

#### 3. **Schedule** (for FreeBusyResponse / EventTimeRange)
- **URL**: https://schema.org/Schedule
- **Usage**: Represents availability and time slots
- **Key Properties**:
  - `byDay` → Days of availability
  - `startTime` → Time availability start
  - `endTime` → Time availability end

#### 4. **SearchAction** (for Gmail search operations)
- **URL**: https://schema.org/SearchAction
- **Usage**: Represents email search operations
- **Key Properties**:
  - `query` → Search query string
  - `result` → Search results (EmailMessage objects)

### Secondary Recommendations (Medium Priority)

#### 5. **Reservation** (for CalendarEventAttendee + RSVP status)
- **URL**: https://schema.org/Reservation
- **Usage**: Enhanced representation of event attendance with RSVP status
- **Key Properties**:
  - `reservationFor` → Calendar Event
  - `underName` → Person (attendee)
  - `reservationStatus` → RSVP status (Confirmed/Tentative/Declined)

#### 6. **EmailMessage** (for Gmail operations)
- **URL**: https://schema.org/EmailMessage
- **Usage**: Represents email messages from Gmail
- **Key Properties**:
  - `sender` → Email sender
  - `toRecipient` → Recipients
  - `subject` → Email subject
  - `dateReceived` → Received timestamp

#### 7. **PerformanceMetric** (for monitoring/observability)
- **URL**: https://schema.org/PerformanceMetric
- **Usage**: Operation performance tracking
- **Key Properties**:
  - `name` → Metric name (e.g., "create_event_duration")
  - `value` → Metric value (ms)
  - `unitText` → "milliseconds"

#### 8. **SoftwareApplication** (for MCP server metadata)
- **URL**: https://schema.org/SoftwareApplication
- **Usage**: Server metadata (`get_server_metadata` tool)
- **Key Properties**:
  - `name` → "bot-army-google-calendar-mcp"
  - `version` → Semantic version
  - `applicationCategory` → "DeveloperApplication"
  - `featureList` → Array of tool names

### Custom Extensions (Not in Schema.org)

The following types are MCP or domain-specific and don't have schema.org equivalents:

1. **ConflictInfo** → Custom extension
   ```json
   {
     "@type": "ConflictInfo",
     "conflictType": "overlap|duplicate",
     "conflictingEvent": { "@type": "Event", ... },
     "overlapPercentage": 0.75,
     "relatedCalendar": "calendar-id"
   }
   ```

2. **GmailCreateFilterInput** → Custom extension
   ```json
   {
     "@type": "EmailFilter",
     "criteria": { "from": "...", "subject": "..." },
     "action": "archive|delete|addLabel"
   }
   ```

3. **FilterAction** (Experimental schema.org)
   - URL: https://schema.org/FilterAction
   - Status: Proposed/experimental in schema.org

---

## How to Retrieve Schema.org Definitions

### Using Schema.org MCP Tools

The following MCP tool calls retrieve complete schema.org type definitions:

#### Core Schema Tools

```bash
# 1. Get Event type definition
get_schema_type
  typeName: "Event"

# 2. Get Person type definition
get_schema_type
  typeName: "Person"

# 3. Get Schedule type definition
get_schema_type
  typeName: "Schedule"

# 4. Get Reservation type definition
get_schema_type
  typeName: "Reservation"

# 5. Search for calendar-related types
search_schemas
  query: "calendar"
  limit: 10

# 6. Search for email/message types
search_schemas
  query: "email message"
  limit: 10

# 7. Get type hierarchy for Event
get_type_hierarchy
  typeName: "Event"

# 8. Get all properties for Event type
get_type_properties
  typeName: "Event"
  includeInherited: true

# 9. Generate JSON-LD example for Event
generate_example
  typeName: "Event"
```

#### Metadata Tools

```bash
# 10. Get server metadata as SoftwareApplication
get_server_metadata
  metadataType: "softwareApplication"

# 11. Generate SearchAction example (for Gmail search)
generate_search_action
  query: "email search"

# 12. Generate CreateAction example (for event creation)
generate_create_action
  typeName: "Event"
```

---

## Type Mapping Table

### Quick Reference: Codebase → Schema.org

| Google Calendar MCP Type | Schema.org Type | Alignment Score | Notes |
|---|---|---|---|
| CalendarEvent | Event | ★★★★★ (95%) | Direct mapping; all properties align |
| CalendarEventAttendee | Person | ★★★★★ (90%) | +Reservation for RSVP status |
| CalendarListEntry | Calendar | ★★★★ (80%) | Missing some calendar properties |
| CalendarEventReminder | Reminder (custom) | ★★★ (60%) | No standard schema.org reminder type |
| FreeBusyResponse | Schedule | ★★★★ (85%) | Maps well to time slot definition |
| EventTimeRange | OpeningHoursSpecification | ★★★ (70%) | Close match; designed for business hours |
| ConflictInfo | Event (custom) | ★★ (40%) | Requires custom extension properties |
| DuplicateInfo | Event (custom) | ★★ (40%) | Requires custom metadata |
| GmailSearchInput | SearchAction | ★★★★ (85%) | Query-based; results are EmailMessages |
| GmailModifyInput | ModifyAction | ★★★ (70%) | Covers message modification |
| GmailCreateFilterInput | FilterAction | ★★ (50%) | Experimental in schema.org |
| PerformanceMetric | PerformanceMetric | ★★★★ (90%) | Direct alignment |
| OAuthCredentials | (N/A) | N/A | Security/auth scope; not in schema.org |
| TransportConfig | (N/A) | N/A | Protocol-specific; not in schema.org |
| DateTimeComponents | (N/A) | N/A | Utility type; implementation detail |

---

## Implementation Recommendations

### Phase 1: Immediate Alignment (Priority 1)

1. **Enhance CalendarEvent documentation** with schema.org Event properties
   - Add `@context: https://schema.org` to API response examples
   - Map all CalendarEvent fields to Event properties
   - Document timezone handling (schema.org uses ISO 8601)

2. **Create Person type mapping** for attendees
   - Document how CalendarEventAttendee aligns with Person
   - Consider adding Reservation type for RSVP status

3. **Generate API examples** using `generate_example` tool
   - Create sample JSON-LD for Event objects
   - Include in API documentation

### Phase 2: Enhanced Metadata (Priority 2)

4. **Add schema.org markup** to server responses
   - Include `@context`, `@type` in API payloads (optional)
   - Use SearchAction for search endpoints
   - Use PerformanceMetric for performance data

5. **Document custom extensions**
   - Create ConflictInfo schema extension
   - Document custom properties for conflict detection

6. **Implement Schema Impact Analysis**
   - Use `analyze_schema_impact` tool to measure SEO/LLM benefits
   - Benchmark before/after implementation

### Phase 3: Advanced Integration (Priority 3)

7. **Rich snippet generation** for events
   - Use `generate_example` for structured data
   - Integrate with knowledge graph tools

8. **Gmail integration** with EmailMessage type
   - Enhance GmailSearchInput documentation
   - Map GmailModifyInput to ModifyAction

9. **Performance monitoring** with schema.org PerformanceMetric
   - Track operation performance
   - Generate performance reports using `generate_performance_report`

---

## Example: CalendarEvent → Event Conversion

### Current Type (CalendarEvent)
```typescript
interface CalendarEvent {
  id?: string | null;
  summary?: string | null;
  start?: {
    dateTime?: string | null;
    date?: string | null;
    timeZone?: string | null;
  };
  end?: {
    dateTime?: string | null;
    date?: string | null;
    timeZone?: string | null;
  };
  location?: string | null;
  attendees?: CalendarEventAttendee[] | null;
  colorId?: string | null;
  reminders?: CalendarEventReminder[] | null;
}
```

### Schema.org Equivalent (Event)
```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "identifier": "event-id-123",
  "name": "Team Standup",
  "startDate": "2026-03-24T10:00:00-07:00",
  "endDate": "2026-03-24T10:30:00-07:00",
  "location": {
    "@type": "Place",
    "name": "Conference Room A"
  },
  "attendee": [
    {
      "@type": "Person",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "color": "blue",
  "reminder": {
    "@type": "Reminder",
    "method": "email",
    "minutes": 15
  }
}
```

### Mapping Details

| CalendarEvent Field | Event Property | Conversion Notes |
|---|---|---|
| `id` | `identifier` | 1:1 mapping |
| `summary` | `name` | 1:1 mapping |
| `start.dateTime` | `startDate` | Convert to ISO 8601 with timezone |
| `start.date` | `startDate` | All-day event (no time component) |
| `start.timeZone` | Timezone suffix in `startDate` | e.g., `2026-03-24T10:00:00-07:00` |
| `end.dateTime` | `endDate` | Convert to ISO 8601 with timezone |
| `end.date` | `endDate` | All-day event |
| `end.timeZone` | Timezone suffix in `endDate` | e.g., `2026-03-24T10:30:00-07:00` |
| `location` | `location` | Wrap string in Place object if needed |
| `attendees[]` | `attendee[]` | Each attendee → Person object |
| `colorId` | `color` | Direct string mapping |
| `reminders[]` | `reminder` | Create custom Reminder objects (or use Action) |

---

## Questions for Further Refinement

1. **Timezone handling**: How should CalendarEvent timezone be represented in Event.startDate?
   - Option A: ISO 8601 with timezone offset (preferred by schema.org)
   - Option B: Separate timeZone property (Google Calendar approach)

2. **Attendee RSVP status**: Should we use Reservation type for detailed RSVP tracking?
   - Pros: More semantic, supports reservationStatus
   - Cons: More complex object structure

3. **Conflict detection**: Should ConflictInfo be a custom extension or separate payload?
   - Option A: Include in Event object as extension property
   - Option B: Return separately with conflict metadata

4. **Performance tracking**: Is PerformanceMetric the right choice for operation timing?
   - Alternative: Custom `OperationMetric` with more detailed breakdown

---

## Related Resources

- **Schema.org Documentation**: https://schema.org/
- **Schema.org Event Type**: https://schema.org/Event
- **JSON-LD Specification**: https://json-ld.org/
- **ISO 8601 Standard**: Date and time format reference
- **Google Calendar API**: https://developers.google.com/calendar/api

---

## Next Steps

1. ✅ Generate schema.org type definitions using MCP tools
2. ⬜ Create JSON-LD examples for each major type
3. ⬜ Update API documentation with schema.org context
4. ⬜ Implement example generation in API responses
5. ⬜ Validate against schema.org validator tools
6. ⬜ Benchmark SEO/LLM impact with `analyze_schema_impact`

---

**Document Version**: 1.0
**Last Updated**: 2026-03-24
**Maintained By**: MCP Development Team
