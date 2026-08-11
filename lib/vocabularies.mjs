/**
 * The controlled vocabularies referenced by ORG_TAGS in create-org-tags.mjs.
 *
 * Data only — the shape rules and their rationale live in ./defined-terms.mjs, and the
 * procedure for adding a vocabulary in docs/DEFINED-TERMS-GUIDE.md. Each vocabulary is
 * exported alongside a `*_TERMS` array holding every term in it, which is what
 * `validateVocabulary` checks and what a reader should extend when adding a term.
 */
import { defineTermSet, defineTerm, defineTerms, defineCodedTerms, termCodeFor } from './defined-terms.mjs';

/**
 * WHO an organization serves. The mailbox's own segmentation rather than a public
 * vocabulary, so the set has no `@id` — there is no page defining it.
 *
 * Kept separate from the subject set below: an audience term answers "who is this for",
 * a subject term "what is this about", and one set holding both means neither name is
 * true of all its members.
 */
export const AUDIENCE_TERM_SET = defineTermSet({
  name: 'Mailbox Audience Terms',
  description: 'Audience segments an organization serves, for use in Organization.keywords.',
});

export const TERM_DIGITAL_NOMADS = defineTerm(AUDIENCE_TERM_SET, {
  id: 'https://en.wikipedia.org/wiki/Digital_nomad',
  name: 'Digital Nomads',
  alternateName: 'Location-Independent Professionals',
  description: 'People who travel freely while working remotely using information and '
    + 'communications technology, working from co-working spaces and temporary housing '
    + '(Wikipedia). As a mailbox term it marks organizations whose offer is built around '
    + 'that pattern — co-living and co-working operators, work-travel programmes, and the '
    + 'insurance, community and job services sold to the same audience — regardless of '
    + 'the schema.org type the organization itself takes.',
  sameAs: 'https://en.wikipedia.org/wiki/Digital_nomad',
});

/**
 * The superset, kept distinct because the mailbox has senders in the gap: FlexJobs and
 * VirtualVocations sell to people who work outside an office, with no travel element at
 * all. Wikipedia makes the same distinction — a digital nomad is a remote worker who also
 * lives nomadically — and schema.org has no broader/narrower property on DefinedTerm, so
 * the relationship lives here in the description.
 */
export const TERM_REMOTE_WORKERS = defineTerm(AUDIENCE_TERM_SET, {
  id: 'https://en.wikipedia.org/wiki/Remote_work',
  name: 'Remote Workers',
  description: 'People who work at or from home or another space rather than from an '
    + 'office or workplace (Wikipedia). Broader than Digital Nomads: it carries no '
    + 'implication of travel, so it fits remote-job boards and distributed-team tooling '
    + 'that a location-independence term would overclaim.',
  sameAs: 'https://en.wikipedia.org/wiki/Remote_work',
});

export const AUDIENCE_TERMS = [TERM_DIGITAL_NOMADS, TERM_REMOTE_WORKERS];

/** WHAT an organization is about, where schema.org has no type for the subject. */
export const SUBJECT_TERM_SET = defineTermSet({
  name: 'Mailbox Subject Terms',
  description: 'Practice and subject areas an organization works in, for use in '
    + 'Organization.keywords.',
});

export const TERM_ALTERNATIVE_PRACTICE = defineTerm(SUBJECT_TERM_SET, {
  name: 'Metaphysical / Esoteric / Alternative Practice',
  description: 'Tantra, human design, energy work and adjacent non-clinical practices.',
  termCode: termCodeFor('subject', 'alternative-practice'),
});

/**
 * The two terms that survived an audit of the 76-entry nomadico.io glossary (2026-08):
 * the only ones that are Wikipedia-defined rather than vendor coinage AND name what an
 * organization *offers*, rather than an amenity, a job title or a lifestyle state.
 * A digital-nomad org's audience is TERM_DIGITAL_NOMADS; these say what it actually sells.
 */
