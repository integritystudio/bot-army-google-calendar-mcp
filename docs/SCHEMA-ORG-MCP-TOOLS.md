# Schema.org MCP Tool Invocations
## Complete Reference for Aligning Google Calendar MCP Types

**Location**: schema-org-mcp server at `/Users/alyshialedlie/code/is-internal/schema-org-mcp`

This guide provides the exact MCP tool calls needed to retrieve and validate schema.org type definitions for the Google Calendar MCP codebase.

---

## Quick Start: Run All Tools

The following commands retrieve complete schema.org definitions for the main codebase types:

### Core Schema Tools (5 tools)

#### 1️⃣  `get_schema_type` - Retrieve "Event" type definition

**Purpose**: Get complete Event type with all properties, inheritance, and documentation

```json
{
  "name": "get_schema_type",
  "arguments": {
    "typeName": "Event"
  }
}
```

**Expected Output Structure**:
- `@id`: https://schema.org/Event
- `@type`: rdfs:Class
- `rdfs:label`: "Event"
- `rdfs:comment`: Full documentation
- `rdfs:subClassOf`: Parent types (Thing → CreativeWork → Event)
- `properties[]`: Array of all Event properties (name, startDate, endDate, location, attendee, organizer, etc.)

**Why**: Event is the primary mapping target for CalendarEvent interface

---

#### 2️⃣  `search_schemas` - Find calendar-related types

**Purpose**: Discover all schema.org types related to calendars and scheduling

```json
{
  "name": "search_schemas",
  "arguments": {
    "query": "calendar",
    "limit": 10
  }
}
```

**Expected Results**:
- Calendar (type for calendar collections)
- CalendarSlot (if available)
- Schedule (time availability)
- EventSeries (recurring events)

---

#### 3️⃣  `get_type_hierarchy` - Explore Event inheritance chain

**Purpose**: Understand Event's parent and child types

```json
{
  "name": "get_type_hierarchy",
  "arguments": {
    "typeName": "Event"
  }
}
```

**Expected Output**:
```json
{
  "type": "Event",
  "supertypes": ["CreativeWork", "Thing"],
  "subtypes": ["DanceEvent", "DeliveryEvent", "EducationEvent", "EventSeries", "ExhibitionEvent", "Festival", "MusicEvent", "PublicationEvent", "SaleEvent", "ScreeningEvent", "SocialEvent", "SportsEvent", "TheaterEvent", "VisualArtsEvent"],
  "properties": ["about", "actor", "aggregateRating", "alternateName", "attendee", "audience", ...]
}
```

**Why**: Understand what types can be used to specialize Event for specific calendar scenarios

---

#### 4️⃣  `get_type_properties` - List all Event properties with inheritance

**Purpose**: Get detailed property list for Event type including inherited properties

```json
{
  "name": "get_type_properties",
  "arguments": {
    "typeName": "Event",
    "includeInherited": true
  }
}
```

**Expected Output** (sample):
```json
[
  {
    "name": "name",
    "description": "The name of the item.",
    "types": ["Text"],
    "required": false
  },
  {
    "name": "startDate",
    "description": "The start date and time of the item (in ISO 8601 date format).",
    "types": ["DateTime", "Date"],
    "required": false
  },
  {
    "name": "endDate",
    "description": "The end date and time of the item (in ISO 8601 date format).",
    "types": ["DateTime", "Date"],
    "required": false
  },
  {
    "name": "location",
    "description": "The location of the event, organization or action.",
    "types": ["Place", "Text"],
    "required": false
  },
  {
    "name": "attendee",
    "description": "A person or organization attending the event.",
    "types": ["Person", "Organization"],
    "required": false
  },
  {
    "name": "organizer",
    "description": "An organizer of an event.",
    "types": ["Person", "Organization"],
    "required": false
  }
]
```

**Why**: Map each CalendarEvent field to corresponding Event property

---

#### 5️⃣  `generate_example` - Create sample JSON-LD for Event

**Purpose**: Generate valid JSON-LD example for use in documentation

```json
{
  "name": "generate_example",
  "arguments": {
    "typeName": "Event",
    "properties": {
      "name": "Team Standup",
      "startDate": "2026-03-24T10:00:00",
      "endDate": "2026-03-24T10:30:00",
      "location": "Conference Room A"
    }
  }
}
```

**Expected Output**:
```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Team Standup",
  "startDate": "2026-03-24T10:00:00",
  "endDate": "2026-03-24T10:30:00",
  "location": "Conference Room A",
  "organizer": {
    "@type": "Person",
    "name": "Sample Organizer"
  }
}
```

**Why**: Use in API documentation and response examples

---

### Metadata Tools (3 tools)

#### 6️⃣  `get_server_metadata` - Retrieve server metadata as SoftwareApplication

**Purpose**: Get structured metadata about the schema-org-mcp server itself

```json
{
  "name": "get_server_metadata",
  "arguments": {
    "metadataType": "softwareApplication"
  }
}
```

