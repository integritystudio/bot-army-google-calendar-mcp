/**
 * Extracts the display name from an RFC 5322 From header.
 * e.g. "John Smith <john@example.com>" → "John Smith"
 * Falls back to the raw value if no display name is present.
 *
 * @param {string} from - Raw From header value
 * @returns {string}
 */
export function extractDisplayName(from) {
  if (!from) return '';
  return from.split('<')[0].trim() || from;
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
