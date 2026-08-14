/**
 * Create every Gmail routing filter and backfill existing mail into its label.
 * Single source of truth for category routing: CATEGORIES below is the list.
 *
 * Usage:
 *   node create-filters.mjs                       # all categories
 *   node create-filters.mjs --only "Promotions"   # only categories whose label starts with the prefix
 *   node create-filters.mjs --dry-run             # print the create/delete plan without mutating
 *   node create-filters.mjs --prune               # also delete stale filters (see diffFilters)
 */
import { pathToFileURL } from 'node:url';
import { createGmailClient } from './lib/gmail-client.mjs';
import {
  ensureLabelExists,
  createGmailFilter,
  deleteGmailFilter,
  diffFilters,
  chunkQueries,
} from './lib/gmail-filter-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';
import { withRetry } from './lib/gmail-retry.mjs';
import { BANNER } from './lib/console-utils.mjs';
import { argAfter, hasFlag } from './lib/cli-utils.mjs';
import {
  GMAIL_INBOX,
  GMAIL_UNREAD,
  DEFAULT_MAX_RESULTS,
  LABEL_SENTRY,
  LABEL_EVENTS_MEETUP,
  LABEL_COMMUNITY_EVENTS,
  LABEL_CALENDLY_NOTIFICATIONS,
  LABEL_LINKEDIN_UPDATES,
  LABEL_DMARC_REPORTS,
  LABEL_MEETING_NOTES,
  LABEL_MONITORING,
  LABEL_FORUMS,
  LABEL_SERVICES,
  LABEL_BILLING,
  LABEL_PRODUCT_UPDATES,
  LABEL_PRODUCT_UPDATES_DEV_TOOLS,
  LABEL_PRODUCT_UPDATES_DATA,
  LABEL_PRODUCT_UPDATES_CREDIT_REPORT,
  LABEL_EVENTS,
  LABEL_EVENTS_LUMA,
  LABEL_EVENTS_CALENDAR_NOTIFICATIONS,
  LABEL_EVENTS_DANCE,
  LABEL_SERVICES_REAL_ESTATE,
  LABEL_SERVICES_UTILITIES,
  LABEL_NEWSLETTERS,
  LABEL_JOB_SEARCH,
  LABEL_JOB_SEARCH_LINKEDIN,
  LABEL_JOB_SEARCH_GLASSDOOR,
  LABEL_JOB_SEARCH_BACKSTAGE,
  LABEL_JOB_SEARCH_INDEED,
  LABEL_JOB_SEARCH_OTHER,
  LABEL_TRAVEL,
  LABEL_ADVOCACY,
  LABEL_ADVOCACY_POLITICAL,
  LABEL_ADVOCACY_NONPROFIT,
  LABEL_ADVOCACY_CCV_BOARD,
  LABEL_COMMUNITIES,
  LABEL_PERSONAL_CORRESPONDENCE,
  LABEL_PERSONAL_SELF_CORRESPONDENCE,
  LABEL_LEGAL,
  LABEL_PROMOTIONS_RETAIL,
  LABEL_PROMOTIONS_BEAUTY,
  LABEL_PROMOTIONS,
  LABEL_PROMOTIONS_FOOD,
  LABEL_PROMOTIONS_HEALTH,
  LABEL_EVENTS_AI_MONTHLY,
  LABEL_EVENTS_CONVENTIONS_TECH,
  LABEL_EVENTS_TECH,
  LABEL_PROMOTIONS_FINANCIAL,
  LABEL_PROMOTIONS_ENTERTAINMENT,
  LABEL_PROMOTIONS_TECH,
  LABEL_AUTOMOTIVE_SHOPPING,
  LABEL_AUTOMOTIVE_INSURANCE,
  LABEL_PROMOTIONS_TRAVEL,
  LABEL_EVENTS_LOCAL,
  LABEL_EVENTS_PERFORMANCES,
  LABEL_EVENTS_ENTERTAINMENT,
  LABEL_SERVICES_HEALTH,
  LABEL_SERVICES_HOME,
  LABEL_SERVICES_USPS,
  LABEL_SERVICES_RENTAL_OPS,
  LABEL_PURCHASES_AMAZON,
  LABEL_BILLING_RECEIPTS,
  LABEL_BILLING_STATEMENTS,
  LABEL_BILLING_MARKET_ALERTS,
  LABEL_BILLING_CREDIT_MONITORING,
  LABEL_SECURITY_ACCOUNT,
  LABEL_VOICEMAIL,
  LABEL_NETWORKING,
  LABEL_NEWSLETTERS_CIVIC_AUSTIN,
  LABEL_NEWSLETTERS_DEVELOPER,
  LABEL_NEWSLETTERS_NEWS,
  LABEL_NEWSLETTERS_LEGAL,
  LABEL_NEWSLETTERS_PERSONAL_DEV,
  LABEL_TIME_SENSITIVE,
  LABEL_KEEP_IMPORTANT,
  LABEL_CAREER_OPPORTUNITY,
  LABEL_CAREER_FELLOWSHIP_INVITE,
  LABEL_EVENTS_CLASSES,
  USER_ID,
} from './lib/constants.mjs';

/**
 * Each category:
 *   labelName     — existing or new label constant
 *   extraLabels   — additional labels applied alongside labelName (e.g. Keep Important)
 *   filters       — array of { name, query } for createGmailFilter; a filter may set
 *                   its own markRead to override the category's
 *   archive       — remove from INBOX when applying (default true)
 *   markRead      — also strip UNREAD when applying (default false)
 *   includeRead   — backfill read mail too (default: unread only)
 *   maxResults    — cap the backfill sweep (default: page to exhaustion)
 *   consolidate   — merge the per-sender entries into OR-joined chunk filters
 *                   (Gmail caps accounts at 1,000 filters). Entries stay one per
 *                   sender in this config; only the live filters merge. APPEND new
 *                   senders — mid-list inserts shift chunk boundaries and churn
 *                   filters on the next sync. Incompatible with per-filter markRead.
 */
const BACKFILL_PAGE_NARROW = 200;
// SolutionPeople sends ~3x/week across four offerings. Subject matching partitions them
// cleanly; body matching cannot, because 44% of the mail cross-sells every offering in the
// footer. Plural forms are spelled out because Gmail phrase matching is token-based and
// does not stem — "AI Innovation Summit" alone misses the "…Summits" news releases.
const SOLUTIONMAN = 'from:solutionman@solutionpeople.ccsend.com';
const SOLUTIONMAN_MONTHLY =
  'subject:("AI Innovation Summit" OR "AI Innovation Summits" OR "Networking on Zoom" OR "Network On Zoom" OR "AI Summit")';
const SOLUTIONMAN_CONVENTIONS =
  'subject:(Thinkathon OR "Global Founders" OR GFIS OR "AI Con USA")';
const SOLUTIONMAN_PROMOS =
  'subject:("Networking Mastery" OR "LinkedIn Group" OR "LinkedIn Groups" OR "Linkedin Groups" OR "HR and Training Professionals" OR "HR and Training Innovators Group")';

