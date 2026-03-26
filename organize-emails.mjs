/**
 * Apply labels to existing emails and create auto-label filters.
 * Consolidates organize-events.mjs, organize-newsletters.mjs, and organize-events-sublabels.mjs.
 *
 * Usage:
 *   node organize-emails.mjs --type events
 *   node organize-emails.mjs --type newsletters
 *   node organize-emails.mjs --type event-sublabels
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import {
  LABEL_EVENTS, LABEL_NEWSLETTERS,
  LABEL_EVENTS_MEETUP, LABEL_EVENTS_CALENDLY, LABEL_EVENTS_COMMUNITY,
  LABEL_EVENTS_WORKSHOPS, LABEL_EVENTS_INVITATIONS,
} from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';
import { createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { BANNER } from './lib/console-utils.mjs';

const typeArg = process.argv[process.argv.indexOf('--type') + 1];
if (!typeArg || !['events', 'newsletters', 'event-sublabels'].includes(typeArg)) {
  console.error('Usage: node organize-emails.mjs --type <events|newsletters|event-sublabels>');
  process.exit(1);
}

const EVENT_SUBLABEL_CATEGORIES = [
  { label: LABEL_EVENTS_MEETUP, searchQuery: 'from:info@email.meetup.com', filterCriteria: { from: 'info@email.meetup.com' }, filterName: 'Meetup Events' },
  { label: LABEL_EVENTS_CALENDLY, searchQuery: 'from:teamcalendly@send.calendly.com OR from:support@calendly.zendesk.com', filterCriteria: { from: 'teamcalendly@send.calendly.com' }, filterName: 'Calendly Events' },
  { label: LABEL_EVENTS_COMMUNITY, searchQuery: 'subject:"📅 Just scheduled"', filterCriteria: { subject: '📅 Just scheduled' }, filterName: 'Community Event Announcements' },
  { label: LABEL_EVENTS_WORKSHOPS, searchQuery: 'subject:workshop OR subject:conference OR subject:summit OR subject:webinar', filterCriteria: { subject: 'workshop OR conference OR summit OR webinar' }, filterName: 'Workshop & Conference Events' },
  { label: LABEL_EVENTS_INVITATIONS, searchQuery: 'subject:invitation OR subject:invite OR subject:rsvp', filterCriteria: { subject: 'invitation OR invite OR rsvp' }, filterName: 'Event Invitations' },
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

async function runSingleLabel(gmail, cfg) {
  const labelCache = await buildLabelCache(gmail);
  const labelId = labelCache.get(cfg.label);
  if (!labelId) {
    console.error(`${cfg.label} label not found`);
    process.exit(1);
  }
  console.log(BANNER);
  console.log('\n1. APPLYING LABEL TO EXISTING EMAILS\n');

  let totalLabeled = 0;
  for (const query of cfg.searchPatterns) {
    try {
      const count = await searchAndModify(gmail, query, { addLabelIds: [labelId] }, 100);
      if (count > 0) console.log(`  Applied to ${count} emails matching: "${query}"`);
      totalLabeled += count;
    } catch (error) {
      console.log(`  Error processing "${query}": ${error.message}`);
    }
  }

  console.log(`\n  Total labeled: ${totalLabeled} emails\n`);
  console.log(BANNER);
  console.log('\n2. CREATING AUTO-LABEL FILTERS\n');

  let filtersCreated = 0;
  for (const filterConfig of cfg.filterConfigs) {
    const filterId = await createGmailFilter(gmail, filterConfig.criteria, { addLabelIds: [labelId] });
    if (filterId) {
      console.log(`  Filter created: ${filterConfig.name}`);
      filtersCreated++;
    } else {
      console.log(`  Filter already exists: ${filterConfig.name}`);
    }
  }

  console.log(BANNER);
  console.log(`\n${cfg.title} COMPLETE\n`);
  console.log(`  Labeled existing emails: ${totalLabeled}`);
  console.log(`  Filters created: ${filtersCreated}`);
}

async function runEventSublabels(gmail) {
  console.log('ORGANIZING EVENTS BY SUB-LABEL\n');
  console.log(BANNER);
  console.log('\n1. APPLYING SUB-LABELS TO EXISTING EMAILS\n');

  const labelCache = await buildLabelCache(gmail);
  const categories = EVENT_SUBLABEL_CATEGORIES
    .map(c => ({ ...c, labelId: labelCache.get(c.label) }))
    .filter(c => c.labelId);

  let totalLabeled = 0;
  for (const category of categories) {
    const count = await searchAndModify(gmail, category.searchQuery, { addLabelIds: [category.labelId] }, 100).catch(error => {
      console.log(`  Error with ${category.label}: ${error.message}`);
      return 0;
    });
    if (count === 0) console.log(`  No emails found for: ${category.label}`);
    else console.log(`  ${category.label}: ${count} emails`);
    totalLabeled += count;
  }

  console.log(`\n  Total labeled: ${totalLabeled} emails\n`);
  console.log(BANNER);
  console.log('\n2. CREATING AUTO-LABEL FILTERS\n');

  let filtersCreated = 0;
  for (const category of categories) {
    const filterId = await createGmailFilter(gmail, category.filterCriteria, { addLabelIds: [category.labelId] });
    if (filterId) {
      console.log(`  Filter created: ${category.filterName}`);
      filtersCreated++;
    } else {
      console.log(`  Filter already exists: ${category.filterName}`);
    }
  }

  console.log(BANNER);
  console.log('\nEVENT SUB-LABELS ORGANIZATION COMPLETE\n');
  console.log(`  Emails labeled: ${totalLabeled}`);
  console.log(`  Filters created: ${filtersCreated}`);
}

async function run() {
  const gmail = createGmailClient();

  if (typeArg === 'event-sublabels') {
    await runEventSublabels(gmail);
    return;
  }

  console.log(`${config.title}\n`);
  await runSingleLabel(gmail, config);
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
