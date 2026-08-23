# Email Categorization

**Status**: Draft
**Context**: Leverage schema.org and GS1 vocabulary markup embedded in emails to improve automated categorization, replacing keyword/sender heuristics with structured data extraction.

---

## Problem

Current email categorization (`create-filters.mjs`, driven by `config/categories.mjs`) relies on sender addresses, subject keywords, and Gmail label heuristics. This breaks when:
- Senders change addresses or domains
- Subject lines don't match keyword patterns
- Emails contain structured data (reservations, orders, shipments) that keywords miss
- New email types require manual rule additions

## Opportunity

Many transactional emails already contain JSON-LD schema.org markup in their HTML `<head>`. Gmail and Outlook extract this for features like "Events from Gmail" and package tracking cards. We can parse the same markup to categorize emails with high precision.

---

## Schema.org Types Relevant to Email Categorization

### Tier 1 - High Volume, Well-Supported

| Schema Type | Category Label | Signals |
|---|---|---|
| `EventReservation` | Events | Ticketed events, concerts, conferences |
| `FlightReservation` | Travel | Flight bookings with departure/arrival |
| `LodgingReservation` | Travel | Hotel bookings |
| `RentalCarReservation` | Travel | Car rental confirmations |
| `Order` | Orders/Shopping | E-commerce purchase confirmations |
| `ParcelDelivery` | Shipping | Package tracking, delivery updates |
| `Invoice` | Billing | Payment requests, invoices |

### Tier 2 - Moderate Volume

| Schema Type | Category Label | Signals |
|---|---|---|
| `RestaurantReservation` | Events | Dining reservations |
| `BusReservation` | Travel | Bus bookings |
| `TrainReservation` | Travel | Train bookings |
| `EmailMessage` + `Action` | Actionable | Emails with confirm/RSVP buttons |

### Tier 3 - Low Volume, Future Use

| Schema Type | Category Label | Signals |
|---|---|---|
| `MedicalAppointment` | Appointments | Healthcare scheduling |
| `ServiceReservation` | Services | Generic service bookings |
| `SubscriptionOffer` | Newsletters | Subscription/newsletter signup |

---

## JSON-LD Extraction Architecture

### Where Markup Lives

```html
<html>
  <head>
    <script type="application/ld+json">
    {
      "@context": "http://schema.org",
      "@type": "EventReservation",
      "reservationNumber": "E123456789",
      "reservationStatus": "http://schema.org/Confirmed",
      "reservationFor": {
        "@type": "Event",
        "name": "Austin Tech Meetup",
        "startDate": "2026-04-15T19:00:00-05:00",
        "location": {
          "@type": "Place",
          "name": "Capital Factory"
        }
      }
    }
    </script>
  </head>
  <body>...</body>
</html>
```

### Extraction Pipeline

```
Gmail API (message.get, format: full)
  → extractHtmlFromPayload() — traverse multipart parts, base64url-decode text/html
  → extractSchemaMarkupFromGmailPayload() — htmlparser2 streaming parser extracts JSON-LD
  → JSON.parse → validate @context + @type
  → categorizeBySchema() — route to category based on @type
  → apply Gmail label + optional archive
```

### Module: `lib/schema-extractor.mjs`

```javascript
// Extract schema.org JSON-LD from Gmail's base64url-decoded HTML payload
// Uses htmlparser2 streaming parser for robust HTML handling
export function extractSchemaMarkupFromGmailPayload(html) {
  // 1. Stream HTML through htmlparser2 Parser
  // 2. Capture text inside <script type="application/ld+json"> tags
  // 3. JSON.parse each block (handle arrays: [{...}, {...}])
  // 4. Filter for @context containing "schema.org"
  // 5. Return array of typed schema objects
}

// Extract HTML body from Gmail's pre-parsed multipart payload
// Gmail returns body data as base64url-encoded strings
export function extractHtmlFromPayload(payload) {
  // Recursively traverses multipart parts to find text/html
}

// Map schema @type to internal category
export function categorizeBySchema(schemaObjects) {
  // Returns { category: string, types: string[], metadata: {...} }
}
```

