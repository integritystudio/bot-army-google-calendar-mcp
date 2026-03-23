import { createGmailClient } from './lib/gmail-client.mjs';

const gmail = createGmailClient();

console.log('📊 QUICK STATUS\n');

// Get profile for total message count
const profile = await gmail.users.getProfile({ userId: 'me' });
console.log(`Total messages: ${profile.data.messagesTotal}`);
console.log(`Total threads: ${profile.data.threadsTotal}`);

// Count unread
const unreadResult = await gmail.users.messages.list({
  userId: 'me',
  q: 'is:unread'
});

console.log(`Unread (is:unread): ${unreadResult.data.resultSizeEstimate}`);

// Count in inbox
const inboxResult = await gmail.users.messages.list({
  userId: 'me',
  q: 'is:unread in:inbox'
});

console.log(`Unread in inbox: ${inboxResult.data.resultSizeEstimate}`);

// Count by category
const labels = ['Sentry Alerts', 'Keep Important', 'Events', 'Monitoring', 'Product Updates', 'Communities', 'Services & Alerts', 'Billing'];
const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
const labelMap = {};
labelsResponse.data.labels.forEach(l => { labelMap[l.name] = l.id; });

console.log('\n📁 By Label:');
for (const label of labels) {
  if (!labelMap[label]) continue;
  const result = await gmail.users.messages.list({
    userId: 'me',
    q: `label:${labelMap[label]} is:unread`
  });
  console.log(`  ${label}: ${result.data.resultSizeEstimate}`);
}
