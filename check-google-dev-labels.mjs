import { createGmailClient } from './lib/gmail-client.mjs';

const gmail = createGmailClient();

const searchResp = await gmail.users.messages.list({
  userId: 'me',
  q: 'from:"no-reply@discuss.google.dev"'
});

const messages = searchResp.data.messages || [];
console.log(`Found ${messages.length} Google Developer emails\n`);

if (messages.length > 0) {
  const labelsResp = await gmail.users.labels.list({ userId: 'me' });
  const labelMap = {};
  labelsResp.data.labels.forEach(l => { labelMap[l.id] = l.name; });

  for (let i = 0; i < Math.min(3, messages.length); i++) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: messages[i].id,
      format: 'metadata',
      metadataHeaders: ['Subject']
    });

    const headers = msg.data.payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
    const labels = (msg.data.labelIds || []).map(id => labelMap[id]);

    console.log(`Subject: ${subject}`);
    console.log(`Labels: ${labels.join(', ')}\n`);
  }
}