### Type-to-Category Mapping

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

---

## Integration with Existing Email System

### Current Flow (keyword-based)

```
list-unread-emails.mjs → categorize by sender/subject patterns → apply labels
create-filters.mjs     → batch label by Gmail search queries → create filters
```

### Enhanced Flow (schema-aware)

```
1. Fetch unread emails (existing)
2. For each email with HTML body:
   a. Extract schema.org JSON-LD (new)
   b. If schema found → high-confidence categorization
   c. If no schema → fall back to existing keyword/sender rules
3. Apply labels (existing)
4. Extract structured metadata for sub-labeling:
   - Events: startDate → future/past sub-labels
   - Travel: departureTime, arrivalTime → trip timeline
   - Orders: orderStatus → confirmed/shipped/delivered
   - Shipping: expectedArrivalFrom → delivery window
```

### Key Metadata Fields by Type

#### EventReservation
```javascript
{
  eventName: schema.reservationFor.name,
  eventDate: schema.reservationFor.startDate,
  venue: schema.reservationFor.location.name,
  city: schema.reservationFor.location.address.addressLocality,
  status: schema.reservationStatus,       // Confirmed, Cancelled
  ticketNumber: schema.reservationNumber,
}
```

#### Order
```javascript
{
  merchant: schema.seller.name,
  orderNumber: schema.orderNumber,
  orderDate: schema.orderDate,
  orderStatus: schema.orderStatus,        // Processing, Delivered
  total: schema.totalPrice,
  items: schema.orderedItem[].name,
}
```

#### ParcelDelivery
```javascript
{
  carrier: schema.deliveryAddress || schema.provider.name,
  trackingNumber: schema.trackingNumber,
  expectedDelivery: schema.expectedArrivalFrom,
  status: schema.deliveryStatus,
}
```

#### FlightReservation
```javascript
{
  airline: schema.reservationFor.provider.name,
  flightNumber: schema.reservationFor.flightNumber,
  departure: schema.reservationFor.departureTime,
  arrival: schema.reservationFor.arrivalTime,
  origin: schema.reservationFor.departureAirport.iataCode,
  destination: schema.reservationFor.arrivalAirport.iataCode,
}
```

---

## Implementation Phases

### Phase 1: Read-Only Extraction (Low Risk)

**Goal**: Parse schema.org from emails without modifying labels. Report what structured data exists.

- Build `lib/schema-extractor.mjs` (HTML parsing, JSON-LD extraction)
- Build `audit-schema-markup.mjs` to show detected schema types (originally a `--schema` flag on `list-unread-emails.mjs`)
- Output: count of emails with schema markup, type distribution, sample metadata
- No label changes — observation only

**Validates**: How many emails in the inbox actually contain schema.org markup, and which types.

### Phase 2: Schema-Aware Categorization

**Goal**: Use extracted schema types as a first-pass categorizer before keyword fallback.

- Add schema extraction to the `create-filters.mjs` pipeline
- Schema match = high confidence, skip keyword rules
- No schema = existing keyword/sender rules (unchanged)
- New sub-labels derived from schema metadata:
  - `Events/Concerts`, `Events/Conferences`, `Events/Meetups`
  - `Travel/Flights`, `Travel/Hotels`
  - `Orders/Confirmed`, `Orders/Shipped`, `Orders/Delivered`

### Phase 3: Temporal Organization

**Goal**: Use date fields from schema to auto-archive past events and surface upcoming ones.

- Parse `startDate`, `departureTime`, `expectedArrivalFrom` from schema
- Auto-archive: events/flights/reservations in the past
- Auto-star: upcoming events within 48 hours
- Integrates with `filter-events-by-date.mjs` existing logic

---

