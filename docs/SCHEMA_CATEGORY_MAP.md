# Schema Category Map

Authoritative reference for type definitions, schema.org alignment, and the `SCHEMA_CATEGORY_MAP` used by the email categorization pipeline.

**Source of truth**: `lib/schema-extractor.mjs`

---

## Type Alignment Overview

```
Core Calendar Types:         7 types (95% alignment)
Conflict/Duplicate Types:    4 types (40% alignment)
Email/Gmail Types:           7 types (70% alignment)
Tool Input Types:           12 types (80% alignment)
Configuration Types:         8 types (N/A - protocol specific)
Transport/Protocol Types:    9 types (N/A - infrastructure)

Aligned:      37/47 (78%)
Out-of-Scope: 10/47 (22%)
Overall Score: 72%
```

**Strengths**: Core calendar operations map naturally to Event/Person/Schedule; event properties align 1:1; search operations fit SearchAction.

**Gaps**: Conflict/duplicate detection requires custom extensions; reminders lack a standard type; some Gmail operations (filters, labels) are non-standard; timezone handling needs careful mapping.

---

## SCHEMA_CATEGORY_MAP

Maps schema.org `@type` values extracted from email JSON-LD to internal Gmail label categories.

```javascript
const SCHEMA_CATEGORY_MAP = {
  // Events
  'EventReservation': 'Events',
  'Event': 'Events',
  'MusicEvent': 'Events',
  'RestaurantReservation': 'Events',
  'RsvpAction': 'Events',

  // Travel
  'FlightReservation': 'Travel',
  'LodgingReservation': 'Travel',
  'RentalCarReservation': 'Travel',
  'BusReservation': 'Travel',
  'TrainReservation': 'Travel',

  // Orders & Shipping
  'Order': 'Orders',
  'ParcelDelivery': 'Shipping',

  // Billing
  'Invoice': 'Billing',

  // Actionable
  'ConfirmAction': 'Actionable',
};
```

### Extraction pipeline

```
Gmail API (messages.get, format: full)
  -> extractHtmlFromPayload()        -- traverse multipart, base64url-decode text/html
  -> extractSchemaMarkupFromGmailPayload()  -- htmlparser2 streaming, capture <script type="application/ld+json">
  -> JSON.parse -> validate @context + @type
  -> categorizeBySchema()            -- route @type through SCHEMA_CATEGORY_MAP
  -> apply Gmail label + optional archive
```

### Metadata extracted per type

| @type | Fields extracted |
|---|---|
| EventReservation / Event / MusicEvent | `eventName`, `eventDate`, `venue` |
| Order | `merchant`, `orderNumber`, `orderStatus`, `total` |
| ParcelDelivery | `carrier`, `trackingNumber`, `expectedDelivery` |
| FlightReservation (and travel types) | `reservationNumber`, `status`, `provider`, `departure`, `arrival` |

### Unmapped types (future candidates)

| Schema.org Type | Potential Category | Volume |
|---|---|---|
| `MedicalAppointment` | Appointments | Low |
| `ServiceReservation` | Services | Low |
| `SubscriptionOffer` | Newsletters | Low |

---

## Codebase Type Inventory

### Core Calendar (src/schemas/types.ts)

