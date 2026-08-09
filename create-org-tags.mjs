// Organization tags are an informational dimension, orthogonal to category routing:
// a sender's mail may route to Billing, Promotions, or Purchases, but always carries
// the same Organization label. Filters here are label-only — never archive/mark-read.
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
  LABEL_ORG_LC_STORE,
  LABEL_ORG_LC_PERFORMING_GROUP,
  LABEL_ORG_LC_MUSEUM,
  LABEL_ORG_LC_RESEARCH,
  LABEL_ORG_LC_SPORTS,
  LABEL_ORG_DIGITAL_NOMAD,
  LABEL_ORG_GOOGLE,
  LABEL_ORG_HEALTH,
  LABEL_ORG_TRAVEL,
  LABEL_ORG_AUTOMOTIVE,
  LABEL_ORG_DEVELOPER_TOOLS,
  LABEL_ORG_GOVERNMENT,
  LABEL_ORG_BIG_TECH,
} from './lib/constants.mjs';

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
      { name: 'Splitwise', query: 'from:splitwise.com' },
      { name: 'Lemonade', query: 'from:lemonade.com' },
      { name: 'Better', query: 'from:better.com' },
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
      { name: 'DoorDash', query: 'from:doordash.com' },
      { name: 'Instacart', query: 'from:instacart.com' },
    ],
  },
  {
    // Restaurants, grocery and delivery. DoorDash/Instacart also appear in the flat
    // Ecommerce list above; sublabels are independent, so they carry both tags.
    labelName: LABEL_ORG_ECOMMERCE_FOOD,
    orgs: [
      { name: 'Rappi', query: 'from:(rappi.com.co OR rappi.com.mx)' },
      { name: 'Front Porch Pantry', query: 'from:frontporchpantry.com' },
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
      { name: 'Austin Business Journal', query: 'from:bizjournals.com' },
    ],
  },
  {
    labelName: LABEL_ORG_LC_NGO,
    orgs: [
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
      { name: 'BATHE', query: 'from:batheaustin.com' },
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
    labelName: LABEL_ORG_LC_SPORTS,
    orgs: [
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
      { name: 'Virtual Vocations', query: 'from:virtualvocations.com' },
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
      { name: 'Angi', query: 'from:angi.com' },
      { name: 'Handy', query: 'from:handy.com' },
      { name: 'Stanley Steemer', query: 'from:stanleysteemer.com' },
      { name: 'Maid Affordable', query: 'from:ccsend.com from:"Maid Affordable"' },
      { name: 'Five Star Home Delivery', query: 'from:homedelivery.ccsend.com' },
      { name: 'Grass Works Lawn Care', query: 'from:demandforced3.com from:"Grass Works"' },
    ],
  },
  {
    // Spas and salons. All but LaserAway reach the mailbox via Demandforce, whose
    // noreply@ address is shared across merchants, so these key on display name.
    labelName: LABEL_ORG_PROFESSIONAL_BEAUTY,
    orgs: [
      { name: 'exhale Spa', query: 'from:demandforced3.com from:exhale' },
      { name: 'Satori Day Spa', query: 'from:demandforced3.com from:Satori' },
      { name: 'Strands', query: 'from:demandforced3.com from:Strands' },
      { name: 'Aveda Institute', query: 'from:demandforced3.com from:Aveda' },
      { name: 'Driftwood Spa', query: 'from:demandforced3.com from:Driftwood' },
      { name: 'LaserAway', query: 'from:(laseraway.com OR laseraway.co)' },
    ],
  },
  {
    labelName: LABEL_ORG_DIGITAL_NOMAD,
    orgs: [
      { name: 'Outsite', query: 'from:outsite.co' },
      { name: 'KIMA SURF', query: 'from:kimasurf.com' },
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
      { name: 'State of Texas', query: 'from:(txt.texas.gov OR dps.texas.gov)' },
      { name: 'US House', query: 'from:mail.house.gov' },
    ],
  },
  {
    // Consumer-tech platforms without their own org tree (Google has one)
    labelName: LABEL_ORG_BIG_TECH,
    orgs: [
      { name: 'Apple', query: 'from:apple.com' },
      { name: 'Microsoft', query: 'from:microsoft.com' },
      { name: 'Meta', query: 'from:(meta.com OR facebookmail.com OR facebook.com OR instagram.com)' },
      { name: 'TikTok', query: 'from:tiktok.com' },
      { name: 'Discord', query: 'from:(discord.com OR discordapp.com)' },
      { name: 'Spotify', query: 'from:spotify.com' },
      { name: 'WordPress / Automattic', query: 'from:(wordpress.com OR automattic.com)' },
    ],
  },
];

const skipBackfill = process.argv.includes('--filters-only');
const onlyLabel = argAfter('--only');
const onlyOrgs = argAfter('--orgs')?.split(',').map(s => s.trim().toLowerCase());

async function run() {
  const gmail = createGmailClient();
  const tagSet = ORG_TAGS.map(({ labelName, orgs }) => ({ labelName, entries: orgs }));
  const filterCount = await applyTagSet(gmail, tagSet, {
    skipBackfill,
    onlyLabel,
    onlyEntries: onlyOrgs,
  });

  console.log(`\nFilters created: ${filterCount}`);
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
