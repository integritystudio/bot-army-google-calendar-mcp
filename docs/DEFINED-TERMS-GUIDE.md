# DefinedTerm / DefinedTermSet Guide

Controlled vocabularies for `ORG_TAGS`. Two files:

| File | Holds |
| --- | --- |
| [`lib/defined-terms.mjs`](../lib/defined-terms.mjs) | Builders (`defineTermSet`, `defineTerm`, `defineTerms`, `defineCodedTerms`, `termCodeFor`) and `validateVocabulary()` |
| [`lib/vocabularies.mjs`](../lib/vocabularies.mjs) | The vocabularies themselves, plus `VOCABULARIES` listing every set with its terms |

`create-org-tags.mjs` imports only the individual terms it references.

## Why vocabularies exist

A Gmail label is a flat string, so the label path can carry an organization's *type* and
nothing else. Everything else about an org has nowhere to live. Rather than invent
non-schema path segments (`.../Tantra`, `.../DigitalNomads`), a tag group carries an
optional `schema` field, and the surplus meaning goes in a schema.org property that takes
a `DefinedTerm`:

- **`keywords`** — the only `Organization` property that accepts a `DefinedTerm`.
  `Organization` is outside the domain of both `audience` and the superseded
  `serviceAudience`, which are Service/Event/LodgingBusiness-only.
- **`knowsAbout`** — for the subject an org teaches or governs (a dance form, say).

Two vocabularies exist for the mailbox's own segmentation (`AUDIENCE_TERM_SET` — who an
org serves; `SUBJECT_TERM_SET` — what it is about) and the rest describe outside subject
matter (`WCS_VOCABULARY`, `FUSION_VOCABULARY`, `ZOUK_VOCABULARY`).

> **`schema` is documentation, not behaviour.** `applyTagSet()` reads `labelName` and
> `orgs` only, so nothing in a `schema` block reaches Gmail. A term records a decision and
> its evidence for the next person to touch the entry; it does not label anything. Adding
> a term to an org changes no mail.

## Adding a term to an existing vocabulary

```js
export const TERM_LINDY_HOP = defineTerm(FUSION_VOCABULARY, {
  id: 'https://en.wikipedia.org/wiki/Lindy_Hop',   // only if it has its own stable page
  name: 'Lindy Hop',
  description: 'Where the definition came from, in the source\'s own framing.',
});
```

Then add it to that vocabulary's `*_TERMS` array — that array is what `validateVocabulary`
checks, so a term missing from it is a term nothing verifies.

For a group of terms with no articles of their own, use `defineCodedTerms(set, kind, …)`;
it fills in `termCode` (`substyle:zouk-flow`) so each term is still identifiable.

## Judging a term for inclusion

Published glossaries are tempting bulk input and mostly wrong for this purpose. The
nomadico.io glossary (76 terms, audited 2026-08) yielded **3**. Four filters, in order of
how many they eliminate:

1. **Does the mailbox use it?** Count the phrase inside the relevant senders' mail before
   arguing about it. 47 of those 76 terms appeared in **zero** messages from any of the 15
   digital-nomad organizations in the mailbox.
2. **Is it the publisher's coinage?** A vendor glossary is SEO surface and product
   marketing. "Guinea Nomad" and "Coliving Partner" are one company's internal words;
   adopting them makes the mailbox's vocabulary depend on that company's copy.
3. **Does it describe the organization, or something smaller?** Amenities (`Hot Desk`,
   `Private Room`, `Dorm Room`), job titles (`Community Manager`) and lifestyle states
   (`Travel Fatigue`) are not what an org *is about*. Pricing tiers collapse into the
   practice: a day pass is coworking.
4. **Does it discriminate?** Compare the in-scope count against the mailbox-wide one.
   `Content Creator` scored 5 in nomad mail and 1,446 overall — it is generic marketing
   language, so tagging an org with it says nothing.

A term that passes all four still needs an `@id` from a source that is not the glossary —
Wikipedia in every case so far. Verify the article resolves; `Coliving` redirects to
`Co-living`, and the `@id` must be the destination.

## Adding a vocabulary

1. `defineTermSet({ id, name, description })`. `id` is optional — prefer a fragment on the
   community's own page (`https://motleyhue.org/about/#what-is-fusion`) over a URL that
   will never resolve, and omit it entirely for a set the mailbox invented.
