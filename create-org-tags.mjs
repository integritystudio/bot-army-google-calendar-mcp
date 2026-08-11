// Organization tags are an informational dimension, orthogonal to category routing:
// a sender's mail may route to Billing, Promotions, or Purchases, but always carries
// the same Organization label. Filters here are label-only — never archive/mark-read.
import { pathToFileURL } from 'node:url';
import { createGmailClient } from './lib/gmail-client.mjs';
import { argAfter } from './lib/cli-utils.mjs';
import { applyTagSet } from './lib/gmail-tag-utils.mjs';
import {
  LABEL_ORG_OPEN_SOURCE,
  LABEL_ORG_FINANCIAL,
  LABEL_ORG_REAL_ESTATE,
  LABEL_ORG_ECOMMERCE,
  LABEL_ORG_LOCAL_COMMUNITY,
  LABEL_ORG_PROFESSIONAL,
  LABEL_ORG_PROFESSIONAL_METAPHYSICAL,
  LABEL_ORG_PROFESSIONAL_HOME,
  LABEL_ORG_PROFESSIONAL_BEAUTY,
  LABEL_ORG_ECOMMERCE_FOOD,
  LABEL_ORG_ECOMMERCE_BEAUTY,
  LABEL_ORG_ECOMMERCE_TECH,
  LABEL_ORG_LC_COLLEGE,
  LABEL_ORG_LC_COLLEGE_ALUMNI,
  LABEL_ORG_LC_GOVERNMENT,
  LABEL_ORG_LC_NEWS_MEDIA,
  LABEL_ORG_LC_NGO,
  LABEL_ORG_LC_CONSORTIUM,
  LABEL_ORG_LC_ONLINE_BUSINESS,
  LABEL_ORG_LC_LOCAL_BUSINESS,
  LABEL_ORG_LC_STORE,
  LABEL_ORG_LC_ENTERTAINMENT,
  LABEL_ORG_LC_PERFORMING_GROUP,
  LABEL_ORG_LC_MUSEUM,
  LABEL_ORG_LC_RESEARCH,
  LABEL_ORG_SPORTS,
  LABEL_ORG_LB_STORE_CLOTHING,
  LABEL_ORG_LB_STORE_GROCERY,
  LABEL_ORG_LB_STORE_HOMEGOODS,
  LABEL_ORG_LB_FOOD,
  LABEL_ORG_PERFORMING_GROUP,
  LABEL_ORG_LODGING_BUSINESS,
  LABEL_ORG_GOOGLE,
  LABEL_ORG_HEALTH,
  LABEL_ORG_TRAVEL,
  LABEL_ORG_AUTOMOTIVE,
  LABEL_ORG_CORPORATION,
  LABEL_ORG_CORP_TAXI_SERVICE,
  LABEL_ORG_CORP_AMAZON_RING,
  LABEL_ORG_ONLINE_BUSINESS,
  LABEL_ORG_ONLINE_STORE,
  LABEL_ORG_EDUCATIONAL,
  LABEL_ORG_EDU_WSDC_AWA,
  LABEL_ORG_SPORTS_ZOUKMX,
  LABEL_ORG_GOVERNMENT,
  LABEL_ORG_POLITICAL,
} from './lib/constants.mjs';
// Controlled vocabularies: a tag group's optional `schema` field records the modeling a
// Gmail label cannot express — labels are flat strings, so `keywords` and `knowsAbout`
// have nowhere else to live. Definitions and shape rules in lib/vocabularies.mjs.
import {
  TERM_DIGITAL_NOMADS,
  TERM_REMOTE_WORKERS,
  TERM_ALTERNATIVE_PRACTICE,
  TERM_ECOVILLAGE,
  TERM_WEST_COAST_SWING,
  TERM_FUSION_DANCE,
  TERM_BRAZILIAN_ZOUK,
} from './lib/vocabularies.mjs';

/**
 * ZoukMX and its parent council, typed as schema.org SportsOrganization.
 *
 * `event` lists the org's recurring PROGRAMMES, not dated instances: what kinds of event
 * it runs is stable, which edition runs when is not. Dates and year-stamped names are
 * deliberately absent — ORG_TAGS is long-lived routing config, and anything here that
 * expires silently rots. startDate is optional on schema.org Event, so these stay valid.
 */
const PLAYA_DEL_CARMEN = {
  '@type': 'Place',
  name: 'Playa del Carmen',
  address: 'Playa del Carmen, Mexico',
};

export const ZOUKMX_PROGRAMS = [
  {
    '@type': 'EducationEvent',
    name: 'ZoukMX 100 Hour Training Program',
    description: 'An immersive month-long dance journey featuring 6 distinct training tracks.',
    location: PLAYA_DEL_CARMEN,
  },
  {
    '@type': 'SportsEvent',
    name: 'ZoukMX Weekdays & Intensives Festival',
    description: 'A 3-day intensive festival focused on sharpening dance technique.',
    location: PLAYA_DEL_CARMEN,
  },
  {
    '@type': 'SportsEvent',
    name: 'ZoukMX Main Festival',
    description: 'The main festival weekend bringing together hundreds of dancers for connection and workshops.',
    location: PLAYA_DEL_CARMEN,
  },
  {
    '@type': 'Festival',
    name: 'ZoukMX Excursion: Lagoon Jungle Party',
    location: PLAYA_DEL_CARMEN,
  },
  {
    '@type': 'Festival',
    name: 'ZoukMX Retreat: Tulum Days',
    location: { '@type': 'Place', name: 'Tulum', address: 'Tulum, Mexico' },
  },
];

