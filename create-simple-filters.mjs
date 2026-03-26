import { createGmailClient } from './lib/gmail-client.mjs';
import {
  GMAIL_INBOX,
  LABEL_DMARC_REPORTS,
  LABEL_EVENTS,
  LABEL_MEETING_NOTES,
  LABEL_MONITORING,
} from './lib/constants.mjs';
import { ensureLabelExists, createGmailFilter } from './lib/gmail-filter-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const gmail = createGmailClient();

const FILTER_CONFIGS = [
  {
    label: LABEL_DMARC_REPORTS,
    filterQuery: 'subject:DMARC',
    applyQuery: 'subject:DMARC',
    logName: 'DMARC',
    maxResults: 100,
  },
  {
    label: LABEL_EVENTS,
    filterQuery: 'from:noreply@reminder.eventbrite.com',
    applyQuery: 'is:unread from:noreply@reminder.eventbrite.com',
    logName: 'Eventbrite',
  },
  {
    label: LABEL_MEETING_NOTES,
    filterQuery: 'from:meetings-noreply@google.com subject:Notes',
    applyQuery: 'is:unread from:meetings-noreply@google.com subject:Notes',
    logName: 'Meet Notes',
  },
  {
    label: LABEL_MONITORING,
    filterQuery: 'from:alertmanager@signoz.cloud',
    applyQuery: 'from:alertmanager@signoz.cloud',
    logName: 'SigNoz',
    maxResults: 200,
  },
];

for (const config of FILTER_CONFIGS) {
  const labelId = await ensureLabelExists(gmail, config.label);
  const filterId = await createGmailFilter(
    gmail,
    { query: config.filterQuery },
    { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] },
  );
  console.log(filterId ? `${config.logName}: filter created: ${filterId}` : `${config.logName}: filter already exists`);
  const count = await searchAndModify(
    gmail,
    config.applyQuery,
    { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] },
    config.maxResults,
  );
  console.log(`${config.logName}: labeled and archived ${count} existing emails`);
}