2. Define the terms against it, collect them in a `*_TERMS` array.
3. Add `{ termSet, terms }` to `VOCABULARIES`.
4. Run the validator (below).

## Rules

- **Terms point at the set; the set never points back.** The inverse `hasDefinedTerm` is
  development-version only, and a set referencing its terms is a cycle that
  `JSON.stringify` cannot serialize — which is how every consumer reads these.
- **A term's `@id` must differ from any organization's `@id`.** One URL for both collapses
  term and org into a single JSON-LD node: `knowsAbout` meant for West Coast Swing would
  resolve to the council that governs it. Hence
  `@id: 'https://en.wikipedia.org/wiki/West_Coast_Swing'` with `sameAs: 'https://worldsdc.com'`.
- **`@id` or `termCode`, never a made-up URL.** A fragment URL that 404s is worse than a
  code scoped to the set; `termCode` exists for exactly this.
- **Constituent styles are siblings, not parents.** Fusion draws *from* tango; an Anchor
  Step is a step *within* West Coast Swing. Neither is a set containing the other.
  schema.org has no "draws from" property, so that relationship lives in the descriptions.
- **Record sources separately when they differ.** Wikipedia is descriptive and historical,
  a community page normative; keep both framings rather than blending them into one
  paraphrase that is faithful to neither.
- **No time-varying data**, the same rule as the rest of `ORG_TAGS`
  ([known issues](../README.md#known-issues)). Historical dates inside a description are
  fine — a form's origin is a fact, not a forecast.
- **An audience term is not a type.** If an org's defining trait is who it serves, that is
  a keyword; the label path still takes its schema.org type. Several digital-nomad
  organizations are not `LodgingBusiness` at all.

## Validating

```bash
node -e "Promise.all([import('./lib/vocabularies.mjs'),import('./lib/defined-terms.mjs')]).then(([v,d])=>{for(const{termSet,terms}of v.VOCABULARIES){const i=d.validateVocabulary(termSet,terms);console.log(\`\${termSet.name}: \${terms.length} terms — \${i.length?i.join(' | '):'OK'}\`)}})"
```

`validateVocabulary` catches structural defects only: a term not pointing at its set,
a term identified by neither `@id` nor `termCode`, an `@id` colliding with the set's,
duplicate names/ids/codes, a missing description, and unserializable cycles. It cannot
tell you whether a definition is accurate or whether a term belongs in the set it claims —
those need the kind of content audit in [ORG-TAGS-GUIDE.md](ORG-TAGS-GUIDE.md).

## The JSON-LD build

`npm run build:jsonld` walks `VOCABULARIES` plus every `schema` block in `ORG_TAGS` and
writes [`mailbox.jsonld`](mailbox.jsonld) — one flattened `@graph`, 47 nodes. Rerun it
after touching either source; `npm run check:jsonld` exits non-zero if the committed file
is stale, so it can gate CI.

Everything the modeling records is otherwise source-only, built in memory on each run and
discarded — nothing is stored in Gmail, which holds label names and nothing else. The
artifact makes it diffable, greppable and checkable against schema.org tooling.

Three choices in [`build-jsonld.mjs`](../build-jsonld.mjs) worth knowing before editing it:

- **Nothing is invented.** A node with no `@id` stays an unidentified (blank) node rather
  than being minted one — the same rule the vocabularies follow. That is why 22 of the 47
  are anonymous: the `termCode` terms and the two mailbox-invented sets have no URL.
- **Annotations are named, entities are left alone.** `{ '@type': 'LodgingBusiness',
  keywords: [...] }` carries no identity, so it describes the orgs tagged under it and is
  emitted once per org, named. A block that is already an entity — `ORG_BZDC`, with its
  own `@id` — is emitted as itself. Merging the two kinds would fuse the group's
  organization with an org tagged under it into one node under the wrong `@id`.
- **No build timestamp**, so a rebuild that changed nothing produces no diff.

Gmail's own keys ride along as schema.org `identifier` / `PropertyValue` entries
(`gmail-label`, `gmail-query`) rather than as invented properties, keeping the graph
inside the schema.org vocabulary.
