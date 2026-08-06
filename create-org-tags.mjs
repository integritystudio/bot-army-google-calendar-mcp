// Organization tags are an informational dimension, orthogonal to category routing:
// a sender's mail may route to Billing, Promotions, or Purchases, but always carries
// the same Organization label. Filters here are label-only — never archive/mark-read.
import { createGmailClient } from './lib/gmail-client.mjs';
import { argAfter } from './lib/cli-utils.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import {
  LABEL_ORG_OPEN_SOURCE,
  LABEL_ORG_FINANCIAL,
  LABEL_ORG_REAL_ESTATE,
  LABEL_ORG_ECOMMERCE,
  LABEL_ORG_LOCAL_COMMUNITY,
  LABEL_ORG_PROFESSIONAL,
  LABEL_ORG_GOOGLE,
  LABEL_ORG_HEALTH,
  LABEL_ORG_TRAVEL,
  LABEL_ORG_AUTOMOTIVE,
  LABEL_ORG_DEVELOPER_TOOLS,
  LABEL_ORG_GOVERNMENT,
} from './lib/constants.mjs';

const BATCH_SIZE = 1000;
const LIST_PAGE_SIZE = 500;
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 3000;

// Gmail intermittently throws FAILED_PRECONDITION / 429 on rapid batch operations
async function withRetry(fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const transient = (error instanceof Error && error.message.includes('Precondition'))
        || (typeof error?.code === 'number' && [429, 500, 503].includes(error.code));
      if (!transient || attempt >= MAX_RETRIES) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
}

const ORG_TAGS = [
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
    ],
  },
  {
    labelName: LABEL_ORG_REAL_ESTATE,
    orgs: [
      { name: 'Zillow', query: 'from:zillow.com' },
      { name: 'Redfin', query: 'from:redfin.com' },
      { name: 'Realtor.com', query: 'from:realtor.com' },
      { name: 'Apartment List', query: 'from:apartmentlist.com' },
      { name: 'RentCafe', query: 'from:rentcafe.com' },
      { name: 'Furnished Finder', query: 'from:furnishedfinder.com' },
      { name: 'Kindred', query: 'from:livekindred.com' },
      { name: 'Keyrenter', query: 'from:keyrenteraustin.com' },
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
      { name: 'Virtual Vocations', query: 'from:virtualvocations.com' },
      { name: 'Lensa', query: 'from:lensa.com' },
      { name: 'A.Team', query: 'from:a.team' },
      { name: 'Idealist', query: 'from:idealist.org' },
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
      { name: 'UnitedHealthcare', query: 'from:unitedhealthcare.com OR from:uhc.com' },
      { name: 'One Medical', query: 'from:onemedical.com' },
      { name: 'Quest Diagnostics', query: 'from:questdiagnostics.com' },
      { name: 'Ascension Seton', query: 'from:ascension.org' },
      { name: 'Baylor Scott & White', query: 'from:bswhealth.org OR from:bswhealth.com' },
      { name: 'Family Medicine Austin', query: 'from:phreesia-mail.com OR from:eclinicalmail.com OR from:campaigns.nexhealth.com OR from:thevalorsolution.com' },
      { name: "Total Men's Primary Care", query: 'from:totalmens.com' },
      { name: 'Galileo Medical', query: 'from:galileohealth.com' },
      { name: 'Spruce', query: 'from:sprucehealth.com' },
      { name: 'FastMed', query: 'from:fastmed.com' },
      { name: 'Texas Diabetes', query: 'from:texasdiabetes.com' },
      { name: 'Allergies & Asthma Clinic', query: 'from:allallergies.com' },
    ],
  },
  {
    labelName: LABEL_ORG_TRAVEL,
    orgs: [
      { name: 'Southwest Airlines', query: 'from:southwest.com' },
      { name: 'Delta', query: 'from:delta.com' },
      { name: 'United', query: 'from:united.com' },
      { name: 'American Airlines', query: 'from:aa.com' },
      { name: 'JetBlue', query: 'from:jetblue.com' },
      { name: 'Frontier', query: 'from:flyfrontier.com' },
      { name: 'Copa Airlines', query: 'from:copa.com OR from:email.connectmiles.com' },
      { name: 'Viva Aerobus', query: 'from:vivaaerobus.com' },
      { name: 'Airbnb', query: 'from:airbnb.com' },
      { name: 'Vrbo', query: 'from:vrbo.com' },
      { name: 'Marriott', query: 'from:email-marriott.com OR from:marriott.com' },
      { name: 'Hertz', query: 'from:hertz.com' },
      { name: 'Vacasa', query: 'from:vacasa.com' },
      { name: 'Trip.com', query: 'from:trip.com' },
      { name: 'Qatar Airways', query: 'from:qatarairways.com' },
      { name: 'Singapore Airlines', query: 'from:singaporeair.com' },
      { name: 'Lufthansa', query: 'from:lufthansa.com' },
      { name: 'British Airways', query: 'from:britishairways.com OR from:email.ba.com' },
      { name: 'Emirates', query: 'from:emirates.com' },
      { name: 'Air France', query: 'from:airfrance.com OR from:airfrance.fr' },
      { name: 'Spirit Airlines', query: 'from:spirit.com' },
      { name: 'Alaska Airlines', query: 'from:alaskaair.com' },
      { name: 'Vonlane', query: 'from:vonlane.com' },
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
    // Commercial developer-platform vendors — distinct from OpenSource foundations/registries
    labelName: LABEL_ORG_DEVELOPER_TOOLS,
    orgs: [
      { name: 'Render', query: 'from:render.com' },
      { name: 'Supabase', query: 'from:supabase.com' },
      { name: 'PostHog', query: 'from:posthog.com' },
      { name: 'Netlify', query: 'from:netlify.com' },
      { name: 'Doppler', query: 'from:doppler.com' },
      { name: 'Grafana', query: 'from:grafana.com' },
      { name: 'OpenRouter', query: 'from:openrouter.ai' },
      { name: 'PromptLayer', query: 'from:promptlayer.com' },
      { name: 'Anthropic', query: 'from:anthropic.com' },
      { name: 'cloudHQ', query: 'from:cloudhq.net' },
      { name: 'Yubico', query: 'from:yubico.com' },
    ],
  },
  {
    labelName: LABEL_ORG_GOVERNMENT,
    orgs: [
      { name: 'USPS', query: 'from:usps.com' },
      { name: 'State of Texas', query: 'from:txt.texas.gov' },
      { name: 'US House', query: 'from:mail.house.gov' },
    ],
  },
];

