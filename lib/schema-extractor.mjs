/**
 * Schema.org JSON-LD extraction from Gmail message HTML.
 * Phase 1: Read-only extraction — no label modifications.
 *
 * Uses htmlparser2 streaming parser instead of regex for robust
 * HTML handling (nested scripts, CDATA, malformed markup).
 */
import { Parser } from 'htmlparser2';

const SCHEMA_ORG_CONTEXT = /schema\.org/i;

const SCHEMA_CATEGORY_MAP = {
  'EventReservation': 'Events',
  'Event': 'Events',
  'MusicEvent': 'Events',
  'RestaurantReservation': 'Events',
  'RsvpAction': 'Events',

  'FlightReservation': 'Travel',
  'LodgingReservation': 'Travel',
  'RentalCarReservation': 'Travel',
  'BusReservation': 'Travel',
  'TrainReservation': 'Travel',

  'Order': 'Orders',
  'ParcelDelivery': 'Shipping',

  'Invoice': 'Billing',

  'ConfirmAction': 'Actionable',
};

/**
 * Extract schema.org JSON-LD objects from Gmail's base64-decoded HTML payload.
 * Uses htmlparser2 streaming parser — handles nested scripts, CDATA,
 * and malformed markup that regex cannot reliably parse.
 *
 * @param {string} html - HTML from extractHtmlFromPayload() (Gmail base64url-decoded)
 * @returns {Array<Object>} Parsed schema.org objects with @type
 */
export function extractSchemaMarkupFromGmailPayload(html) {
  if (!html) return [];

  const results = [];
  let insideJsonLd = false;
  let jsonBuffer = '';

  const parser = new Parser({
    onopentag(name, attrs) {
      if (name === 'script' && attrs.type === 'application/ld+json') {
        insideJsonLd = true;
        jsonBuffer = '';
      }
    },
    ontext(text) {
      if (insideJsonLd) jsonBuffer += text;
    },
    onclosetag(name) {
      if (name === 'script' && insideJsonLd) {
        insideJsonLd = false;
        try {
          const parsed = JSON.parse(jsonBuffer);
          const objects = Array.isArray(parsed) ? parsed : [parsed];
          for (const obj of objects) {
            if (obj['@context'] && SCHEMA_ORG_CONTEXT.test(obj['@context'])) {
              results.push(obj);
            }
          }
        } catch {
          // Malformed JSON — skip
        }
      }
    },
  }, { decodeEntities: true });

  parser.write(html);
  parser.end();

  return results;
}

/**
 * Map schema.org objects to an internal category with metadata.
 *
 * @param {Array<Object>} schemaObjects - From extractSchemaMarkupFromGmailPayload()
 * @returns {{ category: string|null, types: string[], metadata: Object }}
 */
export function categorizeBySchema(schemaObjects) {
  if (!schemaObjects.length) {
    return { category: null, types: [], metadata: {} };
  }

  const types = schemaObjects.map(obj => obj['@type']).filter(Boolean);
  const category = types.reduce((found, type) => found || SCHEMA_CATEGORY_MAP[type], null);

  const metadata = {};
  for (const obj of schemaObjects) {
    const type = obj['@type'];
    if (type === 'EventReservation' || type === 'Event' || type === 'MusicEvent') {
      const event = obj.reservationFor || obj;
      metadata.eventName = event.name;
      metadata.eventDate = event.startDate;
      metadata.venue = event.location?.name;
    } else if (type === 'Order') {
      metadata.merchant = obj.seller?.name;
      metadata.orderNumber = obj.orderNumber;
      metadata.orderStatus = obj.orderStatus;
      metadata.total = obj.totalPrice;
    } else if (type === 'ParcelDelivery') {
      metadata.carrier = obj.provider?.name;
      metadata.trackingNumber = obj.trackingNumber;
      metadata.expectedDelivery = obj.expectedArrivalFrom;
    } else if (type?.includes('Reservation') && type !== 'EventReservation') {
      metadata.reservationNumber = obj.reservationNumber;
      metadata.status = obj.reservationStatus;
      if (obj.reservationFor) {
        metadata.provider = obj.reservationFor.provider?.name;
        metadata.departure = obj.reservationFor.departureTime;
        metadata.arrival = obj.reservationFor.arrivalTime;
      }
    }
  }

  return { category, types, metadata };
}

/**
 * Extract the HTML body from a Gmail message payload.
 * Gmail returns body data as base64url-encoded strings;
 * this traverses multipart parts recursively to find text/html.
 *
 * @param {Object} payload - message.data.payload
 * @returns {string} Base64-decoded HTML or empty string
 */
export function extractHtmlFromPayload(payload) {
  if (payload?.mimeType === 'text/html' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  if (payload?.parts) {
    for (const part of payload.parts) {
      const html = extractHtmlFromPayload(part);
      if (html) return html;
    }
  }

  return '';
}

export { SCHEMA_CATEGORY_MAP };
