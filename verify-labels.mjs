import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');
const tokenFileData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
const accountMode = process.env.ACCOUNT_MODE || 'normal';
const tokenData = tokenFileData[accountMode];

const credPath = process.env.GOOGLE_OAUTH_CREDENTIALS || './credentials.json';
const credData = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
const oauth2Client = new OAuth2Client(
  credData.installed.client_id,
  credData.installed.client_secret,
  credData.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokenData);

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

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