| Codebase Type | Schema.org Equivalent | Alignment | Notes |
|---|---|---|---|
| `CalendarEvent` | [Event](https://schema.org/Event) | 95% | Direct mapping; all core properties align |
| `CalendarListEntry` | Calendar | -- | Missing some calendar properties |
| `CalendarEventAttendee` | [Person](https://schema.org/Person) | 90% | + additionalProperty for RSVP status |
| `CalendarEventReminder` | (custom) | -- | No standard schema.org reminder type |
| `FreeBusyResponse` | [Schedule](https://schema.org/Schedule) | 85% | Maps to time slot definition |

### Conflict Detection (src/services/conflict-detection/types.ts)

| Codebase Type | Schema.org Equivalent | Alignment | Notes |
|---|---|---|---|
| `ConflictInfo` | Event (custom extension) | 40% | Requires conflict metadata properties |
| `DuplicateInfo` | Event (custom extension) | 40% | Requires duplicate detection metadata |
| `ConflictCheckResult` | (MCP-specific) | -- | No schema.org equivalent |
| `ConflictDetectionOptions` | (MCP-specific) | -- | Configuration object |

### Gmail/Email (src/schemas/)

| Codebase Type | Schema.org Equivalent | Alignment | Notes |
|---|---|---|---|
| `GmailSearchInput` | [SearchAction](https://schema.org/SearchAction) | 85% | Query-based; results are EmailMessages |
| `GmailModifyInput` | ModifyAction | -- | Covers message modification |
| `GmailCreateFilterInput` | FilterAction (experimental) | -- | Non-standard |
| `OAuthCredentials` | N/A | -- | Auth is out of schema.org scope |

### Transport & Tool Input Types

MCP protocol-specific types (`TransportConfig`, `ServerConfig`, `BatchRequest`, `ListCalendarsInput`, `CreateEventInput`, etc.) have no schema.org equivalents. Their parameters align with corresponding schema.org types through the handlers that consume them.

---

## Type Alignment Examples

### FreeBusyResponse -> Schedule

```typescript
interface FreeBusyResponse {
  kind: "calendar#freeBusy";
  timeMin: string;
  timeMax: string;
  calendars: { ... };
}
```

```json
{
  "@type": "Schedule",
  "startTime": "2026-03-24T00:00:00Z",
  "endTime": "2026-03-24T23:59:59Z"
}
```

### GmailSearchInput -> SearchAction

```typescript
interface GmailSearchInput {
  query: string;
  maxResults?: number;
}
```

```json
{
  "@type": "SearchAction",
  "query": "from:boss@company.com",
  "result": {
    "@type": "SearchResultsPage",
    "mainEntity": [{ "@type": "EmailMessage" }]
  }
}
```

---

## Property Mapping: CalendarEvent -> Event

| CalendarEvent field | schema.org Event property | Conversion |
|---|---|---|
| `id` | `identifier` | 1:1 |
| `summary` | `name` | 1:1 |
| `start.dateTime` + `start.timeZone` | `startDate` | ISO 8601 with timezone offset |
| `start.date` | `startDate` | All-day event (date only) |
| `end.dateTime` + `end.timeZone` | `endDate` | ISO 8601 with timezone offset |
| `end.date` | `endDate` | All-day event (date only) |
| `location` | `location` | String or wrap in Place object |
| `attendees[]` | `attendee[]` | Each attendee -> Person object |
| `colorId` | `color` | Direct string |
| `reminders` | (custom) | No standard equivalent |
| `recurrence` | `eventSchedule` | RRULE strings |

---

## Implementation Notes

### Timezone Handling

Google Calendar stores timezone separately from the datetime value. Schema.org expects a single ISO 8601 string with offset.

- **Google Calendar**: `{ dateTime: "2026-03-24T10:00:00", timeZone: "America/Los_Angeles" }`
- **Schema.org Event**: `startDate: "2026-03-24T10:00:00-07:00"`

Convert using existing `resolveTimeRange()`/`createTimeObject()` from `src/utils/timezone-utils.ts`.

### RSVP Status

Google Calendar `responseStatus` values: `accepted`, `declined`, `tentative`, `needsAction`.

Use `Person` with `additionalProperty` for the RSVP value (see [SCHEMA-ORG-SERIALIZER-PLAN.md](SCHEMA-ORG-SERIALIZER-PLAN.md) for the full attendee mapping).

### Custom Extensions

Conflict detection types (`ConflictInfo`, `DuplicateInfo`) have no schema.org equivalents. Recommended approach: create custom `@type` extensions (e.g., `@type: "ConflictInfo"`) rather than overloading the Event type with non-standard properties.

---

## GS1 Web Vocabulary (Complementary)

The [GS1 Web Vocabulary](https://ref.gs1.org/voc/) extends schema.org for supply chain, product identification, and commercial transactions. GS1 classes (`owl:Thing`) can be used alongside schema.org types in JSON-LD.

### Relevant GS1 types

| GS1 Class | Complements | Relevance |
|---|---|---|
| `gs1:Offer` + `gs1:PriceSpecification` | schema.org `Order` | Structured pricing/payment in order emails |
| `gs1:Organization` | Organization label hierarchy | GLN-based sender identification |
| `gs1:Place` + `gs1:PostalAddress` | `CalendarEvent.location` | Structured address (locality, region, country) |
| `gs1:Transaction` | schema.org `Invoice` | Business transaction identifiers for billing |
| `gs1:Product` | `ParcelDelivery` metadata | GTIN-based product identification in shipping/order emails |

### GS1 types not applicable

Food/nutrition (`gs1:FoodBeverageTobaccoProduct`), textiles (`gs1:TextileMaterialDetails`), packaging (`gs1:PackagingDetails`), allergens (`gs1:AllergenDetails`), and certification (`gs1:CertificationDetails`) are supply chain-specific and out of scope for this project.

### GS1 vs schema.org coverage

| Domain | schema.org | GS1 |
|---|---|---|
| Events, Reservations, Actions | Yes | No |
| Calendar, Schedule | Yes | No |
| Email, Communication | Yes | No |
| Product identification (GTIN) | Partial | Yes |
| Structured pricing/currency | Partial | Yes |
| Organization (GLN) | Partial | Yes |
| Structured postal address | Partial | Yes |
| Supply chain, logistics | No | Yes |

---

## References

- [schema.org](https://schema.org/) -- primary vocabulary for events, email, actions
- [GS1 Web Vocabulary](https://ref.gs1.org/voc/) -- complementary supply chain/product vocabulary
- [Email Categorization](EMAIL-CATEGORIZATION.md) -- inbound email schema extraction
- [Serializer Plan](SCHEMA-ORG-SERIALIZER-PLAN.md) -- outbound JSON-LD serialization for calendar responses
- [MCP Tools](SCHEMA-ORG-MCP-TOOLS.md) -- schema-org-mcp tool invocations for type validation
- `lib/schema-extractor.mjs` -- extraction module (htmlparser2, JSON-LD parsing, category mapping)
- `src/schemas/types.ts` -- core TypeScript type definitions
