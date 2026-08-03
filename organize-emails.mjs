/**
 * Apply labels to existing emails and create auto-label filters.
 * Consolidates organize-events.mjs, organize-newsletters.mjs, and organize-events-sublabels.mjs.
 *
 * Usage:
 *   node organize-emails.mjs --type events
 *   node organize-emails.mjs --type newsletters
 *   node organize-emails.mjs --type event-sublabels
 *   node organize-emails.mjs --type organization
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import {
  LABEL_EVENTS, LABEL_NEWSLETTERS,
  LABEL_EVENTS_MEETUP, LABEL_EVENTS_CALENDLY, LABEL_EVENTS_COMMUNITY,
  LABEL_EVENTS_WORKSHOPS, LABEL_EVENTS_INVITATIONS,
  LABEL_ORG, LABEL_ORG_OPEN_SOURCE, LABEL_ORG_FINANCIAL,
  LABEL_ORG_REAL_ESTATE, LABEL_ORG_ECOMMERCE,
  LABEL_ORG_LOCAL_COMMUNITY, LABEL_ORG_PROFESSIONAL,
  DEFAULT_MAX_RESULTS,
} from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';
import { createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { BANNER } from './lib/console-utils.mjs';

const VALID_TYPES = ['events', 'newsletters', 'event-sublabels', 'organization'];
const typeArg = process.argv[process.argv.indexOf('--type') + 1];
if (!typeArg || !VALID_TYPES.includes(typeArg)) {
  console.error(`Usage: node organize-emails.mjs --type <${VALID_TYPES.join('|')}>`);
  process.exit(1);
}

const EVENT_SUBLABEL_CATEGORIES = [
  { label: LABEL_EVENTS_MEETUP, searchQuery: 'from:info@email.meetup.com', filterCriteria: { from: 'info@email.meetup.com' }, filterName: 'Meetup Events' },
  { label: LABEL_EVENTS_CALENDLY, searchQuery: 'from:teamcalendly@send.calendly.com OR from:support@calendly.zendesk.com', filterCriteria: { from: 'teamcalendly@send.calendly.com' }, filterName: 'Calendly Events' },
  { label: LABEL_EVENTS_COMMUNITY, searchQuery: 'subject:"📅 Just scheduled"', filterCriteria: { subject: '📅 Just scheduled' }, filterName: 'Community Event Announcements' },
  { label: LABEL_EVENTS_WORKSHOPS, searchQuery: 'subject:workshop OR subject:conference OR subject:summit OR subject:webinar', filterCriteria: { subject: 'workshop OR conference OR summit OR webinar' }, filterName: 'Workshop & Conference Events' },
  { label: LABEL_EVENTS_INVITATIONS, searchQuery: 'subject:invitation OR subject:invite OR subject:rsvp', filterCriteria: { subject: 'invitation OR invite OR rsvp' }, filterName: 'Event Invitations' },
];

const ORG_SUBLABEL_CATEGORIES = [
  { label: LABEL_ORG_OPEN_SOURCE, searchQuery: 'from:notifications@github.com', filterCriteria: { from: 'notifications@github.com' }, filterName: 'GitHub Notifications' },
  { label: LABEL_ORG_FINANCIAL, searchQuery: 'from:(no-reply@mail.coinbase.com OR noreply@robinhood.com OR info@e.equifax.com OR alerts@brex.com)', filterCriteria: { from: 'no-reply@mail.coinbase.com' }, filterName: 'Financial Services' },
  { label: LABEL_ORG_REAL_ESTATE, searchQuery: 'from:(market-updates@mail.zillow.com OR my-saved-home@mail.zillow.com OR consumer@e.mail.realtor.com OR listings@redfin.com)', filterCriteria: { from: 'market-updates@mail.zillow.com' }, filterName: 'Real Estate Updates' },
  { label: LABEL_ORG_ECOMMERCE, searchQuery: 'from:(order-update@amazon.com OR shipment-tracking@amazon.com OR auto-confirm@amazon.com)', filterCriteria: { from: 'order-update@amazon.com' }, filterName: 'Ecommerce Orders' },
  { label: LABEL_ORG_LOCAL_COMMUNITY, searchQuery: 'from:(no-reply@rs.email.nextdoor.com OR reply@news.bizjournals.com)', filterCriteria: { from: 'no-reply@rs.email.nextdoor.com' }, filterName: 'Local Community' },
  { label: LABEL_ORG_PROFESSIONAL, searchQuery: 'from:(jobalerts-noreply@linkedin.com OR groups-noreply@linkedin.com OR newsletters-noreply@linkedin.com OR careers-noreply@google.com)', filterCriteria: { from: 'jobalerts-noreply@linkedin.com' }, filterName: 'Professional Networks' },
];

const CONFIGS = {
  events: {
    label: LABEL_EVENTS,
    title: 'ORGANIZING EVENT EMAILS',
    searchPatterns: [
      'from:info@email.meetup.com',
      'from:teamcalendly@send.calendly.com',
      'from:support@calendly.zendesk.com',
      'from:"ATX - Awkwardly Zen"',
      'from:"Austin Cafe Drawing Group"',
      'from:"Austin Robotics & AI"',
      'from:"International House"',
      'subject:"📅 Just scheduled"',
      'subject:"Just scheduled"',
      'subject:event OR subject:conference OR subject:summit OR subject:workshop',
      'subject:venue OR subject:location OR subject:address',
      'subject:register OR subject:registration',
      'subject:happening OR subject:"save the date"',
      'subject:invitation OR subject:invite',
    ],
    filterConfigs: [
      { name: 'Meetup Event Notifications', criteria: { from: 'info@email.meetup.com' } },
      { name: 'Calendly Team Events', criteria: { from: 'teamcalendly@send.calendly.com' } },
      { name: 'ATX Awkwardly Zen Events', criteria: { from: 'ATX - Awkwardly Zen' } },
      { name: 'Community Event Notifications', criteria: { query: 'subject:"📅 Just scheduled"' } },
      { name: 'Workshop & Conference Announcements', criteria: { subject: 'workshop OR conference OR summit OR webinar' } },
      { name: 'Event Invitations', criteria: { subject: 'invitation OR invite OR rsvp' } },
    ],
  },
  newsletters: {
    label: LABEL_NEWSLETTERS,
    title: 'ORGANIZING NEWSLETTERS',
    searchPatterns: [
      'from:news@alphasignal.ai',
      'from:noreply@email.openai.com',
      'from:hello@adapty.io',
      'from:info@email.meetup.com',
      'from:googlecloud@google.com',
      'from:communications@yodlee.com',
      'from:updates-noreply@linkedin.com',
      'from:noreply@notifications.hubspot.com',
      'from:support@substack.com',
      'subject:newsletter OR subject:digest OR subject:weekly OR subject:monthly',
      'label:Promotions',
    ],
    filterConfigs: [
      { name: 'AlphaSignal News', criteria: { from: 'news@alphasignal.ai' } },
      { name: 'OpenAI Newsletter', criteria: { from: 'noreply@email.openai.com' } },
      { name: 'Adapty Updates', criteria: { from: 'hello@adapty.io' } },
      { name: 'Meetup Notifications', criteria: { from: 'info@email.meetup.com' } },
      { name: 'Google Cloud Updates', criteria: { from: 'googlecloud@google.com' } },
      { name: 'Promotional Emails', criteria: { query: 'label:Promotions' } },
    ],
  },
};

const config = CONFIGS[typeArg];

function countFiltersCreated(filterResults) {
  let created = 0;
  for (const { name, created: isNew } of filterResults) {
    console.log(`  Filter ${isNew ? 'created' : 'already exists'}: ${name}`);
    if (isNew) created++;
  }
  return created;
}

async function runSingleLabel(gmail, labelCache, cfg) {
  const labelId = labelCache.get(cfg.label);
  if (!labelId) {
    console.error(`${cfg.label} label not found`);
    process.exit(1);
  }
  console.log(BANNER);
  console.log('\n1. APPLYING LABEL TO EXISTING EMAILS\n');

  const searchResults = await Promise.all(
    cfg.searchPatterns.map(query =>
      searchAndModify(gmail, query, { addLabelIds: [labelId] }, DEFAULT_MAX_RESULTS)
        .then(count => ({ query, count, error: null }))
        .catch(error => ({ query, count: 0, error: error.message }))
    )
  );
  let totalLabeled = 0;
  for (const { query, count, error } of searchResults) {
    if (error) console.log(`  Error processing "${query}": ${error}`);
    else if (count > 0) console.log(`  Applied to ${count} emails matching: "${query}"`);
    totalLabeled += count;
  }

  console.log(`\n  Total labeled: ${totalLabeled} emails\n`);
  console.log(BANNER);
  console.log('\n2. CREATING AUTO-LABEL FILTERS\n');

  const filterResults = await Promise.all(
    cfg.filterConfigs.map(fc =>
      createGmailFilter(gmail, fc.criteria, { addLabelIds: [labelId] })
        .then(filterId => ({ name: fc.name, created: !!filterId }))
    )
  );
  const filtersCreated = countFiltersCreated(filterResults);

  console.log(BANNER);
  console.log(`\n${cfg.title} COMPLETE\n`);
  console.log(`  Labeled existing emails: ${totalLabeled}`);
  console.log(`  Filters created: ${filtersCreated}`);
}

async function runSublabels(gmail, labelCache, categoryConfigs, title, parentLabel) {
  console.log(`${title}\n`);
  console.log(BANNER);
  console.log('\n1. APPLYING SUB-LABELS TO EXISTING EMAILS\n');

  const parentLabelId = parentLabel ? labelCache.get(parentLabel) : null;

  const categories = categoryConfigs
    .map(c => {
      const labelId = labelCache.get(c.label);
      if (!labelId) console.warn(`  Skipping ${c.label}: label not found`);
      return {
        ...c,
        labelId,
        labelIds: labelId && parentLabelId ? [labelId, parentLabelId] : labelId ? [labelId] : null,
      };
    })
    .filter(c => c.labelIds);

  const searchResults = await Promise.all(
    categories.map(category =>
      searchAndModify(gmail, category.searchQuery, { addLabelIds: category.labelIds }, DEFAULT_MAX_RESULTS)
        .then(count => ({ label: category.label, count, error: null }))
        .catch(error => ({ label: category.label, count: 0, error: error.message }))
    )
  );
  let totalLabeled = 0;
  for (const { label, count, error } of searchResults) {
    if (error) console.log(`  Error with ${label}: ${error}`);
    else if (count === 0) console.log(`  No emails found for: ${label}`);
    else console.log(`  ${label}: ${count} emails`);
    totalLabeled += count;
  }

  console.log(`\n  Total labeled: ${totalLabeled} emails\n`);
  console.log(BANNER);
  console.log('\n2. CREATING AUTO-LABEL FILTERS\n');

  const filterResults = await Promise.all(
    categories.flatMap(category =>
      category.labelIds.map(labelId =>
        createGmailFilter(gmail, category.filterCriteria, { addLabelIds: [labelId] })
          .then(filterId => ({ name: category.filterName, created: !!filterId }))
      )
    )
  );
  const filtersCreated = countFiltersCreated(filterResults);

  console.log(BANNER);
  console.log(`\n${title} COMPLETE\n`);
  console.log(`  Emails labeled: ${totalLabeled}`);
  console.log(`  Filters created: ${filtersCreated}`);
}

async function run() {
  const gmail = createGmailClient();
  const labelCache = await buildLabelCache(gmail);

  if (typeArg === 'event-sublabels') {
    await runSublabels(gmail, labelCache, EVENT_SUBLABEL_CATEGORIES, 'ORGANIZING EVENTS BY SUB-LABEL');
    return;
  }

  if (typeArg === 'organization') {
    await runSublabels(gmail, labelCache, ORG_SUBLABEL_CATEGORIES, 'ORGANIZING BY ORGANIZATION TYPE', LABEL_ORG);
    return;
  }

  console.log(`${config.title}\n`);
  await runSingleLabel(gmail, labelCache, config);
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
