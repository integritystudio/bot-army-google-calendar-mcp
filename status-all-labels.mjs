import { createGmailClient } from './lib/gmail-client.mjs';

const gmail = createGmailClient();

console.log('📁 ALL LABELED EMAILS\n');

const labels = ['Sentry Alerts', 'Keep Important', 'Events', 'Monitoring', 'Product Updates', 'Communities', 'Services & Alerts', 'Billing'];
const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
const labelMap = {};
labelsResponse.data.labels.forEach(l => { labelMap[l.name] = l.id; });

for (const label of labels) {
  if (!labelMap[label]) {
    console.log(`${label}: 0 (label not found)`);
    continue;
  }

  const result = await gmail.users.messages.list({
    userId: 'me',
    q: `label:${labelMap[label]}`
  });

  const total = result.data.resultSizeEstimate || 0;

  // Check unread separately
  const unreadResult = await gmail.users.messages.list({
    userId: 'me',
    q: `label:${labelMap[label]} is:unread`
  });

  const unread = unreadResult.data.resultSizeEstimate || 0;

  console.log(`${label}: ${total} total, ${unread} unread`);
}