export const TERM_COLIVING = defineTerm(SUBJECT_TERM_SET, {
  id: 'https://en.wikipedia.org/wiki/Co-living',
  name: 'Coliving',
  alternateName: 'Co-living',
  description: 'A residential community model in which multiple unrelated people share '
    + 'living space and common facilities, typically managed by a single operator '
    + '(Wikipedia) — private bedrooms alongside communal kitchens and lounges. Distinct '
    + 'from cohousing, which it borrows from: a coliving operator runs the home.',
  sameAs: 'https://en.wikipedia.org/wiki/Co-living',
});

export const TERM_COWORKING = defineTerm(SUBJECT_TERM_SET, {
  id: 'https://en.wikipedia.org/wiki/Coworking',
  name: 'Coworking',
  description: 'An arrangement in which workers for different companies share an office '
    + 'space (Wikipedia), sharing infrastructure and, for remote workers, avoiding '
    + 'isolation. Covers the practice and the spaces sold on it; day passes, hot desks '
    + 'and dedicated desks are pricing tiers of this, not separate subjects.',
  sameAs: 'https://en.wikipedia.org/wiki/Coworking',
});

/**
 * The neighbouring term the nomadico.io glossary has no entry for, which is the point:
 * an ecovillage is somewhere to settle, a coliving home somewhere to stay. Nexus Villages
 * scored 0 of that glossary's 76 terms and still needed a subject term.
 */
export const TERM_ECOVILLAGE = defineTerm(SUBJECT_TERM_SET, {
  id: 'https://en.wikipedia.org/wiki/Ecovillage',
  name: 'Ecovillage',
  alternateName: 'Eco-village',
  description: 'A traditional or intentional community that aims to become more socially, '
    + 'culturally, economically or environmentally sustainable, striving for the least '
    + 'possible negative impact on the natural environment through intentional physical '
    + 'design and the behavioural choices of its inhabitants (Wikipedia). Typically 50–250 '
    + 'residents. A subtype of intentional community, distinguished from cohousing by an '
    + 'explicit commitment to ecological regeneration rather than shared living alone.',
  sameAs: 'https://en.wikipedia.org/wiki/Ecovillage',
});

export const SUBJECT_TERMS = [TERM_ALTERNATIVE_PRACTICE, TERM_COLIVING, TERM_COWORKING, TERM_ECOVILLAGE];

/**
 * West Coast Swing vocabulary. The three terms are siblings in one set, each pointing at
 * it with `inDefinedTermSet` — an Anchor Step is a step *within* WCS, so it must not
 * appear as a set that contains WCS.
 */
export const WCS_VOCABULARY = defineTermSet({
  id: 'https://worldsdc.com/#wcs-vocabulary',
  name: 'West Coast Swing Vocabulary',
});

export const [TERM_WEST_COAST_SWING, TERM_ANCHOR_STEP, TERM_COASTER_STEP] = defineTerms(WCS_VOCABULARY, [
  {
    // Distinct from the World Swing Dance Council's @id: reusing worldsdc.com for both
    // collapses term and council into one node, making knowsAbout point at the council.
    id: 'https://en.wikipedia.org/wiki/West_Coast_Swing',
    name: 'West Coast Swing',
    alternateName: 'WCS',
    description: 'An evolution of Savoy Style Lindy Hop that originated in the 1930s '
      + 'and is the Official State Dance of California.',
    sameAs: 'https://worldsdc.com',
  },
  {
    id: 'https://en.wikipedia.org/wiki/Anchor_Step',
    name: 'Anchor Step',
    description: 'The stationary two-beat pattern that ends most West Coast Swing figures.',
  },
  {
    id: 'https://en.wikipedia.org/wiki/Coaster_Step',
    name: 'Coaster Step',
    description: 'A back-together-forward triple step used to recover the slot.',
  },
]);

export const WCS_TERMS = [TERM_WEST_COAST_SWING, TERM_ANCHOR_STEP, TERM_COASTER_STEP];