// Exported so backfill/drain scripts can import the definitions without executing run()
export const CATEGORIES = [
  {
    labelName: LABEL_FORUMS,
    archive: true,
    markRead: true,
    filters: [
      { name: 'GitHub Notifications', query: 'from:notifications@github.com' },
      { name: 'GitHub Account', query: 'from:github.com' },
      { name: 'Quora Digest', query: 'from:quora.com' },
    ],
  },
  {
    labelName: LABEL_SERVICES,
    archive: true,
    filters: [
      { name: 'FoundersCard', query: 'from:memberservices@founderscard.com' },
      { name: 'Link', query: 'from:notifications@link.com' },
      { name: 'Heroku', query: 'from:bot@notifications.heroku.com' },
      { name: 'American Best', query: 'from:upcoming@americanbestech.com' },
      { name: 'Zillow', query: 'from:mail.zillow.com' },
      { name: 'Zillow Rental Manager', query: 'from:zillowrentals.com' },
      { name: 'Redfin', query: 'from:redfin.com' },
      { name: 'Realtor.com', query: 'from:e.mail.realtor.com' },
      { name: 'Apartment List', query: 'from:emp.apartmentlist.com' },
      // Texas Gas Service and City of Austin Utilities moved to Services & Alerts/Utilities,
      // which keeps bills in the inbox instead of archiving them here
      { name: 'Quest Diagnostics', query: 'from:e.questdiagnostics.com' },
      { name: 'Ascension Seton', query: 'from:communication.ascension.org' },
      { name: 'One Medical', query: 'from:access.onemedical.com' },
      { name: 'Texas.gov Notifications', query: 'from:(txt.texas.gov OR dps.texas.gov)' },
    ],
  },
  {
    labelName: LABEL_BILLING,
    archive: true,
    filters: [
      // e.usa.experian.com is marketing and routes to Product Updates/Credit Report;
      // bare experian.com already covers s.usa.experian.com as a subdomain
      { name: 'Experian', query: 'from:experian.com -from:e.usa.experian.com' },
      { name: 'Equifax', query: 'from:(e.equifax.com OR equifax.com)' },
      { name: 'Credit Karma', query: 'from:(notifications.creditkarma.com OR mail.creditkarma.com)' },
      { name: 'Coinbase', query: 'from:mail.coinbase.com' },
      // mcmap.chase.com is Chase's marketing subdomain (preapproval/product-pitch mail);
      // excluded here rather than routed by a second combined entry so a chase.com
      // sender never needs listing twice — see the Netflix entry for the same idiom
      { name: 'Chase', query: 'from:chase.com -from:mcmap.chase.com' },
      { name: 'Charles Schwab', query: 'from:(email.schwab.com OR mail.schwab.com)' },
      // member.americanexpress.com only: welcome.americanexpress.com (onboarding/card-arrived)
      // is marketing and routes to Promotions/Financial
      { name: 'American Express', query: 'from:member.americanexpress.com' },
      // notify.wellsfargo.com and customerfeedback.wellsfargo.com send both transactional
      // and marketing mail from the same address and can't be split by domain — subject-pin
      // if that becomes worth doing (see Wells Fargo Statements below). mail2.wellsfargorewards.com
      // and mail.accountoffers.wellsfargo.com are marketing-only and route to Promotions/Financial.
      { name: 'Wells Fargo', query: 'from:(notify.wellsfargo.com OR customerfeedback.wellsfargo.com)' },
      { name: 'USAA', query: 'from:(omem.usaa.com OR mem.usaa.com OR mailcenter.usaa.com OR protect.usaa.com)' },
      // transactional.vanguard.com only: bare vanguard.com (VBS@vanguard.com options-account
      // pitches etc.) is marketing and routes to Promotions/Financial
      { name: 'Vanguard', query: 'from:transactional.vanguard.com' },
      { name: 'Ally Alerts', query: 'from:(alert.ally.com OR alerts.ally.com)' },
      { name: 'PayPal Service', query: 'from:(service.paypal.com OR communications.paypal.com OR service@paypal.com)' },
      // notificationmycredit-guide/feedbackemail only: email.americanexpress.com's offer
      // mail is marketing and routes to Promotions/Financial
      { name: 'Amex Credit & Feedback', query: 'from:(notificationmycredit-guide.americanexpress.com OR feedbackemail.americanexpress.com)' },
      { name: 'Credit Karma Reminders', query: 'from:(reminder.creditkarma.com OR savings.creditkarma.com)' },
      { name: 'SoFi', query: 'from:o.sofi.org' },
      { name: 'E-Trade', query: 'from:etrade.com' },
      { name: 'Charles Schwab Corporate', query: 'from:schwab.com' },
      { name: 'Progressive Leasing', query: 'from:t.progleasing.com' },
      { name: 'Coinbase Info', query: 'from:info.coinbase.com' },
      { name: 'Venmo Updates', query: 'from:email.venmo.com' },
    ],
  },
  {
    // Luma event invites & digests — label only, future events may need attention
    labelName: LABEL_EVENTS_LUMA,
    archive: false,
    filters: [
      { name: 'Luma (all sending domains)', query: 'from:(user.luma-mail.com OR calendar.luma-mail.com OR luma-mail.com)' },
    ],
  },
  {
    // Developer tooling release notes. Whimsical is a diagramming tool rather than a
    // dev tool proper, but it is used the same way and does not warrant a label of its own.
    labelName: LABEL_PRODUCT_UPDATES_DEV_TOOLS,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Vercel', query: 'from:vercel.com' },
      { name: 'GitKraken', query: 'from:gitkraken.com' },
      { name: 'Kestra', query: 'from:kestra.io' },
      { name: 'Whimsical', query: 'from:whimsical.com' },
      { name: 'Postman', query: 'from:notifications@mail.postman.com' },
      { name: 'Resend', query: 'from:zeno@updates.resend.com' },
      { name: 'Render Outreach', query: 'from:anurag.goel@render.com' },
    ],
  },
  {
    labelName: LABEL_PRODUCT_UPDATES_DATA,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Databricks', query: 'from:mkt.databricks.com' },
      { name: 'Mixpanel', query: 'from:(support@mixpanel.com OR content@mixpanel.com)' },
      { name: 'Google Analytics', query: 'from:analytics-noreply@google.com' },
      { name: 'DataHub', query: 'from:no-reply@comms.datahub.com' },
    ],
  },
  {
    labelName: LABEL_PRODUCT_UPDATES,
    archive: true,
    markRead: true,
    filters: [
      { name: 'AI product announcements', query: 'from:(noreply@email.openai.com OR no-reply@email.claude.com OR googlecloud@google.com OR lukak@storylane.io)' },
      { name: 'Google Workspace', query: 'from:workspace-noreply@google.com' },
      { name: 'Google Cloud Startups', query: 'from:GoogleCloudStartups@google.com' },
      { name: 'Google Developer Forums', query: 'from:no-reply@discuss.google.d' },
      { name: 'HubSpot', query: 'from:noreply@notifications.hubspot.com' },
      // tm/tm1 are OpenAI's marketing senders; the bare domain would pull in account+security mail
      { name: 'OpenAI', query: 'from:(tm.openai.com OR tm1.openai.com)' },
      { name: 'Storylane', query: 'from:arthur@storylane.io' },
      { name: 'Poshmark', query: 'from:(poshmark.com)' },
      { name: 'cloudHQ', query: 'from:cloudhq.net' },
      // Listening reports and Labs feature news — about the user's own data, not merchandising
      { name: 'Last.fm', query: 'from:(music@last.fm OR mailer.last.fm)' },
      { name: 'NordVPN', query: 'from:mail.nordvpn.com' },
      { name: 'Oura', query: 'from:ouraring.com' },
      { name: 'Dropbox', query: 'from:dropbox.com' },
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
      { name: 'Read AI', query: 'from:(read.ai OR e.read.ai)' },
      { name: 'Otter.ai', query: 'from:otter.ai' },
      { name: 'Microsoft', query: 'from:(microsoft.com OR notificationmail.microsoft.com)' },
      { name: 'Meta Devices', query: 'from:email.meta.com' },
      { name: 'Splitwise', query: 'from:splitwise.com' },
      { name: 'Wikiloc', query: 'from:wikiloc.com' },
      { name: 'Apple', query: 'from:email.apple.com' },
      { name: 'WordPress.com', query: 'from:wordpress.com' },
      { name: 'Google Photos', query: 'from:noreply-photos@google.com' },
    ],
  },
  {
    // TurboTax and Experian existed as separate labels/live filters (Experian's already
    // marked read; TurboTax was untracked) until 2026-08-13, when they merged into one.
    labelName: LABEL_PRODUCT_UPDATES_CREDIT_REPORT,
    archive: true,
    markRead: true,
    filters: [
      { name: 'TurboTax', query: 'from:em1.turbotax.intuit.com' },
      { name: 'Experian', query: 'from:e.usa.experian.com' },
    ],
  },
  {
    labelName: LABEL_TRAVEL,
    archive: false,
    filters: [
      { name: 'Frontier Airlines', query: 'from:emails.flyfrontier.com' },
      { name: 'Airbnb', query: 'from:airbnb.com' },
      { name: 'Vacasa', query: 'from:e.vacasa.com' },
      { name: 'Vonlane', query: 'from:vonlane.com' },
      { name: 'WeSalute Travel', query: 'from:(wesalute.com)' },
      { name: 'Google Flights Alerts', query: 'from:google.com subject:"tracked route"' },
      { name: 'Under30 Experiences', query: 'from:under30experiences.com' },
      { name: 'Lyft', query: 'from:(lyft.com OR lyftmail.com)' },
      { name: 'United Notifications', query: 'from:(notifications@united.com OR insights.united.com)' },
      { name: 'American Airlines Trips', query: 'from:(connect.email.aa.com OR info.ms.aa.com OR info.email.aa.com)' },
      { name: 'Southwest Trips', query: 'from:ifly.southwest.com' },
      { name: 'Delta', query: 'from:(delta.com OR t.delta.com)' },
      { name: 'Frontier Airlines Updates', query: 'from:flyfrontier.com' },
      { name: 'Singapore Airlines', query: 'from:email.singaporeair.com' },
      { name: 'Marriott Stays', query: 'from:(marriott.com OR res-marriott.com)' },
    ],
  },
  {
    // Airline/booking marketing domains — transactional mail (reservations, alerts) uses
    // different domains and stays under Travel above
    labelName: LABEL_PROMOTIONS_TRAVEL,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Southwest Airlines', query: 'from:iluv.southwest.com' },
      { name: 'Hertz', query: 'from:emails.hertz.com' },
      { name: 'Marriott', query: 'from:email-marriott.com' },
      { name: 'Viva Aerobus', query: 'from:newsletter.vivaaerobus.com' },
      { name: 'ConnectMiles', query: 'from:email.connectmiles.com' },
      { name: 'MileagePlus Dining', query: 'from:email.rewardsnetwork.com' },
      { name: 'MileagePlus Shopping', query: 'from:mileageplusshoppingnews.com' },
      { name: 'Trip.com', query: 'from:newsletter.trip.com' },
      // Address-scoped: express@airbnb.com is guest correspondence and must stay
      // in the inbox; only the recommendations/impact sender archives.
      { name: 'Airbnb Discover', query: 'from:discover@airbnb.com' },
      { name: 'Delta Marketing', query: 'from:o.delta.com' },
      { name: 'United News & Deals', query: 'from:enews.united.com' },
      { name: 'Copa Airlines', query: 'from:email.copa.com' },
      { name: 'Vrbo Marketing', query: 'from:eg.vrbo.com' },
      { name: 'American Airlines Loyalty', query: 'from:loyalty.ms.aa.com' },
      { name: 'AirAsia Rewards', query: 'from:rewards.airasia.com' },
      { name: 'GOL', query: 'from:news.voegol.com.br' },
      { name: 'JetBlue Marketing', query: 'from:(email.jetblue.com OR marketing.jetblue.com)' },
      { name: 'Virgin Red', query: 'from:rewards.red.virgin.com' },
      { name: 'Couchsurfing Marketing', query: 'from:marketing.couchsurfing.com' },
      { name: 'Qatar Airways', query: 'from:(qr.qatarairways.com OR qrgroup.qatarairways.com)' },
      { name: 'Air France Marketing', query: 'from:enews-airfrance.com' },
      { name: 'Turo', query: 'from:mail.turo.com' },
      { name: 'Aeromexico', query: 'from:(mx.aeromexico.com OR mx.aeromexicorewards.com)' },
      { name: 'Booking.com', query: 'from:sg.booking.com' },
      { name: 'Wild Women Expeditions', query: 'from:wildwomenexpeditions.com' },
    ],
  },
  {
    labelName: LABEL_JOB_SEARCH,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Glassdoor Jobs', query: 'from:glassdoor.com' },
      // Excludes the social/newsletter senders routed to Forums/LinkedIn Social and
      // Newsletters/LinkedIn — an unqualified from:linkedin.com labels those Job Search too
      { name: 'LinkedIn', query: 'from:linkedin.com -from:newsletters-noreply@linkedin.com -from:messages-noreply@linkedin.com -from:invitations@linkedin.com -from:groups-noreply@linkedin.com -from:notifications-noreply@linkedin.com -from:messaging-digest-noreply@linkedin.com' },
      { name: 'Backstage', query: 'from:backstage.com' },
      { name: 'Virtual Vocations', query: 'from:(email.virtualvocations.com OR alerts.virtualvocations.com)' },
      { name: 'PostJobFree', query: 'from:postjobfree.com' },
      { name: 'Indeed', query: 'from:(indeed.com OR match.indeed.com OR indeedemail.com)' },
      { name: 'Idealist', query: 'from:idealist.org' },
      { name: 'Google Careers', query: 'from:careers-noreply@google.com' },
      { name: 'GrantWatch', query: 'from:grantwatch.com' },
      { name: 'EstateJobs', query: 'from:estatejobs.com' },
      { name: 'Lensa', query: 'from:lensa.com' },
      { name: 'A.Team', query: 'from:a.team' },
      { name: 'Recruiter cold-email (Steneral)', query: 'from:steneral.com' },
      { name: 'College Contact', query: 'from:yourcollegecontact.com' },
    ],
  },
  {
    // Sub-labels existed only as live Gmail filters (no config entry, no markRead/archive)
    // until 2026-08-13; brought under config so the sync doesn't leave them untracked.
    labelName: LABEL_JOB_SEARCH_LINKEDIN,
    archive: true,
    markRead: true,
    filters: [
      { name: 'LinkedIn Job Alerts', query: 'from:(jobalerts-noreply@linkedin.com OR jobs-noreply@linkedin.com)' },
    ],
  },
  {
    labelName: LABEL_JOB_SEARCH_GLASSDOOR,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Glassdoor Job Alerts', query: 'from:glassdoor.com subject:("new jobs" OR "apply now" OR hiring OR "job alert")' },
    ],
  },
  {
    labelName: LABEL_JOB_SEARCH_BACKSTAGE,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Backstage', query: 'from:backstage.com' },
    ],
  },
  {
    labelName: LABEL_JOB_SEARCH_INDEED,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Indeed', query: 'from:(indeed.com OR match.indeed.com)' },
    ],
  },
  {
    labelName: LABEL_JOB_SEARCH_OTHER,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Other job boards', query: 'from:(email.virtualvocations.com OR alerts.virtualvocations.com OR postjobfree.com OR idealist.org)' },
    ],
  },
  {
    labelName: LABEL_NEWSLETTERS,
    archive: true,
    markRead: true,
    filters: [
      // Zapier's news@ is product-update marketing, not a service alert; the
      // Promotions/Tech block below excludes it to avoid double-labeling.
      { name: 'Zapier News', query: 'from:news@send.zapier.com' },
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
      { name: 'Medium', query: 'from:medium.com' },
      { name: 'Cryptonary', query: 'from:cryptonary.com' },
      { name: 'Thesis Driven', query: 'from:thesisdriven.com' },
      { name: 'MIT Sloan Thinking Forward', query: 'from:thinkingforward@mit.edu' },
      { name: 'IMF', query: 'from:updates.imf.org' },
      { name: 'F6S', query: 'from:f6s.com' },
      { name: 'The Publish Press', query: 'from:mail.thepublishpress.com' },
      { name: 'Google Scholar Alerts', query: 'from:scholaralerts-noreply@google.com' },
      { name: 'Cherub', query: 'from:investwithcherub.com' },
      { name: 'Wilbe', query: 'from:wilbe.com' },
      { name: 'Advisory Board Centre', query: 'from:advisoryboardcentre.com' },
      { name: 'Unbuilt Lab', query: 'from:unbuiltlab.com' },
      { name: 'Dr. Hyman', query: 'from:drhyman.com' },
      { name: 'Sound Sight Tarot', query: 'from:soundsighttarot.com' },
      { name: 'Heart Centered Being', query: 'from:theheartcenteredbeing.com' },
      { name: 'ACA WSO Daily Meditation', query: 'from:acawso.org' },
      { name: 'Human Design Daily', query: 'from:human.design' },
      { name: 'UT Austin Newsletters', query: 'from:(utexas.edu OR mccombs.utexas.edu) subject:newsletter' },
      { name: 'ACM Listserv', query: 'from:listserv.acm.org' },
      { name: 'AlphaSignal', query: 'from:("AlphaSignal" OR alphasignal.ai)' },
      { name: 'Yodlee', query: 'from:communications@yodlee.com' },
      { name: 'Adapty', query: 'from:hello@adapty.io' },
      // The next four existed only as live Gmail filters (no config entry) until the
      // 2026-08-13 markRead sync; added here so the prune upgrades instead of unrouting.
      { name: 'OpenAI', query: 'from:email.openai.com' },
      { name: 'Google Cloud', query: 'from:googlecloud@google.com' },
      { name: 'LinkedIn Newsletters', query: 'from:newsletters-noreply@linkedin.com' },
      { name: 'Lumos FC', query: 'from:lumosfc.com' },
    ],
  },
  {
    labelName: LABEL_NEWSLETTERS_NEWS,
    archive: true,
    markRead: true,
    filters: [
      { name: 'CNN', query: 'from:mail.cnn.com' },
      { name: 'New York Times', query: 'from:e.newyorktimes.com' },
      { name: 'Axios', query: 'from:axios.com' },
    ],
  },
  {
    // ALM publishes Law.com, already routed to the parent Newsletters block
    labelName: LABEL_NEWSLETTERS_LEGAL,
    archive: true,
    markRead: true,
    filters: [
      { name: 'ALM', query: 'from:alm.com' },
      { name: 'Law.com (an ALM property)', query: 'from:law.com' },
    ],
  },
  {
    labelName: LABEL_NEWSLETTERS_PERSONAL_DEV,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Ladies Get Paid', query: 'from:ladiesgetpaid.com' },
      { name: 'School of Greatness', query: 'from:schoolofgreatness.com' },
    ],
  },
  {
    labelName: LABEL_ADVOCACY,
    archive: true,
    markRead: true,
    filters: [
      { name: 'DLCC', query: 'from:dlcc.org' },
      { name: 'Congressman Doggett', query: 'from:mail.house.gov' },
      { name: 'Inside Books Project', query: 'from:insidebooksproject.org' },
      { name: 'Obama Foundation', query: 'from:email.obama.org' },
    ],
  },
  {
    // Campaign/electoral/legislative senders
    labelName: LABEL_ADVOCACY_POLITICAL,
    archive: true,
    markRead: true,
    // Single combined filter: Gmail dedupes filters on criteria alone, so these must
    // differ from the parent Advocacy category's per-sender criteria
    filters: [
      // Scoped to the individual senator, not senate.gov — the broader domain would
      // sweep in unrelated congressional mail
      { name: 'Political senders', query: 'from:(dlcc.org OR mail.house.gov OR gillibrand.senate.gov OR e.democrats.org)' },
    ],
  },
  {
    // Austin Less Wrong meetup list & regular thread participants — stay in inbox
    labelName: LABEL_COMMUNITIES,
    archive: false,
    filters: [
      { name: 'Austin Less Wrong', query: 'from:(austinlesswrong@gmail.com OR sbarta@gmail.com OR chanj137036@gmail.com)' },
      { name: 'Fiesta Community', query: 'from:fiesta.community' },
      { name: 'VIDA Coworking', query: 'from:vidacoworking.com' },
      // UT mail not already routed to Newsletters (subject:newsletter) or Events (event subjects, econnect/austin announcements)
      { name: 'UT Austin (other)', query: 'from:utexas.edu -subject:(newsletter OR event OR lecture OR register OR workshop) -from:(econnect.utexas.edu OR austin.utexas.edu)' },
    ],
  },
  {
    // CCV nonprofit board correspondence — stays in inbox, never marked read.
    // includeRead because board threads are read-then-forgotten, and the org's
    // own domain carries the same governance mail as the members' personal accounts.
    labelName: LABEL_ADVOCACY_CCV_BOARD,
    archive: false,
    includeRead: true,
    filters: [
      { name: 'CCV board members', query: 'from:(mmaynesworth@gmail.com OR belindajroberts@gmail.com OR jshillis55@gmail.com)' },
      { name: 'Capital City Village', query: 'from:capitalcityvillage.org' },
    ],
  },
  {
    // Known personal contacts — stay in inbox
    labelName: LABEL_PERSONAL_CORRESPONDENCE,
    archive: false,
    filters: [
      { name: 'Personal contacts', query: 'from:(jasonledlie@gmail.com OR jeffschmulen@gmail.com OR girwin@gmail.com OR susan6100groce@gmail.com OR niki@pobox.com)' },
    ],
  },
  {
    // Legal correspondence, signed documents, court-ordered course records — stay in inbox
    labelName: LABEL_LEGAL,
    archive: false,
    filters: [
      { name: 'SAFE Austin', query: 'from:safeaustin.org' },
      { name: 'signNow', query: 'from:signnow.com' },
      { name: 'LRS Systems', query: 'from:lrssystems.com' },
    ],
  },
  {
    // Mail from my own accounts (self-notes, cross-account forwards) — stay in inbox
    labelName: LABEL_PERSONAL_SELF_CORRESPONDENCE,
    archive: false,
    filters: [
      { name: 'Own accounts', query: 'from:(alwaysrunningfast@gmail.com OR alyshia@integritystudio.ai OR alyshia@inventoryai.io)' },
    ],
  },
  {
    // Charitable/501(c)(3) organizations
    labelName: LABEL_ADVOCACY_NONPROFIT,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Non-profit senders', query: 'from:(insidebooksproject.org OR email.obama.org)' },
      { name: 'Equality Texas', query: 'from:equalitytexas.org' },
      { name: 'Eat Real', query: 'from:eatreal.org' },
      { name: 'Friends Austin', query: 'from:friendsaustin.org' },
      { name: 'Front Steps', query: 'from:mailman.bloomerang-mail.com' },
    ],
  },
  {
    labelName: LABEL_EVENTS,
    archive: false,
    filters: [
      // ccsend.com is Constant Contact's shared platform — the display-name term keeps
      // other merchants on the same subdomain from matching
      { name: 'Neill-Cochran Museum', query: 'from:(shared1.ccsend.com OR neill-cochranhousemuseum.ccsend.com) from:Neill-Cochran' },
      { name: 'ColdTowne Theater', query: 'from:coldtowne.ccsend.com' },
      { name: 'UT Austin Events', query: 'from:utexas.edu subject:(event OR lecture OR register OR workshop)' },
      { name: 'Environmental Science Institute', query: 'from:environmentalscienceinstitute.ccsend.com' },
      { name: 'The Concourse Project', query: 'from:concourseproject.com' },
      { name: 'Texas Exes', query: 'from:texasexesemail.com' },
      { name: 'dadageek', query: 'from:dadageek.com' },
      { name: 'Salem Center', query: 'from:mccombs.utexas.edu subject:event' },
      { name: 'Meetup', query: 'from:(email.meetup.com OR meetup.com)' },
      { name: 'Austin Pets Alive', query: 'from:austinpetsalive.org' },
      { name: 'Austin Alchemist', query: 'from:theaustinalchemist.com' },
      { name: 'Lumos Fitness', query: 'from:lumosfc.com' },
      { name: 'UT Austin Announcements', query: 'from:(econnect.utexas.edu OR austin.utexas.edu)' },
      { name: '10times', query: 'from:10times.com' },
      { name: 'Summit Series', query: 'from:summit.co' },
    ],
  },
  {
    // Austin venues & clubs — stay in inbox like the parent Events category (future events)
    labelName: LABEL_EVENTS_LOCAL,
    archive: false,
    filters: [
      { name: 'Tiny Minotaur Tavern', query: 'from:tinyminotaur.com' },
      { name: 'Austin Tennis League', query: 'from:ccsend.com from:Tennis' },
      { name: 'The Unbuzzed Club', query: 'from:theunbuzzedclub.com' },
      { name: 'Fallout Theater', query: 'from:fallouttheater.com' },
      { name: 'Museum of Human Achievement', query: 'from:themuseumofhumanachievement.com' },
      { name: 'Austin Westie Academy', query: 'from:austinwestieacademy' },
      { name: 'Open House Austin', query: 'from:openhouseaustin.co' },
      { name: 'Houston Sports & Social Club', query: 'from:houstonssc.com' },
      { name: 'Tantra Institute', query: 'from:tantrany.com' },
      { name: 'CreativeMornings', query: 'from:creativemornings.com' },
      { name: 'Austin Books & Comics', query: 'from:austinbooks.ccsend.com' },
      { name: 'Texas Longhorns', query: 'from:go.texaslonghorns.com' },
      { name: 'MyCheekyDate', query: 'from:mycheekydate.com' },
      { name: 'Alchemy Fitness', query: 'from:alchemy.bm' },
    ],
  },
  {
    // Dance scene mail (zouk, fuego, WCS) — stay in inbox like other event invites
    labelName: LABEL_EVENTS_DANCE,
    archive: false,
    filters: [
      { name: 'Fuego', query: 'from:fuegodance.com' },
      { name: 'Zouk (Sindi Obando)', query: 'from:(zouk.us OR dancers.media)' },
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
      { name: 'HBO Max', query: 'from:hbomax.com' },
      { name: 'Steam', query: 'from:steampowered.com' },
      { name: 'Goodreads', query: 'from:mail.goodreads.com' },
      { name: 'X Digests', query: 'from:newsletter@x.com' },
      { name: 'Instagram', query: 'from:mail.instagram.com' },
      { name: 'TikTok', query: 'from:service.tiktok.com' },
      { name: 'Facebook', query: 'from:(facebookmail.com OR priority.facebookmail.com)' },
      { name: 'Discord', query: 'from:discord.com' },
      { name: 'Prime Video', query: 'from:(primevideo.com OR channels.primevideo.com)' },
      { name: 'Spotify', query: 'from:(spotify.com OR legal.spotify.com)' },
    ],
  },
  {
    // Short-term rental operations: turnover scheduling and dynamic pricing drive
    // same-day decisions, so this stays in the inbox like Real Estate above rather
    // than archiving with the Home marketing block.
    labelName: LABEL_SERVICES_RENTAL_OPS,
    archive: false,
    filters: [
      { name: 'Turno (turnover cleaning)', query: 'from:(turno.com OR turnoverbnb.com)' },
      { name: 'Beyond Pricing', query: 'from:beyondpricing.com' },
    ],
  },
  {
    // Daily mail-scan digests: each is superseded by the next day's, so they are
    // archived and marked read on arrival rather than accumulating unread.
    labelName: LABEL_SERVICES_USPS,
    archive: true,
    markRead: true,
    filters: [
      { name: 'USPS Informed Delivery', query: 'from:email.informeddelivery.usps.com' },
    ],
  },
  {
    // Medical/appointment mail — must stay in inbox (visit links, confirmations)
    labelName: LABEL_SERVICES_HEALTH,
    archive: false,
    filters: [
      { name: 'Dogwood Therapy ATX', query: 'from:dogwoodtherapyatx.com' },
      { name: 'OptumRx', query: 'from:optumrx.com' },
      { name: 'Patient Messages (Hightop/Roots)', query: 'from:patient-message.com' },
      // LaserAway splits senders: .co is transactional (booking confirmations) and stays
      // in the inbox, while .com marketing archives under Promotions/Beauty & Wellness.
      // Age-based cleanup: archive-old-emails.mjs --query "from:laseraway.co"
      { name: 'LaserAway Appointments', query: 'from:laseraway.co' },
      { name: 'Victory Medical', query: 'from:demandforced3.com from:"Victory Medical"' },
      { name: 'Integrative Psychiatry Austin', query: 'from:ccsend.com from:"Integrative Psychiatry"' },
      { name: "Total Men's Primary Care", query: 'from:mj.totalmens.com' },
      // Shared Constant Contact domain — pin the sender prefix
      { name: 'Northshore Medical', query: 'from:info-nmac.bm@shared1.ccsend.com' },
      { name: 'Genomelink', query: 'from:genomelink.io' },
      { name: 'Google Health', query: 'from:google-health-noreply@google.com' },
      { name: 'UnitedHealthcare', query: 'from:(member.unitedhealthcare.com OR aca.unitedhealthcare.com OR edelivery.uhc.com)' },
      { name: 'Family Medicine Austin', query: 'from:(phreesia-mail.com OR eclinicalmail.com OR campaigns.nexhealth.com OR thevalorsolution.com)' },
      { name: 'One Medical', query: 'from:(onemedical.com OR care.onemedical.com)' },
      { name: 'Galileo Medical', query: 'from:hello.galileohealth.com' },
      { name: 'Allergies & Asthma Clinic', query: 'from:allallergies.com' },
      { name: 'Texas Diabetes', query: 'from:texasdiabetes.com' },
      { name: "Total Men's (campaigns)", query: 'from:totalmens.com' },
      { name: 'Spruce', query: 'from:sprucehealth.com' },
      { name: 'Baylor Scott & White', query: 'from:bswhealth.org' },
      { name: 'FastMed', query: 'from:fastmed.com' },
      { name: 'Probably Genetic', query: 'from:m.probablygenetic.com' },
      { name: 'Amazon Pharmacy', query: 'from:(pharmacy.amazon.com OR email.pharmacy.amazon.com)' },
      { name: 'SonderMind', query: 'from:notify.sondermind.com' },
      { name: 'CVS Pharmacy Alerts', query: 'from:alerts.cvs.com' },
      { name: 'Healthcare.gov', query: 'from:healthcare.gov' },
      { name: 'LiveWello', query: 'from:livewello.com' },
    ],
  },
  {
    // Rental/apartment inquiry follow-ups & listing alerts — stay in inbox (active correspondence)
    labelName: LABEL_SERVICES_REAL_ESTATE,
    archive: false,
    filters: [
      { name: 'Furnished Finder', query: 'from:(leads.furnishedfinder.com OR communications.furnishedfinder.com)' },
      { name: 'Apartment platforms', query: 'from:(assist.rent OR rentinquiries.com OR betterbot.com OR email.rentcafe.com OR emailrelay.com)' },
      { name: 'Apartment List', query: 'from:(nurture.apartmentlist.com OR explore.apartmentlist.com)' },
      { name: 'Zillow', query: 'from:(zmail.zillow.com OR convo.zillow.com)' },
      { name: 'Berkshire Leasing', query: 'from:berkshire-residential-leasing.com' },
      { name: 'KeyCheck Screening', query: 'from:keycheck.com' },
      { name: 'Keyrenter Austin', query: 'from:keyrenteraustin.com' },
      { name: 'PAMCO HOA', query: 'from:pamcotx.com' },
      { name: 'Listing alerts (Ylopo/McGuire)', query: 'from:(ylopo-email.com OR mcguireatx.com)' },
      { name: 'Kindred', query: 'from:(m.livekindred.com OR t.livekindred.com)' },
    ],
  },
  {
    // Utility bills, watering schedules, rebate programs — stay in inbox (bills matter)
    labelName: LABEL_SERVICES_UTILITIES,
    archive: false,
    filters: [
      { name: 'Austin Water', query: 'from:myatxwater.com' },
      // Two independent COA senders: coautilitiesemail.com (billing) and coautilities.com
      // (weekly usage updates) — neither is a subdomain of the other
      { name: 'City of Austin Utilities', query: 'from:(coautilitiesemail.com OR coautilities.com)' },
      { name: 'Texas Gas Service', query: 'from:texasgasservice.com' },
      { name: 'Austin Energy Rebates', query: 'from:rebates.austinenergy.com' },
      { name: 'Texas Water & Property (InvoiceCloud)', query: 'from:invoicecloud.net' },
      { name: 'Austin Energy Info', query: 'from:austinenergy.com' },
    ],
  },
  {
    // Home services marketing/digest mail — label + archive.
    // Ring alerts that need action ("charge your", "action required") are excluded here;
    // the battery nudge is routed to Time Sensitive by the category below instead.
    labelName: LABEL_SERVICES_HOME,
    archive: true,
    filters: [
      { name: 'Ring', query: 'from:(mail.ring.com OR notifications.ring.com OR em.service.ring.com OR rs.ring.com OR neighborhoods.ring.com OR myaccount.ring.com) -subject:"charge your" -subject:"action required"' },
      { name: 'Handy', query: 'from:handy.com' },
      { name: 'Maid Affordable', query: 'from:ccsend.com from:"Maid Affordable"' },
      { name: 'Grass Works Lawn Care', query: 'from:demandforced3.com from:"Grass Works"' },
      { name: 'EnergySage', query: 'from:energysage.com' },
      { name: 'GFiber', query: 'from:outreach.gfiber.com' },
      { name: 'Gaston & Sheehan Auctions', query: 'from:txauction.com' },
      { name: 'Nextdoor', query: 'from:email.nextdoor.com' },
      { name: 'CoStar Listings', query: 'from:c.costarmail.com' },
      { name: 'Magic Helpers', query: 'from:themagichelpers.com' },
      { name: 'Nest Reports', query: 'from:nest.com' },
      { name: 'Yale Access', query: 'from:yalehomeus.com' },
      { name: 'Life360 Devices', query: 'from:devices.life360.com' },
      { name: 'Cleanster', query: 'from:cleanster.com' },
      { name: '50K Lawn', query: 'from:50klawn.com' },
      { name: 'LawnStarter', query: 'from:lawnstarter.com' },
      { name: 'YardDoc', query: 'from:yarddoc.com' },
      { name: 'Premier Home Warranty', query: 'from:premierhw.com' },
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
      { name: 'ABC Home & Commercial', query: 'from:(evolveone.com OR abchomeandcommercial.com)' },
      { name: 'Critter Control (TruTech)', query: 'from:trutechinc.com' },
    ],
  },
  {
    // Professional networking & membership outreach from real organizations — stay in inbox
    labelName: LABEL_NETWORKING,
    archive: false,
    filters: [
      { name: 'EGBI', query: 'from:egbi.org' },
      { name: 'Austin Technology Council', query: 'from:austintechnologycouncil.org' },
    ],
  },
  {
    // Developer program digests & release roundups
    labelName: LABEL_NEWSLETTERS_DEVELOPER,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Google Developer Program', query: 'from:googledev-noreply@google.com' },
      { name: 'Supabase', query: 'from:supabase.com' },
      { name: 'Render Updates', query: 'from:render.com' },
      { name: 'PostHog', query: 'from:posthog.com' },
      { name: 'TechExpert Academy', query: 'from:techexpert.io' },
      { name: 'DataTalks.Club', query: 'from:datatalks.club' },
      { name: 'OpenRouter', query: 'from:openrouter.ai' },
      { name: 'PromptLayer', query: 'from:promptlayer.com' },
      { name: 'xAI', query: 'from:x.ai' },
      { name: 'Notiondesk', query: 'from:notiondesk.so' },
    ],
  },
  {
    // City of Austin & civic sources (austintexas.gov covers publicinput/econdev/etc. subdomains)
    labelName: LABEL_NEWSLETTERS_CIVIC_AUSTIN,
    archive: true,
    markRead: true,
    filters: [
      { name: 'City of Austin', query: 'from:austintexas.gov' },
      { name: 'Austin Current', query: 'from:austincurrent.org' },
      { name: 'Austin Neighborhoods Council', query: 'from:ancweb.org' },
      { name: 'Austin Habitat for Humanity', query: 'from:ahfh.org' },
    ],
  },
  {
    // Voicemail transcriptions — label only, stay in inbox (each needs listening/triage)
    labelName: LABEL_VOICEMAIL,
    archive: false,
    filters: [
      { name: 'YouMail', query: 'from:youmail.com' },
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
      { name: 'Google Security Alerts', query: 'from:accounts.google.com' },
      { name: 'Netflix Account', query: 'from:account.netflix.com' },
      { name: 'Docusign Account', query: 'from:docusign.net' },
      { name: 'Doppler Logins', query: 'from:doppler.com' },
      { name: 'Venmo Security', query: 'from:security-alerts@venmo.com' },
      { name: 'Tesla Verification', query: 'from:tesla.com subject:verification' },
      { name: 'npm Tokens', query: 'from:npmjs.com' },
    ],
  },
  {
    // Market-data digests — the highest-volume unrouted sender in the unlabeled backlog
    labelName: LABEL_BILLING_MARKET_ALERTS,
    archive: true,
    filters: [
      { name: 'Barchart', query: 'from:partners.barchart.com' },
    ],
  },
  {
    // Proxy material carries a dated voting deadline, so it stays in the inbox —
    // unlike the statement senders below, which archive on arrival
    labelName: LABEL_BILLING_STATEMENTS,
    archive: false,
    filters: [
      { name: 'ProxyVote', query: 'from:proxyvote.com' },
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
    // Credit bureau monitoring noise — label, archive, and mark read automatically
    labelName: LABEL_BILLING_CREDIT_MONITORING,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Equifax', query: 'from:(e.equifax.com OR equifax.com)' },
      { name: 'Experian Monitoring', query: 'from:s.usa.experian.com' },
      { name: 'Credit Karma', query: 'from:(mail.creditkarma.com OR notifications.creditkarma.com)' },
      { name: 'IDnotify', query: 'from:email.idnotify.com' },
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
      { name: 'Stripe Receipts', query: 'from:stripe.com subject:receipt' },
      { name: 'Netlify Invoices', query: 'from:netlify.com subject:(invoice OR payment)' },
      { name: 'Anthropic Receipts', query: 'from:mail.anthropic.com subject:receipt' },
      { name: 'DocHub Receipts', query: 'from:dochub.com subject:receipt' },
      { name: 'Toast Orders (JuiceLand etc.)', query: 'from:toasttab.com' },
      { name: 'Park ATX', query: 'from:gopassport.com' },
      { name: 'Hartsel Ranch', query: 'from:hartselranch.co' },
      { name: 'Etsy Order Updates', query: 'from:(account.etsy.com OR mail.etsy.com)' },
      { name: 'Home Depot Orders', query: 'from:order.homedepot.com' },
    ],
  },
  {
    // Amazon order lifecycle — label + skip inbox (receipts live under the label).
    // Deliberately excludes promo senders (amazonmusic.com etc.) by pinning transactional addresses.
    labelName: LABEL_PURCHASES_AMAZON,
    archive: true,
    filters: [
      { name: 'Amazon Orders', query: 'from:(auto-confirm@amazon.com OR order-update@amazon.com OR return@amazon.com)' },
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
    labelName: LABEL_PROMOTIONS_RETAIL,
    archive: true,
    markRead: true,
    consolidate: true,
    filters: [
      { name: 'Wayfair', query: 'from:(members.wayfair.com OR service.wayfair.com)' },
      { name: "Macy's", query: 'from:macys.com' },
      { name: 'Rent the Runway', query: 'from:renttherunway.com' },
      { name: 'Quince', query: 'from:mail.quince.com' },
      { name: 'Ruti', query: 'from:ruti.com' },
      { name: "Margaret O'Leary", query: 'from:margaretoleary.com' },
      { name: 'Tuft & Needle', query: 'from:news.tuftandneedle.com' },
      { name: 'Home Depot Deals', query: 'from:mg.homedepot.com' },
      { name: 'Mary & Jane', query: 'from:shopmaryandjane.com' },
      { name: 'adidas', query: 'from:(us-news.adidas.com OR us-news.comms.adidas.com OR us-info.adidas.com)' },
      { name: 'Audible Promos', query: 'from:(mail.audible.com OR audible.com)' },
      { name: 'Amazon Store News', query: 'from:store-news@amazon.com' },
      { name: 'eBay Marketing', query: 'from:(reply.ebay.com OR info.ebay.com)' },
      { name: 'Wayfair Stores', query: 'from:wayfair.com' },
      { name: 'Amazon Music', query: 'from:amazonmusic.com' },
      { name: 'Kiwi Drug', query: 'from:kiwidrug.com' },
      { name: 'Whole30', query: 'from:whole30.com' },
      { name: 'Stanley Steemer', query: 'from:email.stanleysteemer.com' },
      { name: 'Temu', query: 'from:news.temuemail.com' },
      { name: 'Thorum', query: 'from:thorum.com' },
      { name: 'Smashwords', query: 'from:smashwords.com' },
      { name: 'Lumosity', query: 'from:lumosity.com' },
      { name: 'Move Dancewear', query: 'from:movedancewear.com' },
      { name: 'BY Design Home Staging', query: 'from:bydesignsa.com' },
      { name: 'Shapermint', query: 'from:shapermint.com' },
      { name: 'Perigold', query: 'from:members.perigold.com' },
      { name: 'Woodcraft', query: 'from:woodcraft.com' },
      { name: 'Thuma', query: 'from:thuma.co' },
      { name: 'Alp N Rock', query: 'from:alpnrock.com' },
    ],
  },
  {
    labelName: LABEL_EVENTS_AI_MONTHLY,
    archive: true,
    filters: [
      { name: 'SolutionPeople monthly series', query: `${SOLUTIONMAN} ${SOLUTIONMAN_MONTHLY}` },
    ],
  },
  {
    labelName: LABEL_EVENTS_CONVENTIONS_TECH,
    archive: false,
    filters: [
      { name: 'SolutionPeople conventions', query: `${SOLUTIONMAN} ${SOLUTIONMAN_CONVENTIONS}` },
    ],
  },
  {
    labelName: LABEL_PROMOTIONS,
    archive: true,
    markRead: true,
    filters: [
      { name: 'SolutionPeople book & LinkedIn-group promos', query: `${SOLUTIONMAN} ${SOLUTIONMAN_PROMOS}` },
    ],
  },
  {
    // Catch-all for this sender: everything not matched by the three buckets above
    labelName: LABEL_EVENTS_TECH,
    archive: true,
    filters: [
      {
        name: 'SolutionPeople other',
        query: `${SOLUTIONMAN} -${SOLUTIONMAN_MONTHLY} -${SOLUTIONMAN_CONVENTIONS} -${SOLUTIONMAN_PROMOS}`,
      },
    ],
  },
  {
    // Practice marketing from medical providers — kept apart from Services & Alerts/Health,
    // which carries transactional patient mail that should stay visible
    labelName: LABEL_PROMOTIONS_HEALTH,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Sanova Dermatology', query: 'from:ccsend.com from:Sanova' },
      { name: 'Sleep Medicine Consultants', query: 'from:ccsend.com from:"Sleep Medicine"' },
    ],
  },
  {
    labelName: LABEL_PROMOTIONS_BEAUTY,
    archive: true,
    markRead: true,
    filters: [
      { name: 'LaserAway', query: 'from:laseraway.com' },
      { name: 'Saving Face Austin', query: 'from:savingfaceaustin.com' },
      { name: 'milk + honey', query: 'from:milkandhoney.com' },
      // Shared marketing-platform domains — pin the full address so other merchants on the platform don't match
      // Demandforce is multi-vertical and noreply@demandforced3.com is shared by at least
      // four merchants, so senders here are keyed on display name, not address.
      { name: 'Driftwood Spa', query: 'from:Driftwood@demandforced3.com' },
      { name: 'exhale Spa', query: 'from:demandforced3.com from:exhale' },
      { name: 'Satori Day Spa', query: 'from:demandforced3.com from:Satori' },
      { name: 'Strands', query: 'from:demandforced3.com from:Strands' },
      { name: 'Aveda Institute', query: 'from:demandforced3.com from:Aveda' },
      { name: 'Dolce Blu', query: 'from:noreply@hirefrederick.com' },
      { name: 'Dermazen', query: 'from:dermazen.co' },
      { name: 'WellnessLiving Studios', query: 'from:wellnessliving.com' },
      { name: 'SweatDecks', query: 'from:sweatdecks.com' },
      { name: 'Pure Body Studio', query: 'from:purebodystudio.com' },
    ],
  },
  {
    // Netflix sends marketing from several subdomains but security mail from account.netflix.com,
    // which the Security & Account group keeps in the inbox. Excluding by sender rather than
    // enumerating marketing subdomains means a new marketing subdomain is covered automatically
    // while sign-in codes can never be swept up. discship/customerservice are legacy DVD-era
    // transactional mail and are left unrouted.
    labelName: LABEL_PROMOTIONS_ENTERTAINMENT,
    archive: true,
    markRead: true,
    filters: [
      {
        name: 'Netflix Marketing',
        query: 'from:netflix.com -from:account.netflix.com -from:discship@netflix.com -from:customerservice@netflix.com',
      },
    ],
  },
  {
    // SaaS marketing drips (automation tips, trial nurture, webinar invites). Zapier's
    // news@ is excluded — it routes to Newsletters — leaving blog@/learn@/events@ here.
    labelName: LABEL_PROMOTIONS_TECH,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Zapier Marketing', query: 'from:zapier.com -from:news@send.zapier.com' },
    ],
  },
  {
    // Marketing-only sender domains — statements/alerts use separate domains
    // (o.sofi.org, notify.wellsfargo.com, transactional.vanguard.com) and must stay in inbox
    labelName: LABEL_PROMOTIONS_FINANCIAL,
    archive: true,
    markRead: true,
    filters: [
      { name: 'NerdWallet', query: 'from:mail.nerdwallet.com' },
      { name: 'Rocket Mortgage', query: 'from:e.rocketmortgage.com' },
      { name: 'SoFi Marketing', query: 'from:(m.sofi.org OR r.sofi.com)' },
      { name: 'USAA Offers', query: 'from:(Perks@mem.usaa.com OR exmac.usaa.com)' },
      { name: 'Boston Globe Offers', query: 'from:email.globe.com' },
      { name: 'Wells Fargo Offers', query: 'from:mail1.wellsfargo.com' },
      // Rewards summaries and account offers — split out of Billing's Wells Fargo entry
      { name: 'Wells Fargo Rewards & Offers', query: 'from:(mail2.wellsfargorewards.com OR mail.accountoffers.wellsfargo.com)' },
      { name: 'Vanguard Digital Advisor', query: 'from:e-vanguard.com' },
      // Everything on vanguard.com except the transactional subdomain, which stays in
      // Billing — same exclusion idiom as the Netflix/Chase entries
      { name: 'Vanguard Marketing', query: 'from:vanguard.com -from:transactional.vanguard.com' },
      { name: 'Chase Marketing', query: 'from:mcmap.chase.com' },
      { name: 'Kraken', query: 'from:email.kraken.com' },
      { name: 'Robinhood', query: 'from:robinhood.com' },
      { name: 'Ally', query: 'from:(email.ally.com OR email.ally-invest.com)' },
      { name: 'PayPal Marketing', query: 'from:news.paypal.com' },
      { name: 'Wise', query: 'from:(wise.com OR info.wise.com)' },
      // welcome.americanexpress.com (onboarding) and email.americanexpress.com (offers) —
      // split out of Billing's American Express and Amex Credit & Feedback entries
      { name: 'Amex Marketing', query: 'from:(welcome.americanexpress.com OR email.americanexpress.com)' },
      { name: 'CNN Subscriptions', query: 'from:email.cnn.com' },
      { name: 'Lemonade', query: 'from:lemonade.com' },
      { name: 'Better Cover', query: 'from:better.com' },
      { name: 'Truist Mortgage Marketing', query: 'from:(mail.mktg.truist.com OR cx.oneteam.truist.com)' },
      { name: 'Citi Offers', query: 'from:info15.citi.com' },
    ],
  },
  {
    labelName: LABEL_AUTOMOTIVE_SHOPPING,
    archive: true,
    filters: [
      { name: 'Edmunds', query: 'from:email.edmunds.com' },
      // Match on "Ultimate": the display name appears as both "Dave's Ultimate Automotive"
      // and "Daves Ultimate Automotive", and the apostrophe tokenizes badly (from:Dave
      // returns well under half the messages)
      { name: "Dave's Ultimate Automotive", query: 'from:demandforced3.com from:Ultimate' },
      { name: 'Cars.com', query: 'from:em.cars.com' },
      { name: 'Carvana', query: 'from:(mail.carvana.com OR vehicles.carvana.com)' },
      { name: 'CARFAX', query: 'from:no-reply.carfax.com' },
      { name: 'Driveway', query: 'from:email.driveway.com' },
      { name: 'Autotrader', query: 'from:(psx.autotrader.com OR messages.autotrader.com)' },
      { name: 'CarGurus', query: 'from:mail.cargurus.com' },
      { name: 'Kelley Blue Book', query: 'from:messages.kbb.com' },
      { name: 'CarMax', query: 'from:email-carmax.com' },
      { name: 'AutoNation', query: 'from:autonation.com' },
      { name: 'Mazda Dealers', query: 'from:dealers-mazdausa.com' },
      { name: 'DealerCenter', query: 'from:dealercenter.net' },
      { name: 'Capitol Chevrolet', query: 'from:capitolchevy.com' },
      // Full address: alstspecials.com is a dealer-marketing platform domain; other
      // dealers may send from it, so match the local part too
      { name: 'City Limits Subaru', query: 'from:citylimitssubaru@alstspecials.com' },
      { name: 'Autoblog', query: 'from:email.thestreet.com' },
    ],
  },
  {
    labelName: LABEL_AUTOMOTIVE_INSURANCE,
    archive: true,
    filters: [
      { name: 'GEICO', query: 'from:(e.geico.com OR et.geico.com)' },
    ],
  },
  {
    labelName: LABEL_PROMOTIONS_FOOD,
    archive: true,
    markRead: true,
    filters: [
      // Food/pharmacy delivery; .co and .mx send independently, so both are listed
      { name: 'Rappi', query: 'from:(rappi.com.co OR rappi.com.mx)' },
      // Thanx is a restaurant-loyalty platform, so every merchant on it is food — the only
      // shared platform here safe to route by domain. Pinning one address missed a second
      // Hopdoddy sender on the bare domain (emails@thanx.com).
      { name: 'Thanx platform (Hopdoddy, Via 313)', query: 'from:thanx.com' },
      { name: 'MOD Pizza', query: 'from:offers@modpizza.com' },
      { name: 'Northside Wine & Spirits', query: 'from:northsidewine.com' },
      { name: 'DoorDash', query: 'from:doordash.com' },
      { name: 'Instacart', query: 'from:instacart.com' },
      { name: 'Whole Foods', query: 'from:mail.wholefoodsmarket.com' },
      { name: 'Papa Johns', query: 'from:promotions.papajohns.com' },
      { name: 'Wegmans', query: 'from:eml.wegmans.com' },
      { name: 'Toast (restaurant marketing platform)', query: 'from:toast-restaurants.com' },
      { name: 'Grubhub', query: 'from:a.grubhub.com' },
      { name: 'Sweetgreen', query: 'from:email.sweetgreen.com' },
      { name: 'SevenRooms (reservation platform)', query: 'from:email.sevenrooms.com' },
      { name: 'Snooze Eatery', query: 'from:snoozeeatery.com' },
    ],
  },
  {
    labelName: LABEL_SENTRY,
    archive: true,
    filters: [
      { name: 'Sentry Alerts', query: 'from:noreply@md.getsentry.com' },
    ],
  },
  {
    labelName: LABEL_EVENTS_MEETUP,
    archive: true,
    filters: [
      { name: 'Meetup Announcements', query: 'from:info@email.meetup.com' },
    ],
  },
  {
    labelName: LABEL_COMMUNITY_EVENTS,
    archive: true,
    filters: [
      { name: 'Austin community groups', query: 'from:("ATX - Awkwardly Zen" OR "Austin Cafe Drawing Group" OR "Austin Robotics & AI")' },
    ],
  },
  {
    labelName: LABEL_CALENDLY_NOTIFICATIONS,
    archive: true,
    filters: [
      { name: 'Calendly', query: 'from:teamcalendly@send.calendly.com' },
    ],
  },
  {
    labelName: LABEL_LINKEDIN_UPDATES,
    archive: true,
    filters: [
      { name: 'LinkedIn Updates', query: 'from:updates-noreply@linkedin.com' },
    ],
  },
  {
    labelName: LABEL_MEETING_NOTES,
    archive: true,
    filters: [
      { name: 'Google Meet Notes', query: 'from:meetings-noreply@google.com subject:Notes' },
    ],
  },
  {
    // Subject-only match with no sender constraint — capped lower so a broad backfill
    // cannot sweep unrelated mail that merely mentions DMARC.
    labelName: LABEL_DMARC_REPORTS,
    archive: true,
    maxResults: DEFAULT_MAX_RESULTS,
    includeRead: true,
    filters: [
      { name: 'DMARC Reports', query: 'subject:DMARC' },
    ],
  },
  {
    labelName: LABEL_MONITORING,
    archive: true,
    maxResults: BACKFILL_PAGE_NARROW,
    includeRead: true,
    filters: [
      { name: 'SigNoz Alertmanager', query: 'from:alertmanager@signoz.cloud' },
    ],
  },
  {
    // Events and Communities each already have an archive: false block above. These
    // senders archive on arrival, so they stay separate rather than inheriting the
    // keep-in-inbox policy of the labels they share.
    labelName: LABEL_EVENTS,
    archive: true,
    filters: [
      // Covers reminder.eventbrite.com too, so the reminder-only filter it replaced is gone
      { name: 'Eventbrite', query: 'from:eventbrite.com' },
    ],
  },
  {
    labelName: LABEL_COMMUNITIES,
    archive: true,
    filters: [
      { name: 'Women Techmakers', query: 'from:wtm@technovation.org' },
    ],
  },
  {
    // Google Calendar email notifications — label + archive + mark read silently
    labelName: LABEL_EVENTS_CALENDAR_NOTIFICATIONS,
    archive: true,
    markRead: true,
    filters: [
      { name: 'Google Calendar Notifications', query: 'from:calendar-notification@google.com' },
    ],
  },
  // Recruiter and inbound-opportunity threads. Never archived and pinned with Keep Important:
  // these were the mail that sat unread-and-archived long enough to go stale.
  {
    labelName: LABEL_CAREER_OPPORTUNITY,
    extraLabels: [LABEL_KEEP_IMPORTANT],
    archive: false,
    includeRead: true,
    filters: [
      { name: 'Leucadia Talent', query: 'from:leucadia-talent.com' },
      { name: '8VC', query: 'from:8vc.com' },
    ],
  },
  {
    // from:a16z.com also matches sr-team./alpha. subdomains, which is where the
    // speedrun fellowship mail actually originates.
    labelName: LABEL_CAREER_FELLOWSHIP_INVITE,
    archive: false,
    includeRead: true,
    filters: [
      { name: 'a16z Speedrun', query: 'from:a16z.com' },
    ],
  },
  {
    labelName: LABEL_EVENTS_CLASSES,
    archive: false,
    includeRead: true,
    filters: [
      { name: 'Austin Gymnastics Club', query: 'from:austingymnasticsclub.com' },
    ],
  },
];

