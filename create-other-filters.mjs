/**
 * Create Gmail filters for uncategorized "Other" emails.
 * Covers: GitHub, Real Estate, Job Search, Finance, Shopping, Travel,
 * LinkedIn digests, Newsletters, Advocacy, Calendar notifications,
 * Local Austin events, Health/Wellness, and Utilities.
 *
 * Usage:
 *   node create-other-filters.mjs                       # all categories
 *   node create-other-filters.mjs --only "Promotions"   # only categories whose label starts with the prefix
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';
import { BANNER } from './lib/console-utils.mjs';
import {
  GMAIL_INBOX,
  GMAIL_UNREAD,
  LABEL_FORUMS,
  LABEL_SERVICES,
  LABEL_BILLING,
  LABEL_PRODUCT_UPDATES,
  LABEL_EVENTS,
  LABEL_NEWSLETTERS,
  LABEL_JOB_SEARCH,
  LABEL_TRAVEL,
  LABEL_ADVOCACY,
  LABEL_PROMOTIONS_RETAIL,
  LABEL_PROMOTIONS_BEAUTY,
  LABEL_PROMOTIONS_FOOD,
  LABEL_PROMOTIONS_FINANCIAL,
  LABEL_AUTOMOTIVE_SHOPPING,
  LABEL_AUTOMOTIVE_INSURANCE,
} from './lib/constants.mjs';

/**
 * Each category:
 *   labelName     — existing or new label constant
 *   filters       — array of { name, query } for createGmailFilter
 *   archive       — remove from INBOX when applying (default true)
 *   markRead      — also strip UNREAD when applying (default false)
 *   applyQuery    — override the backfill query (default: join all filter queries with OR + is:unread)
 */
