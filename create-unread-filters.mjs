import { createGmailClient } from './lib/gmail-client.mjs';
import {
  LABEL_SENTRY, LABEL_MEETUP_EVENTS, LABEL_COMMUNITY_EVENTS, LABEL_PRODUCT_UPDATES,
  LABEL_CALENDLY_NOTIFICATIONS, LABEL_LINKEDIN_UPDATES, LABEL_DMARC_REPORTS,
} from './lib/constants.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { GMAIL_INBOX } from './lib/constants.mjs';

const FILTER_CONFIGS = [
  { name: LABEL_SENTRY, query: 'from:noreply@md.getsentry.com', description: 'Sentry error/alert notifications' },
  { name: LABEL_MEETUP_EVENTS, query: 'from:info@email.meetup.com', description: 'Meetup group invitations and event updates' },
  { name: LABEL_COMMUNITY_EVENTS, query: 'from:("ATX - Awkwardly Zen" OR "Austin Cafe Drawing Group" OR "Austin Robotics & AI")', description: 'Local community event invitations' },
  { name: LABEL_PRODUCT_UPDATES, query: 'from:(noreply@email.openai.com OR no-reply@email.claude.com OR googlecloud@google.com OR "AlphaSignal" OR lukak@storylane.io)', description: 'AI/SaaS product announcements and updates' },
  { name: LABEL_CALENDLY_NOTIFICATIONS, query: 'from:teamcalendly@send.calendly.com', description: 'Calendly team setup and scheduling guides' },
  { name: LABEL_LINKEDIN_UPDATES, query: 'from:updates-noreply@linkedin.com', description: 'LinkedIn job notifications and updates' },
  { name: LABEL_DMARC_REPORTS, query: 'subject:DMARC', description: 'Automated DMARC aggregate reports' },
];

async function createFilters() {
  const gmail = createGmailClient();

  console.log('CREATING AUTO-ARCHIVE FILTERS FOR UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  let created = 0;
  let errors = 0;

  for (const config of FILTER_CONFIGS) {
    let labelId;
    try {
      labelId = await ensureLabelExists(gmail, config.name);
    } catch (error) {
      console.log(`  Error creating label ${config.name}: ${error.message}`);
      errors++;
      continue;
    }

    const filterId = await createGmailFilter(
      gmail,
      { query: config.query },
      { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] },
    );

    if (filterId) {
      console.log(`  Filter created: ${config.name}`);
      console.log(`     Query: ${config.query}\n`);
      created++;
    } else {
      console.log(`  Filter already exists: ${config.name}`);
    }
  }

  console.log('═'.repeat(80));
  console.log(`Filters created: ${created} | Errors: ${errors}\n`);
  console.log('═'.repeat(80) + '\n');
}

createFilters().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
