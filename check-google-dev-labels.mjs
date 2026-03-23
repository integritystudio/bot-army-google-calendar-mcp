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