const CATEGORIES = [
  {
    labelName: LABEL_FORUMS,
    archive: true,
    markRead: true,
    filters: [
      { name: 'GitHub Notifications', query: 'from:notifications@github.com' },
      { name: 'GitHub Account', query: 'from:github.com' },
    ],
  },
  {
    labelName: LABEL_SERVICES,
    archive: true,
    filters: [
      { name: 'Zillow', query: 'from:mail.zillow.com' },
      { name: 'Zillow Rental Manager', query: 'from:zillowrentals.com' },
      { name: 'Redfin', query: 'from:redfin.com' },
      { name: 'Realtor.com', query: 'from:e.mail.realtor.com' },
      { name: 'Apartment List', query: 'from:emp.apartmentlist.com' },
      { name: 'USPS Informed Delivery', query: 'from:email.informeddelivery.usps.com' },
      { name: 'Texas Gas Service', query: 'from:texasgasservice.com' },
      { name: 'City of Austin Utilities', query: 'from:coautilities.com' },
      { name: 'Quest Diagnostics', query: 'from:e.questdiagnostics.com' },
      { name: 'Ascension Seton', query: 'from:communication.ascension.org' },
      { name: 'One Medical', query: 'from:access.onemedical.com' },
    ],
  },
  {
    labelName: LABEL_BILLING,
    archive: true,
    filters: [
      { name: 'Experian', query: 'from:(e.usa.experian.com OR s.usa.experian.com OR experian.com)' },
      { name: 'Equifax', query: 'from:(e.equifax.com OR equifax.com)' },
      { name: 'Credit Karma', query: 'from:(notifications.creditkarma.com OR mail.creditkarma.com)' },
      { name: 'Coinbase', query: 'from:mail.coinbase.com' },
      { name: 'Kraken', query: 'from:email.kraken.com' },
      { name: 'Chase', query: 'from:(chase.com OR mcmap.chase.com)' },
      { name: 'Ally', query: 'from:(email.ally.com OR email.ally-invest.com)' },
      { name: 'Robinhood', query: 'from:robinhood.com' },
      { name: 'Charles Schwab', query: 'from:(email.schwab.com OR mail.schwab.com)' },
      { name: 'PayPal', query: 'from:news.paypal.com' },
      { name: 'American Express', query: 'from:(member.americanexpress.com OR welcome.americanexpress.com)' },
    ],
  },
  {
    labelName: LABEL_PRODUCT_UPDATES,
    archive: true,
    filters: [
      { name: 'Poshmark', query: 'from:(poshmark.com)' },
      { name: 'Amazon Promo', query: 'from:(amazon.com) subject:(sale OR deal OR offer OR savings OR "% off" OR promo OR coupon)' },
      { name: 'Zappos', query: 'from:emails.zappos.com' },
      { name: 'Etsy', query: 'from:email.etsy.com' },
      { name: 'Best Buy', query: 'from:email.bestbuy.com' },
      { name: 'Bed Bath & Beyond', query: 'from:promotion.bedbathandbeyond.com' },
      { name: 'AllModern', query: 'from:members.allmodern.com' },
      { name: 'Groupon', query: 'from:(r.groupon.com)' },
      { name: 'Gibbons Company', query: 'from:gibbons.bm' },
      { name: 'Blinds.com', query: 'from:email.blinds.com' },
      { name: 'Homary', query: 'from:homary.com' },
      { name: 'Nespresso', query: 'from:email.nespresso.com' },
      { name: 'UPS Promo', query: 'from:emails.ups.com' },
      { name: 'LinkedIn Digests', query: 'from:em.linkedin.com' },
      { name: 'Global Sources', query: 'from:(globalsources.com)' },
      { name: 'Pottery Barn', query: 'from:e.potterybarn.com' },
    ],
  },
  {
    labelName: LABEL_TRAVEL,
    archive: false,
    filters: [
      { name: 'Southwest Airlines', query: 'from:iluv.southwest.com' },
      { name: 'Frontier Airlines', query: 'from:emails.flyfrontier.com' },
      { name: 'JetBlue', query: 'from:marketing.jetblue.com' },
      { name: 'Airbnb', query: 'from:airbnb.com' },
      { name: 'Hertz', query: 'from:emails.hertz.com' },
      { name: 'Marriott', query: 'from:email-marriott.com' },
      { name: 'Vacasa', query: 'from:e.vacasa.com' },
      { name: 'Virgin Red', query: 'from:rewards.red.virgin.com' },
      { name: 'Vonlane', query: 'from:vonlane.com' },
      { name: 'Viva Aerobus', query: 'from:newsletter.vivaaerobus.com' },
      { name: 'ConnectMiles', query: 'from:email.connectmiles.com' },
      { name: 'MileagePlus Dining', query: 'from:email.rewardsnetwork.com' },
      { name: 'MileagePlus Shopping', query: 'from:mileageplusshoppingnews.com' },
      { name: 'WeSalute Travel', query: 'from:(wesalute.com)' },
      { name: 'Google Flights Alerts', query: 'from:google.com subject:"tracked route"' },
      { name: 'Trip.com', query: 'from:newsletter.trip.com' },
      { name: 'Under30 Experiences', query: 'from:under30experiences.com' },
    ],
  },
  {
    labelName: LABEL_JOB_SEARCH,
    archive: false,
    filters: [
      { name: 'Glassdoor Jobs', query: 'from:glassdoor.com' },
      { name: 'LinkedIn', query: 'from:linkedin.com' },
      { name: 'Backstage', query: 'from:backstage.com' },
      { name: 'Virtual Vocations', query: 'from:(email.virtualvocations.com OR alerts.virtualvocations.com)' },
      { name: 'PostJobFree', query: 'from:postjobfree.com' },
      { name: 'Indeed', query: 'from:(indeed.com OR match.indeed.com)' },
      { name: 'Idealist', query: 'from:idealist.org' },
    ],
  },
  {
    labelName: LABEL_NEWSLETTERS,
    archive: false,
    filters: [
      { name: 'Substack', query: 'from:substack.com' },
      { name: 'Beehiiv', query: 'from:mail.beehiiv.com' },
      { name: 'Mozilla Ten Tabs', query: 'from:mail.mozilla.org' },
      { name: 'SmartBrief', query: 'from:smartbrief.com' },
      { name: 'Built In', query: 'from:builtin.com' },
      { name: 'MIT Sloan AI at Work', query: 'from:mit.edu subject:"AI AT WORK"' },
      { name: 'Austin Business Journal', query: 'from:(news.bizjournals.com OR engaged.bizjournals.com)' },
    ],
  },
  {
    labelName: LABEL_ADVOCACY,
    archive: true,
    filters: [
      { name: 'DLCC', query: 'from:dlcc.org' },
      { name: 'Congressman Doggett', query: 'from:mail.house.gov' },
      { name: 'Inside Books Project', query: 'from:insidebooksproject.org' },
      { name: 'Obama Foundation', query: 'from:email.obama.org' },
    ],
  },
  {
    labelName: LABEL_EVENTS,
    archive: false,
    filters: [
      { name: 'Neill-Cochran Museum', query: 'from:shared1.ccsend.com from:Neill-Cochran' },
      { name: 'ColdTowne Theater', query: 'from:coldtowne.ccsend.com' },
      { name: 'UT Austin Events', query: 'from:utexas.edu subject:(event OR lecture OR register OR workshop)' },
      { name: 'Environmental Science Institute', query: 'from:environmentalscienceinstitute.ccsend.com' },
      { name: 'The Concourse Project', query: 'from:concourseproject.com' },
      { name: 'Texas Exes', query: 'from:texasexesemail.com' },
      { name: 'dadageek', query: 'from:dadageek.com' },
      { name: 'Eventbrite Campaigns', query: 'from:campaign.eventbrite.com' },
      { name: 'Salem Center', query: 'from:mccombs.utexas.edu subject:event' },
      { name: 'Meetup', query: 'from:(email.meetup.com OR meetup.com)' },
      { name: 'Austin Pets Alive', query: 'from:austinpetsalive.org' },
      { name: 'Austin Alchemist', query: 'from:theaustinalchemist.com' },
      { name: 'Lumos Fitness', query: 'from:lumosfc.com' },
      { name: 'UT Austin Announcements', query: 'from:(econnect.utexas.edu OR austin.utexas.edu)' },
    ],
  },
  {
    labelName: LABEL_PROMOTIONS_RETAIL,
    archive: true,
    filters: [
      { name: 'Wayfair', query: 'from:(members.wayfair.com OR service.wayfair.com)' },
      { name: 'Quince', query: 'from:mail.quince.com' },
      { name: 'Ruti', query: 'from:ruti.com' },
      { name: "Margaret O'Leary", query: 'from:margaretoleary.com' },
      { name: 'Tuft & Needle', query: 'from:news.tuftandneedle.com' },
      { name: 'Home Depot Deals', query: 'from:mg.homedepot.com' },
      { name: 'Mary & Jane', query: 'from:shopmaryandjane.com' },
      { name: 'adidas', query: 'from:us-news.adidas.com' },
      { name: 'Audible Promos', query: 'from:mail.audible.com' },
      { name: 'Amazon Music', query: 'from:amazonmusic.com' },
      { name: 'Kiwi Drug', query: 'from:kiwidrug.com' },
      { name: 'Whole30', query: 'from:headquarters@whole30.com' },
      { name: 'Stanley Steemer', query: 'from:email.stanleysteemer.com' },
    ],
  },
  {
    labelName: LABEL_PROMOTIONS_BEAUTY,
    archive: true,
    filters: [
      { name: 'LaserAway', query: 'from:laseraway.com' },
      { name: 'milk + honey', query: 'from:milkandhoney.com' },
      // Shared marketing-platform domains — pin the full address so other merchants on the platform don't match
      { name: 'Driftwood Spa', query: 'from:Driftwood@demandforced3.com' },
      { name: 'Dolce Blu', query: 'from:noreply@hirefrederick.com' },
    ],
  },
  {
    // Marketing-only sender domains — statements/alerts use separate domains
    // (o.sofi.org, notify.wellsfargo.com, transactional.vanguard.com) and must stay in inbox
    labelName: LABEL_PROMOTIONS_FINANCIAL,
    archive: true,
    filters: [
      { name: 'NerdWallet', query: 'from:mail.nerdwallet.com' },
      { name: 'SoFi Marketing', query: 'from:(m.sofi.org OR r.sofi.com)' },
      { name: 'USAA Offers', query: 'from:(Perks@mem.usaa.com OR USAABank@exmac.usaa.com)' },
      { name: 'Wells Fargo Offers', query: 'from:mail1.wellsfargo.com' },
      { name: 'Vanguard Digital Advisor', query: 'from:e-vanguard.com' },
      { name: 'CNN Subscriptions', query: 'from:email.cnn.com' },
    ],
  },
  {
    labelName: LABEL_AUTOMOTIVE_SHOPPING,
    archive: true,
    filters: [
      { name: 'Edmunds', query: 'from:email.edmunds.com' },
      { name: 'Cars.com', query: 'from:em.cars.com' },
      { name: 'Carvana', query: 'from:(mail.carvana.com OR vehicles.carvana.com)' },
      { name: 'CARFAX', query: 'from:no-reply.carfax.com' },
      { name: 'Driveway', query: 'from:email.driveway.com' },
    ],
  },
  {
    labelName: LABEL_AUTOMOTIVE_INSURANCE,
    archive: true,
    filters: [
      { name: 'GEICO', query: 'from:e.geico.com' },
    ],
  },
  {
    labelName: LABEL_PROMOTIONS_FOOD,
    archive: true,
    filters: [
      { name: 'Hopdoddy', query: 'from:hopdoddy@emails.thanx.com' },
      { name: 'MOD Pizza', query: 'from:offers@modpizza.com' },
      { name: 'Northside Wine & Spirits', query: 'from:northsidewine.com' },
    ],
  },
  {
    // Google Calendar email notifications — archive + mark read silently
    labelName: null,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Google Calendar Notifications', query: 'from:calendar-notification@google.com' },
    ],
  },
];