## Technical Constraints

### Gmail API Considerations
- `messages.get` with `format: full` returns HTML parts for schema extraction
- Rate limit: 250 quota units per user per second (batch requests help)
- HTML part may be nested in `multipart/alternative` → recursive part traversal needed

### Schema.org Parsing Edge Cases
- Multiple `<script type="application/ld+json">` blocks per email
- Array format: `[{...}, {...}]` (e.g., round-trip flight = 2 reservations)
- `@context` may be `"http://schema.org"` or `"https://schema.org"`
- Some senders use Microdata instead of JSON-LD (lower priority; JSON-LD covers most transactional email)
- Invalid/malformed JSON blocks must be handled gracefully

### Sender Coverage
Major senders known to include schema.org JSON-LD:
- Airlines (United, Delta, Southwest, American)
- Hotels (Marriott, Hilton, Airbnb)
- E-commerce (Amazon, eBay, Etsy, Target)
- Food delivery (DoorDash, Uber Eats)
- Ticketing (Eventbrite, Ticketmaster, StubHub)
- Travel aggregators (Booking.com, Expedia, Kayak)
- Google (Calendar invitations, Play Store orders)

---

## GS1 Web Vocabulary

The [GS1 Web Vocabulary](https://ref.gs1.org/voc/) complements schema.org with supply chain and commercial transaction types. GS1 classes use `owl:Thing` and can appear alongside schema.org types in the same JSON-LD block.

### Where GS1 adds value to email categorization

Schema.org covers the `@type` routing (EventReservation, Order, ParcelDelivery, Invoice), but the metadata extracted from those objects can be enriched with GS1-aligned fields when senders include them.

| Category | schema.org fields (current) | GS1 enrichment (future) |
|---|---|---|
| Orders | `seller.name`, `orderNumber`, `totalPrice` | `gs1:Product` (GTIN), `gs1:PriceSpecification` (currency code, payment method) |
| Shipping | `provider.name`, `trackingNumber`, `expectedArrivalFrom` | `gs1:PostalAddress` (structured delivery address: locality, region, country) |
| Billing | maps to "Billing" with no detail extracted | `gs1:Transaction` (transaction ID, type), `gs1:Discount` (discount structures) |
| Events | `eventName`, `eventDate`, `venue` | `gs1:Place` + `gs1:GeoCoordinates` (structured venue location) |

### GS1 types for sender/organization classification

The Organization label hierarchy (`lib/constants.mjs`) currently uses flat string labels. `gs1:Organization` provides GLN-based identification with `gs1:OrganizationID_Details` for government/trade body identifiers and `gs1:OrganizationStatusHistory` for active/inactive tracking. This could improve sender classification for commercial senders who embed GS1 identifiers in their markup.

### Not applicable to email categorization

GS1 food/nutrition (`gs1:FoodBeverageTobaccoProduct`, `gs1:AllergenDetails`, `gs1:NutritionMeasurementType`), textiles (`gs1:TextileMaterialDetails`), packaging (`gs1:PackagingDetails`), and certification (`gs1:CertificationDetails`) types are supply chain-specific and unlikely to appear in email JSON-LD.

---

## Related Docs

| Document | Focus |
|---|---|
| [SCHEMA_CATEGORY_MAP.md](SCHEMA_CATEGORY_MAP.md) | Type definitions, schema.org alignment, and category mapping |
| [GS1 Web Vocabulary](https://ref.gs1.org/voc/) | Complementary supply chain/product vocabulary |
| **This document** | Inbound email schema extraction and categorization |

---

## Success Metrics

- **Coverage**: % of categorized emails where schema.org markup was the signal (vs keyword fallback)
- **Accuracy**: False positive rate of schema-based categorization (expect < 1%)
- **New categories**: Email types that become categorizable only through schema (orders, shipping, travel)
- **Rule reduction**: Fewer keyword patterns needed in `config/categories.mjs` rules
