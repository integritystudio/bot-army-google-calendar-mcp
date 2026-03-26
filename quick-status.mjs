import { createGmailClient } from './lib/gmail-client.mjs';
import {
  USER_ID,
  LABEL_SENTRY, LABEL_KEEP_IMPORTANT, LABEL_EVENTS, LABEL_MONITORING,
  LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING,
} from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';

const gmail = createGmailClient();

console.log('📊 QUICK STATUS\n');

const profile = await gmail.users.getProfile({ userId: USER_ID });
console.log(`Total messages: ${profile.data.messagesTotal}`);
console.log(`Total threads: ${profile.data.threadsTotal}`);

const unreadResult = await gmail.users.messages.list({
  userId: USER_ID,
  q: 'is:unread'
});

console.log(`Unread (is:unread): ${unreadResult.data.resultSizeEstimate}`);

const inboxResult = await gmail.users.messages.list({
  userId: USER_ID,
  q: 'is:unread in:inbox'
});

console.log(`Unread in inbox: ${inboxResult.data.resultSizeEstimate}`);

const labels = [LABEL_SENTRY, LABEL_KEEP_IMPORTANT, LABEL_EVENTS, LABEL_MONITORING, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING];
const labelCache = await buildLabelCache(gmail);

console.log('\n📁 By Label:');
const labelCounts = await Promise.all(
  labels.map(async label => {
    const labelId = labelCache.get(label);
    if (!labelId) return { label, count: 0 };
    const result = await gmail.users.messages.list({
      userId: USER_ID,
      q: `label:${labelId} is:unread`
    });
    return { label, count: result.data.resultSizeEstimate };
  })
);
for (const { label, count } of labelCounts) {
  console.log(`  ${label}: ${count}`);
}