export const ORG_ZOUKMX = {
  '@type': 'SportsOrganization',
  '@id': 'https://zouk.mx',
  name: 'ZoukMX',
  url: 'https://zouk.mx/',
  description: 'An immersive dance organization specializing in Brazilian Zouk training '
    + 'and festival experiences in Central America.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Playa del Carmen',
    addressRegion: 'Quintana Roo',
    addressCountry: 'MX',
  },
  knowsAbout: TERM_BRAZILIAN_ZOUK,
  event: ZOUKMX_PROGRAMS,
};

/** subOrganization only — the inverse parentOrganization would make this cyclic. */
export const ORG_BZDC = {
  '@type': 'SportsOrganization',
  '@id': 'https://brazilianzoukcouncil.com',
  name: 'Brazilian Zouk Dance Council',
  alternateName: 'BZDC',
  url: 'https://www.brazilianzoukcouncil.com/',
  subOrganization: ORG_ZOUKMX,
};

/**
 * Motley Hue and its recurring programmes. Same shape as ORG_BZDC/ORG_ZOUKMX, minus the
 * subOrganization wrapper — Motley Hue has no parent org.
 *
 * @type is SportsOrganization to match the label it converged onto, though the company
 * self-describes as an event production company; the participatory-vs-audience rule that
 * put it there is a local convention, not a schema.org distinction.
 *
 * Dates omitted for the same reason as ZoukMX's. The About page also cites an NYC
 * flagship festival, absent here because no page for it was supplied — an omitted
 * programme is better than an invented one.
 */
export const MOTLEY_HUE_PROGRAMS = [
  {
    '@type': 'Festival',
    name: 'The Fusion Nest',
    description: 'An immersive weekend of fusion dance in the mountains of Cuneo — an '
      + 'all-inclusive retreat-style festival blending instruction, social dancing, live '
      + 'music, meals and lodging in a rural co-living space.',
    url: 'https://motleyhue.org/nest/',
    location: {
      '@type': 'Place',
      name: 'Osservatorio P.U.S.H.',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Busca',
        addressRegion: 'Piemonte',
        addressCountry: 'IT',
      },
    },
  },
  {
    '@type': 'Festival',
    name: 'Crème de la Connection',
    description: 'A spacious sleep-away weekend at a riverside monastery filled with '
      + 'fusion dance, group games and embodiment workshops, on a schedule that '
      + 'prioritises rest.',
    url: 'https://motleyhue.org/cremeconnection2/',
    location: {
      '@type': 'Place',
      name: 'Herder-Kulturzentrum',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Klosterstraße 10',
        postalCode: '93188',
        addressLocality: 'Pielenhofen',
        addressCountry: 'DE',
      },
    },
  },
  {
    // One programme, delivered as rotating regional modules. The regions are stable;
    // which city hosts a given cohort is not, so no location is pinned.
    '@type': 'EducationEvent',
    name: 'Fusion Teacher Training (FTT)',
    description: 'A multi-module pathway developing fusion dance instructors through '
      + 'technique, theory and teaching methodology, delivered as rotating European and '
      + 'North American modules.',
    url: 'https://motleyhue.org/teachertraining/',
  },
];

export const ORG_MOTLEY_HUE = {
  '@type': 'SportsOrganization',
  '@id': 'https://motleyhue.org',
  name: 'Motley Hue',
  url: 'https://motleyhue.org/',
  description: 'An event production company hosting experiences meant to educate and '
    + 'inspire through the medium of partner dancing.',
  knowsAbout: TERM_FUSION_DANCE,
  event: MOTLEY_HUE_PROGRAMS,
};

