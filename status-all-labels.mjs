import { createGmailClient } from './lib/gmail-client.mjs';
import {
  USER_ID,
  LABEL_SENTRY, LABEL_KEEP_IMPORTANT, LABEL_EVENTS, LABEL_MONITORING,
  LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING,
} from './lib/constants.mjs';

const gmail = createGmailClient();

console.log('📁 ALL LABELED EMAILS\n');

const labels = [LABEL_SENTRY, LABEL_KEEP_IMPORTANT, LABEL_EVENTS, LABEL_MONITORING, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING];
const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
const labelMap = {};
labelsResponse.data.labels.forEach(l => { labelMap[l.name] = l.id; });

const labelStats = await Promise.all(
  labels.map(async label => {
    if (!labelMap[label]) return { label, total: 0, unread: 0, missing: true };
    const [result, unreadResult] = await Promise.all([
      gmail.users.messages.list({ userId: USER_ID, q: `label:${labelMap[label]}` }),
      gmail.users.messages.list({ userId: USER_ID, q: `label:${labelMap[label]} is:unread` })
    ]);
    return {
      label,
      total: result.data.resultSizeEstimate || 0,
      unread: unreadResult.data.resultSizeEstimate || 0
    };
  })
);

for (const { label, total, unread, missing } of labelStats) {
  if (missing) {
    console.log(`${label}: 0 (label not found)`);
  } else {
    console.log(`${label}: ${total} total, ${unread} unread`);
  }
}
