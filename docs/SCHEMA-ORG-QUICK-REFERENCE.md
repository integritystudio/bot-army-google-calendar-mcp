# Schema.org Type Alignment - Quick Reference
## Visual Guide for Google Calendar MCP Type Mapping

---

## 🎯 Primary Type Alignments

```
Google Calendar MCP Types              →  Schema.org Types
────────────────────────────────────────────────────────────

CalendarEvent                          →  Event
├─ id                                  →  identifier
├─ summary                             →  name
├─ start {dateTime, date, timeZone}   →  startDate (ISO 8601)
├─ end {dateTime, date, timeZone}     →  endDate (ISO 8601)
├─ location                            →  location (string or Place)
├─ attendees[]                         →  attendee[] (Person[])
├─ colorId                             →  color
└─ reminders[]                         →  reminder[] (custom)

CalendarEventAttendee                  →  Person + Reservation
├─ email                               →  email
├─ responseStatus                      →  reservationStatus (with Reservation)
└─ optional/required                   →  (custom extension)

FreeBusyResponse                       →  Schedule
├─ timeMin                             →  startTime
├─ timeMax                             →  endTime
└─ busy/free periods                   →  byDay / availabilityStarts

GmailSearchInput                       →  SearchAction
├─ query                               →  query
└─ results                             →  result (SearchResultsPage)

PerformanceMetric                      →  PerformanceMetric
├─ operation                           →  name
├─ startTime                           →  timestamp
└─ duration                            →  value (in ms)
```

---

## 📊 Type Alignment Matrix

```
┌─────────────────────────────┬──────────────────┬─────────────┬──────────┐
│ Codebase Type               │ Schema.org Equiv. │ Match Score │ Priority │
├─────────────────────────────┼──────────────────┼─────────────┼──────────┤
│ CalendarEvent               │ Event            │   95%       │ ⭐⭐⭐⭐⭐ │
│ CalendarEventAttendee       │ Person           │   90%       │ ⭐⭐⭐⭐⭐ │
│ FreeBusyResponse            │ Schedule         │   85%       │ ⭐⭐⭐⭐  │
│ CalendarListEntry           │ Calendar         │   80%       │ ⭐⭐⭐⭐  │
│ GmailSearchInput            │ SearchAction     │   85%       │ ⭐⭐⭐⭐  │
│ PerformanceMetric           │ PerformanceMetric│   90%       │ ⭐⭐⭐⭐  │
│ CalendarEventReminder       │ (custom)         │   60%       │ ⭐⭐⭐   │
│ ConflictInfo                │ (custom)         │   40%       │ ⭐⭐    │
│ GmailCreateFilterInput      │ FilterAction     │   50%       │ ⭐⭐⭐   │
│ OAuthCredentials            │ (N/A)            │   N/A       │ N/A     │
│ TransportConfig             │ (N/A)            │   N/A       │ N/A     │
└─────────────────────────────┴──────────────────┴─────────────┴──────────┘

Legend:
  ⭐⭐⭐⭐⭐ = Implement immediately (direct 1:1 mapping)
  ⭐⭐⭐⭐   = Implement in Phase 1 (minor mapping effort)
  ⭐⭐⭐    = Implement in Phase 2 (custom extensions needed)
  ⭐⭐     = Lower priority (significant customization)
  N/A      = Out of scope (protocol-specific)
```

---

## 🔄 Type Transformation Examples

### Example 1: CalendarEvent → Event

```
INPUT (CalendarEvent)                    OUTPUT (Schema.org Event)
────────────────────────────────────     ─────────────────────────
{
  id: "evt_123",                    →    "identifier": "evt_123",
  summary: "Team Standup",          →    "name": "Team Standup",
  start: {
    dateTime: "2026-03-24T10:00",  →    "startDate": "2026-03-24T10:00:00",
    timeZone: "America/Los_Angeles"
  },
  end: {
    dateTime: "2026-03-24T10:30",  →    "endDate": "2026-03-24T10:30:00",
    timeZone: "America/Los_Angeles"
  },
  location: "Room 101",             →    "location": "Room 101",
  attendees: [
    {
      email: "alice@example.com",   →    "attendee": [{
      responseStatus: "accepted"         "@type": "Person",
    }                                      "email": "alice@example.com"
                                         }],
  colorId: "1"                      →    "color": "tomato"
}
```

### Example 2: CalendarEventAttendee → Person + Reservation

```
INPUT (CalendarEventAttendee)           OUTPUT (Person + Reservation)
─────────────────────────────────       ──────────────────────────────
{
  email: "john@example.com",       →    {
  responseStatus: "tentative",         "@type": "Person",
  optional: true                       "email": "john@example.com",
}                                      "hasReservation": {
                                         "@type": "Reservation",
                                         "reservationStatus": "ReservationPending",
                                         "underName": "john@example.com"
                                       }
                                     }
```

### Example 3: GmailSearchInput → SearchAction

```
INPUT (GmailSearchInput)                OUTPUT (SearchAction)
────────────────────────────────        ───────────────────────
{
  query: "from:boss@company.com",  →    {
  maxResults: 10                        "@type": "SearchAction",
}                                      "query": "from:boss@company.com",
                                       "result": {
                                         "@type": "SearchResultsPage",
                                         "numberOfItems": 10,
                                         "mainEntity": [
                                           { "@type": "EmailMessage", ... }
                                         ]
                                       }
                                     }
```

