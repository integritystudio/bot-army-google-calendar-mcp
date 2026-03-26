import { createGmailClient } from './lib/gmail-client.mjs';
import {
  USER_ID,
  GMAIL_INBOX,
  LABEL_PRODUCT_UPDATES,
  LABEL_MEETUP_EVENTS,
  LABEL_COMMUNITY_EVENTS,
  LABEL_CALENDLY_NOTIFICATIONS,
  LABEL_LINKEDIN_UPDATES,
  LABEL_DMARC_REPORTS,
} from './lib/constants.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';

const FILTER_CONFIGS = [
  { name: LABEL_MEETUP_EVENTS, query: 'is:unread from:info@email.meetup.com' },
  { name: LABEL_COMMUNITY_EVENTS, query: 'is:unread from:("ATX - Awkwardly Zen" OR "Austin Cafe Drawing Group" OR "Austin Robotics & AI")' },
  { name: LABEL_PRODUCT_UPDATES, query: 'is:unread from:(noreply@email.openai.com OR no-reply@email.claude.com OR googlecloud@google.com OR "AlphaSignal" OR lukak@storylane.io)' },
  { name: LABEL_CALENDLY_NOTIFICATIONS, query: 'is:unread from:teamcalendly@send.calendly.com' },
  { name: LABEL_LINKEDIN_UPDATES, query: 'is:unread from:updates-noreply@linkedin.com' },
  { name: LABEL_DMARC_REPORTS, query: 'is:unread subject:DMARC' },
];

async function applyFiltersToUnread() {
  const gmail = createGmailClient();

  console.log('APPLYING FILTERS TO EXISTING UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
  const labelMap = new Map((labelsResponse.data.labels || []).map(l => [l.name, l.id]));

  let totalProcessed = 0;

  for (const config of FILTER_CONFIGS) {
    const labelId = labelMap.get(config.name);
    if (!labelId) {
      console.log(`Label not found for: ${config.name}`);
      continue;
    }

    const searchResponse = await gmail.users.messages.list({ userId: USER_ID, q: config.query, maxResults: 500 });
    const messageIds = searchResponse.data.messages || [];
    console.log(`${config.name}: ${messageIds.length} emails`);
    if (messageIds.length === 0) continue;

    await batchModifyMessages(gmail, messageIds, { addLabelIds: [labelId], removeLabelIds: [GMAIL_INBOX] });
    totalProcessed += messageIds.length;
  }

  console.log('═'.repeat(80));
  console.log(`Total emails labeled & archived: ${totalProcessed}\n`);
  console.log('═'.repeat(80) + '\n');
}

applyFiltersToUnread().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
