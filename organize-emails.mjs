/**
 * Apply labels to existing emails and create auto-label filters.
 * Consolidates organize-events.mjs and organize-newsletters.mjs.
 *
 * Usage:
 *   node organize-emails.mjs --type events
 *   node organize-emails.mjs --type newsletters
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { LABEL_EVENTS, LABEL_NEWSLETTERS } from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';
import { createGmailFilter } from './lib/gmail-filter-utils.mjs';

const typeArg = process.argv[process.argv.indexOf('--type') + 1];
if (!typeArg || !['events', 'newsletters'].includes(typeArg)) {
  console.error('Usage: node organize-emails.mjs --type <events|newsletters>');
  process.exit(1);
}

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

async function run() {
  const gmail = createGmailClient();

  console.log(`${config.title}\n`);
  const labelCache = await buildLabelCache(gmail);
  const labelId = labelCache.get(config.label);
  if (!labelId) {
    console.error(`${config.label} label not found`);
    process.exit(1);
  }
  console.log('═'.repeat(80));
  console.log('\n1. APPLYING LABEL TO EXISTING EMAILS\n');

  let totalLabeled = 0;
  const processedQueries = new Set();
  for (const query of config.searchPatterns) {
    if (processedQueries.has(query)) continue;
    processedQueries.add(query);
    try {
      const count = await searchAndModify(gmail, query, { addLabelIds: [labelId] }, 100);
      if (count > 0) console.log(`  Applied to ${count} emails matching: "${query}"`);
      totalLabeled += count;
    } catch (error) {
      console.log(`  Error processing "${query}": ${error.message}`);
    }
  }

  console.log(`\n  Total labeled: ${totalLabeled} emails\n`);
  console.log('═'.repeat(80));
  console.log('\n2. CREATING AUTO-LABEL FILTERS\n');

  let filtersCreated = 0;
  for (const filterConfig of config.filterConfigs) {
    const filterId = await createGmailFilter(gmail, filterConfig.criteria, { addLabelIds: [labelId] });
    if (filterId) {
      console.log(`  Filter created: ${filterConfig.name}`);
      filtersCreated++;
    } else {
      console.log(`  Filter already exists: ${filterConfig.name}`);
    }
  }

  console.log('═'.repeat(80));
  console.log(`\n${config.title} COMPLETE\n`);
  console.log(`  Labeled existing emails: ${totalLabeled}`);
  console.log(`  Filters created: ${filtersCreated}`);
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
