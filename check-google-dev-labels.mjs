import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';
import { getHeader } from './lib/email-utils.mjs';

const gmail = createGmailClient();

const searchResp = await gmail.users.messages.list({
  userId: USER_ID,
  q: 'from:"no-reply@discuss.google.dev"'
});

const messages = searchResp.data.messages || [];
console.log(`Found ${messages.length} Google Developer emails\n`);

if (messages.length > 0) {
  const labelsResp = await gmail.users.labels.list({ userId: USER_ID });
  const labelMap = {};
  labelsResp.data.labels.forEach(l => { labelMap[l.id] = l.name; });

  const sampleMsgs = await Promise.all(
    messages.slice(0, 3).map(msg =>
      gmail.users.messages.get({
        userId: USER_ID,
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject']
      })
    )
  );

  for (const msg of sampleMsgs) {
    const headers = msg.data.payload?.headers || [];
    const subject = getHeader(headers, 'Subject', '(no subject)');
    const labels = (msg.data.labelIds || []).map(id => labelMap[id]);

    console.log(`Subject: ${subject}`);
    console.log(`Labels: ${labels.join(', ')}\n`);
  }
}