// Exported so coverage-audit scripts can read the definitions without executing main()
export const ORG_TAGS = [
  {
    // National parties and campaign committees. Government covers public agencies and
    // LC/NGO covers local nonprofits; neither fits a party organization.
    labelName: LABEL_ORG_POLITICAL,
    orgs: [
      { name: 'Democrats.org', query: 'from:democrats.org' },
    ],
  },
  {
    labelName: LABEL_ORG_OPEN_SOURCE,
    orgs: [
      { name: 'GitHub', query: 'from:github.com' },
      { name: 'npm', query: 'from:npmjs.com' },
      { name: 'MLCommons', query: 'from:mlcommons.org' },
      { name: 'Mozilla', query: 'from:mozilla.org' },
      { name: 'DEV Community', query: 'from:dev.to' },
    ],
  },
  {
    labelName: LABEL_ORG_FINANCIAL,
    orgs: [
      { name: 'Wells Fargo', query: 'from:wellsfargo.com OR from:wellsfargorewards.com' },
      { name: 'Barchart', query: 'from:barchart.com' },
      { name: 'Citi', query: 'from:citi.com' },
      { name: 'ProxyVote (Broadridge)', query: 'from:proxyvote.com' },
      { name: 'AV.VC', query: 'from:av.vc' },
      { name: 'USAA', query: 'from:usaa.com' },
      { name: 'Vanguard', query: 'from:vanguard.com' },
      { name: 'Ally', query: 'from:ally.com OR from:ally-invest.com' },
      { name: 'Chase', query: 'from:chase.com' },
      { name: 'Charles Schwab', query: 'from:schwab.com' },
      { name: 'American Express', query: 'from:americanexpress.com' },
      { name: 'PayPal', query: 'from:paypal.com' },
      { name: 'Venmo', query: 'from:venmo.com' },
      { name: 'SoFi', query: 'from:sofi.org OR from:sofi.com' },
      { name: 'Coinbase', query: 'from:coinbase.com' },
      { name: 'Robinhood', query: 'from:robinhood.com' },
      { name: 'Kraken', query: 'from:kraken.com' },
      { name: 'Equifax', query: 'from:equifax.com' },
      { name: 'Experian', query: 'from:experian.com' },
      { name: 'Credit Karma', query: 'from:creditkarma.com' },
      { name: 'Wise', query: 'from:wise.com' },
      { name: 'E-Trade', query: 'from:etrade.com' },
      { name: 'Stripe', query: 'from:stripe.com' },
      { name: 'Truist', query: 'from:truist.com' },
      { name: 'Square', query: 'from:squareup.com' },
      { name: 'NerdWallet', query: 'from:nerdwallet.com' },
      { name: 'GEICO', query: 'from:geico.com' },
      { name: 'Progressive Leasing', query: 'from:progleasing.com' },
      { name: 'Splitwise', query: 'from:splitwise.com' },
      { name: 'Lemonade', query: 'from:lemonade.com' },
      { name: 'Better', query: 'from:better.com' },
    ],
  },
  {
    labelName: LABEL_ORG_REAL_ESTATE,
    orgs: [
      { name: 'Zillow', query: 'from:zillow.com' },
      { name: 'Turno (STR turnover)', query: 'from:(turno.com OR turnoverbnb.com)' },
      { name: 'Beyond Pricing', query: 'from:beyondpricing.com' },
      { name: 'Redfin', query: 'from:redfin.com' },
      { name: 'Realtor.com', query: 'from:realtor.com' },
      { name: 'Apartment List', query: 'from:apartmentlist.com' },
      { name: 'RentCafe', query: 'from:rentcafe.com' },
      { name: 'Furnished Finder', query: 'from:furnishedfinder.com' },
      { name: 'Kindred', query: 'from:livekindred.com' },
      { name: 'Keyrenter', query: 'from:keyrenteraustin.com' },
      {
        // Developer of "futuristic eco-village" communities — Amara Village (Portugal)
        // and Azulik Residences (Tulum). Audited against the digital-nomad vocabulary and
        // scored 0 of 76 terms across every message and its own site: the offer is a home
        // to settle in ("See Your Future Home for the First Time"), not accommodation for
        // people on the move, so it belongs with Zillow rather than with Outsite.
        name: 'Nexus Villages',
        query: 'from:nexusvillages.com',
        schema: { keywords: [TERM_ECOVILLAGE] },
      },
    ],
  },
  {
    labelName: LABEL_ORG_ECOMMERCE,
    orgs: [
      { name: 'Amazon', query: 'from:amazon.com OR from:amazonmusic.com OR from:primevideo.com OR from:audible.com' },
      { name: 'eBay', query: 'from:ebay.com' },
      { name: 'Etsy', query: 'from:etsy.com' },
      { name: 'Poshmark', query: 'from:poshmark.com' },
      { name: 'Temu', query: 'from:temuemail.com' },
      { name: 'Wayfair', query: 'from:wayfair.com OR from:members.allmodern.com OR from:email.blinds.com' },
      { name: 'Best Buy', query: 'from:bestbuy.com' },
      { name: 'Zappos', query: 'from:zappos.com' },
      { name: 'Groupon', query: 'from:groupon.com' },
      { name: 'Home Depot', query: 'from:homedepot.com' },
      { name: 'Pottery Barn', query: 'from:potterybarn.com' },
      { name: 'Bed Bath & Beyond', query: 'from:bedbathandbeyond.com' },
      { name: 'Nespresso', query: 'from:nespresso.com' },
      { name: 'adidas', query: 'from:adidas.com' },
      { name: 'Quince', query: 'from:quince.com' },
      { name: 'DoorDash', query: 'from:doordash.com' },
      { name: 'Instacart', query: 'from:instacart.com' },
      { name: 'Shapermint', query: 'from:shapermint.com' },
      { name: 'Perigold', query: 'from:perigold.com' },
      { name: 'Woodcraft', query: 'from:woodcraft.com' },
      { name: 'Thuma', query: 'from:thuma.co' },
      { name: 'Alp N Rock', query: 'from:alpnrock.com' },
    ],
  },
  {
    // Restaurants, grocery and delivery. DoorDash/Instacart also appear in the flat
    // Ecommerce list above; sublabels are independent, so they carry both tags.
    labelName: LABEL_ORG_ECOMMERCE_FOOD,
    orgs: [
      { name: 'Rappi', query: 'from:(rappi.com.co OR rappi.com.mx)' },
      { name: 'Front Porch Pantry', query: 'from:frontporchpantry.com' },
      { name: 'Toast', query: 'from:toast-restaurants.com' },
      { name: 'Grubhub', query: 'from:grubhub.com' },
      { name: 'Sweetgreen', query: 'from:email.sweetgreen.com' },
      { name: 'SevenRooms', query: 'from:email.sevenrooms.com' },
      { name: 'Snooze Eatery', query: 'from:snoozeeatery.com' },
      { name: 'Hopdoddy Burger Bar', query: 'from:thanx.com from:Hopdoddy' },
      { name: 'Via 313 Pizza', query: 'from:thanx.com from:"Via 313"' },
      { name: 'DoorDash', query: 'from:doordash.com' },
      { name: 'Instacart', query: 'from:instacart.com' },
    ],
  },
  {
    labelName: LABEL_ORG_ECOMMERCE_BEAUTY,
    orgs: [
      { name: 'Benefit Cosmetics', query: 'from:benefitcosmetics.com' },
    ],
  },
  {
    labelName: LABEL_ORG_ECOMMERCE_TECH,
    orgs: [
      // Senders are brother@/account@my.brother.com; the registrable domain catches both
      { name: 'Brother USA', query: 'from:brother.com' },
    ],
  },
  {
    labelName: LABEL_ORG_LOCAL_COMMUNITY,
    orgs: [
      { name: 'Nextdoor', query: 'from:nextdoor.com' },
      { name: 'Austin Business Journal', query: 'from:bizjournals.com' },
      { name: 'City of Austin', query: 'from:austintexas.gov OR from:coautilitiesemail.com OR from:myatxwater.com OR from:austinenergy.com' },
      { name: 'Austin Less Wrong', query: 'from:austinlesswrong@gmail.com' },
      { name: 'UT Austin', query: 'from:utexas.edu OR from:texasexesemail.com' },
      { name: 'Austin Pets Alive', query: 'from:austinpetsalive.org' },
      { name: 'Austin Neighborhoods Council', query: 'from:ancweb.org' },
      { name: 'Austin Habitat for Humanity', query: 'from:ahfh.org' },
      { name: 'EGBI', query: 'from:egbi.org' },
      { name: 'Austin Technology Council', query: 'from:austintechnologycouncil.org' },
      { name: 'Meetup', query: 'from:meetup.com' },
      // ccsend.com is Constant Contact's shared platform; these key on display name
      { name: 'Austin Books & Comics', query: 'from:ccsend.com from:"Austin Books"' },
      { name: 'ColdTowne Theater', query: 'from:coldtowne.ccsend.com' },
      { name: 'Neill-Cochran House Museum', query: 'from:ccsend.com from:Neill-Cochran' },
      { name: 'Environmental Science Institute', query: 'from:ccsend.com from:"Environmental Science"' },
      { name: 'Austin Tennis League', query: 'from:ccsend.com from:Tennis' },
      { name: 'Austin AI Alliance', query: 'from:austin-ai.org' },
      { name: 'BATHE', query: 'from:batheaustin.com' },
      { name: "Games Y'all", query: 'from:gamesyall.com' },
    ],
  },
  // LocalCommunity members repeated below under their schema.org Organization subtype.
  // Routing is unaffected — these are label-only tags, and the entries above still apply
  // the parent LocalCommunity tag, so each org carries both its sector and its type.
  {
    labelName: LABEL_ORG_LC_COLLEGE,
    orgs: [
      { name: 'UT Austin', query: 'from:utexas.edu' },
    ],
  },
  {
    // schema.org subOrganization of UT Austin
    labelName: LABEL_ORG_LC_COLLEGE_ALUMNI,
    orgs: [
      { name: 'Texas Exes Alumni Association', query: 'from:texasexesemail.com' },
    ],
  },
  {
    labelName: LABEL_ORG_LC_GOVERNMENT,
    orgs: [
      { name: 'City of Austin', query: 'from:austintexas.gov OR from:coautilitiesemail.com OR from:myatxwater.com OR from:austinenergy.com' },
    ],
  },
  {
    labelName: LABEL_ORG_LC_NEWS_MEDIA,
    orgs: [
      { name: 'Axios', query: 'from:axios.com' },
      { name: 'The Boston Globe', query: 'from:globe.com' },
      // 501(c)(3) nonprofit newsroom. NewsMediaOrganization is the type ("a newspaper
      // or TV station"); nonprofit status is a property, not a competing NGO type.
      {
        name: 'Texas Tribune',
        query: 'from:texastribune.org',
        schema: { nonprofitStatus: 'Nonprofit501c3' },
      },
      { name: 'Austin Business Journal', query: 'from:bizjournals.com' },
      { name: 'CNN', query: 'from:cnn.com' },
      { name: 'New York Times', query: 'from:newyorktimes.com' },
      { name: 'ALM', query: 'from:alm.com' },
    ],
  },
  {
    labelName: LABEL_ORG_LC_NGO,
    orgs: [
      { name: 'Dhamma Sukha', query: 'from:sukha.dhamma.org' },
      { name: 'Snehalaya', query: 'from:snehalaya.org' },
      { name: 'SAFE Austin', query: 'from:safeaustin.org' },
      { name: 'Austin Pets Alive', query: 'from:austinpetsalive.org' },
      { name: 'Austin Habitat for Humanity', query: 'from:ahfh.org' },
      { name: 'EGBI', query: 'from:egbi.org' },
      { name: 'Austin Neighborhoods Council', query: 'from:ancweb.org' },
    ],
  },
  {
    // Membership organization whose members are themselves organizations
    labelName: LABEL_ORG_LC_CONSORTIUM,
    orgs: [
      { name: 'Austin Technology Council', query: 'from:austintechnologycouncil.org' },
      { name: 'Austin AI Alliance', query: 'from:austin-ai.org' },
      { name: 'Austin Less Wrong', query: 'from:austinlesswrong@gmail.com' },
    ],
  },
  {
    labelName: LABEL_ORG_LC_ONLINE_BUSINESS,
    orgs: [
      { name: 'Meetup', query: 'from:meetup.com' },
      { name: 'Nextdoor', query: 'from:nextdoor.com' },
    ],
  },
  {
    // schema.org Store, a subtype of LocalBusiness
    labelName: LABEL_ORG_LC_STORE,
    orgs: [
      { name: 'Austin Books & Comics', query: 'from:ccsend.com from:"Austin Books"' },
    ],
  },
  {
    // areaServed is Austin-only; no narrower schema.org type applies (there is no
    // SocialOrganization type, so a sober-social club is just a LocalBusiness)
    labelName: LABEL_ORG_LC_LOCAL_BUSINESS,
    orgs: [
      // LocalBusiness half of Austin Westie Academy's [LocalBusiness, School] multi-type
      { name: 'Austin Westie Academy (local business)', query: 'from:austinwestieacademy' },
      { name: 'The Unbuzzed Club', query: 'from:theunbuzzedclub.com' },
    ],
  },
  {
    // Venue programming (album drops, takeovers, anniversaries), not retail
    labelName: LABEL_ORG_LC_ENTERTAINMENT,
    orgs: [
      { name: 'BATHE', query: 'from:batheaustin.com' },
      { name: 'Tiny Minotaur Tavern', query: 'from:tinyminotaur.com' },
    ],
  },
  {
    labelName: LABEL_ORG_LC_PERFORMING_GROUP,
    orgs: [
      { name: 'ColdTowne Theater', query: 'from:coldtowne.ccsend.com' },
    ],
  },
  {
    labelName: LABEL_ORG_LC_MUSEUM,
    orgs: [
      { name: 'Neill-Cochran House Museum', query: 'from:ccsend.com from:Neill-Cochran' },
    ],
  },
  {
    labelName: LABEL_ORG_LC_RESEARCH,
    orgs: [
      { name: 'Environmental Science Institute', query: 'from:ccsend.com from:"Environmental Science"' },
    ],
  },
  {
    labelName: LABEL_ORG_SPORTS,
    orgs: [
      // Participatory partner-dance events: attendees dance, they do not watch. Grouped
      // with the sports leagues rather than EntertainmentBusiness, which would imply an
      // audience. Self-described "event production company hosting experiences meant to
      // educate and inspire through the medium of partner dancing".
      { name: 'Motley Hue', query: 'from:motleyhue.org', schema: ORG_MOTLEY_HUE },
      // Recreational leagues (volleyball, soccer, kickball) + tournaments — organizes
      // sport, so SportsOrganization rather than a SportsActivityLocation venue
      { name: 'Houston Sports & Social Club', query: 'from:houstonssc.com' },
      { name: 'Austin Tennis League', query: 'from:ccsend.com from:Tennis' },
    ],
  },
  {
    labelName: LABEL_ORG_PROFESSIONAL,
    orgs: [
      { name: 'LinkedIn', query: 'from:linkedin.com' },
      { name: 'Indeed', query: 'from:indeed.com OR from:indeedemail.com' },
      { name: 'Glassdoor', query: 'from:glassdoor.com' },
      { name: 'ACM', query: 'from:acm.org' },
      { name: 'Google Careers', query: 'from:careers-noreply@google.com' },
      { name: 'Backstage', query: 'from:backstage.com' },
      {
        // A remote-only job board: the audience is the whole product, but it is Remote
        // Workers, not Digital Nomads — none of its 342 messages carries a travel or
        // location-independence signal.
        name: 'Virtual Vocations',
        query: 'from:virtualvocations.com',
        schema: { keywords: [TERM_REMOTE_WORKERS] },
      },
      { name: 'Lensa', query: 'from:lensa.com' },
      { name: 'A.Team', query: 'from:a.team' },
      { name: 'Idealist', query: 'from:idealist.org' },
      { name: 'Read AI', query: 'from:read.ai' },
    ],
  },
  {
    labelName: LABEL_ORG_PROFESSIONAL_METAPHYSICAL,
    orgs: [
      { name: 'Human Design', query: 'from:human.design' },
      { name: 'The Heart Centered Being', query: 'from:shared1.ccsend.com from:"Heart Centered"' },
    ],
  },
  {
    // Home services. Shared-platform senders are keyed on display name — ccsend and
    // demandforced3 carry many unrelated merchants on the same domain.
    labelName: LABEL_ORG_PROFESSIONAL_HOME,
    orgs: [
      { name: '50K Professional Lawn Services', query: 'from:50klawn.com' },
      { name: 'Critter Control', query: 'from:crittercontrol.com' },
      { name: 'Angi', query: 'from:angi.com' },
      { name: 'LawnStarter', query: 'from:lawnstarter.com' },
      { name: 'YardDoc', query: 'from:yarddoc.com' },
      { name: 'Premier Home Warranty', query: 'from:premierhw.com' },
      { name: 'HomeDesigns AI', query: 'from:homedesigns.ai' },
      { name: 'Handy', query: 'from:handy.com' },
      { name: 'Stanley Steemer', query: 'from:stanleysteemer.com' },
      { name: 'Maid Affordable', query: 'from:ccsend.com from:"Maid Affordable"' },
      { name: 'Five Star Home Delivery', query: 'from:homedelivery.ccsend.com' },
      { name: 'Grass Works Lawn Care', query: 'from:demandforced3.com from:"Grass Works"' },
      { name: 'BY Design Home Staging', query: 'from:bydesignsa.com' },
    ],
  },
  {
    // Spas and salons. All but LaserAway reach the mailbox via Demandforce, whose
    // noreply@ address is shared across merchants, so these key on display name.
    labelName: LABEL_ORG_PROFESSIONAL_BEAUTY,
    orgs: [
      { name: 'milk + honey', query: 'from:milkandhoney.com' },
      { name: 'Illumma', query: 'from:illumma.com' },
      { name: 'exhale Spa', query: 'from:demandforced3.com from:exhale' },
      { name: 'Satori Day Spa', query: 'from:demandforced3.com from:Satori' },
      { name: 'Strands', query: 'from:demandforced3.com from:Strands' },
      { name: 'Aveda Institute', query: 'from:demandforced3.com from:Aveda' },
      { name: 'Driftwood Spa', query: 'from:demandforced3.com from:Driftwood' },
      { name: 'LaserAway', query: 'from:(laseraway.com OR laseraway.co)' },
      { name: 'Pure Body Studio', query: 'from:purebodystudio.com' },
    ],
  },
  {
    // Co-living / co-working operators, all LodgingBusiness. "Digital Nomads" is their
    // audience, not their type, so it lives in schema.keywords as a DefinedTerm rather
    // than as a path segment. Organization.keywords is the one Organization property
    // that accepts DefinedTerm; Organization is outside the domain of both `audience`
    // and the superseded `serviceAudience`, which are Service/Event/LodgingBusiness-only.
    labelName: LABEL_ORG_LODGING_BUSINESS,
    schema: {
      '@type': 'LodgingBusiness',
      keywords: [TERM_DIGITAL_NOMADS],
    },
    orgs: [
      { name: 'Outsite', query: 'from:outsite.co' },
      { name: 'KIMA SURF', query: 'from:kimasurf.com' },
      { name: 'WiFi Tribe', query: 'from:wifitribe.co' },
    ],
  },
  {
    labelName: LABEL_ORG_GOOGLE,
    orgs: [
      { name: 'Google', query: 'from:google.com OR from:youtube.com OR from:gfiber.com OR from:nest.com' },
    ],
  },
  // Google sub-organizations by product line, from a sender audit (2026-08).
  // Small one-off senders (photos, voice, forms, drive shares) stay parent-only.
  {
    labelName: `${LABEL_ORG_GOOGLE}/Calendar`,
    orgs: [
      { name: 'Google Calendar', query: 'from:calendar-notification@google.com' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/Travel`,
    orgs: [
      { name: 'Google Flights', query: 'from:noreply-travel@google.com' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/Scholar`,
    orgs: [
      { name: 'Google Scholar', query: 'from:(scholaralerts-noreply@google.com OR scholarcitations-noreply@google.com)' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/Careers`,
    orgs: [
      { name: 'Google Careers', query: 'from:careers-noreply@google.com' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/Accounts`,
    orgs: [
      { name: 'Google Accounts', query: 'from:(no-reply@accounts.google.com OR noreply-accounts@google.com OR no-reply@google.com)' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/Store & Play`,
    orgs: [
      { name: 'Google Store & Play', query: 'from:(googlestore-noreply@google.com OR googlepixel-noreply@google.com OR googleplay-noreply@google.com OR googleplaypromo-noreply@google.com OR googleone-noreply@google.com)' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/GFiber`,
    orgs: [
      { name: 'GFiber', query: 'from:(gfiber.com OR fiber-support-bounce@google.com)' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/Payments`,
    orgs: [
      { name: 'Google Payments', query: 'from:(payments-noreply@google.com OR googlepay-noreply@google.com OR googlewallet-noreply@google.com)' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/Workspace & Cloud`,
    orgs: [
      { name: 'Google Workspace & Cloud', query: 'from:(workspace-noreply@google.com OR cloud-noreply@google.com OR chrome-noreply@google.com OR googlecloud@google.com)' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/Business Tools`,
    orgs: [
      { name: 'Google Business Tools', query: 'from:(businessprofile-noreply@google.com OR analytics-noreply@google.com OR analytics-reply@google.com OR sc-noreply@google.com OR smbupdates-noreply@google.com OR tagmanager-noreply@google.com)' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/AI`,
    orgs: [
      { name: 'Google AI', query: 'from:(googleaistudio-noreply@google.com OR notebooklm-noreply@google.com OR gemininotebook-noreply@google.com OR google-gemini-noreply@google.com)' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/Developers`,
    orgs: [
      { name: 'Google Developers', query: 'from:(googledev-noreply@google.com OR googledevelopers-noreply@google.com OR cloudplatform-noreply@google.com OR google-maps-platform-noreply@google.com)' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/Home & Nest`,
    orgs: [
      { name: 'Google Home & Nest', query: 'from:(googlehome@google.com OR googlehome-noreply@google.com OR googlenest@google.com OR nest.com)' },
    ],
  },
  {
    labelName: `${LABEL_ORG_GOOGLE}/Health`,
    orgs: [
      { name: 'Google Health', query: 'from:google-health-noreply@google.com' },
    ],
  },
  {
    labelName: LABEL_ORG_HEALTH,
    orgs: [
      { name: 'Labcorp', query: 'from:labcorp.com' },
      { name: 'VSP Vision Care', query: 'from:vsp.com' },
      { name: 'UnitedHealthcare', query: 'from:unitedhealthcare.com OR from:uhc.com' },
      { name: 'SonderMind', query: 'from:sondermind.com' },
      { name: 'CVS', query: 'from:cvs.com' },
      { name: 'Fitbit', query: 'from:fitbit.com' },
      { name: 'FamilyTreeDNA', query: 'from:familytreedna.com' },
      { name: "Barry's Bootcamp", query: 'from:barrys.com' },
      { name: 'ClubReady', query: 'from:clubreadymail.com' },
      { name: 'One Medical', query: 'from:onemedical.com' },
      { name: 'Quest Diagnostics', query: 'from:questdiagnostics.com' },
      { name: 'Ascension Seton', query: 'from:ascension.org' },
      { name: 'Baylor Scott & White', query: 'from:bswhealth.org' },
      { name: 'Family Medicine Austin', query: 'from:phreesia-mail.com OR from:eclinicalmail.com OR from:campaigns.nexhealth.com OR from:thevalorsolution.com' },
      { name: "Total Men's Primary Care", query: 'from:totalmens.com' },
      { name: 'Galileo Medical', query: 'from:galileohealth.com' },
      { name: 'Spruce', query: 'from:sprucehealth.com' },
      { name: 'FastMed', query: 'from:fastmed.com' },
      { name: 'Texas Diabetes', query: 'from:texasdiabetes.com' },
      { name: 'Allergies & Asthma Clinic', query: 'from:allallergies.com' },
      { name: 'WellnessLiving', query: 'from:wellnessliving.com' },
    ],
  },
  {
    labelName: LABEL_ORG_TRAVEL,
    orgs: [
      { name: 'Southwest Airlines', query: 'from:southwest.com' },
      { name: 'Turo', query: 'from:turo.com' },
      { name: 'Aeromexico', query: 'from:(aeromexico.com OR aeromexicorewards.com)' },
      { name: 'Booking.com', query: 'from:booking.com' },
      { name: 'Wild Women Expeditions', query: 'from:wildwomenexpeditions.com' },
      { name: 'Rewilding Guide', query: 'from:rewildinguide.com' },
      { name: 'Delta', query: 'from:delta.com' },
      { name: 'United', query: 'from:united.com' },
      { name: 'American Airlines', query: 'from:aa.com' },
      { name: 'JetBlue', query: 'from:jetblue.com' },
      { name: 'Frontier', query: 'from:flyfrontier.com' },
      { name: 'Copa Airlines', query: 'from:copa.com OR from:email.connectmiles.com' },
      { name: 'Viva Aerobus', query: 'from:vivaaerobus.com' },
      { name: 'Airbnb', query: 'from:airbnb.com' },
      { name: 'Vrbo', query: 'from:vrbo.com' },
      // One Marriott org, five sending paths. The Medallia survey address carries 16
      // distinct hotel properties (Ritz-Carlton, Courtyard, Aloft...) — collapsed to the
      // parent brand rather than 16 labels for 32 messages. Marriott-Bonvoy@ must stay
      // address-scoped: points-mail.com is a platform shared with Southwest.
      {
        name: 'Marriott',
        query: 'from:(marriott.com OR email-marriott.com OR jwmarriott-res.com OR marriott-local-news.com) '
          + 'OR from:marriott@express.medallia.com OR from:Marriott-Bonvoy@points-mail.com',
      },
      { name: 'Hertz', query: 'from:hertz.com' },
      { name: 'Vacasa', query: 'from:vacasa.com' },
      { name: 'Trip.com', query: 'from:trip.com' },
      { name: 'Qatar Airways', query: 'from:qatarairways.com' },
      { name: 'Singapore Airlines', query: 'from:singaporeair.com' },
      { name: 'Lufthansa', query: 'from:lufthansa.com' },
      { name: 'British Airways', query: 'from:britishairways.com OR from:email.ba.com' },
      { name: 'Emirates', query: 'from:emirates.com' },
      { name: 'Air France', query: 'from:airfrance.com OR from:airfrance.fr OR from:enews-airfrance.com' },
      { name: 'Spirit Airlines', query: 'from:spirit.com' },
      { name: 'Alaska Airlines', query: 'from:alaskaair.com' },
      { name: 'Vonlane', query: 'from:vonlane.com' },
      { name: 'Lyft', query: 'from:lyft.com OR from:lyftmail.com' },
      { name: 'Couchsurfing', query: 'from:couchsurfing.com' },
      { name: 'Wikiloc', query: 'from:wikiloc.com' },
    ],
  },
  {
    labelName: LABEL_ORG_AUTOMOTIVE,
    orgs: [
      { name: 'Edmunds', query: 'from:edmunds.com' },
      { name: 'Carvana', query: 'from:carvana.com' },
      { name: 'CarGurus', query: 'from:cargurus.com' },
      { name: 'Kelley Blue Book', query: 'from:kbb.com' },
      { name: 'CarMax', query: 'from:email-carmax.com OR from:carmax.com' },
      { name: 'Autotrader', query: 'from:autotrader.com' },
      { name: 'Cars.com', query: 'from:cars.com' },
      { name: 'CARFAX', query: 'from:carfax.com' },
      { name: 'AutoNation', query: 'from:autonation.com' },
      { name: 'Driveway', query: 'from:driveway.com' },
      { name: 'DealerCenter', query: 'from:dealercenter.net' },
    ],
  },
  {
    // schema.org Corporation. Absorbed the former BigTech and DeveloperTools groups:
    // neither was a schema.org type, and both described the same kind of entity.
    labelName: LABEL_ORG_CORPORATION,
    orgs: [
      { name: 'Sentry', query: 'from:sentry.io' },
      { name: 'Reddit', query: 'from:reddit.com' },
      { name: 'Ubisoft', query: 'from:ubisoft.com' },
      { name: 'PlayStation', query: 'from:playstation.com' },
      { name: 'Disney+', query: 'from:disneyplus.com' },
      { name: 'Apple', query: 'from:apple.com' },
      { name: 'Microsoft', query: 'from:microsoft.com' },
      { name: 'Meta', query: 'from:(meta.com OR facebookmail.com OR facebook.com OR instagram.com)' },
      { name: 'TikTok', query: 'from:tiktok.com' },
      { name: 'Discord', query: 'from:(discord.com OR discordapp.com)' },
      { name: 'Spotify', query: 'from:spotify.com' },
      { name: 'WordPress / Automattic', query: 'from:(wordpress.com OR automattic.com)' },
      // Bare domain, unlike the category filter: an org tag identifies the sender, so
      // account and security mail belongs under it too
      { name: 'OpenAI', query: 'from:openai.com' },
      { name: 'Anthropic', query: 'from:anthropic.com' },
      { name: 'Render', query: 'from:render.com' },
      { name: 'Vercel', query: 'from:vercel.com' },
      { name: 'GitKraken', query: 'from:gitkraken.com' },
      { name: 'Kestra', query: 'from:kestra.io' },
      { name: 'Databricks', query: 'from:databricks.com' },
      { name: 'Whimsical', query: 'from:whimsical.com' },
      { name: 'Reach AI', query: 'from:getreach.ai' },
      { name: 'Supabase', query: 'from:supabase.com' },
      { name: 'PostHog', query: 'from:posthog.com' },
      { name: 'Netlify', query: 'from:netlify.com' },
      { name: 'Doppler', query: 'from:doppler.com' },
      { name: 'Grafana', query: 'from:grafana.com' },
      { name: 'OpenRouter', query: 'from:openrouter.ai' },
      { name: 'PromptLayer', query: 'from:promptlayer.com' },
      { name: 'cloudHQ', query: 'from:cloudhq.net' },
      { name: 'Yubico', query: 'from:yubico.com' },
      { name: 'Zapier', query: 'from:zapier.com' },
      { name: 'DocuSign', query: 'from:docusign.net' },
    ],
  },
  {
    // TaxiService is a schema.org Service subtype, not an Organization one: the segment
    // names the service these corporations provide, not what kind of org they are.
    labelName: LABEL_ORG_CORP_TAXI_SERVICE,
    orgs: [
      { name: 'Uber', query: 'from:uber.com' },
      { name: 'Lyft', query: 'from:lyft.com' },
    ],
  },
  {
    // Bare domain covers both notifications.ring.com and mail.ring.com — Gmail's
    // from: matches subdomains.
    labelName: LABEL_ORG_CORP_AMAZON_RING,
    orgs: [
      { name: 'Ring', query: 'from:ring.com' },
    ],
  },
  {
    // Digital-native businesses: streaming, scrobbling, and subscription publishing.
    // Thesis Driven is deliberately NOT NewsMediaOrganization — schema.org scopes that
    // to "a newspaper or TV station", and Thesis Driven sells industry analysis,
    // workshops and data products rather than reporting news.
    labelName: LABEL_ORG_ONLINE_BUSINESS,
    orgs: [
      { name: 'Thesis Driven', query: 'from:thesisdriven.com' },
      { name: 'Netflix', query: 'from:netflix.com' },
      { name: 'HBO Max', query: 'from:hbomax.com' },
      { name: 'Last.fm', query: 'from:last.fm' },
    ],
  },
  {
    // Training providers. Data Science Dojo was misfiled under the former
    // DeveloperTools group; The Tantra Institute runs paid workshops, so the type is
    // EducationalOrganization and the practice area rides along as a keywords
    // DefinedTerm rather than as a non-schema path segment.
    labelName: LABEL_ORG_EDUCATIONAL,
    orgs: [
      { name: 'MIT', query: 'from:mit.edu' },
      { name: 'Emeritus (Wharton Exec Ed)', query: 'from:emeritus.org' },
      { name: 'Data Science Dojo', query: 'from:datasciencedojo.com' },
      {
        name: 'The Tantra Institute',
        query: 'from:tantrany.com',
        schema: { keywords: [TERM_ALTERNATIVE_PRACTICE] },
      },
      // Cohort mastermind in experience design (applications, artist grants, IDEO /
      // d.school guest sessions). Audited against the Digital Nomads term: zero
      // location-independence signals in any of its mail, so no keywords entry.
      { name: 'Experience House', query: 'from:experiencehouse.co' },
    ],
  },
  {
    // Dance-adjacent domains are usually not PerformingGroup: Fuego is a shoe brand
    labelName: LABEL_ORG_ONLINE_STORE,
    orgs: [
      { name: 'Fuego Dance Shoes', query: 'from:fuegodance.com' },
    ],
  },
  {
    // ZoukMX festival — subOrganization of the Brazilian Zouk Council, which the
    // path records. Not a PerformingGroup: it organizes, it does not perform.
    labelName: LABEL_ORG_SPORTS_ZOUKMX,
    schema: ORG_BZDC,
    orgs: [
      { name: 'ZoukMX', query: 'from:zouk.us' },
    ],
  },
  {
    labelName: LABEL_ORG_GOVERNMENT,
    orgs: [
      { name: 'International Monetary Fund', query: 'from:imf.org' },
      { name: 'USPS', query: 'from:usps.com' },
      { name: 'Healthcare.gov', query: 'from:healthcare.gov' },
      { name: 'State of Texas', query: 'from:(txt.texas.gov OR dps.texas.gov)' },
      { name: 'US House', query: 'from:mail.house.gov' },
    ],
  },
  {
    labelName: LABEL_ORG_LB_STORE_CLOTHING,
    orgs: [
      { name: 'Ruti', query: 'from:ruti.com' },
      { name: 'PAIGE', query: 'from:paige.com' },
      { name: "Margaret O'Leary", query: 'from:margaretoleary.com' },
      { name: 'H&M', query: 'from:hm.com' },
    ],
  },
  {
    labelName: LABEL_ORG_LB_STORE_GROCERY,
    orgs: [
      { name: 'Whole Foods Market', query: 'from:wholefoodsmarket.com' },
      { name: 'Wegmans', query: 'from:wegmans.com' },
    ],
  },
  {
    labelName: LABEL_ORG_LB_STORE_HOMEGOODS,
    orgs: [
      { name: 'Williams Sonoma', query: 'from:williams-sonoma.com' },
    ],
  },
  {
    labelName: LABEL_ORG_LB_FOOD,
    orgs: [
      { name: 'MOD Pizza', query: 'from:modpizza.com' },
      { name: 'Pangloss Cellars', query: 'from:panglosscellars.com' },
    ],
  },
  {
    // A touring house presenting Broadway productions to an audience.
    labelName: LABEL_ORG_PERFORMING_GROUP,
    orgs: [
      { name: 'Broadway San Jose', query: 'from:broadwaysanjose.com' },
    ],
  },
  {
    // Matches the local part, not a domain: this sender has no mail from
    // austinwestieacademy.com at all — it arrives via a unique Mailchimp account
    // subdomain, a shared Mailchimp domain, and its own Gmail account. All 40 messages
    // across the three use the same austinwestieacademy@ local part.
    labelName: LABEL_ORG_EDU_WSDC_AWA,
    schema: {
      '@type': ['LocalBusiness', 'School'],
      knowsAbout: TERM_WEST_COAST_SWING,
      parentOrganization: 'World Swing Dance Council',
    },
    orgs: [
      { name: 'Austin Westie Academy', query: 'from:austinwestieacademy' },
    ],
  },
];


async function run() {
  const skipBackfill = process.argv.includes('--filters-only');
  const onlyLabel = argAfter('--only');
  const onlyOrgs = argAfter('--orgs')?.split(',').map(s => s.trim().toLowerCase());
  const gmail = createGmailClient();
  const tagSet = ORG_TAGS.map(({ labelName, orgs }) => ({ labelName, entries: orgs }));
  const filterCount = await applyTagSet(gmail, tagSet, {
    skipBackfill,
    onlyLabel,
    onlyEntries: onlyOrgs,
  });

  console.log(`\nFilters created: ${filterCount}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
