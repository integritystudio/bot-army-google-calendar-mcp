# Adding Organization Tags

`Organization/*` labels are an **informational dimension, orthogonal to category
routing**. A sender's mail may route to `Billing`, `Promotions`, or `Purchases`
and still carry the same `Organization/*` tag. Tag filters are **label-only** —
they never archive and never mark read.

Source of truth: `ORG_TAGS` in [`config/org-tags.mjs`](../config/org-tags.mjs).
(`create-org-tags.mjs` is the CLI that applies it.)
Shared machinery: [`lib/gmail-tag-utils.mjs`](../lib/gmail-tag-utils.mjs).

## Naming: mirror schema.org

**Label path segments mirror [schema.org](https://schema.org/Organization) types
and properties as closely as possible.** `Organization/LocalCommunity/CollegeOrUniversity`
mirrors [`CollegeOrUniversity`](https://schema.org/CollegeOrUniversity). Prefer the
exact schema.org spelling (`NewsMediaOrganization`, not `News`) so a label maps
1:1 to a type.

### Types vs. instances

A path segment is either a **type** or an **instance**, and nesting an instance
under a type is how the tree says "this org is of that type":

```
Organization/LocalCommunity/CollegeOrUniversity          <- type
  └── The University of Texas                            <- instance of that type
        └── Texas Exes Alumni Association                <- subOrganization of UT
```

Nesting one instance under another expresses
[`subOrganization`](https://schema.org/subOrganization) (inverse:
`parentOrganization`). Texas Exes is a plain `Organization` that is a
`subOrganization` of The University of Texas — it is *not* itself a
`CollegeOrUniversity`, so it must not sit directly under that type segment.

Known deviations from this rule, both pre-existing:

- `Organization/LocalCommunity/CollegeOrUniversity/Texas Exes Alumni Association`
  nests the instance directly under the type, skipping the UT instance level.
- `Organization/Google/*` uses an instance (`Google`) as a mid-path segment, with
  products and subsidiaries below it (`Calendar`, `Store & Play`, `GFiber`).
  Those children are closer to products than `subOrganization`s.

### The 20 direct subtypes of `Organization`

Verified against schema.org: `Airline`, `Consortium`, `Cooperative`,
`Corporation`, `EducationalOrganization`, `FundingScheme`,
`GovernmentOrganization`, `LibrarySystem`, `LocalBusiness`,
`MedicalOrganization`, `NGO`, `NewsMediaOrganization`, `OnlineBusiness`,
`PerformingGroup`, `PoliticalParty`, `Project`, `ResearchOrganization`,
`SearchRescueOrganization`, `SportsOrganization`, `WorkersUnion`.

`LocalBusiness` carries the large second tier — `AutomotiveBusiness`, `Dentist`,
`EntertainmentBusiness`, `FinancialService`, `FoodEstablishment`,
`HealthAndBeautyBusiness`, `HomeAndConstructionBusiness`, `LegalService`,
`LodgingBusiness`, `MedicalBusiness`, `ProfessionalService`, `RealEstateAgent`,
`SelfStorage`, `ShoppingCenter`, `SportsActivityLocation`, `Store`,
`TravelAgency`, and more. `Store` in turn has ~31 subtypes (`ClothingStore`,
`GroceryStore`, `HomeGoodsStore`, `LiquorStore`, …), and `OnlineStore` is a
subtype of `OnlineBusiness`.

**`Museum` is not an `Organization` subtype** — it is a `Place`/`CivicStructure`.
`Organization/LocalCommunity/Museum` therefore has no schema.org backing as an
Organization tag.

### Existing labels that do not mirror a schema.org type

These predate the convention. Left alone deliberately — renaming a label
rewrites every filter that targets it — but prefer the schema.org name for
anything new:

| Current segment | Schema.org type it should mirror |
|---|---|
| `Political` | `PoliticalParty` |
| `Financial` | `FinancialService` |
| `RealEstate` | `RealEstateAgent` |
| `Ecommerce` | `OnlineStore` |
| `Professional` | `ProfessionalService` |
| `Health` | `MedicalOrganization` |
| `Travel` | `TravelAgency` |
| `Automotive` | `AutomotiveBusiness` |
| `Government` | `GovernmentOrganization` (duplicates the `LocalCommunity/` one) |
| `Beauty` | `HealthAndBeautyBusiness` |
| `Home` | `HomeAndConstructionBusiness` |

No schema.org equivalent exists for `OpenSource`, `DigitalNomad`, `Tech`,
`Metaphysical-Esoteric-Alternative`, or the `LocalCommunity` grouping itself.
Those are deliberate local extensions; keep them, but don't invent a new one
where a schema.org type already fits.

`DigitalNomad` and `Metaphysical-Esoteric-Alternative` describe an org's audience
and subject matter, not its type, and are now carried as `DefinedTerm`s in
`schema.keywords` instead of as path segments — see
[`DEFINED-TERMS-GUIDE.md`](DEFINED-TERMS-GUIDE.md). The label path still takes the
org's schema.org type, which is what lets one keyword span several types: the
digital-nomad senders include a `LodgingBusiness`, an insurer and a media
community.

### Resolved: BigTech, DeveloperTools, Streaming

`Organization/BigTech` and `Organization/DeveloperTools` were merged into
`Organization/Corporation`, and `BigTech/Streaming` + `BigTech/Entertainment`
into `Organization/OnlineBusiness`:

| Was | Now |
|---|---|
| `BigTech` (12 orgs) | `Corporation` |
| `DeveloperTools` (19 orgs) | `Corporation` |
| `BigTech/Streaming` (Netflix, HBO Max) | `OnlineBusiness` |
| `BigTech/Entertainment` (Last.fm) | `OnlineBusiness` |
| `BigTech/Developer/AI` (OpenAI, Anthropic) | `Corporation` |
| `DeveloperTools` → Data Science Dojo | `EducationalOrganization` |
| *(new)* Uber, Lyft | `Corporation/TaxiService` |

This replaced an earlier model in which BigTech members were treated as
schema.org `SoftwareApplication` with sub-sectors named for `applicationCategory`.
An `Organization/*` tag describes the **sender organization**, so an Organization
subtype is the right vocabulary; the application-category model described the
products instead.

`Corporation/TaxiService` is the one intentional exception to "every segment is
an Organization subtype": [`TaxiService`](https://schema.org/TaxiService) is
`Thing → Intangible → Service → TaxiService`, so the segment names *the service
the corporation provides*, not what kind of organization it is. Schema.org links
the two via `Service.provider` / `Organization.makesOffer`, not a direct
`service` property on `Organization`.

Note there are now **two** `OnlineBusiness` segments at different depths:
top-level `Organization/OnlineBusiness` (Netflix, HBO Max, Last.fm) and
`Organization/LocalCommunity/OnlineBusiness` (Meetup, Nextdoor). Consistent with
`LocalCommunity` being a non-schema grouping, but worth collapsing if the
distinction stops earning its keep.

When no schema.org type fits a real sender, say so explicitly rather than
stretching an unrelated type — e.g. rideshare has no `Organization` subtype
(`TaxiService` is a `Service`, not an `Organization`).

## Procedure

### 1. Add the label constant (only for a new label)

In `lib/constants.mjs`:

```js
export const LABEL_ORG_LC_CLOTHING_STORE = 'Organization/LocalCommunity/LocalBusiness/Store/ClothingStore';
```

Adding entries to an *existing* tag group needs no new constant — skip to step 3.

### 2. Import it in `config/org-tags.mjs`

Add to the `from '../lib/constants.mjs'` import block at the top.

### 3. Add the entry to `ORG_TAGS`

The field is **`entries`**:

```js
{
  labelName: LABEL_ORG_LC_CLOTHING_STORE,   // 'Organization/LocalCommunity/LocalBusiness/Store/ClothingStore'
  entries: [
    { name: 'H&M', query: 'from:hm.com' },
    { name: 'Ruti', query: 'from:ruti.com' },
  ],
},
```

Pick the label name by finding the schema.org type first — see
[Naming](#naming-mirror-schemaorg) above.

`applyTagSet()` iterates `tag.entries` directly, so `ORG_TAGS` is handed to it
unchanged. `CATEGORIES` and `COUNTRY_TAGS` use the same field name — all three
config sources agree, and nothing remaps between them.

Use a **bare domain** (`from:uber.com`), not a specific sending subdomain. An org
tag identifies the *sender*, so account and security mail belongs under it too,
and Gmail's `from:` matches subdomains — `from:a16z.com` also catches
`sr-team.a16z.com` and `alpha.a16z.com`.

### 4. Apply

```bash
node create-org-tags.mjs                                   # every tag group
node create-org-tags.mjs --only "Organization/LocalCommunity/LocalBusiness"  # prefix match on labelName
node create-org-tags.mjs --orgs "h&m,ruti"                  # entry names, comma-separated, case-insensitive
node create-org-tags.mjs --filters-only                    # create filters, skip the backfill
```

`--only` is a **prefix** match, so `--only "Organization/Google"` also runs every
`Organization/Google/*` sublabel. Flags compose.

### 5. Verify

```bash
node audit-org-tag-coverage.mjs --max 500                   # gaps in the unread sample
node audit-org-tag-coverage.mjs --query 'from:hm.com'       # confirm one sender is now covered
```

The audit reports sender domains carrying no `Organization/*` label that no
`ORG_TAGS` entry claims, plus any `ORG_TAGS` label missing from Gmail.

## What `applyTagSet()` actually does

Per entry:

1. `ensureLabelExists()` — creates the label if absent (hierarchical names work;
   Gmail nests on `/`).
2. `createGmailFilter()` with `{ addLabelIds: [labelId] }` and **no**
   `removeLabelIds` — this is what keeps tags label-only.
3. Unless `--filters-only`, `labelAllMatching()` backfills
   `(<query>) -label:"<labelName>"`.

### Backfill scope is the whole mailbox, read and unread

`labelAllMatching()` pages through **every** match with no `is:unread` clause —
500/page, `batchModify` in chunks of 1000, `addLabelIds` only. It never removes a
label and never touches inbox or read state, so re-running is safe and
idempotent; the `-label:` clause makes repeat runs cheap.

This differs from `create-filters.mjs`, whose category backfill is unread-only
unless the category sets `includeRead: true`.

## Gotchas

- **A Gmail filter can add only ONE user label.** Two labels in one
  `addLabelIds` fails with `Too many user labels in filter`. Org tags are
  one-label-per-filter so this never bites here — but it does in
  `create-filters.mjs`, which creates one filter per label on the same query.
  `messages.modify` / `batchModify` have no such limit, which is why a backfill
  can succeed on a label set that filter creation rejects.
- **Filters run only on arrival.** A new entry does nothing to existing mail
  unless the backfill runs — that's the whole reason step 4 has a backfill at all.
- **`withRetry()` covers only transient failures**: an error message containing
  `Precondition`, or code 429/500/503. 4 attempts, linear backoff (3s × attempt).
  Anything else throws immediately.
- **Duplicate filters are swallowed, not errors.** `createGmailFilter()` returns
  `null` for 409 / 500 / `Filter already exists`, so re-running prints `~` instead
  of `✓` and creates nothing. A `~` means "already present", not "failed".
- **Don't tag ESP infrastructure or your own domain.** `qemailserver.com`,
  `*.mailchimpapp.com`, and similar are sending platforms, not organizations;
  `integritystudio.ai` is the user's own domain.
- **The domain name lies about the type.** Check what the sender *is* before
  picking a type — a dance-sounding domain is rarely a `PerformingGroup`. All
  three of these were first mis-proposed as `PerformingGroup`:

  | Domain | Actually | Type |
  |---|---|---|
  | `fuegodance.com` | shoe brand | `OnlineBusiness/OnlineStore` |
  | `tinyminotaur.com` | tavern / venue | `LocalBusiness/EntertainmentBusiness` |
  | `zouk.us` | ZoukMX festival organizer | `SportsOrganization/…/ZoukMX` |

  `PerformingGroup` means the org *performs*. An organizer, a venue, or a brand
  in the same scene is something else.

- **`LocalCommunity/` shadows several top-level types.** There are now pairs at
  two depths for `OnlineBusiness` and `SportsOrganization`, and
  `PerformingGroup`/`EntertainmentBusiness` exist only under `LocalCommunity`.
  "Local vs. not" is not a schema.org distinction, so decide deliberately which
  depth a new tag belongs at rather than copying whichever you find first.

## Related

- [`DEFINED-TERMS-GUIDE.md`](DEFINED-TERMS-GUIDE.md) — the controlled vocabularies
  a tag group's `schema` field points at (`lib/defined-terms.mjs` builders,
  `lib/vocabularies.mjs` data), and how to add a term or a set.
- `create-country-tags.mjs` — the other tag set on the same machinery. Uses
  `entries:` directly and is seeded from ccTLD domains only.
- [`SCHEMA_CATEGORY_MAP.md`](SCHEMA_CATEGORY_MAP.md) — the *other* schema.org
  surface in this repo: JSON-LD `@type` extracted from email bodies mapped to
  routing categories. Unrelated machinery, same vocabulary.
- [`LABEL-RESOLUTION-GUIDE.md`](LABEL-RESOLUTION-GUIDE.md) — why label IDs are
  resolved dynamically rather than hardcoded.
