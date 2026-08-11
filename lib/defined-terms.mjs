/**
 * Builders and a validator for schema.org DefinedTerm / DefinedTermSet vocabularies.
 *
 * A Gmail label is a flat string, so anything about an organization beyond its type has
 * nowhere to live in the label path. Controlled vocabularies carry that surplus meaning:
 * a tag group's `schema.keywords` or `schema.knowsAbout` points at a DefinedTerm instead
 * of inventing a non-schema path segment like `.../Tantra` or `.../DigitalNomads`.
 *
 * Two invariants these helpers enforce, both learned the hard way:
 *
 * - **Terms point at the set, never the reverse.** The inverse `hasDefinedTerm` is
 *   development-version only, and a set pointing back at its terms is a cycle that
 *   `JSON.stringify` cannot serialize — which is how every consumer here reads them.
 * - **A term's `@id` must differ from any organization's `@id`.** Reusing one URL for
 *   both collapses term and org into a single JSON-LD node, so a `knowsAbout` meant for
 *   the dance ends up pointing at the council that governs it.
 *
 * See docs/DEFINED-TERMS-GUIDE.md.
 */

const TYPE_DEFINED_TERM_SET = 'DefinedTermSet';
const TYPE_DEFINED_TERM = 'DefinedTerm';

/** Drops undefined values so serialized vocabularies carry no empty keys. */
const compact = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/**
 * @param {{ id?: string, name: string, description?: string }} spec
 *   `id` is optional: a set with no public URL is still valid, and its terms remain
 *   identifiable by `termCode`. Prefer a fragment on the community's own page
 *   (`https://motleyhue.org/about/#what-is-fusion`) over a URL that will never resolve.
 */
export function defineTermSet({ id, name, description }) {
  return compact({
    '@type': TYPE_DEFINED_TERM_SET,
    '@id': id,
    name,
    description,
  });
}

/**
 * @param {object} termSet - the set returned by defineTermSet, linked via inDefinedTermSet
 * @param {{ id?: string, name: string, alternateName?: string, description?: string,
 *           termCode?: string, sameAs?: string }} spec
 *   Give a term an `@id` when it has its own stable page (a Wikipedia article), and a
 *   `termCode` when it does not — inventing a fragment URL that 404s is worse than a
 *   code scoped to the set. `termCode` exists precisely for that case.
 */
export function defineTerm(termSet, { id, name, alternateName, description, termCode, sameAs }) {
  return compact({
    '@type': TYPE_DEFINED_TERM,
    '@id': id,
    name,
    alternateName,
    description,
    termCode,
    inDefinedTermSet: termSet,
    sameAs,
  });
}

/** defineTerm over a list, for terms that share a set. */
export function defineTerms(termSet, specs) {
  return specs.map((spec) => defineTerm(termSet, spec));
}

/** `substyle:zouk-flow` — a term code is only unique within its set, so it carries a kind. */
export const termCodeFor = (kind, name) => `${kind}:${name.toLowerCase().replace(/\s+/g, '-')}`;

/**
 * Terms with no article of their own: identified by `termCode`, never by a made-up `@id`.
 * `kind` groups them within the set ('step', 'substyle'), which is what keeps two
 * same-named terms from different kinds apart.
 */
export function defineCodedTerms(termSet, kind, specs) {
  return specs.map(({ name, description }) => defineTerm(termSet, {
    name,
    description,
    termCode: termCodeFor(kind, name),
  }));
}

/**
 * Structural problems only — this cannot tell you whether a definition is accurate, or
 * whether a term belongs in the set it claims. Returns a list of human-readable strings;
 * empty means the vocabulary is well-formed.
 */
export function validateVocabulary(termSet, terms) {
  const issues = [];
  const add = (issue) => issues.push(issue);

  if (!termSet?.name) add('set: missing name');
  if (termSet?.['@type'] !== TYPE_DEFINED_TERM_SET) add(`set: @type is ${termSet?.['@type']}, expected ${TYPE_DEFINED_TERM_SET}`);
  if (termSet?.hasDefinedTerm) add('set: carries hasDefinedTerm, which makes the graph cyclic and unserializable');

  const seen = { name: new Map(), id: new Map(), termCode: new Map() };
  for (const term of terms) {
    const label = term?.name ?? '(unnamed)';
    if (term?.['@type'] !== TYPE_DEFINED_TERM) add(`${label}: @type is ${term?.['@type']}, expected ${TYPE_DEFINED_TERM}`);
    if (!term?.name) add('a term has no name');
    if (term?.inDefinedTermSet !== termSet) add(`${label}: inDefinedTermSet does not point at this set`);
    if (!term?.['@id'] && !term?.termCode) add(`${label}: has neither @id nor termCode, so nothing identifies it`);
    if (term?.['@id'] && termSet?.['@id'] && term['@id'] === termSet['@id']) add(`${label}: @id collides with the set's @id`);
    if (!term?.description) add(`${label}: no description`);

    for (const key of ['name', 'id', 'termCode']) {
      const value = key === 'id' ? term?.['@id'] : term?.[key];
      if (!value) continue;
      if (seen[key].has(value)) add(`${label}: duplicate ${key} "${value}"`);
      seen[key].set(value, label);
    }
  }

  try {
    JSON.stringify({ termSet, terms });
  } catch {
    add('vocabulary is not serializable — check for a circular reference');
  }

  return issues;
}