/**
 * Fusion partner dance vocabulary. Sourced from two places, deliberately kept distinct:
 * the Wikipedia article supplies the form's definition and lineage, and Motley Hue's
 * "What is Fusion" page supplies the community's own framing. Where they differ in
 * emphasis — Wikipedia is descriptive/historical, Motley Hue normative ("say yes to your
 * partner") — both are recorded rather than blended into one paraphrase.
 *
 * The constituent styles are siblings in this set, not parents of it: fusion draws FROM
 * them. schema.org has no "draws from" property on DefinedTerm, so the relationship
 * lives in the descriptions.
 */
export const FUSION_VOCABULARY = defineTermSet({
  id: 'https://motleyhue.org/about/#what-is-fusion',
  name: 'Fusion Partner Dance Vocabulary',
  description: 'Terms describing fusion partner dance and the traditional forms it '
    + 'draws on, compiled from en.wikipedia.org/wiki/Fusion_dance and Motley Hue.',
});

export const TERM_FUSION_DANCE = defineTerm(FUSION_VOCABULARY, {
  id: 'https://en.wikipedia.org/wiki/Fusion_dance',
  name: 'Fusion Dance',
  alternateName: 'Fusion Partner Dancing',
  description: 'A contemporary social improvised partner dance that combines different '
    + 'dance styles to create a new aesthetic (Wikipedia). The community frames it as '
    + 'dancing "outside" the boxes of traditional forms such as tango or waltz, drawing '
    + 'on the techniques of all partner dances to create personal, improvisational '
    + 'expressions to music — "the ability to be endlessly creative and say yes! to your '
    + 'partner" (Motley Hue). Emerged in the United States in the 2000s and spread to '
    + 'Canada and Europe; the Houston Fusion Exchange (January 2008) was the first '
    + 'nationally recognised event. Emphasises lead-follow connection, '
    + 'extension-compression and frame, decouples dance roles from gender, and '
    + 'prioritises consent between partners.',
  sameAs: 'https://en.wikipedia.org/wiki/Fusion_dance',
});

/** Forms the two sources name as fusion's inputs. */
export const FUSION_SOURCE_FORMS = defineTerms(FUSION_VOCABULARY, [
  { name: 'Tango', id: 'https://en.wikipedia.org/wiki/Tango_(dance)', description: 'Named by Motley Hue as a traditional form fusion dances outside of; bridged to blues by the 2005 "Tangoed Up In Blues" workshops.' },
  { name: 'Waltz', id: 'https://en.wikipedia.org/wiki/Waltz', description: 'Named by Motley Hue as a traditional form fusion dances outside of.' },
  { name: 'Blues', id: 'https://en.wikipedia.org/wiki/Blues_dance', description: 'Bridged to the tango community by "Tangoed Up In Blues" (2005), an influence on fusion\'s emergence.' },
  { name: 'Lindy Hop', id: 'https://en.wikipedia.org/wiki/Lindy_Hop', description: 'Blended with non-traditional music at Lindy Booty (2004, San Francisco and Sacramento), shaping fusion\'s development.' },
  { name: 'Ballet', id: 'https://en.wikipedia.org/wiki/Ballet', description: 'A technique source fusion incorporates.' },
  { name: 'Contact Improvisation', id: 'https://en.wikipedia.org/wiki/Contact_improvisation', description: 'A technique source fusion incorporates.' },
  { name: 'Popping', id: 'https://en.wikipedia.org/wiki/Popping', description: 'A technique source fusion incorporates.' },
]);

export const FUSION_TERMS = [TERM_FUSION_DANCE, ...FUSION_SOURCE_FORMS];

/**
 * Brazilian Zouk vocabulary, built on the fusion model but with one difference: only
 * three of these terms have their own Wikipedia article, so the steps and substyles use
 * `termCode` and carry no `@id` rather than inventing fragment URLs that may not resolve.
 *
 * The Brazilian Zouk Dance Council page supplies no definition of the dance — unlike
 * Motley Hue's "What is Fusion" — so the definition here is Wikipedia's alone, and the
 * council contributes only the set's community framing.
 */