// Gmail's per-filter query length limit is undocumented; 500 sits well inside
// every reported bound while still collapsing ~30 senders into 2 filters
const MAX_CONSOLIDATED_QUERY_LENGTH = 500;

function describeFilter(filter, labelNameById) {
  const criteria = filter.criteria?.query ?? JSON.stringify(filter.criteria);
  const adds = (filter.action?.addLabelIds ?? []).map(id => labelNameById.get(id) ?? id);
  const removes = (filter.action?.removeLabelIds ?? []).map(id => labelNameById.get(id) ?? id);
  const parts = [];
  if (adds.length) parts.push(`+[${adds.join(', ')}]`);
  if (removes.length) parts.push(`-[${removes.join(', ')}]`);
  return `${criteria} → ${parts.join(' ')}`;
}

/**
 * A consolidated category's sender entries collapse into OR-joined chunk
 * filters; everything else keeps one filter per entry. Per-filter markRead
 * cannot survive a merge, so consolidate rejects it.
 */
function planEntriesFor(category) {
  if (!category.consolidate) return category.filters;
  const overridden = category.filters.find(f => f.markRead !== undefined);
  if (overridden) {
    throw new Error(
      `${category.labelName}: per-filter markRead ("${overridden.name}") is incompatible with consolidate`
    );
  }
  const chunks = chunkQueries(category.filters.map(f => f.query), MAX_CONSOLIDATED_QUERY_LENGTH);
  return chunks.map((query, i) => ({ name: `chunk ${i + 1}/${chunks.length}`, query }));
}

