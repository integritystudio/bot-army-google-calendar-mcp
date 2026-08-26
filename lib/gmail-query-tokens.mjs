/**
 * Parse sender tokens out of Gmail search queries and Gmail filter criteria, so two
 * spellings of the same sender — `from:a.com`, a grouped `from:(a.com OR b.com)`, a live
 * filter's `criteria.from` — can be compared without re-parsing each shape separately.
 *
 * Pure query parsing, no Gmail client — was defined inside audit-label-drift.mjs, a CLI
 * entrypoint, so audit-org-tag-coverage.mjs importing fromTokens from it dragged in that
 * script's own config loading and CLI parsing along with it.
 */

const normalizeToken = (raw) => raw.trim().replace(/^["'(]+|["')]+$/g, '').toLowerCase();

/**
 * Every sender token a query names. Handles both spellings the config uses:
 * `from:a.com OR from:b.com` and the grouped `from:(a.com OR b.com)` — a plain
 * /from:([^\s()]+)/ sweep silently returns nothing for the grouped form.
 */
export function fromTokens(query = '') {
  const tokens = new Set();
  const grouped = /from:\(([^)]*)\)/gi;
  for (const match of query.matchAll(grouped)) {
    for (const part of match[1].split(/\s+OR\s+/i)) {
      const token = normalizeToken(part);
      if (token) tokens.add(token);
    }
  }
  for (const match of query.replace(grouped, ' ').matchAll(/from:([^\s()]+)/gi)) {
    const token = normalizeToken(match[1]);
    if (token) tokens.add(token);
  }
  return tokens;
}

/** Sender tokens a live Gmail filter keys on; criteria carry either `from` or a raw `query`. */
export function criteriaTokens(criteria = {}) {
  const tokens = fromTokens(criteria.query ?? '');
  for (const part of (criteria.from ?? '').split(/\s+OR\s+/i)) {
    const token = normalizeToken(part);
    if (token) tokens.add(token);
  }
  return tokens;
}

const domainOf = (token) => token.split('@').pop();

/**
 * The config also matches senders by display name (`from:"AlphaSignal"`), which carries no
 * dot and so never suffix-matches a domain. Treat a bare word as naming a sender when it is
 * one of the domain's own segments, or the filter that uses that spelling looks absent.
 */
const namesDomain = (word, domain) => !word.includes('.') && domain.split('.').includes(word);

/**
 * news@alphasignal.ai, alphasignal.ai and mail.alphasignal.ai all name the same sender.
 *
 * This is bidirectional suffix matching on domainOf(token), so it is deliberately more
 * permissive than a single-domain membership test: it will treat any two tokens sharing a
 * domain as the same sender even when one names a specific address on a shared platform
 * (e.g. `marriott@express.medallia.com` vs the bare domain `express.medallia.com`). That
 * permissiveness is correct for audit-label-drift.mjs's job — deciding whether two RULES
 * overlap — but wrong for deciding whether a platform domain is fully "claimed" by one
 * address on it (audit-org-tag-coverage.mjs's isCovered() needs the narrower, one-directional
 * test for exactly that reason: express.medallia.com sends for ~20 orgs, and marking the
 * whole domain covered because one is tagged would hide the other 19). Do not replace
 * isCovered() with this.
 */
export function tokensOverlap(a, b) {
  for (const left of a) {
    for (const right of b) {
      const [x, y] = [domainOf(left), domainOf(right)];
      if (x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`)) return true;
      if (namesDomain(x, y) || namesDomain(y, x)) return true;
    }
  }
  return false;
}
