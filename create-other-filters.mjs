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
  LABEL_PROMOTIONS_TRAVEL,
  LABEL_EVENTS_LOCAL,
  LABEL_EVENTS_PERFORMANCES,
  LABEL_EVENTS_ENTERTAINMENT,
  LABEL_SERVICES_HEALTH,
  LABEL_SERVICES_HOME,
  LABEL_PURCHASES_AMAZON,
  LABEL_BILLING_RECEIPTS,
  LABEL_BILLING_STATEMENTS,
  LABEL_SECURITY_ACCOUNT,
  LABEL_TIME_SENSITIVE,
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
    // Airline/booking marketing domains — transactional mail (reservations, alerts) uses
    // different domains and stays under Travel above
    labelName: LABEL_PROMOTIONS_TRAVEL,
    archive: true,
    filters: [
      { name: 'Delta Marketing', query: 'from:o.delta.com' },
      { name: 'United News & Deals', query: 'from:enews.united.com' },
      { name: 'Copa Airlines', query: 'from:email.copa.com' },
      { name: 'Vrbo Marketing', query: 'from:eg.vrbo.com' },
      { name: 'Rappi', query: 'from:hello.rappi.com.co' },
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
      { name: 'Google Careers', query: 'from:careers-noreply@google.com' },
      { name: 'GrantWatch', query: 'from:grantwatch.com' },
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
      { name: 'Austin Business Journal', query: 'from:(news.bizjournals.com OR engaged.bizjournals.com OR partner.bizjournals.com)' },
      { name: 'Superhuman AI', query: 'from:mail.joinsuperhuman.ai' },
      { name: 'DEV Community', query: 'from:dev.to' },
      { name: 'Apple Developer', query: 'from:insideapple.apple.com' },
      { name: 'Grafana', query: 'from:update@grafana.com' },
      { name: 'Yubico', query: 'from:info.yubico.com' },
      { name: 'Render', query: 'from:dx@render.com' },
      { name: 'Thesis Driven', query: 'from:thesisdriven.com' },
      { name: 'MIT Sloan Thinking Forward', query: 'from:thinkingforward@mit.edu' },
      { name: 'IMF', query: 'from:updates.imf.org' },
      { name: 'F6S', query: 'from:f6s.com' },
      { name: 'Axios Partners', query: 'from:partners@axios.com' },
      { name: 'The Publish Press', query: 'from:mail.thepublishpress.com' },
      { name: 'Google Scholar Alerts', query: 'from:scholaralerts-noreply@google.com' },
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
    // Austin venues & clubs — stay in inbox like the parent Events category (future events)
    labelName: LABEL_EVENTS_LOCAL,
    archive: false,
    filters: [
      { name: 'Tiny Minotaur Tavern', query: 'from:tinyminotaur.com' },
      { name: 'Fallout Theater', query: 'from:fallouttheater.com' },
      { name: 'Museum of Human Achievement', query: 'from:themuseumofhumanachievement.com' },
      { name: 'Austin Westie Academy', query: 'from:austinwestieacademy' },
      { name: 'Open House Austin', query: 'from:openhouseaustin.co' },
      { name: 'Houston Sports & Social Club', query: 'from:houstonssc.com' },
    ],
  },
  {
    labelName: LABEL_EVENTS_PERFORMANCES,
    archive: false,
    filters: [
      { name: 'Broadway San Jose', query: 'from:response.broadwaysanjose.com' },
    ],
  },
  {
    // Streaming/gaming/social notifications — no upcoming dates, safe to archive
    labelName: LABEL_EVENTS_ENTERTAINMENT,
    archive: true,
    filters: [
      { name: 'HBO Max', query: 'from:mail.hbomax.com' },
      { name: 'Steam', query: 'from:steampowered.com' },
      { name: 'Goodreads', query: 'from:mail.goodreads.com' },
      { name: 'X Digests', query: 'from:newsletter@x.com' },
      { name: 'Instagram', query: 'from:mail.instagram.com' },
    ],
  },
  {
    // Medical/appointment mail — must stay in inbox (visit links, confirmations)
    labelName: LABEL_SERVICES_HEALTH,
    archive: false,
    filters: [
      { name: 'Patient Messages (Hightop/Roots)', query: 'from:patient-message.com' },
      { name: "Total Men's Primary Care", query: 'from:mj.totalmens.com' },
      // Shared Constant Contact domain — pin the sender prefix
      { name: 'Northshore Medical', query: 'from:info-nmac.bm@shared1.ccsend.com' },
      { name: 'Genomelink', query: 'from:genomelink.io' },
      { name: 'Google Health', query: 'from:google-health-noreply@google.com' },
    ],
  },
  {
    // Home services marketing/digest mail — label + archive.
    // Ring alerts that need action ("charge your", "action required") are excluded here;
    // the battery nudge is routed to Time Sensitive by the category below instead.
    labelName: LABEL_SERVICES_HOME,
    archive: true,
    filters: [
      { name: 'Ring', query: 'from:(mail.ring.com OR notifications.ring.com) -subject:"charge your" -subject:"action required"' },
      { name: 'Handy', query: 'from:handy.com' },
      { name: 'EnergySage', query: 'from:energysage.com' },
      { name: 'GFiber', query: 'from:outreach.gfiber.com' },
      { name: 'Gaston & Sheehan Auctions', query: 'from:txauction.com' },
      { name: 'Nextdoor', query: 'from:email.nextdoor.com' },
      { name: 'CoStar Listings', query: 'from:c.costarmail.com' },
    ],
  },
  {
    // Money attached (invoices, estimates, statements) + TexasProtax — label only, never archive
    labelName: LABEL_SERVICES_HOME,
    archive: false,
    filters: [
      { name: 'Summit Home & Appliance', query: 'from:summithomeappliance1@gmail.com' },
      { name: 'Housecall Pro (Comax etc.)', query: 'from:notifications@housecallpro.com' },
      { name: 'Critter Control', query: 'from:crittercontrol.com' },
      { name: 'TexasProtax', query: 'from:texasprotax.com' },
    ],
  },
  {
    // Sign-in alerts, device confirmations, account-data notices — label only, stay in inbox
    // (these deserve a "was that me?" glance). PayPal is subject-scoped because service@paypal.com
    // also sends payment receipts.
    labelName: LABEL_SECURITY_ACCOUNT,
    archive: false,
    filters: [
      { name: 'Google Account Notices', query: 'from:noreply-accounts@google.com' },
      { name: 'Samsung Account', query: 'from:samsung-mail.com' },
      { name: 'PayPal Security', query: 'from:service@paypal.com subject:("trusted device" OR "sign in" OR sign-in OR password OR security)' },
    ],
  },
  {
    // Account statements — label + skip inbox. Subject-pinned where the sender domain
    // also carries non-statement mail (e.g. SoFi's o.sofi.org sends card-shipped notices too).
    labelName: LABEL_BILLING_STATEMENTS,
    archive: true,
    filters: [
      { name: 'SoFi Statements', query: 'from:o.sofi.org subject:statement' },
      { name: 'Vanguard Statements', query: 'from:transactional.vanguard.com subject:statement' },
      { name: 'Wells Fargo Statements', query: 'from:notify.wellsfargo.com subject:statement' },
      { name: 'Truist Alerts', query: 'from:message.truist.com' },
    ],
  },
  {
    // Payment receipts — label + skip inbox
    labelName: LABEL_BILLING_RECEIPTS,
    archive: true,
    filters: [
      { name: 'Venmo', query: 'from:venmo@venmo.com' },
      { name: 'Vantaca (HOA)', query: 'from:vantaca.com' },
      { name: 'Square Receipts (ICON etc.)', query: 'from:messaging.squareup.com' },
    ],
  },
  {
    // Amazon order lifecycle — label + skip inbox (receipts live under the label).
    // Deliberately excludes promo senders (amazonmusic.com etc.) by pinning transactional addresses.
    labelName: LABEL_PURCHASES_AMAZON,
    archive: true,
    filters: [
      { name: 'Amazon Orders', query: 'from:(auto-confirm@amazon.com OR order-update@amazon.com)' },
      { name: 'Amazon Shipping', query: 'from:shipment-tracking@amazon.com' },
      { name: 'Amazon Marketplace', query: 'from:marketplace-messages@amazon.com' },
    ],
  },
  {
    // Device alerts that need physical action — flag, keep in inbox, no Home label
    labelName: LABEL_TIME_SENSITIVE,
    archive: false,
    filters: [
      { name: 'Ring Device Battery', query: 'from:(mail.ring.com OR notifications.ring.com) subject:"charge your"' },
    ],
  },
  {
    // Daily practice drip mail — label as Health but archive
    labelName: LABEL_SERVICES_HEALTH,
    archive: true,
    filters: [
      { name: 'ACA WSO Daily Meditation', query: 'from:acawso.org' },
      { name: 'Human Design Daily', query: 'from:office@human.design' },
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
    const combinedQuery = category.applyQuery ?? `(${filterQueries.join(' OR ')}) is:unread${labelClause}`;
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