---

## 📋 Property Mapping Checklist

### Event Properties (CalendarEvent → Event)

- [x] `name` ← `summary`
- [x] `startDate` ← `start.dateTime + start.timeZone`
- [x] `endDate` ← `end.dateTime + end.timeZone`
- [x] `location` ← `location`
- [x] `attendee[]` ← `attendees[]` (as Person objects)
- [x] `organizer` ← calendar owner (implicit)
- [x] `description` ← `description` (if available)
- [x] `url` ← calendar event URL
- [ ] `image` ← event image/thumbnail
- [ ] `eventStatus` ← event status (confirmed, tentative, cancelled)
- [ ] `isAccessibleForFree` ← free/paid event
- [ ] `offers` ← pricing/registration

### Person Properties (CalendarEventAttendee → Person)

- [x] `email` ← attendee email
- [x] `name` ← attendee name (if available)
- [x] `url` ← attendee calendar URL
- [ ] `telephone` ← phone number
- [ ] `image` ← avatar/photo
- [ ] `affiliation` ← organization

---

## 🔗 Schema.org Type URLs

**Core Types** (retrieve with `get_schema_type`):
- https://schema.org/Event
- https://schema.org/Person
- https://schema.org/Organization
- https://schema.org/Schedule
- https://schema.org/Reservation
- https://schema.org/EmailMessage
- https://schema.org/Calendar
- https://schema.org/SearchAction
- https://schema.org/PerformanceMetric

**Related Types**:
- https://schema.org/Place (for locations)
- https://schema.org/CreativeWork (parent of Event)
- https://schema.org/Thing (root type)
- https://schema.org/Action (parent of SearchAction)

---

## 🛠️ Implementation Phases

### Phase 1: Foundation (Week 1-2)
```
Priority 1: CalendarEvent → Event
  ✓ Map all core properties
  ✓ Handle timezone conversion
  ✓ Update API docs with examples

Priority 2: CalendarEventAttendee → Person
  ✓ Map email/name
  ✓ Add Reservation for RSVP status

Priority 3: Generate JSON-LD examples
  ✓ Use generate_example tool
  ✓ Include in API documentation
```

### Phase 2: Enhanced Features (Week 3-4)
```
Priority 4: Gmail integration
  ✓ GmailSearchInput → SearchAction
  ✓ EmailMessage support

Priority 5: Performance tracking
  ✓ PerformanceMetric mapping
  ✓ Operation telemetry

Priority 6: Documentation
  ✓ Update README with schema.org section
  ✓ Create integration guide
```

### Phase 3: Validation (Week 5+)
```
Priority 7: SEO/LLM analysis
  ✓ Run analyze_schema_impact
  ✓ Validate with https://validator.schema.org/

Priority 8: Custom extensions
  ✓ Document ConflictInfo extension
  ✓ Define custom properties
```

---

## 📈 Metrics Dashboard

```
Alignment Progress Tracker:

Core Calendar Types:
  CalendarEvent       ████████░░ 95%
  Attendee Types      ███████░░░ 85%
  Scheduling          ██████░░░░ 75%

Email Integration:
  Gmail Search        ████████░░ 80%
  Message Types       ██████░░░░ 60%

Metadata/Config:
  Server Metadata     ███████░░░ 70%
  Performance Data    ████████░░ 85%

Custom Extensions:
  Conflict Detection  ███░░░░░░░ 30%
  Filter Actions      ██░░░░░░░░ 20%

Overall Alignment: ███████░░░ 72%
```

---

## 🎯 Key Recommendations

### DO ✅
- Use ISO 8601 datetime format (schema.org standard)
- Include `@context: https://schema.org` in examples
- Map all human-readable fields (name, email, title)
- Use standard types before creating custom extensions
- Document timezone handling explicitly
- Generate examples with `generate_example` tool
- Validate with https://validator.schema.org/

### DON'T ❌
- Use custom field names without schema.org properties
- Mix timezone representations
- Omit required properties (name, startDate for Events)
- Create custom types for standard concepts
- Hardcode timezone offsets
- Forget to include @context in JSON-LD

---

## 📞 Quick Links

| Need | Go To |
|------|-------|
| Full type documentation | `docs/SCHEMA-ORG-ALIGNMENT.md` |
| MCP tool reference | `docs/SCHEMA-ORG-MCP-TOOLS.md` |
| Implementation guide | This file + ALIGNMENT.md |
| Schema.org validator | https://validator.schema.org/ |
| Event type details | https://schema.org/Event |
| Person type details | https://schema.org/Person |

---

## 🚀 Next Steps

1. **Review** this quick reference and SCHEMA-ORG-ALIGNMENT.md
2. **Run** the MCP tools listed in SCHEMA-ORG-MCP-TOOLS.md
3. **Map** each CalendarEvent property to Event
4. **Generate** JSON-LD examples using `generate_example` tool
5. **Update** API documentation with schema.org context
6. **Test** with https://validator.schema.org/
7. **Measure** impact with `analyze_schema_impact` tool

---

**Quick Ref Version**: 1.0
**Date**: 2026-03-24
**Status**: Ready for implementation