async function run() {
  const onlyPrefix = argAfter('--only');
  const dryRun = hasFlag('--dry-run');
  const prune = hasFlag('--prune');
  const gmail = createGmailClient();

  console.log(`CREATING CATEGORY FILTERS${dryRun ? ' (DRY RUN)' : ''}\n`);
  console.log(BANNER + '\n');

  // One live snapshot for diffing. Creations during the run aren't re-listed,
  // which is fine — only what the snapshot lacked gets created.
  const [{ data: filterData }, { data: labelData }] = await Promise.all([
    withRetry(() => gmail.users.settings.filters.list({ userId: USER_ID })),
    withRetry(() => gmail.users.labels.list({ userId: USER_ID })),
  ]);
  const liveFilters = filterData.filter ?? [];
  const labelNameById = new Map(labelData.labels.map(l => [l.id, l.name]));
  const labelIdByName = new Map(labelData.labels.map(l => [l.name, l.id]));

  // Existing labels resolve from the snapshot; missing ones are only created
  // outside --dry-run (a dry run must not mutate anything, labels included)
  const resolveLabelId = async name => {
    const existing = labelIdByName.get(name);
    if (existing) return existing;
    if (dryRun) {
      console.log(`  + would create label ${name}`);
      return null;
    }
    return ensureLabelExists(gmail, name);
  };

  let totalFilters = 0;
  let totalDeleted = 0;
  let totalEmails = 0;
  const failedBackfills = new Set();

  for (const category of CATEGORIES) {
    if (onlyPrefix && !(category.labelName ?? '').startsWith(onlyPrefix)) continue;
    const displayName = category.labelName ?? 'Auto-archive (no label)';
    console.log(`\n${displayName.toUpperCase()}`);

    const labelId = category.labelName
      ? await resolveLabelId(category.labelName).catch(err => {
          console.warn(`  Warning: ${err.message}`);
          return null;
        })
      : null;

    if (category.labelName && !labelId) continue;

    const extraLabelIds = [];
    for (const extra of category.extraLabels ?? []) {
      const extraId = await resolveLabelId(extra);
      if (extraId) extraLabelIds.push(extraId);
    }
    const addIds = [...(labelId ? [labelId] : []), ...extraLabelIds];

    const removalIdsFor = (markRead) => [
      ...(category.archive ? [GMAIL_INBOX] : []),
      ...(markRead ? [GMAIL_UNREAD] : []),
    ];
    const planEntries = planEntriesFor(category);
    // Backfill runs once per distinct markRead value, so per-filter overrides
    // get their own searchAndModify pass with the matching removals
    const queriesByMarkRead = new Map();
    const desired = [];

    for (const entry of planEntries) {
      const markRead = Boolean(entry.markRead ?? category.markRead);
      const removeIds = removalIdsFor(markRead);
      // Gmail rejects a filter action carrying more than one user label
      // ("Too many user labels in filter"), so each extra label needs its own
      // filter on the same query. messages.modify has no such limit, so the
      // backfill below still applies every label in a single pass.
      if (addIds.length === 0 && removeIds.length) {
        // Label-less category: archive/mark-read only
        desired.push({
          entryName: entry.name,
          criteria: { query: entry.query },
          action: { removeLabelIds: removeIds },
        });
      }
      for (const [index, addId] of addIds.entries()) {
        desired.push({
          entryName: entry.name,
          criteria: { query: entry.query },
          action: {
            addLabelIds: [addId],
            // Only the first filter needs to move the message out of INBOX/UNREAD
            ...(index === 0 && removeIds.length ? { removeLabelIds: removeIds } : {}),
          },
        });
      }
      const group = queriesByMarkRead.get(markRead) ?? [];
      group.push(`(${entry.query})`);
      queriesByMarkRead.set(markRead, group);
    }

    const { missing, stale, foreign } = diffFilters({ desired, liveAll: liveFilters, ownLabelId: labelId });

    // Stale deletions run BEFORE creations: at Gmail's 1,000-filter cap there is
    // no free slot until old filters go. Mail arriving in the gap lands unlabeled
    // in the inbox; the backfill below sweeps it up.
    for (const filter of stale) {
      const summary = describeFilter(filter, labelNameById);
      if (!prune) {
        console.log(`  ! stale (rerun with --prune to delete): ${summary}`);
      } else if (dryRun) {
        console.log(`  - would delete stale: ${summary}`);
      } else {
        await deleteGmailFilter(gmail, filter.id);
        console.log(`  - deleted stale: ${summary}`);
        totalDeleted++;
      }
    }
    for (const filter of foreign) {
      console.log(`  ! unmatched filter also adds other labels — left alone: ${describeFilter(filter, labelNameById)}`);
    }

    for (const entry of planEntries) {
      const toCreate = missing.filter(m => m.entryName === entry.name);
      if (toCreate.length === 0) {
        console.log(`  ~ ${entry.name}`);
        continue;
      }
      if (dryRun) {
        console.log(`  + would create ${entry.name}: ${entry.query}`);
        continue;
      }
      let created = false;
      for (const d of toCreate) {
        if (await createGmailFilter(gmail, d.criteria, d.action)) created = true;
      }
      console.log(`  ${created ? '✓' : '~'} ${entry.name}`);
      if (created) totalFilters++;
    }

    if (dryRun) continue;

    const labelClause = category.labelName && !category.archive ? ` -label:"${category.labelName}"` : '';
    const readClause = category.includeRead ? '' : ' is:unread';
    for (const [markRead, queries] of queriesByMarkRead) {
      const removeIds = removalIdsFor(markRead);
      const combinedQuery = `(${queries.join(' OR ')})${readClause}${labelClause}`;
      const modifications = {
        ...(addIds.length ? { addLabelIds: addIds } : {}),
        ...(removeIds.length ? { removeLabelIds: removeIds } : {}),
      };

      try {
        const count = await searchAndModify(gmail, combinedQuery, modifications, category.maxResults);
        if (count > 0) {
          console.log(`  → ${count} existing emails processed`);
          totalEmails += count;
        }
      } catch (error) {
        console.error(`  ✗ Backfill failed: ${error?.message ?? String(error)}`);
        failedBackfills.add(displayName);
      }
    }
  }

  console.log('\n' + BANNER);
  console.log(`Filters created: ${totalFilters} | Filters deleted: ${totalDeleted} | Emails processed: ${totalEmails}`);
  if (failedBackfills.size > 0) {
    console.error(`Backfill FAILED for ${failedBackfills.size} categor${failedBackfills.size === 1 ? 'y' : 'ies'}: ${[...failedBackfills].join(', ')}`);
    console.error('Filters above may be created but existing mail in these categories was not relabeled — rerun to retry.');
    process.exitCode = 1;
  }
  console.log(BANNER + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    console.error('Error:', error?.message ?? String(error));
    process.exit(1);
  });
}