const argAfter = flag => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : null;
};

async function run() {
  const onlyPrefix = argAfter('--only');
  const gmail = createGmailClient();

  console.log('CREATING OTHER CATEGORY FILTERS\n');
  console.log(BANNER + '\n');

  let totalFilters = 0;
  let totalEmails = 0;

  for (const category of CATEGORIES) {
    if (onlyPrefix && !(category.labelName ?? '').startsWith(onlyPrefix)) continue;
    const displayName = category.labelName ?? 'Auto-archive (no label)';
    console.log(`\n${displayName.toUpperCase()}`);

    const labelId = category.labelName
      ? await ensureLabelExists(gmail, category.labelName).catch(err => {
          console.warn(`  Warning: ${err.message}`);
          return null;
        })
      : null;

    if (category.labelName && !labelId) continue;

    const filterQueries = [];

    for (const filter of category.filters) {
      const action = {
        ...(labelId ? { addLabelIds: [labelId] } : {}),
        ...(category.archive ? { removeLabelIds: [GMAIL_INBOX] } : {}),
      };
      const filterId = await createGmailFilter(gmail, { query: filter.query }, action);
      console.log(`  ${filterId ? '✓' : '~'} ${filter.name}`);
      if (filterId) totalFilters++;
      filterQueries.push(`(${filter.query})`);
    }

    const labelClause = category.labelName && !category.archive ? ` -label:"${category.labelName}"` : '';
    const combinedQuery = `(${filterQueries.join(' OR ')}) is:unread${labelClause}`;
    const modifications = {
      ...(labelId ? { addLabelIds: [labelId] } : {}),
      ...(category.archive ? { removeLabelIds: [GMAIL_INBOX] } : {}),
      ...(category.markRead ? { removeLabelIds: [...(category.archive ? [GMAIL_INBOX] : []), GMAIL_UNREAD] } : {}),
    };

    const count = await searchAndModify(gmail, combinedQuery, modifications, 500);
    if (count > 0) {
      console.log(`  → ${count} existing emails processed`);
      totalEmails += count;
    }
  }

  console.log('\n' + BANNER);
  console.log(`Filters created: ${totalFilters} | Emails processed: ${totalEmails}`);
  console.log(BANNER + '\n');
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
