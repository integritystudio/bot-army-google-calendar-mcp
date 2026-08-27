/**
 * Extracts a named header value from a Gmail message headers array.
 * Returns the fallback string if the header is not found.
 *
 * @param {Array<{name: string, value: string}>} headers - Message headers array
 * @param {string} name - Header name (e.g. 'Subject', 'From', 'Date')
 * @param {string} [fallback=''] - Value to return when header is absent
 * @returns {string}
 */
export function getHeader(headers, name, fallback = '') {
  return headers.find(h => h.name === name)?.value ?? fallback;
}

/**
 * Extracts the display name from an RFC 5322 From header, with surrounding quotes
 * removed. e.g. '"John Smith" <john@example.com>' -> 'John Smith'.
 *
 * Returns '' when the header carries no display name, rather than falling back to
 * the address: callers that group senders by name must be able to tell "this sender
 * has no name" from "this sender is named john@example.com". For display, write
 * `extractDisplayName(from) || extractEmailAddress(from)`.
 *
 * @param {string} from - Raw From header value
 * @returns {string}
 */
export function extractDisplayName(from) {
  return (from?.match(/^\s*"?([^"<]*?)"?\s*</)?.[1] ?? '').trim();
}

/**
 * Extracts the email address from an RFC 5322 From header.
 * e.g. "John Smith <john@example.com>" → "john@example.com"
 * Falls back to the raw value if no angle-bracket address is present.
 *
 * @param {string} from - Raw From header value
 * @returns {string}
 */
export function extractEmailAddress(from) {
  if (!from) return '';
  const match = from.match(/<(.+?)>/);
  return match ? match[1].trim() : from.trim();
}

/**
 * Extracts the lowercased local part of a From header's address.
 * e.g. "Austin Westie <austinwestieacademy@gmail.com>" -> "austinwestieacademy"
 *
 * @param {string} from - Raw From header value
 * @returns {string}
 */
export function extractLocalPart(from) {
  return (from?.match(/([^<\s@]+)@/)?.[1] ?? '').toLowerCase();
}

/**
 * Extracts the lowercased sender domain from a From header.
 * e.g. "Redfin <listings@Redfin.com>" -> "redfin.com"
 *
 * Lowercased because domains are case-insensitive but the configs that map domains
 * to labels are written in lower case — an unnormalized compare silently misses.
 * The character class stops at '>' and at the ',' / ';' of a multi-address header.
 *
 * @param {string} from - Raw From header value
 * @returns {string}
 */
export function extractDomain(from) {
  return (from?.match(/@([A-Za-z0-9.-]+)/)?.[1] ?? '').toLowerCase().replace(/[.-]+$/, '');
}

/**
 * Local parts that identify nothing. A bare `from:noreply` reaches 58k messages and
 * `from:emails` 3.4k, so these must never stand in for a domain — only a distinctive,
 * org-specific local part (austinwestieacademy@) can.
 */
export const GENERIC_LOCAL_PARTS = new Set([
  'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'info', 'hello', 'emails', 'email',
  'support', 'notifications', 'notification', 'mail', 'newsletter', 'newsletters', 'admin',
  'contact', 'team', 'marketing', 'offers', 'news', 'updates', 'reply', 'service', 'help',
  'sales', 'billing', 'account', 'accounts', 'alerts', 'members', 'membership', 'shop', 'cs',
]);

/**
 * Do these display names all belong to one organization?
 * "Axios Austin" and "Axios Partners" are one org; Airbnb / CVS / Marriott are three.
 *
 * @param {string[]} names - Display names seen on a single sender domain
 * @returns {boolean}
 */
export const shareLeadingToken = (names) => {
  const first = names.map((n) => n.toLowerCase().split(/[\s|,–-]+/)[0]).filter(Boolean);
  return first.length > 0 && first.every((t) => t === first[0]);
};

/**
 * Whether one sender domain's display names look like a sending platform's rather than
 * one organization's — several distinct names with nothing in common.
 *
 * Two callers had this expression inline and identical, which mattered because it is a
 * judgement, not a fact: getting it wrong files a whole ESP's mail under the ESP's name
 * (express.medallia.com carries Airbnb, CVS and 18 more), and the two audits that report
 * [PLATFORM] have to agree or one contradicts the other on the same domain.
 *
 * One name is one org. Several that share a leading token are one org's variations
 * ("Marriott Bonvoy" / "Marriott Rewards"), which is what shareLeadingToken tests for.
 *
 * @param {string[]} names - Display names seen on a single sender domain
 * @returns {boolean}
 */
export const looksLikePlatform = (names) => names.length > 1 && !shareLeadingToken(names);

/**
 * @param {string} data - Base64url-encoded string from Gmail API
 * @returns {string} UTF-8 decoded content
 */
export function decodeBase64Payload(data) {
  return Buffer.from(data, 'base64').toString('utf-8');
}

/**
 * Collapses runs of whitespace to a single space and trims the ends — e.g. so a
 * header or subject with embedded newlines stays one row in a TSV.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeWhitespace(value) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Groups From headers by local part, tracking how many times each distinct display
 * name is seen under it. extract-platform-orgs.mjs and audit-sender-signals.mjs each
 * built this map with an identical loop; only what they do with the names afterward
 * differs (one ranks them by frequency, the other just needs the distinct set).
 *
 * @param {Array<{from: string}>} headers
 * @returns {Map<string, {count: number, names: Map<string, number>}>}
 */
export function groupByLocalPart(headers) {
  const byLocalPart = new Map();
  for (const { from } of headers) {
    const lp = extractLocalPart(from);
    if (!lp) continue;
    const entry = byLocalPart.get(lp) ?? { count: 0, names: new Map() };
    entry.count++;
    const dn = extractDisplayName(from);
    if (dn) entry.names.set(dn, (entry.names.get(dn) ?? 0) + 1);
    byLocalPart.set(lp, entry);
  }
  return byLocalPart;
}
