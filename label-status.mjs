import { createGmailClient } from './lib/gmail-client.mjs';
import {
  USER_ID,
  LABEL_SENTRY, LABEL_KEEP_IMPORTANT, LABEL_EVENTS, LABEL_MONITORING,
  LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING,
} from './lib/constants.mjs';

const gmail = createGmailClient();

const profile = await gmail.users.getProfile({ userId: USER_ID });
console.log(`Total messages: ${profile.data.messagesTotal}`);
console.log(`Total threads: ${profile.data.threadsTotal}`);

const [unreadResult, inboxResult] = await Promise.all([
  gmail.users.messages.list({ userId: USER_ID, q: 'is:unread' }),
  gmail.users.messages.list({ userId: USER_ID, q: 'is:unread in:inbox' }),
]);
console.log(`Unread (is:unread): ${unreadResult.data.resultSizeEstimate}`);
console.log(`Unread in inbox: ${inboxResult.data.resultSizeEstimate}`);

const labels = [LABEL_SENTRY, LABEL_KEEP_IMPORTANT, LABEL_EVENTS, LABEL_MONITORING, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING];
const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
const labelMap = new Map((labelsResponse.data.labels || []).map(l => [l.name, l.id]));

console.log('\nBy Label (total / unread):');
const labelStats = await Promise.all(
  labels.map(async label => {
    const labelId = labelMap.get(label);
    if (!labelId) return { label, total: 0, unread: 0, missing: true };
    const [totalRes, unreadRes] = await Promise.all([
      gmail.users.messages.list({ userId: USER_ID, q: `label:${labelId}` }),
      gmail.users.messages.list({ userId: USER_ID, q: `label:${labelId} is:unread` }),
    ]);
    return {
      label,
      total: totalRes.data.resultSizeEstimate || 0,
      unread: unreadRes.data.resultSizeEstimate || 0,
    };
  })
);

for (const { label, total, unread, missing } of labelStats) {
  if (missing) {
    console.log(`  ${label}: 0 (label not found)`);
  } else {
    console.log(`  ${label}: ${total} total, ${unread} unread`);
  }
}