export const ZOUK_VOCABULARY = defineTermSet({
  id: 'https://www.brazilianzoukcouncil.com/#zouk-vocabulary',
  name: 'Brazilian Zouk Vocabulary',
  description: 'Terms describing Brazilian Zouk, its lineage, step vocabulary and '
    + 'substyles. Definitions from en.wikipedia.org/wiki/Brazilian_Zouk; community '
    + 'framing from the Brazilian Zouk Dance Council, "a platform dedicated to '
    + 'connecting dancers, events, and professionals of Brazilian Zouk around the world".',
});

export const TERM_BRAZILIAN_ZOUK = defineTerm(ZOUK_VOCABULARY, {
  id: 'https://en.wikipedia.org/wiki/Brazilian_Zouk',
  name: 'Brazilian Zouk',
  alternateName: 'Zouk',
  description: 'A partner dance which began in Brazil during the early 1990s. It evolved '
    + 'from Lambada: as Lambada music fell out of fashion, dancers moved to zouk music '
    + 'from the francophone Caribbean, and the dance took that name to distinguish itself '
    + 'from the musical genre. Its most distinctive feature is the follower\'s upper-body '
    + 'movement, led out of axis through intricate lead-follow technique, alongside body '
    + 'isolations, tilted turns and counter-balance.',
  sameAs: 'https://en.wikipedia.org/wiki/Brazilian_Zouk',
});

/** Lineage: the two forms Brazilian Zouk descends from. Both have their own articles. */
export const ZOUK_LINEAGE = defineTerms(ZOUK_VOCABULARY, [
  { name: 'Lambada', id: 'https://en.wikipedia.org/wiki/Lambada', description: 'The Brazilian partner dance popular in the 1980s from which Brazilian Zouk directly evolved.' },
  { name: 'Zouk', id: 'https://en.wikipedia.org/wiki/Zouk', description: 'The Caribbean music genre, from the francophone islands, that Lambada dancers adopted and which gave the dance its name.' },
]);

/** Named basic steps. No standalone articles, so identified by termCode within the set. */
export const ZOUK_STEPS = defineCodedTerms(ZOUK_VOCABULARY, 'step',
  ['Basic', 'Lateral', 'Viradinha', 'Elástico', 'Bonus'].map((name) => ({
    name,
    description: 'A named foundational step of Brazilian Zouk.',
  })));

/** Established substyles, likewise identified by termCode. */
export const ZOUK_SUBSTYLES = defineCodedTerms(ZOUK_VOCABULARY, 'substyle', [
  { name: 'Traditional Zouk', description: 'Rio-style, the established traditional form.' },
  { name: 'Lamba Zouk', description: 'Porto Seguro style; the substyle closest to the original Lambada.' },
  { name: 'Mzouk', description: 'Originated in Mallorca, Spain.' },
  { name: 'Soulzouk', description: 'Rio de Janeiro-based substyle.' },
  { name: 'Zouk Flow', description: 'Influenced by hip-hop culture.' },
  { name: 'Neozouk', description: 'Circular movements with a focus on energy management.' },
]);

export const ZOUK_TERMS = [TERM_BRAZILIAN_ZOUK, ...ZOUK_LINEAGE, ...ZOUK_STEPS, ...ZOUK_SUBSTYLES];

/** Every vocabulary in the mailbox, for validation and reporting. */
export const VOCABULARIES = [
  { termSet: AUDIENCE_TERM_SET, terms: AUDIENCE_TERMS },
  { termSet: SUBJECT_TERM_SET, terms: SUBJECT_TERMS },
  { termSet: WCS_VOCABULARY, terms: WCS_TERMS },
  { termSet: FUSION_VOCABULARY, terms: FUSION_TERMS },
  { termSet: ZOUK_VOCABULARY, terms: ZOUK_TERMS },
];
