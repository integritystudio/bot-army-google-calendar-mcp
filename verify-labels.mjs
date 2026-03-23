import { createGmailClient } from './lib/gmail-client.mjs';

const gmail = createGmailClient();

console.log('Checking if labels were applied...\n');

// Check Meetup emails
const result = await gmail.users.messages.list({
  userId: 'me',
  q: 'from:info@email.meetup.com'
});

console.log(`Meetup emails found: ${result.data.resultSizeEstimate}`);

if (result.data.messages && result.data.messages.length > 0) {
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: result.data.messages[0].id
  });

  const labels = msg.data.labelIds || [];
  const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
  const labelMap = {};
  labelsResponse.data.labels.forEach(l => { labelMap[l.id] = l.name; });

  console.log(`Labels on first Meetup email: ${labels.map(id => labelMap[id]).join(', ')}`);

  // Check for Events label
  const hasEventsLabel = labels.some(id => labelMap[id] === 'Events');
  console.log(`Has 'Events' label: ${hasEventsLabel}\n`);

  // Check others
  const result2 = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:news@alphasignal.ai'
  });

  if (result2.data.messages && result2.data.messages.length > 0) {
    const msg2 = await gmail.users.messages.get({
      userId: 'me',
      id: result2.data.messages[0].id
    });

    const labels2 = msg2.data.labelIds || [];
    const hasProductLabel = labels2.some(id => labelMap[id] === 'Product Updates');
    console.log(`AlphaSignal email has 'Product Updates' label: ${hasProductLabel}`);
  }
}