const skipBackfill = process.argv.includes('--filters-only');
const onlyLabel = argAfter('--only');
const onlyOrgs = argAfter('--orgs')?.split(',').map(s => s.trim().toLowerCase());

async function labelAllMatching(gmail, query, labelId) {
  let total = 0;
  let pageToken;
  do {
    const res = await withRetry(() => gmail.users.messages.list({
      userId: 'me', q: query, maxResults: LIST_PAGE_SIZE, pageToken,
    }));
    const ids = (res.data.messages || []).map(m => m.id);
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE);
      await withRetry(() => gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: { ids: chunk, addLabelIds: [labelId] },
      }));
    }
    total += ids.length;
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return total;
}

async function run() {
  const gmail = createGmailClient();
  let filterCount = 0;

  for (const tag of ORG_TAGS) {
    if (onlyLabel && !tag.labelName.startsWith(onlyLabel)) continue;
    console.log(`\n${tag.labelName.toUpperCase()}`);
    const labelId = await ensureLabelExists(gmail, tag.labelName);

    for (const org of tag.orgs) {
      if (onlyOrgs && !onlyOrgs.includes(org.name.toLowerCase())) continue;
      const filterId = await withRetry(() => createGmailFilter(gmail, { query: org.query }, { addLabelIds: [labelId] }));
      if (filterId) filterCount++;

      let backfilled = 0;
      if (!skipBackfill) {
        backfilled = await labelAllMatching(gmail, `(${org.query}) -label:"${tag.labelName}"`, labelId);
      }
      console.log(`  ${filterId ? '✓' : '~'} ${org.name}${backfilled ? ` (+${backfilled} tagged)` : ''}`);
    }
  }

  console.log(`\nFilters created: ${filterCount}`);
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