**Expected Output**:
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "schema-org-mcp",
  "version": "0.1.0",
  "description": "MCP server for schema.org vocabulary integration",
  "applicationCategory": "DeveloperApplication",
  "programmingLanguage": "TypeScript",
  "runtimePlatform": "Node.js",
  "license": "MIT",
  "codeRepository": "https://github.com/aledlie/schema-org-mcp",
  "potentialAction": [
    {
      "@type": "SearchAction",
      "name": "search_schemas",
      "description": "Search for schema.org types by keyword"
    },
    {
      "@type": "CreateAction",
      "name": "generate_example",
      "description": "Generate JSON-LD examples"
    }
  ]
}
```

---

#### 7️⃣  `generate_search_action` - Create SearchAction example

**Purpose**: Generate SearchAction example for Gmail/email search operations

```json
{
  "name": "generate_search_action",
  "arguments": {
    "query": "email search",
    "results": ["EmailMessage", "Message"]
  }
}
```

**Expected Output**:
```json
{
  "@context": "https://schema.org",
  "@type": "SearchAction",
  "query": "email search",
  "target": {
    "@type": "EntryPoint",
    "name": "Gmail Search",
    "actionPlatform": ["MCP"]
  },
  "agent": {
    "@type": "SoftwareApplication",
    "name": "schema-org-mcp"
  },
  "result": {
    "@type": "SearchResultsPage",
    "mainEntity": [
      {
        "@type": "EmailMessage",
        "name": "Message"
      }
    ]
  }
}
```

**Why**: Document Gmail search operations in schema.org format

---

#### 8️⃣  `generate_create_action` - Create CreateAction example

**Purpose**: Generate CreateAction example for event creation

```json
{
  "name": "generate_create_action",
  "arguments": {
    "typeName": "Event",
    "result": {
      "@type": "Event",
      "name": "Sample Event",
      "startDate": "2026-03-24T10:00:00"
    }
  }
}
```

**Expected Output**:
```json
{
  "@context": "https://schema.org",
  "@type": "CreateAction",
  "object": {
    "@type": "Thing",
    "name": "Event",
    "description": "Schema.org Event type"
  },
  "result": {
    "@type": "CreativeWork",
    "name": "Event JSON-LD Example",
    "description": "Generated JSON-LD example for Event creation",
    "text": "{...}",
    "encodingFormat": "application/ld+json"
  },
  "instrument": {
    "@type": "SoftwareApplication",
    "name": "schema-org-mcp"
  },
  "actionStatus": "CompletedActionStatus"
}
```

---

### Performance Tools (5 tools - Optional)

These tools measure SEO and LLM impact of schema.org implementation. Run after implementing schema alignment.

#### 9️⃣  `analyze_schema_impact` - Measure overall schema.org benefit

**Purpose**: Analyze SEO, LLM, and performance impact of schema.org markup

```json
{
  "name": "analyze_schema_impact",
  "arguments": {
    "url": "https://your-deployed-api-endpoint/docs",
    "options": {
      "analyzeStructuredData": true,
      "measureSEOImpact": true,
      "analyzeLLMUsability": true
    }
  }
}
```

**Expected Output** (sample):
```json
{
  "@context": "https://schema.org",
  "@type": "SchemaImpactAnalysis",
  "seoImpact": {
    "@type": "SEOImpact",
    "structuredDataScore": 85,
    "richSnippetPotential": 90
  },
  "llmImpact": {
    "@type": "LLMImpact",
    "contentUnderstandability": 88,
    "entityRecognition": 92
  },
  "overallScore": 87,
  "grade": "A-"
}
```

---

## Additional Type Searches

Beyond the core 8 tools above, use `search_schemas` and `get_schema_type` for these additional types:

### Attendee Types

```json
{
  "name": "get_schema_type",
  "arguments": {
    "typeName": "Person"
  }
}
```

```json
{
  "name": "get_schema_type",
  "arguments": {
    "typeName": "Reservation"
  }
}
```

### Email/Gmail Types

```json
{
  "name": "search_schemas",
  "arguments": {
    "query": "email message",
    "limit": 5
  }
}
```

```json
{
  "name": "get_schema_type",
  "arguments": {
    "typeName": "EmailMessage"
  }
}
```

### Scheduling Types

```json
{
  "name": "get_schema_type",
  "arguments": {
    "typeName": "Schedule"
  }
}
```

```json
{
  "name": "get_schema_type",
  "arguments": {
    "typeName": "OpeningHoursSpecification"
  }
}
```

---

## Implementation Checklist

- [ ] Run Core Schema Tools (1-5) to retrieve type definitions
- [ ] Run Metadata Tools (6-8) to document server capabilities
- [ ] Review SCHEMA-ORG-ALIGNMENT.md mapping table
- [ ] Run Performance Tools (9+) to measure impact
- [ ] Map CalendarEvent fields to Event properties
- [ ] Update API documentation with JSON-LD examples
- [ ] Validate examples using https://schema.org/docs/jsonldcontext.jsonld
- [ ] Test with https://validator.schema.org/

---

## Output Format

All tool responses follow this structure:

```typescript
{
  content: [
    {
      type: "text",
      text: "<JSON stringified result>"
    }
  ]
}
```

Parse the JSON from `response.content[0].text` to access the result.

---

## Error Handling

| Error | Meaning | Solution |
|---|---|---|
| `InvalidRequest` | Missing/wrong parameter | Check argument types |
| `InternalError` | Schema.org fetch failed | Check internet connection |
| `NotFound` | Type doesn't exist | Try `search_schemas` first |
| `TimeoutError` | Operation too slow | Retry or reduce scope |

---

## Related Resources

- **Schema.org Website**: https://schema.org/
- **Schema.org Event**: https://schema.org/Event
- **Schema.org Person**: https://schema.org/Person
- **JSON-LD Specification**: https://json-ld.org/
- **Structured Data Validator**: https://validator.schema.org/

---

**Document Version**: 1.0
**Date**: 2026-03-24
