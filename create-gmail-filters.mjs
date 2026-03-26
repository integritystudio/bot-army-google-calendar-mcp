/**
 * Create Gmail filters and apply them to existing emails.
 * Consolidates create-simple-filters.mjs and create-unread-filters.mjs.
 *
 * Usage:
 *   node create-gmail-filters.mjs            # create all filters + apply to existing
 *   node create-gmail-filters.mjs --apply    # apply labels to existing emails only
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import {
  GMAIL_INBOX,
  LABEL_SENTRY,
  LABEL_MEETUP_EVENTS,
  LABEL_COMMUNITY_EVENTS,
  LABEL_PRODUCT_UPDATES,
  LABEL_CALENDLY_NOTIFICATIONS,
  LABEL_LINKEDIN_UPDATES,
  LABEL_DMARC_REPORTS,
  LABEL_EVENTS,
  LABEL_MEETING_NOTES,
  LABEL_MONITORING,
} from './lib/constants.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const applyOnly = process.argv.includes('--apply');

/**
 * Each entry: label name, Gmail filter criteria query string, and a separate
 * applyQuery used when backfilling existing messages (may differ from filter
 * query to narrow to unread/recent). maxResults is optional.
 */
const FILTER_CONFIGS = [
  {
    label: LABEL_SENTRY,
    filterQuery: 'from:noreply@md.getsentry.com',
    applyQuery: 'is:unread from:noreply@md.getsentry.com',
    description: 'Sentry error/alert notifications',
  },
  {
    label: LABEL_MEETUP_EVENTS,
    filterQuery: 'from:info@email.meetup.com',
    applyQuery: 'is:unread from:info@email.meetup.com',
    description: 'Meetup group invitations and event updates',
  },
  {
    label: LABEL_COMMUNITY_EVENTS,
    filterQuery: 'from:("ATX - Awkwardly Zen" OR "Austin Cafe Drawing Group" OR "Austin Robotics & AI")',
    applyQuery: 'is:unread from:("ATX - Awkwardly Zen" OR "Austin Cafe Drawing Group" OR "Austin Robotics & AI")',
    description: 'Local community event invitations',
  },
  {
    label: LABEL_PRODUCT_UPDATES,
    filterQuery: 'from:(noreply@email.openai.com OR no-reply@email.claude.com OR googlecloud@google.com OR "AlphaSignal" OR lukak@storylane.io)',
    applyQuery: 'is:unread from:(noreply@email.openai.com OR no-reply@email.claude.com OR googlecloud@google.com OR "AlphaSignal" OR lukak@storylane.io)',
    description: 'AI/SaaS product announcements and updates',
  },
  {
    label: LABEL_CALENDLY_NOTIFICATIONS,
    filterQuery: 'from:teamcalendly@send.calendly.com',
    applyQuery: 'is:unread from:teamcalendly@send.calendly.com',
    description: 'Calendly team setup and scheduling guides',
  },
  {
    label: LABEL_LINKEDIN_UPDATES,
    filterQuery: 'from:updates-noreply@linkedin.com',
    applyQuery: 'is:unread from:updates-noreply@linkedin.com',
    description: 'LinkedIn job notifications and updates',
  },
  {
    label: LABEL_DMARC_REPORTS,
    filterQuery: 'subject:DMARC',
    applyQuery: 'subject:DMARC',
    description: 'Automated DMARC aggregate reports',
    maxResults: 100,
  },
  {
    label: LABEL_EVENTS,
    filterQuery: 'from:noreply@reminder.eventbrite.com',
    applyQuery: 'is:unread from:noreply@reminder.eventbrite.com',
    description: 'Eventbrite event reminders',
  },
  {
    label: LABEL_MEETING_NOTES,
    filterQuery: 'from:meetings-noreply@google.com subject:Notes',
    applyQuery: 'is:unread from:meetings-noreply@google.com subject:Notes',
    description: 'Google Meet auto-generated notes',
  },
  {
    label: LABEL_MONITORING,
    filterQuery: 'from:alertmanager@signoz.cloud',
    applyQuery: 'from:alertmanager@signoz.cloud',
    description: 'SigNoz alertmanager notifications',
    maxResults: 200,
  },
];

async function run() {
  const gmail = createGmailClient();

  console.log(applyOnly ? 'APPLYING LABELS TO EXISTING EMAILS\n' : 'CREATING AUTO-ARCHIVE FILTERS\n');
  console.log('═'.repeat(80) + '\n');

  let created = 0;
  let errors = 0;
  let emailsProcessed = 0;

  for (const config of FILTER_CONFIGS) {
    let labelId;
    try {
      labelId = await ensureLabelExists(gmail, config.label);
    } catch (error) {
      console.log(`  Error creating label ${config.label}: ${error.message}`);
      errors++;
      continue;
    }

    if (!applyOnly) {
      const filterId = await createGmailFilter(
        gmail,
        { query: config.filterQuery },
        { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] },
      );
      if (filterId) {
        console.log(`  Filter created: ${config.label}`);
        created++;
      } else {
        console.log(`  Filter already exists: ${config.label}`);
      }
    }

    const count = await searchAndModify(
      gmail,
      config.applyQuery,
      { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] },
      config.maxResults,
    );
    if (count > 0) {
      console.log(`  ${config.label}: labeled and archived ${count} existing emails`);
      emailsProcessed += count;
    }
  }

  console.log('\n' + '═'.repeat(80));
  if (!applyOnly) {
    console.log(`Filters created: ${created} | Errors: ${errors} | Emails processed: ${emailsProcessed}\n`);
  } else {
    console.log(`Emails processed: ${emailsProcessed}\n`);
  }
  console.log('═'.repeat(80) + '\n');
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
